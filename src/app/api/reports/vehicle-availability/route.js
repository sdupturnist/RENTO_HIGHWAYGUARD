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
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");
        const offset = (page - 1) * perPage;

        const rawDateFrom = dateFrom ? dateFrom.substring(0, 10) : new Date().toISOString().slice(0, 10);
        const rawDateTo = dateTo ? dateTo.substring(0, 10) : new Date().toISOString().slice(0, 10);
        const startDate = `${rawDateFrom} 00:00:00`;
        const endDate = `${rawDateTo} 23:59:59.999`;

        // Vehicles with no active assignments in the period
        const [vehicles] = await dbTenant(`
            SELECT v.*, vt.name as vehicleType_name,
                   (SELECT MAX(endDate) FROM \`assignment_blocks\` b WHERE b.vehicleId = v.id) as lastAssignmentEndDate
            FROM \`vehicles\` v
            LEFT JOIN \`vehicle_types\` vt ON vt.id = v.typeId
            WHERE NOT EXISTS (
                SELECT 1 FROM \`assignment_blocks\` b
                JOIN \`assignments\` a ON a.id = b.assignmentId
                WHERE b.vehicleId = v.id
                  AND a.status = 'ACTIVE'
                  AND b.status != 'STOPPED'
                  AND b.startDate <= ?
                  AND b.endDate >= ?
            )
            ORDER BY v.vehicleCode ASC
            LIMIT ${Number(perPage)} OFFSET ${Number(offset)}
        `, [endDate, startDate]);

        const [[{ total }]] = await dbTenant(`
            SELECT COUNT(*) as total
            FROM \`vehicles\` v
            WHERE NOT EXISTS (
                SELECT 1 FROM \`assignment_blocks\` b
                JOIN \`assignments\` a ON a.id = b.assignmentId
                WHERE b.vehicleId = v.id
                  AND a.status = 'ACTIVE'
                  AND b.status != 'STOPPED'
                  AND b.startDate <= ?
                  AND b.endDate >= ?
            )
        `, [endDate, startDate]);

        const availableVehicles = (vehicles || []).map((v) => ({
            vehicleCode: v.vehicleCode,
            vehicleType: v.vehicleType_name,
            lastAssignmentEndDate: v.lastAssignmentEndDate,
            availableFrom: v.lastAssignmentEndDate || v.createdAt,
            status: v.status,
        }));

        return NextResponse.json({
            vehicles: availableVehicles,
            total,
            page,
            perPage,
            totalPages: Math.ceil(total / perPage),
        });
    } catch (error) {
        console.error("Error fetching vehicle availability report:", error);
        return NextResponse.json({ message: "Error fetching report data" }, { status: 500 });
    }
}
