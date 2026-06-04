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

        const [csRows] = await dbTenant("SELECT fullDayHours FROM `company_settings` LIMIT 1");
        const fullDayHours = Number(csRows?.[0]?.fullDayHours || 8);

        let whereClause = "WHERE t.isInternal = 0";
        const params = [];

        if (dateFrom) { whereClause += " AND t.periodStart >= ?"; params.push(`${dateFrom.substring(0, 10)} 00:00:00`); }
        if (dateTo) { whereClause += " AND t.periodEnd <= ?"; params.push(`${dateTo.substring(0, 10)} 23:59:59.999`); }
        if (customerId) { whereClause += " AND t.customerId = ?"; params.push(parseInt(customerId)); }
        if (projectId) { whereClause += " AND t.projectId = ?"; params.push(parseInt(projectId)); }

        const [rows] = await dbTenant(`
            SELECT
                t.id as timesheetId,
                t.timesheetCode,
                t.periodStart,
                t.periodEnd,
                t.status,
                c.companyName,
                p.name as projectName,
                SUM(tl.calculatedAmount) as totalBilled,
                SUM(
                    CASE
                        WHEN tl.blockType IN ('MATERIAL', 'LABOUR')
                            THEN tl.rateSnapshot * COALESCE(tl.quantity, 0)
                        ELSE
                            tl.rateSnapshot * (COALESCE(tl.totalHours, 0) / ${fullDayHours})
                    END
                ) as estimatedCost,
                COUNT(tl.id) as lineCount
            FROM \`timesheets\` t
            JOIN \`timesheet_lines\` tl ON tl.timesheetId = t.id
            LEFT JOIN \`customers\` c ON c.id = t.customerId
            LEFT JOIN \`projects\` p ON p.id = t.projectId
            ${whereClause}
            GROUP BY t.id, t.timesheetCode, t.periodStart, t.periodEnd, t.status, c.companyName, p.name
            ORDER BY t.periodStart DESC
        `, params);

        const enriched = (rows || []).map(r => {
            const billed = Number(r.totalBilled || 0);
            const cost = Number(r.estimatedCost || 0);
            const profit = billed - cost;
            const margin = billed > 0 ? (profit / billed) * 100 : 0;
            return {
                ...r,
                totalBilled: billed,
                estimatedCost: cost,
                profit,
                marginPercent: parseFloat(margin.toFixed(2)),
            };
        });

        return NextResponse.json({ rows: enriched });
    } catch (error) {
        console.error("Error fetching profitability report:", error);
        return NextResponse.json({ message: "Error fetching report data" }, { status: 500 });
    }
}
