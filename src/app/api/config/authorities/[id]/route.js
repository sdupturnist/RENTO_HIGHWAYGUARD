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
        const [[{ c: vCount }]] = await dbTenant(`SELECT COUNT(*) as c FROM \`vehicles\` WHERE registrationAuthorityId = ?`, [id]);
        if (vCount > 0) return NextResponse.json({ message: "Cannot delete registration authority in use by vehicles." }, { status: 400 });

        const [raRows] = await dbTenant(`SELECT name FROM \`registration_authorities\` WHERE id = ? LIMIT 1`, [id]);
        const raName = raRows?.[0]?.name ?? id;
        await dbTenant(`DELETE FROM \`registration_authorities\` WHERE id = ?`, [id]);
        await logActivity("CONFIG", id, "DELETE", `Deleted registration authority: ${raName}`);
        return NextResponse.json({ message: "Registration authority deleted" });
    } catch (error) {
        console.error("Error deleting registration authority:", error);
        return NextResponse.json({ message: "Error deleting registration authority" }, { status: 500 });
    }
}

export async function PUT(request, props) {
    const params = await props.params;
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const id = parseInt(params.id);

    try {
        const body = await request.json();
        await dbTenant(`UPDATE \`registration_authorities\` SET name = ?, updatedAt = NOW() WHERE id = ?`, [body.name, id]);
        const [rows] = await dbTenant(`SELECT * FROM \`registration_authorities\` WHERE id = ? LIMIT 1`, [id]);
        await logActivity("CONFIG", id, "UPDATE", `Updated registration authority: ${body.name}`);
        return NextResponse.json(rows[0]);
    } catch (error) {
        console.error("Error updating registration authority:", error);
        return NextResponse.json({ message: "Error updating registration authority" }, { status: 500 });
    }
}
