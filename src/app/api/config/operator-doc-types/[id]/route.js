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
        const [[{ c: oCount }]] = await dbTenant(`SELECT COUNT(*) as c FROM \`operator_documents\` WHERE documentTypeId = ?`, [id]);
        if (oCount > 0) return NextResponse.json({ message: "Cannot delete document type as it is used by existing documents" }, { status: 400 });

        const [dtRows] = await dbTenant(`SELECT name FROM \`operator_document_types\` WHERE id = ? LIMIT 1`, [id]);
        const dtName = dtRows?.[0]?.name ?? id;
        await dbTenant(`DELETE FROM \`operator_document_types\` WHERE id = ?`, [id]);
        await logActivity("OPERATOR_DOC_TYPE", id, "DELETE", `Deleted operator document type: ${dtName}`);
        return NextResponse.json({ message: "Document type deleted" });
    } catch (error) {
        console.error("Error deleting document type:", error);
        return NextResponse.json({ message: "Error deleting document type" }, { status: 500 });
    }
}
