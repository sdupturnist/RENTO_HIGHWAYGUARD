import { NextResponse } from "next/server";
import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { generateExpenseCode } from "@/app/lib/expense-utils";
import { logActivity } from "@/app/lib/logger";

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canView = await verifySessionPermission(session, "Expenses", "View");
        if (!canView) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1") || 1;
        const perPage = parseInt(searchParams.get("perPage") || "50") || 50;
        const vehicleId = searchParams.get("vehicleId");
        const expenseTypeId = searchParams.get("expenseTypeId");
        const status = searchParams.get("status");
        const projectId = searchParams.get("projectId");
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");

        const offset = (page - 1) * perPage;

        let query = `
            SELECT e.*, 
                   et.name as expenseType_name, 
                   v.vehicleCode as vehicle_vehicleCode,
                   o.name as operator_name, o.operatorCode as operator_operatorCode,
                   p.name as project_name, p.projectCode as project_projectCode,
                   a.assignmentCode as assignment_assignmentCode
            FROM \`expenses\` e
            LEFT JOIN \`expense_types\` et ON et.id = e.expenseTypeId
            LEFT JOIN \`vehicles\` v ON v.id = e.vehicleId
            LEFT JOIN \`operators\` o ON o.id = e.operatorId
            LEFT JOIN \`projects\` p ON p.id = e.projectId
            LEFT JOIN \`assignments\` a ON a.id = e.assignmentId
        `;
        const params = [];
        const whereClauses = [];

        if (vehicleId) { whereClauses.push("e.vehicleId = ?"); params.push(parseInt(vehicleId)); }
        if (expenseTypeId) { whereClauses.push("e.expenseTypeId = ?"); params.push(parseInt(expenseTypeId)); }
        if (status) { whereClauses.push("e.status = ?"); params.push(status); }
        if (projectId) { whereClauses.push("e.projectId = ?"); params.push(parseInt(projectId)); }
        if (dateFrom) { whereClauses.push("e.date >= ?"); params.push(`${dateFrom.substring(0, 10)} 00:00:00`); }
        if (dateTo) { whereClauses.push("e.date <= ?"); params.push(`${dateTo.substring(0, 10)} 23:59:59.999`); }

        if (whereClauses.length > 0) {
            query += " WHERE " + whereClauses.join(" AND ");
        }

        query += ` ORDER BY e.date DESC LIMIT ${Number(perPage)} OFFSET ${Number(offset)}`;

        const [expenses] = await dbTenant(query, params);

        let countQuery = "SELECT COUNT(*) as total FROM \`expenses\` e";
        if (whereClauses.length > 0) {
            countQuery += " WHERE " + whereClauses.join(" AND ");
        }
        const [[{ total }]] = await dbTenant(countQuery, params);

        const formattedExpenses = (expenses || []).map(e => ({
            ...e,
            expenseType: { name: e.expenseType_name },
            vehicle: e.vehicleId ? { vehicleCode: e.vehicle_vehicleCode } : null,
            operator: e.operatorId ? { name: e.operator_name, operatorCode: e.operator_operatorCode } : null,
            project: e.projectId ? { name: e.project_name, projectCode: e.project_projectCode } : null,
            assignment: e.assignmentId ? { assignmentCode: e.assignment_assignmentCode } : null
        }));

        return NextResponse.json({
            expenses: formattedExpenses,
            total,
            page,
            perPage,
            totalPages: Math.ceil(total / perPage),
        });
    } catch (error) {
        console.error("Error fetching expenses:", error);
        return NextResponse.json({ message: "Error fetching expenses" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canCreate = await verifySessionPermission(session, "Expenses", "Create");
        if (!canCreate) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const body = await request.json();
        const {
            expenseTypeId, date, amount, status,
            vehicleId, operatorId, projectId, assignmentId,
            description, attachmentUrl
        } = body;

        if (!expenseTypeId || !date || amount === undefined || amount === null) {
            return NextResponse.json({ message: "Type, Date, and Amount are required" }, { status: 400 });
        }

        let createdExpense;
        await withTenantTransaction(async (tx) => {
            const expenseCode = await generateExpenseCode(tx);
            const [res] = await tx.execute(`
                INSERT INTO \`expenses\` (
                    expenseCode, expenseTypeId, date, amount, status, 
                    vehicleId, operatorId, projectId, assignmentId, 
                    description, attachmentUrl, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
                expenseCode, parseInt(expenseTypeId), new Date(date), parseFloat(amount), status || "DRAFT",
                vehicleId ? parseInt(vehicleId) : null,
                operatorId ? parseInt(operatorId) : null,
                projectId ? parseInt(projectId) : null,
                assignmentId ? parseInt(assignmentId) : null,
                description || null,
                attachmentUrl || null
            ]);
            
            const [rows] = await tx.execute(`
                SELECT e.*, et.name as expenseType_name 
                FROM \`expenses\` e 
                LEFT JOIN \`expense_types\` et ON et.id = e.expenseTypeId 
                WHERE e.id = ?
            `, [res.insertId]);
            createdExpense = rows[0];
            createdExpense.expenseType = { name: createdExpense.expenseType_name };
        });

        await logActivity("EXPENSES", createdExpense.id, "CREATE", `Created expense ${createdExpense.expenseCode} with amount ${amount}`);

        return NextResponse.json(createdExpense, { status: 201 });
    } catch (error) {
        console.error("Error creating expense:", error);
        return NextResponse.json({ message: "Error creating expense" }, { status: 500 });
    }
}
