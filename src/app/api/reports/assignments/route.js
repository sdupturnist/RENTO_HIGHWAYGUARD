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
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");
        const offset = (page - 1) * perPage;

        let whereClause = "WHERE 1=1";
        const params = [];

        if (customerId) {
            whereClause += " AND a.customerId = ?";
            params.push(parseInt(customerId));
        }
        if (projectId) {
            whereClause += " AND a.projectId = ?";
            params.push(parseInt(projectId));
        }
        if (status) {
            whereClause += " AND a.status = ?";
            params.push(status);
        }
        if (dateFrom) {
            whereClause += " AND a.startDate >= ?";
            params.push(`${dateFrom.substring(0, 10)} 00:00:00`);
        }
        if (dateTo) {
            whereClause += " AND a.endDate <= ?";
            params.push(`${dateTo.substring(0, 10)} 23:59:59.999`);
        }

        const [assignments] = await dbTenant(`
            SELECT a.*, c.companyName as customer_companyName, p.name as project_name
            FROM \`assignments\` a
            LEFT JOIN \`customers\` c ON c.id = a.customerId
            LEFT JOIN \`projects\` p ON p.id = a.projectId
            ${whereClause}
            ORDER BY a.startDate DESC
            LIMIT ${Number(perPage)} OFFSET ${Number(offset)}
        `, params);

        const [[{ total }]] = await dbTenant(`SELECT COUNT(*) as total FROM \`assignments\` a ${whereClause}`, params);

        const assignmentIds = (assignments || []).map(a => a.id);
        let blockStats = {};
        if (assignmentIds.length > 0) {
            const placeholders = assignmentIds.map(() => "?").join(",");
            const [blockRows] = await dbTenant(
                `SELECT assignmentId, vehicleId, operatorId FROM \`assignment_blocks\` WHERE assignmentId IN (${placeholders})`,
                assignmentIds
            );
            for (const b of blockRows) {
                if (!blockStats[b.assignmentId]) blockStats[b.assignmentId] = { vehicles: new Set(), operators: new Set() };
                if (b.vehicleId) blockStats[b.assignmentId].vehicles.add(b.vehicleId);
                if (b.operatorId) blockStats[b.assignmentId].operators.add(b.operatorId);
            }
        }

        const formattedAssignments = (assignments || []).map(a => ({
            ...a,
            customer: a.customerId ? { companyName: a.customer_companyName } : null,
            project: a.projectId ? { name: a.project_name } : null,
            totalVehicles: blockStats[a.id]?.vehicles.size ?? 0,
            totalOperators: blockStats[a.id]?.operators.size ?? 0,
        }));

        return NextResponse.json({
            assignments: formattedAssignments,
            total,
            page,
            perPage,
            totalPages: Math.ceil(total / perPage),
        });
    } catch (error) {
        console.error("Error fetching assignments report:", error);
        return NextResponse.json({ message: "Error fetching report data" }, { status: 500 });
    }
}
