import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { startOfMonth, endOfMonth, differenceInDays } from "date-fns";

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const hasPermission = await verifySessionPermission(session, "Reports", "View");
        if (!hasPermission) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1") || 1;
        const perPage = parseInt(searchParams.get("perPage") || "50") || 50;
        const operatorId = searchParams.get("operatorId");
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");
        const offset = (page - 1) * perPage;

        const formatDate = (date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        const parseLocalDate = (dateStr) => {
            const [y, m, d] = dateStr.split("-").map(Number);
            return new Date(y, m - 1, d);
        };

        const rawDateFrom = dateFrom ? dateFrom.substring(0, 10) : formatDate(startOfMonth(new Date()));
        const rawDateTo = dateTo ? dateTo.substring(0, 10) : formatDate(endOfMonth(new Date()));
        const startDateStr = `${rawDateFrom} 00:00:00`;
        const endDateStr = `${rawDateTo} 23:59:59.999`;
        const periodDays = differenceInDays(parseLocalDate(endDateStr), parseLocalDate(startDateStr)) + 1;

        let whereClause = "WHERE 1=1";
        const params = [];
        if (operatorId) {
            whereClause += " AND o.id = ?";
            params.push(parseInt(operatorId));
        }

        const [operators] = await dbTenant(`
            SELECT o.* FROM \`operators\` o
            ${whereClause}
            LIMIT ${Number(perPage)} OFFSET ${Number(offset)}
        `, params);

        const [[{ total }]] = await dbTenant(`SELECT COUNT(*) as total FROM \`operators\` o ${whereClause}`, params);

        const operatorIds = (operators || []).map(o => o.id);
        let opStats = {};
        if (operatorIds.length > 0) {
            const placeholders = operatorIds.map(() => "?").join(",");
            const [dtlRows] = await dbTenant(`
                SELECT operatorId,
                       COUNT(DISTINCT date) as assignedDays,
                       SUM(workedHours) as workedHours
                FROM \`daily_time_logs\`
                WHERE operatorId IN (${placeholders})
                  AND date >= ? AND date <= ?
                GROUP BY operatorId
            `, [...operatorIds, startDateStr, endDateStr]);
            for (const row of dtlRows) {
                opStats[row.operatorId] = row;
            }
        }

        const operatorUtilization = (operators || []).map(o => {
            const stats = opStats[o.id] || {};
            const occupied = Number(stats.assignedDays) || 0;
            return {
                operatorName: o.name,
                assignedDays: occupied,
                workedHours: Number(stats.workedHours) || 0,
                utilizationPercent: periodDays > 0 ? ((occupied / periodDays) * 100).toFixed(2) : "0.00",
            };
        });

        return NextResponse.json({
            operators: operatorUtilization,
            total,
            page,
            perPage,
            totalPages: Math.ceil(total / perPage),
        });
    } catch (error) {
        console.error("Error fetching operator utilization report:", error);
        return NextResponse.json({ message: "Error fetching report data" }, { status: 500 });
    }
}
