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
        const [[{ c: vCount }]] = await dbTenant(`SELECT COUNT(*) as c FROM \`vehicles\` WHERE brandId = ?`, [id]);
        if (vCount > 0) return NextResponse.json({ message: "Cannot delete brand: Used by existing vehicles." }, { status: 400 });

        const [[{ c: mCount }]] = await dbTenant(`SELECT COUNT(*) as c FROM \`vehicle_models\` WHERE brandId = ?`, [id]);
        if (mCount > 0) return NextResponse.json({ message: "Cannot delete brand: Has associated models." }, { status: 400 });

        const [brandRows] = await dbTenant(`SELECT name FROM \`vehicle_brands\` WHERE id = ? LIMIT 1`, [id]);
        const brandName = brandRows?.[0]?.name ?? id;
        await dbTenant(`DELETE FROM \`vehicle_brands\` WHERE id = ?`, [id]);
        await logActivity("VEHICLE_BRAND", id, "DELETE", `Deleted vehicle brand: ${brandName}`);
        return NextResponse.json({ message: "Vehicle brand deleted" });
    } catch (error) {
        console.error("Error deleting vehicle brand:", error);
        return NextResponse.json({ message: "Error deleting vehicle brand" }, { status: 500 });
    }
}

export async function PUT(request, props) {
    const params = await props.params;
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const id = parseInt(params.id);

    try {
        const body = await request.json();
        await dbTenant(`
            UPDATE \`vehicle_brands\` SET name = ?, typeId = ?, updatedAt = NOW()
            WHERE id = ?
        `, [body.name, body.typeId ? parseInt(body.typeId) : null, id]);

        const [rows] = await dbTenant(`SELECT * FROM \`vehicle_brands\` WHERE id = ? LIMIT 1`, [id]);
        await logActivity("VEHICLE_BRAND", id, "UPDATE", `Updated vehicle brand: ${body.name}`);
        return NextResponse.json(rows[0]);
    } catch (error) {
        console.error("Error updating vehicle brand:", error);
        return NextResponse.json({ message: "Error updating vehicle brand" }, { status: 500 });
    }
}
