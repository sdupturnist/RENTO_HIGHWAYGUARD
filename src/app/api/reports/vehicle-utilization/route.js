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
        const vehicleId = searchParams.get("vehicleId");
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
        if (vehicleId) {
            whereClause += " AND v.id = ?";
            params.push(parseInt(vehicleId));
        }

        const [vehicles] = await dbTenant(`
            SELECT v.*, vt.name as vehicleType_name
            FROM \`vehicles\` v
            LEFT JOIN \`vehicle_types\` vt ON vt.id = v.typeId
            ${whereClause}
            LIMIT ${Number(perPage)} OFFSET ${Number(offset)}
        `, params);

        const [[{ total }]] = await dbTenant(`SELECT COUNT(*) as total FROM \`vehicles\` v ${whereClause}`, params);

        const vehicleIds = (vehicles || []).map(v => v.id);
        let dtlStats = {};
        if (vehicleIds.length > 0) {
            const placeholders = vehicleIds.map(() => "?").join(",");
            const [dtlRows] = await dbTenant(`
                SELECT vehicleId,
                       COUNT(DISTINCT date) as assignedDays,
                       SUM(workedHours) as workedHours
                FROM \`daily_time_logs\`
                WHERE vehicleId IN (${placeholders})
                  AND blockType = 'VEHICLE'
                  AND date >= ? AND date <= ?
                GROUP BY vehicleId
            `, [...vehicleIds, startDateStr, endDateStr]);
            for (const row of dtlRows) {
                dtlStats[row.vehicleId] = row;
            }
        }

        const vehicleUtilization = (vehicles || []).map(v => {
            const stats = dtlStats[v.id] || {};
            const occupied = Number(stats.assignedDays) || 0;
            const utilizationPercent = periodDays > 0 ? (occupied / periodDays) * 100 : 0;
            return {
                vehicleCode: v.vehicleCode,
                vehicleType: v.vehicleType_name,
                assignedDays: occupied,
                workedHours: Number(stats.workedHours) || 0,
                utilizationPercent: utilizationPercent.toFixed(2),
                status: v.status,
            };
        });

        return NextResponse.json({
            vehicles: vehicleUtilization,
            total,
            page,
            perPage,
            totalPages: Math.ceil(total / perPage),
        });
    } catch (error) {
        console.error("Error fetching vehicle utilization report:", error);
        return NextResponse.json({ message: "Error fetching report data" }, { status: 500 });
    }
}
