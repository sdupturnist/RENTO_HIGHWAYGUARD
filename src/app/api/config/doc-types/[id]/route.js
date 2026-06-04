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
        const [[{ c: vCount }]] = await dbTenant(`SELECT COUNT(*) as c FROM \`vehicle_documents\` WHERE documentTypeId = ?`, [id]);
        if (vCount > 0) return NextResponse.json({ message: "Cannot delete document type in use by vehicles." }, { status: 400 });

        const [dtRows] = await dbTenant(`SELECT name FROM \`document_types\` WHERE id = ? LIMIT 1`, [id]);
        const dtName = dtRows?.[0]?.name ?? id;
        await dbTenant(`DELETE FROM \`document_types\` WHERE id = ?`, [id]);
        await logActivity("DOCUMENT_TYPE", id, "DELETE", `Deleted vehicle document type: ${dtName}`);
        return NextResponse.json({ message: "Document type deleted" });
    } catch (error) {
        console.error("Error deleting document type:", error);
        return NextResponse.json({ message: "Error deleting document type" }, { status: 500 });
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
            UPDATE \`document_types\` SET name = ?, category = ?, updatedAt = NOW()
            WHERE id = ?
        `, [body.name, body.category, id]);

        const [rows] = await dbTenant(`SELECT * FROM \`document_types\` WHERE id = ? LIMIT 1`, [id]);
        await logActivity("DOCUMENT_TYPE", id, "UPDATE", `Updated vehicle document type: ${body.name}`);
        return NextResponse.json(rows[0]);
    } catch (error) {
        console.error("Error updating document type:", error);
        return NextResponse.json({ message: "Error updating document type" }, { status: 500 });
    }
}
