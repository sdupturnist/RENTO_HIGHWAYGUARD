import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const canView = await verifySessionPermission(session, "Reports", "View") || await verifySessionPermission(session, "Expenses", "View");
        if (!canView) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const dateFrom = searchParams.get("startDate");
        const dateTo = searchParams.get("endDate");
        const expenseTypeId = searchParams.get("expenseTypeId");
        const vehicleId = searchParams.get("vehicleId");
        const status = searchParams.get("status");

        let whereClause = "WHERE 1=1";
        const params = [];

        if (expenseTypeId) {
            whereClause += " AND e.expenseTypeId = ?";
            params.push(parseInt(expenseTypeId));
        }
        if (vehicleId) {
            whereClause += " AND e.vehicleId = ?";
            params.push(parseInt(vehicleId));
        }
        if (status) {
            whereClause += " AND e.status = ?";
            params.push(status);
        }
        if (dateFrom) {
            whereClause += " AND e.date >= ?";
            params.push(`${dateFrom.substring(0, 10)} 00:00:00`);
        }
        if (dateTo) {
            whereClause += " AND e.date <= ?";
            params.push(`${dateTo.substring(0, 10)} 23:59:59.999`);
        }

        const [expenses] = await dbTenant(`
            SELECT e.*, 
                   et.name as expenseType_name,
                   v.vehicleCode as vehicle_vehicleCode, v.ownership as vehicle_ownership,
                   o.name as operator_name,
                   p.name as project_name,
                   a.assignmentCode as assignment_assignmentCode
            FROM \`expenses\` e
            LEFT JOIN \`expense_types\` et ON et.id = e.expenseTypeId
            LEFT JOIN \`vehicles\` v ON v.id = e.vehicleId
            LEFT JOIN \`operators\` o ON o.id = e.operatorId
            LEFT JOIN \`projects\` p ON p.id = e.projectId
            LEFT JOIN \`assignments\` a ON a.id = e.assignmentId
            ${whereClause}
            ORDER BY e.date DESC
        `, params);

        let totalAmount = 0;
        const byType = {};
        const byMonth = {};

        const formatted = (expenses || []).map(exp => {
            const amt = parseFloat(exp.amount) || 0;
            totalAmount += amt;

            const typeName = exp.expenseType_name || "Unknown";
            byType[typeName] = (byType[typeName] || 0) + amt;

            const dStr = exp.date instanceof Date ? exp.date.toISOString() : String(exp.date);
            const monthStr = dStr.substring(0, 7);
            byMonth[monthStr] = (byMonth[monthStr] || 0) + amt;

            return {
                ...exp,
                expenseType: { name: exp.expenseType_name },
                vehicle: exp.vehicleId ? { vehicleCode: exp.vehicle_vehicleCode, ownership: exp.vehicle_ownership } : null,
                operator: exp.operatorId ? { name: exp.operator_name } : null,
                project: exp.projectId ? { name: exp.project_name } : null,
                assignment: exp.assignmentId ? { assignmentCode: exp.assignment_assignmentCode } : null
            };
        });

        return NextResponse.json({
            data: formatted,
            summary: {
                totalAmount,
                byType: Object.entries(byType).map(([name, amount]) => ({ name, amount })),
                byMonth: Object.entries(byMonth).map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month))
            }
        });
    } catch (error) {
        console.error("Error generating expense report:", error);
        return NextResponse.json({ message: "Error generating report" }, { status: 500 });
    }
}
