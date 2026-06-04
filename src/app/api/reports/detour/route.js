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
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");
        const customerId = searchParams.get("customerId");
        const projectId = searchParams.get("projectId");

        let whereClause = "WHERE d.detourBlockId IS NOT NULL";
        const params = [];

        if (dateFrom) { whereClause += " AND d.date >= ?"; params.push(`${dateFrom.substring(0, 10)} 00:00:00`); }
        if (dateTo) { whereClause += " AND d.date <= ?"; params.push(`${dateTo.substring(0, 10)} 23:59:59.999`); }
        if (customerId) { whereClause += " AND d.customerId = ?"; params.push(parseInt(customerId)); }
        if (projectId) { whereClause += " AND d.projectId = ?"; params.push(parseInt(projectId)); }

        const [rows] = await dbTenant(`
            SELECT
                ab.id as detourBlockId,
                dst.name as templateName,
                c.companyName,
                p.name as projectName,
                MIN(d.date) as startDate,
                MAX(d.date) as endDate,
                COUNT(DISTINCT d.date) as totalDays,
                SUM(CASE WHEN d.blockType IN ('VEHICLE', 'OPERATOR') THEN COALESCE(d.workedHours, 0) ELSE 0 END) as totalHours,
                SUM(CASE WHEN d.blockType IN ('VEHICLE', 'OPERATOR') THEN COALESCE(d.overtimeHours, 0) ELSE 0 END) as overtimeHours,
                COUNT(DISTINCT CASE WHEN d.blockType = 'VEHICLE' THEN d.vehicleId END) as vehicleCount,
                COUNT(DISTINCT CASE WHEN d.blockType IN ('VEHICLE', 'OPERATOR') THEN d.operatorId END) as operatorCount,
                COUNT(DISTINCT CASE WHEN d.blockType = 'MATERIAL' THEN d.materialId END) as materialCount,
                COUNT(DISTINCT CASE WHEN d.blockType = 'LABOUR' THEN d.labourTypeId END) as labourCount
            FROM \`daily_time_logs\` d
            JOIN \`assignment_blocks\` ab ON ab.id = d.detourBlockId
            LEFT JOIN \`detour_service_templates\` dst ON dst.id = ab.detourTemplateId
            LEFT JOIN \`customers\` c ON c.id = d.customerId
            LEFT JOIN \`projects\` p ON p.id = d.projectId
            ${whereClause}
            GROUP BY ab.id, dst.name, d.customerId, c.companyName, d.projectId, p.name
            ORDER BY MIN(d.date) DESC
        `, params);

        return NextResponse.json({ rows: rows || [] });
    } catch (error) {
        console.error("Error fetching detour report:", error);
        return NextResponse.json({ message: "Error fetching report data" }, { status: 500 });
    }
}
