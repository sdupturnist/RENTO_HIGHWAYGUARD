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
        const page = parseInt(searchParams.get("page") || "1") || 1;
        const perPage = parseInt(searchParams.get("perPage") || "50") || 50;
        const customerId = searchParams.get("customerId");
        const projectId = searchParams.get("projectId");
        const status = searchParams.get("status");
        const offset = (page - 1) * perPage;

        let whereClause = "WHERE 1=1";
        const params = [];

        if (customerId) {
            whereClause += " AND t.customerId = ?";
            params.push(parseInt(customerId));
        }
        if (projectId) {
            whereClause += " AND t.projectId = ?";
            params.push(parseInt(projectId));
        }
        if (status) {
            whereClause += " AND t.status = ?";
            params.push(status);
        }

        const [timesheets] = await dbTenant(`
            SELECT t.*, c.companyName as customer_companyName, p.name as project_name
            FROM \`timesheets\` t
            LEFT JOIN \`customers\` c ON c.id = t.customerId
            LEFT JOIN \`projects\` p ON p.id = t.projectId
            ${whereClause}
            ORDER BY t.createdAt DESC
            LIMIT ${Number(perPage)} OFFSET ${Number(offset)}
        `, params);

        const [[{ total }]] = await dbTenant(`SELECT COUNT(*) as total FROM \`timesheets\` t ${whereClause}`, params);

        const timesheetIds = (timesheets || []).map(ts => ts.id);
        let lineStats = {};
        if (timesheetIds.length > 0) {
            const placeholders = timesheetIds.map(() => "?").join(",");
            const [lineRows] = await dbTenant(
                `SELECT timesheetId, vehicleId, operatorId, totalHours FROM \`timesheet_lines\` WHERE timesheetId IN (${placeholders})`,
                timesheetIds
            );
            for (const l of lineRows) {
                if (!lineStats[l.timesheetId]) lineStats[l.timesheetId] = { vehicles: new Set(), operators: new Set(), hours: 0 };
                if (l.vehicleId) lineStats[l.timesheetId].vehicles.add(l.vehicleId);
                if (l.operatorId) lineStats[l.timesheetId].operators.add(l.operatorId);
                lineStats[l.timesheetId].hours += Number(l.totalHours) || 0;
            }
        }

        const formattedTimesheets = (timesheets || []).map(ts => ({
            ...ts,
            customer: { companyName: ts.customer_companyName },
            project: { name: ts.project_name },
            totalVehicles: lineStats[ts.id]?.vehicles.size ?? 0,
            totalOperators: lineStats[ts.id]?.operators.size ?? 0,
            totalWorkedHours: lineStats[ts.id]?.hours ?? 0,
        }));

        return NextResponse.json({
            timesheets: formattedTimesheets,
            total,
            page,
            perPage,
            totalPages: Math.ceil(total / perPage),
        });
    } catch (error) {
        console.error("Error fetching timesheets report:", error);
        return NextResponse.json({ message: "Error fetching report data" }, { status: 500 });
    }
}
