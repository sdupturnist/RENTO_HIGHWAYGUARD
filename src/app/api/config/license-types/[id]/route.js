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
        const [[{ c: oCount }]] = await dbTenant(`SELECT COUNT(*) as c FROM \`operators\` WHERE licenseTypeId = ?`, [id]);
        if (oCount > 0) return NextResponse.json({ message: "Cannot delete license type in use by operators." }, { status: 400 });

        const [ltRows] = await dbTenant(`SELECT name FROM \`license_types\` WHERE id = ? LIMIT 1`, [id]);
        const ltName = ltRows?.[0]?.name ?? id;
        await dbTenant(`DELETE FROM \`license_types\` WHERE id = ?`, [id]);
        await logActivity("LICENSE_TYPE", id, "DELETE", `Deleted license type: ${ltName}`);
        return NextResponse.json({ message: "License type deleted" });
    } catch (error) {
        console.error("Error deleting license type:", error);
        return NextResponse.json({ message: "Error deleting license type" }, { status: 500 });
    }
}

export async function PUT(request, props) {
    const params = await props.params;
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const id = parseInt(params.id);

    try {
        const body = await request.json();
        await dbTenant(`UPDATE \`license_types\` SET name = ?, updatedAt = NOW() WHERE id = ?`, [body.name, id]);
        const [rows] = await dbTenant(`SELECT * FROM \`license_types\` WHERE id = ? LIMIT 1`, [id]);
        await logActivity("LICENSE_TYPE", id, "UPDATE", `Updated license type: ${body.name}`);
        return NextResponse.json(rows[0]);
    } catch (error) {
        console.error("Error updating license type:", error);
        return NextResponse.json({ message: "Error updating license type" }, { status: 500 });
    }
}
