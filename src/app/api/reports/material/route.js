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
        const materialId = searchParams.get("materialId");

        let whereClause = "WHERE d.blockType = 'MATERIAL'";
        const params = [];

        if (dateFrom) { whereClause += " AND d.date >= ?"; params.push(`${dateFrom.substring(0, 10)} 00:00:00`); }
        if (dateTo) { whereClause += " AND d.date <= ?"; params.push(`${dateTo.substring(0, 10)} 23:59:59.999`); }
        if (customerId) { whereClause += " AND d.customerId = ?"; params.push(parseInt(customerId)); }
        if (projectId) { whereClause += " AND d.projectId = ?"; params.push(parseInt(projectId)); }
        if (materialId) { whereClause += " AND d.materialId = ?"; params.push(parseInt(materialId)); }

        const [rows] = await dbTenant(`
            SELECT
                mat.id as materialId,
                mat.name as materialName,
                c.companyName,
                p.name as projectName,
                SUM(d.quantity) as totalQuantity,
                COUNT(DISTINCT d.date) as deployedDays,
                MIN(d.date) as firstDate,
                MAX(d.date) as lastDate
            FROM \`daily_time_logs\` d
            LEFT JOIN \`materials\` mat ON mat.id = d.materialId
            LEFT JOIN \`customers\` c ON c.id = d.customerId
            LEFT JOIN \`projects\` p ON p.id = d.projectId
            ${whereClause}
            GROUP BY mat.id, mat.name, d.customerId, c.companyName, d.projectId, p.name
            ORDER BY mat.name ASC, c.companyName ASC
        `, params);

        return NextResponse.json({ rows: rows || [] });
    } catch (error) {
        console.error("Error fetching material report:", error);
        return NextResponse.json({ message: "Error fetching report data" }, { status: 500 });
    }
}
