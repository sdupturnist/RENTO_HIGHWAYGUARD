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
        const [[{ c: vCount }]] = await dbTenant(`SELECT COUNT(*) as c FROM \`vehicles\` WHERE modelId = ?`, [id]);
        if (vCount > 0) return NextResponse.json({ message: "Cannot delete model: Used by existing vehicles." }, { status: 400 });

        const [modelRows] = await dbTenant(`SELECT name FROM \`vehicle_models\` WHERE id = ? LIMIT 1`, [id]);
        const modelName = modelRows?.[0]?.name ?? id;
        await dbTenant(`DELETE FROM \`vehicle_models\` WHERE id = ?`, [id]);
        await logActivity("VEHICLE_MODEL", id, "DELETE", `Deleted vehicle model: ${modelName}`);
        return NextResponse.json({ message: "Vehicle model deleted" });
    } catch (error) {
        console.error("Error deleting vehicle model:", error);
        return NextResponse.json({ message: "Error deleting vehicle model" }, { status: 500 });
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
            UPDATE \`vehicle_models\` SET name = ?, brandId = ?, updatedAt = NOW()
            WHERE id = ?
        `, [body.name, body.brandId ? parseInt(body.brandId) : null, id]);

        const [rows] = await dbTenant(`SELECT * FROM \`vehicle_models\` WHERE id = ? LIMIT 1`, [id]);
        await logActivity("VEHICLE_MODEL", id, "UPDATE", `Updated vehicle model: ${body.name}`);
        return NextResponse.json(rows[0]);
    } catch (error) {
        console.error("Error updating vehicle model:", error);
        return NextResponse.json({ message: "Error updating vehicle model" }, { status: 500 });
    }
}
