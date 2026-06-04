import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { startOfMonth, endOfMonth } from "date-fns";

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

        const rawDateFrom = dateFrom ? dateFrom.substring(0, 10) : formatDate(startOfMonth(new Date()));
        const rawDateTo = dateTo ? dateTo.substring(0, 10) : formatDate(endOfMonth(new Date()));
        const startDateStr = `${rawDateFrom} 00:00:00`;
        const endDateStr = `${rawDateTo} 23:59:59.999`;

        const [settingsRows] = await dbTenant("SELECT fullDayHours FROM `company_settings` LIMIT 1");
        const companySettings = settingsRows?.[0];
        const fullDayHours = Number(companySettings?.fullDayHours || 8);

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
        let otStats = {};
        if (operatorIds.length > 0) {
            const placeholders = operatorIds.map(() => "?").join(",");
            const [otRows] = await dbTenant(`
                SELECT operatorId,
                       SUM(workedHours) as totalWorkedHours,
                       SUM(overtimeHours) as overtimeHours,
                       SUM(isWeekend) as weekendDays,
                       SUM(isHoliday) as holidayDays
                FROM \`daily_time_logs\`
                WHERE operatorId IN (${placeholders})
                  AND date >= ? AND date <= ?
                GROUP BY operatorId
            `, [...operatorIds, startDateStr, endDateStr]);
            for (const row of otRows) {
                otStats[row.operatorId] = row;
            }
        }

        const operatorOvertimeSummary = (operators || []).map(o => {
            const stats = otStats[o.id] || {};
            return {
                operatorName: o.name,
                totalWorkedHours: Number(stats.totalWorkedHours || 0).toFixed(2),
                overtimeHours: Number(stats.overtimeHours || 0).toFixed(2),
                weekendDays: Number(stats.weekendDays || 0),
                holidayDays: Number(stats.holidayDays || 0),
            };
        });

        return NextResponse.json({
            operators: operatorOvertimeSummary,
            total,
            page,
            perPage,
            totalPages: Math.ceil(total / perPage),
        });
    } catch (error) {
        console.error("Error fetching operator overtime report:", error);
        return NextResponse.json({ message: "Error fetching report data" }, { status: 500 });
    }
}
