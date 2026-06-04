import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { validateMaintenanceCost } from "@/app/lib/maintenance-utils";
import { logActivity } from "@/app/lib/logger";

export async function GET(request, { params }) {
    try {
        const session = await getSession();
        if (!session)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canView = await verifySessionPermission(session, "Maintenance", "View");
        if (!canView)
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const { id } = await params;
        const [rows] = await dbTenant(`
            SELECT m.*,
                   v.id as vehicle_id, v.vehicleCode, v.ownership,
                   vt.name as vehicleType_name,
                   mt.id as maintenanceType_id, mt.name as maintenanceType_name
            FROM \`maintenances\` m
            LEFT JOIN \`vehicles\` v ON v.id = m.vehicleId
            LEFT JOIN \`vehicle_types\` vt ON vt.id = v.typeId
            LEFT JOIN \`maintenance_types\` mt ON mt.id = m.maintenanceTypeId
            WHERE m.id = ? LIMIT 1
        `, [parseInt(id)]);

        if (!rows || rows.length === 0)
            return NextResponse.json({ message: "Maintenance not found" }, { status: 404 });

        const row = rows[0];
        return NextResponse.json({
            ...row,
            vehicle: { id: row.vehicle_id, vehicleCode: row.vehicleCode, ownership: row.ownership, vehicleType: { name: row.vehicleType_name } },
            maintenanceType: { id: row.maintenanceType_id, name: row.maintenanceType_name },
        });
    } catch (error) {
        console.error("Error fetching maintenance:", error);
        return NextResponse.json({ message: "Error fetching maintenance" }, { status: 500 });
    }
}

export async function PUT(request, { params }) {
    try {
        const session = await getSession();
        if (!session)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canEdit = await verifySessionPermission(session, "Maintenance", "Edit");
        if (!canEdit)
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const body = await request.json();
        const { maintenanceTypeId, description, startDate, endDate, amount, status } = body;
        const { id } = await params;
        const maintenanceId = parseInt(id);

        // Fetch existing with vehicle ownership
        const [existRows] = await dbTenant(`
            SELECT m.*, v.ownership FROM \`maintenances\` m
            LEFT JOIN \`vehicles\` v ON v.id = m.vehicleId
            WHERE m.id = ? LIMIT 1
        `, [maintenanceId]);

        if (!existRows || existRows.length === 0)
            return NextResponse.json({ message: "Maintenance not found" }, { status: 404 });

        const existing = existRows[0];

        // Validate cost
        const costValidation = validateMaintenanceCost(existing.ownership, amount);
        if (!costValidation.valid)
            return NextResponse.json({ message: costValidation.error }, { status: 400 });

        const fields = [];
        const values = [];
        if (maintenanceTypeId !== undefined) { fields.push("maintenanceTypeId = ?"); values.push(parseInt(maintenanceTypeId)); }
        if (description !== undefined) { fields.push("description = ?"); values.push(description); }
        if (startDate !== undefined) { fields.push("startDate = ?"); values.push(new Date(startDate)); }
        fields.push("endDate = ?"); values.push(endDate ? new Date(endDate) : null);
        if (amount !== undefined) { fields.push("amount = ?"); values.push(amount ? parseFloat(amount) : null); }
        if (status !== undefined) { fields.push("status = ?"); values.push(status); }
        fields.push("updatedAt = NOW()");

        await dbTenant(`UPDATE \`maintenances\` SET ${fields.join(", ")} WHERE id = ?`, [...values, maintenanceId]);

        const [updRows] = await dbTenant(`
            SELECT m.*, v.vehicleCode, v.ownership, mt.name as maintenanceType_name
            FROM \`maintenances\` m
            LEFT JOIN \`vehicles\` v ON v.id = m.vehicleId
            LEFT JOIN \`maintenance_types\` mt ON mt.id = m.maintenanceTypeId
            WHERE m.id = ? LIMIT 1
        `, [maintenanceId]);
        const upd = updRows[0];

        await logActivity("MAINTENANCE", maintenanceId, "UPDATE", `Maintenance ${upd.maintenanceCode} updated`);
        return NextResponse.json({
            ...upd,
            vehicle: { vehicleCode: upd.vehicleCode, ownership: upd.ownership },
            maintenanceType: { name: upd.maintenanceType_name },
        });
    } catch (error) {
        console.error("Error updating maintenance:", error);
        return NextResponse.json({ message: "Error updating maintenance" }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        const session = await getSession();
        if (!session)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canDelete = await verifySessionPermission(session, "Maintenance", "Delete");
        if (!canDelete)
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const { id } = await params;
        const maintenanceId = parseInt(id);

        const [rows] = await dbTenant(`SELECT id FROM \`maintenances\` WHERE id = ? LIMIT 1`, [maintenanceId]);
        if (!rows || rows.length === 0)
            return NextResponse.json({ message: "Maintenance not found" }, { status: 404 });

        await dbTenant(`DELETE FROM \`maintenances\` WHERE id = ?`, [maintenanceId]);
        await logActivity("MAINTENANCE", maintenanceId, "DELETE", `Maintenance ID ${id} deleted`);
        return NextResponse.json({ message: "Maintenance deleted successfully" });
    } catch (error) {
        console.error("Error deleting maintenance:", error);
        return NextResponse.json({ message: "Error deleting maintenance" }, { status: 500 });
    }
}
