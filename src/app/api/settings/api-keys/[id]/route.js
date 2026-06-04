import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";

export async function DELETE(req, props) {
    const params = await props.params;
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const canEdit = await verifySessionPermission(session, "Settings", "Edit");
    if (!canEdit) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    try {
        const id = String(params.id);
        await dbTenant.query("DELETE FROM `api_keys` WHERE id = ?", [id]);
        await logActivity("SETTINGS", 0, "DELETE", `API key deleted: ${id}`);
        return NextResponse.json({ message: "API Key deleted successfully" });
    } catch (error) {
        console.error("Error deleting key:", error);
        return NextResponse.json({ message: "Error deleting key" }, { status: 500 });
    }
}
