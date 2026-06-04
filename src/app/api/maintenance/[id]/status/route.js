import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";

export async function PATCH(request, { params }) {
    try {
        const resolvedParams = await params;
        const { id } = resolvedParams;
        if (!id)
            return NextResponse.json({ message: "ID is missing" }, { status: 400 });

        const maintenanceId = parseInt(id);
        if (isNaN(maintenanceId))
            return NextResponse.json({ message: "Invalid ID format" }, { status: 400 });

        const session = await getSession();
        if (!session)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const hasPermission = await verifySessionPermission(session, "Maintenance", "Edit");
        if (!hasPermission)
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const body = await request.json();
        const { status } = body;
        if (!status)
            return NextResponse.json({ message: "Status is required" }, { status: 400 });

        const [rows] = await dbTenant(`SELECT * FROM \`maintenances\` WHERE id = ? LIMIT 1`, [maintenanceId]);
        if (!rows || rows.length === 0)
            return NextResponse.json({ message: "Maintenance not found" }, { status: 404 });

        const existing = rows[0];

        // Business logic: completing sets endDate if not set; non-completing clears endDate
        const endDate = status === "COMPLETED"
            ? (existing.endDate || new Date())
            : null;

        await dbTenant(
            `UPDATE \`maintenances\` SET status = ?, endDate = ?, updatedAt = NOW() WHERE id = ?`,
            [status, endDate, maintenanceId]
        );

        const [updRows] = await dbTenant(`
            SELECT m.*, v.vehicleCode, mt.name as maintenanceType_name
            FROM \`maintenances\` m
            LEFT JOIN \`vehicles\` v ON v.id = m.vehicleId
            LEFT JOIN \`maintenance_types\` mt ON mt.id = m.maintenanceTypeId
            WHERE m.id = ? LIMIT 1
        `, [maintenanceId]);

        await logActivity("MAINTENANCE", maintenanceId, "STATUS_CHANGE", `Changed status from ${existing.status} to ${status}`);
        return NextResponse.json({
            ...updRows[0],
            vehicle: { vehicleCode: updRows[0].vehicleCode },
            maintenanceType: { name: updRows[0].maintenanceType_name },
        });
    } catch (error) {
        console.error("Error updating maintenance status:", error);
        return NextResponse.json({ message: error?.message || "Error updating maintenance status" }, { status: 500 });
    }
}
