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
        const labourTypeId = searchParams.get("labourTypeId");

        let whereClause = "WHERE d.blockType = 'LABOUR'";
        const params = [];

        if (dateFrom) { whereClause += " AND d.date >= ?"; params.push(`${dateFrom.substring(0, 10)} 00:00:00`); }
        if (dateTo) { whereClause += " AND d.date <= ?"; params.push(`${dateTo.substring(0, 10)} 23:59:59.999`); }
        if (customerId) { whereClause += " AND d.customerId = ?"; params.push(parseInt(customerId)); }
        if (projectId) { whereClause += " AND d.projectId = ?"; params.push(parseInt(projectId)); }
        if (labourTypeId) { whereClause += " AND d.labourTypeId = ?"; params.push(parseInt(labourTypeId)); }

        const [rows] = await dbTenant(`
            SELECT
                lab.id as labourTypeId,
                lab.labourType as labourTypeName,
                c.companyName,
                p.name as projectName,
                SUM(d.quantity) as totalQuantity,
                COUNT(DISTINCT d.date) as deployedDays,
                MIN(d.date) as firstDate,
                MAX(d.date) as lastDate
            FROM \`daily_time_logs\` d
            LEFT JOIN \`labours\` lab ON lab.id = d.labourTypeId
            LEFT JOIN \`customers\` c ON c.id = d.customerId
            LEFT JOIN \`projects\` p ON p.id = d.projectId
            ${whereClause}
            GROUP BY lab.id, lab.labourType, d.customerId, c.companyName, d.projectId, p.name
            ORDER BY lab.labourType ASC, c.companyName ASC
        `, params);

        return NextResponse.json({ rows: rows || [] });
    } catch (error) {
        console.error("Error fetching labour report:", error);
        return NextResponse.json({ message: "Error fetching report data" }, { status: 500 });
    }
}
