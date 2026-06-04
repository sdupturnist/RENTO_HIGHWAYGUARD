import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";

export async function PUT(request, { params }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const hasPermission = await verifySessionPermission(session, "Settings", "Edit");
        if (!hasPermission) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const body = await request.json();
        const { name, isActive } = body;
        const id = parseInt((await params).id);

        await dbTenant(`
            UPDATE \`maintenance_types\` SET name = ?, isActive = ?, updatedAt = NOW()
            WHERE id = ?
        `, [name, isActive !== undefined ? (isActive ? 1 : 0) : 1, id]);

        const [rows] = await dbTenant(`SELECT * FROM \`maintenance_types\` WHERE id = ? LIMIT 1`, [id]);
        if (!rows || rows.length === 0) return NextResponse.json({ message: "Maintenance type not found" }, { status: 404 });

        await logActivity("MAINTENANCE_TYPE", id, "UPDATE", `Updated maintenance type: ${rows[0].name}`);
        return NextResponse.json(rows[0]);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return NextResponse.json({ message: "Maintenance type name already exists" }, { status: 400 });
        console.error("Error updating maintenance type:", error);
        return NextResponse.json({ message: "Error updating maintenance type" }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const hasPermission = await verifySessionPermission(session, "Settings", "Edit");
        if (!hasPermission) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const id = parseInt((await params).id);

        const [[{ c: mCount }]] = await dbTenant(`SELECT COUNT(*) as c FROM \`maintenances\` WHERE maintenanceTypeId = ?`, [id]);
        if (mCount > 0) return NextResponse.json({ message: "Cannot delete maintenance type that is in use" }, { status: 400 });

        const [mtRows] = await dbTenant(`SELECT name FROM \`maintenance_types\` WHERE id = ? LIMIT 1`, [id]);
        const mtName = mtRows?.[0]?.name ?? id;
        const [res] = await dbTenant(`DELETE FROM \`maintenance_types\` WHERE id = ?`, [id]);
        if (res.affectedRows === 0) return NextResponse.json({ message: "Maintenance type not found" }, { status: 404 });

        await logActivity("MAINTENANCE_TYPE", id, "DELETE", `Deleted maintenance type: ${mtName}`);
        return NextResponse.json({ message: "Maintenance type deleted successfully" });
    } catch (error) {
        console.error("Error deleting maintenance type:", error);
        return NextResponse.json({ message: "Error deleting maintenance type" }, { status: 500 });
    }
}
