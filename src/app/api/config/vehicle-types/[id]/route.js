import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";

export async function DELETE(request, props) {
    const params = await props.params;
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const id = parseInt(params.id);

    try {
        const [[{ c: vCount }]] = await dbTenant(`SELECT COUNT(*) as c FROM \`vehicles\` WHERE typeId = ?`, [id]);
        if (vCount > 0) return NextResponse.json({ message: "Cannot delete type: Used by existing vehicles." }, { status: 400 });

        const [[{ c: bCount }]] = await dbTenant(`SELECT COUNT(*) as c FROM \`vehicle_brands\` WHERE typeId = ?`, [id]);
        if (bCount > 0) return NextResponse.json({ message: "Cannot delete type: Has associated brands." }, { status: 400 });

        const [typeRows] = await dbTenant(`SELECT name FROM \`vehicle_types\` WHERE id = ? LIMIT 1`, [id]);
        const typeName = typeRows?.[0]?.name ?? id;
        await dbTenant(`DELETE FROM \`vehicle_types\` WHERE id = ?`, [id]);
        await logActivity("VEHICLE_TYPE", id, "DELETE", `Deleted vehicle type: ${typeName}`);
        return NextResponse.json({ message: "Vehicle type deleted" });
    } catch (error) {
        console.error("Error deleting vehicle type:", error);
        return NextResponse.json({ message: "Error deleting vehicle type" }, { status: 500 });
    }
}

export async function PUT(request, props) {
    const params = await props.params;
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const id = parseInt(params.id);

    try {
        const body = await request.json();
        await dbTenant(`UPDATE \`vehicle_types\` SET name = ?, updatedAt = NOW() WHERE id = ?`, [body.name, id]);
        const [rows] = await dbTenant(`SELECT * FROM \`vehicle_types\` WHERE id = ? LIMIT 1`, [id]);
        await logActivity("VEHICLE_TYPE", id, "UPDATE", `Updated vehicle type: ${body.name}`);
        return NextResponse.json(rows[0]);
    } catch (error) {
        console.error("Error updating vehicle type:", error);
        return NextResponse.json({ message: "Error updating vehicle type" }, { status: 500 });
    }
}
