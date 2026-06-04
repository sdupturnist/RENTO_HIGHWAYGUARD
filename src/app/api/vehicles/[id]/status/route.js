import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";

export async function PATCH(request, props) {
    try {
        const params = await props.params;
        const id = parseInt(params.id);

        const session = await getSession();
        if (!session)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canEdit = await verifySessionPermission(session, "Vehicles", "Edit");
        if (!canEdit)
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const { status } = await request.json();
        if (!status)
            return NextResponse.json({ message: "Status required" }, { status: 400 });

        const [rows] = await dbTenant(`SELECT * FROM \`vehicles\` WHERE id = ? LIMIT 1`, [id]);
        if (!rows || rows.length === 0)
            return NextResponse.json({ message: "Vehicle not found" }, { status: 404 });

        const oldVehicle = rows[0];

        await dbTenant(`UPDATE \`vehicles\` SET status = ?, updatedAt = NOW() WHERE id = ?`, [status, id]);

        const [updRows] = await dbTenant(`SELECT * FROM \`vehicles\` WHERE id = ? LIMIT 1`, [id]);

        await logActivity("VEHICLE", id, "STATUS_CHANGE", `Changed status from ${oldVehicle.status} to ${status}`);
        return NextResponse.json(updRows[0]);
    } catch (error) {
        console.error("Error updating vehicle status:", error);
        return NextResponse.json({ message: "Error updating status" }, { status: 500 });
    }
}
