import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const hasPermission = await verifySessionPermission(session, "Reports", "View");
        if (!hasPermission) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get("projectId");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        if (!projectId) {
            return NextResponse.json({ message: "projectId is required" }, { status: 400 });
        }

        const pid = parseInt(projectId);

        // 1. Project Overview
        const [[projectRows]] = await dbTenant(`
            SELECT p.id, p.projectCode, p.name, p.location, p.lpoNumber, p.status,
                   c.id as customer_id, c.companyName as customer_companyName
            FROM \`projects\` p
            LEFT JOIN \`customers\` c ON c.id = p.customerId
            WHERE p.id = ?
            LIMIT 1
        `, [pid]);

        if (!projectRows) {
            return NextResponse.json({ message: "Project not found" }, { status: 404 });
        }

        const project = {
            id: projectRows.id,
            projectCode: projectRows.projectCode,
            name: projectRows.name,
            location: projectRows.location,
            lpoNumber: projectRows.lpoNumber,
            status: projectRows.status,
            customer: { id: projectRows.customer_id, companyName: projectRows.customer_companyName },
        };

        // 2. Assignments with resource blocks
        const [assignmentRows] = await dbTenant(`
            SELECT id, assignmentCode, startDate, endDate, status
            FROM \`assignments\`
            WHERE projectId = ?
            ORDER BY startDate ASC
        `, [pid]);

        const assignments = [];
        for (const a of assignmentRows || []) {
            const [blockRows] = await dbTenant(`
                SELECT b.id, b.blockType, b.startDate, b.endDate,
                       b.quantity, b.billingCycle,
                       b.detourBlockId,
                       v.vehicleCode,
                       o.name AS operator_name,
                       m.name AS material_name,
                       l.labourType,
                       dt.name AS detour_name, dt.templateCode AS detour_code
                FROM \`assignment_blocks\` b
                LEFT JOIN \`vehicles\` v ON v.id = b.vehicleId
                LEFT JOIN \`operators\` o ON o.id = b.operatorId
                LEFT JOIN \`materials\` m ON m.id = b.materialId
                LEFT JOIN \`labours\` l ON l.id = b.labourTypeId
                LEFT JOIN \`detour_service_templates\` dt ON dt.id = b.detourTemplateId
                WHERE b.assignmentId = ?
                ORDER BY b.blockType, b.startDate ASC
            `, [a.id]);

            const vehicles = [];
            const operators = [];
            const materials = [];
            const labours = [];
            const detours = [];

            for (const b of blockRows || []) {
                if (b.blockType === "VEHICLE" && !b.detourBlockId) {
                    vehicles.push({ vehicleCode: b.vehicleCode, hourlyRate: b.hourlyRate, startDate: b.startDate, endDate: b.endDate });
                } else if (b.blockType === "OPERATOR" && !b.detourBlockId) {
                    operators.push({ name: b.operator_name, hourlyRate: b.hourlyRate, startDate: b.startDate, endDate: b.endDate });
                } else if (b.blockType === "MATERIAL" && !b.detourBlockId) {
                    materials.push({ name: b.material_name, quantity: b.quantity, dailyRate: b.dailyRate, startDate: b.startDate, endDate: b.endDate });
                } else if (b.blockType === "LABOUR" && !b.detourBlockId) {
                    labours.push({ labourType: b.labourType, quantity: b.quantity, dailyRate: b.dailyRate, startDate: b.startDate, endDate: b.endDate });
                } else if (b.blockType === "DETOUR" && !b.detourBlockId) {
                    detours.push({ name: b.detour_name, templateCode: b.detour_code, startDate: b.startDate, endDate: b.endDate });
                }
            }

            assignments.push({
                id: a.id,
                assignmentCode: a.assignmentCode,
                startDate: a.startDate,
                endDate: a.endDate,
                status: a.status,
                resources: { vehicles, operators, materials, labours, detours },
            });
        }

        // Date filters for timesheets, invoices, expenses
        const dateParams = [];
        let dateWhere = "";
        if (startDate) { dateWhere += " AND date_col >= ?"; dateParams.push(`${startDate.substring(0, 10)} 00:00:00`); }
        if (endDate) { dateWhere += " AND date_col <= ?"; dateParams.push(`${endDate.substring(0, 10)} 23:59:59`); }

        // 3. Timesheets
        const tsDateWhere = dateWhere.replace(/date_col/g, "t.periodStart");
        const [timesheetRows] = await dbTenant(`
            SELECT id, timesheetCode, periodStart, periodEnd, status, generatedAt
            FROM \`timesheets\` t
            WHERE projectId = ? ${tsDateWhere}
            ORDER BY periodStart DESC
        `, [pid, ...dateParams]);

        // 4. Invoices
        const invDateWhere = dateWhere.replace(/date_col/g, "i.date");
        const [invoiceRows] = await dbTenant(`
            SELECT i.id, i.invoiceNumber, i.date, i.dueDate, i.status, i.grandTotal as totalAmount
            FROM \`invoices\` i
            WHERE i.projectId = ? ${invDateWhere}
            ORDER BY i.date DESC
        `, [pid, ...dateParams]);

        // 5. Expenses — direct (projectId) + assignment-linked
        const expDateWhere = dateWhere.replace(/date_col/g, "e.date");
        const assignmentIds = (assignmentRows || []).map(a => a.id);
        let expensesQuery;
        let expensesParams;

        if (assignmentIds.length > 0) {
            const placeholders = assignmentIds.map(() => "?").join(",");
            expensesQuery = `
                SELECT DISTINCT e.id, e.expenseCode, e.date, e.amount, e.status, e.description,
                       et.name AS expenseType_name,
                       v.vehicleCode,
                       o.name AS operator_name,
                       a.assignmentCode
                FROM \`expenses\` e
                LEFT JOIN \`expense_types\` et ON et.id = e.expenseTypeId
                LEFT JOIN \`vehicles\` v ON v.id = e.vehicleId
                LEFT JOIN \`operators\` o ON o.id = e.operatorId
                LEFT JOIN \`assignments\` a ON a.id = e.assignmentId
                WHERE (e.projectId = ? OR e.assignmentId IN (${placeholders})) ${expDateWhere}
                ORDER BY e.date DESC
            `;
            expensesParams = [pid, ...assignmentIds, ...dateParams];
        } else {
            expensesQuery = `
                SELECT e.id, e.expenseCode, e.date, e.amount, e.status, e.description,
                       et.name AS expenseType_name,
                       v.vehicleCode,
                       o.name AS operator_name,
                       a.assignmentCode
                FROM \`expenses\` e
                LEFT JOIN \`expense_types\` et ON et.id = e.expenseTypeId
                LEFT JOIN \`vehicles\` v ON v.id = e.vehicleId
                LEFT JOIN \`operators\` o ON o.id = e.operatorId
                LEFT JOIN \`assignments\` a ON a.id = e.assignmentId
                WHERE e.projectId = ? ${expDateWhere}
                ORDER BY e.date DESC
            `;
            expensesParams = [pid, ...dateParams];
        }

        const [expenseRows] = await dbTenant(expensesQuery, expensesParams);

        const expenses = (expenseRows || []).map(e => ({
            id: e.id,
            expenseCode: e.expenseCode,
            date: e.date,
            amount: parseFloat(e.amount || 0),
            status: e.status,
            description: e.description,
            expenseType: { name: e.expenseType_name },
            vehicle: e.vehicleCode ? { vehicleCode: e.vehicleCode } : null,
            operator: e.operator_name ? { name: e.operator_name } : null,
            assignment: e.assignmentCode ? { assignmentCode: e.assignmentCode } : null,
        }));

        // 6. Summary
        const totalInvoiced = (invoiceRows || []).reduce((sum, i) => sum + parseFloat(i.totalAmount || 0), 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

        return NextResponse.json({
            project,
            assignments,
            timesheets: timesheetRows || [],
            invoices: (invoiceRows || []).map(i => ({ ...i, totalAmount: parseFloat(i.totalAmount || 0) })),
            expenses,
            summary: {
                totalAssignments: (assignmentRows || []).length,
                totalTimesheets: (timesheetRows || []).length,
                totalInvoiced,
                totalExpenses,
            },
        });
    } catch (error) {
        console.error("Error fetching project report:", error);
        return NextResponse.json({ message: "Error fetching project report", details: error.message }, { status: 500 });
    }
}
