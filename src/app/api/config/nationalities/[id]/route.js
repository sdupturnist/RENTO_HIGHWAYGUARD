import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";

export async function DELETE(request, props) {
    const params = await props.params;
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const id = parseInt(params.id);

    if (isNaN(id)) return NextResponse.json({ message: "Invalid ID" }, { status: 400 });

    try {
        const [[{ c: oCount }]] = await dbTenant(`SELECT COUNT(*) as c FROM \`operators\` WHERE nationalityId = ?`, [id]);
        if (oCount > 0) return NextResponse.json({ message: "Cannot delete nationality as it is used by operators" }, { status: 400 });

        const [natRows] = await dbTenant(`SELECT name FROM \`nationalities\` WHERE id = ? LIMIT 1`, [id]);
        const natName = natRows?.[0]?.name ?? id;
        await dbTenant(`DELETE FROM \`nationalities\` WHERE id = ?`, [id]);
        await logActivity("NATIONALITY", id, "DELETE", `Deleted nationality: ${natName}`);
        return NextResponse.json({ message: "Nationality deleted" });
    } catch (error) {
        console.error("Error deleting nationality:", error);
        return NextResponse.json({ message: "Error deleting nationality" }, { status: 500 });
    }
}
