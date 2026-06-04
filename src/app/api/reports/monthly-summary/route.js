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
        const year = searchParams.get("year");
        const customerId = searchParams.get("customerId");
        const projectId = searchParams.get("projectId");
        const isInternal = searchParams.get("isInternal");

        let whereClause = "WHERE 1=1";
        const params = [];

        if (year) {
            whereClause += " AND YEAR(d.date) = ?";
            params.push(parseInt(year));
        }
        if (customerId) { whereClause += " AND d.customerId = ?"; params.push(parseInt(customerId)); }
        if (projectId) { whereClause += " AND d.projectId = ?"; params.push(parseInt(projectId)); }
        if (isInternal === "true") { whereClause += " AND d.isInternal = 1"; }
        else if (isInternal === "false") { whereClause += " AND d.isInternal = 0"; }

        const [rows] = await dbTenant(`
            SELECT
                DATE_FORMAT(d.date, '%Y-%m') as monthKey,
                DATE_FORMAT(d.date, '%b %Y') as monthLabel,
                SUM(COALESCE(d.regularHours, 0)) as regularHours,
                SUM(COALESCE(d.overtimeHours, 0)) as overtimeHours,
                SUM(COALESCE(d.holidayHours, 0)) as holidayHours,
                SUM(COALESCE(d.workedHours, 0)) as totalHours,
                COUNT(DISTINCT CASE WHEN d.blockType = 'VEHICLE' OR d.blockType IS NULL THEN d.vehicleId END) as vehicleCount,
                COUNT(DISTINCT CASE WHEN d.blockType IN ('VEHICLE', 'OPERATOR') AND d.operatorId IS NOT NULL THEN d.operatorId END) as operatorCount,
                SUM(CASE WHEN d.blockType = 'MATERIAL' THEN COALESCE(d.quantity, 0) ELSE 0 END) as materialQty,
                SUM(CASE WHEN d.blockType = 'LABOUR' THEN COALESCE(d.quantity, 0) ELSE 0 END) as labourQty,
                COUNT(DISTINCT d.assignmentId) as assignmentCount,
                COUNT(DISTINCT CASE WHEN d.isInternal = 0 THEN d.customerId END) as customerCount
            FROM \`daily_time_logs\` d
            ${whereClause}
            GROUP BY DATE_FORMAT(d.date, '%Y-%m'), DATE_FORMAT(d.date, '%b %Y')
            ORDER BY monthKey DESC
        `, params);

        return NextResponse.json({
            rows: (rows || []).map(r => ({
                ...r,
                regularHours: Number(r.regularHours || 0),
                overtimeHours: Number(r.overtimeHours || 0),
                holidayHours: Number(r.holidayHours || 0),
                totalHours: Number(r.totalHours || 0),
                materialQty: Number(r.materialQty || 0),
                labourQty: Number(r.labourQty || 0),
            })),
        });
    } catch (error) {
        console.error("Error fetching monthly summary report:", error);
        return NextResponse.json({ message: "Error fetching report data" }, { status: 500 });
    }
}
