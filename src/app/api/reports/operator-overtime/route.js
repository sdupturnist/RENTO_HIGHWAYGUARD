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

        const [settingsRows] = await dbTenant("SELECT fullDayHours, overtimeStartsAfter FROM `company_settings` LIMIT 1");
        const companySettings = settingsRows?.[0];
        const fullDayHours = Number(companySettings?.fullDayHours || 8);
        const overtimeStartsAfter = Number(companySettings?.overtimeStartsAfter ?? fullDayHours);

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
                SELECT dtl.operatorId, dtl.workedHours, dtl.isWeekend, dtl.isHoliday,
                       p.fullDayHours as proj_fullDayHours, p.overtimeStartsAfter as proj_overtimeStartsAfter
                FROM \`daily_time_logs\` dtl
                LEFT JOIN \`projects\` p ON p.id = dtl.projectId
                WHERE dtl.operatorId IN (${placeholders})
                  AND dtl.date >= ? AND dtl.date <= ?
            `, [...operatorIds, startDateStr, endDateStr]);
            for (const row of otRows) {
                const opId = row.operatorId;
                const worked = Number(row.workedHours || 0);
                
                // Resolve limit: use project overrides if specified, otherwise fall back to global settings
                let limit = overtimeStartsAfter;
                if (row.proj_overtimeStartsAfter !== null) {
                    limit = Number(row.proj_overtimeStartsAfter);
                } else if (row.proj_fullDayHours !== null) {
                    limit = Number(row.proj_fullDayHours);
                }

                let opRegular = 0, opOvertime = 0, opHoliday = 0;
                
                if (row.isHoliday) opHoliday = worked;
                else if (row.isWeekend) opOvertime = worked;
                else {
                    opRegular = Math.min(worked, limit);
                    opOvertime = Math.max(0, worked - limit);
                }
                
                if (!otStats[opId]) {
                    otStats[opId] = {
                        totalWorkedHours: 0,
                        overtimeHours: 0,
                        weekendDays: 0,
                        holidayDays: 0
                    };
                }
                otStats[opId].totalWorkedHours += worked;
                otStats[opId].overtimeHours += opOvertime;
                if (row.isWeekend) otStats[opId].weekendDays += 1;
                if (row.isHoliday) otStats[opId].holidayDays += 1;
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
