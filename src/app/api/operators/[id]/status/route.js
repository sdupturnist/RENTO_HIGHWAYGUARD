import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";

export async function PATCH(req, context) {
    try {
        const params = await context.params;
        const id = parseInt(params.id);
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canEdit = await verifySessionPermission(session, "Operators", "Edit");
        if (!canEdit) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        if (isNaN(id)) return NextResponse.json({ message: "Invalid ID" }, { status: 400 });

        const body = await req.json();
        const { status } = body;
        if (!status || !["ACTIVE", "INACTIVE", "BLOCKED", "ON_LEAVE"].includes(status)) {
            return NextResponse.json({ message: "Invalid status" }, { status: 400 });
        }

        const [rows] = await dbTenant(`SELECT status, name FROM \`operators\` WHERE id = ? LIMIT 1`, [id]);
        if (!rows || rows.length === 0) return NextResponse.json({ message: "Operator not found" }, { status: 404 });
        const existing = rows[0];

        await dbTenant(`UPDATE \`operators\` SET status = ?, updatedAt = NOW() WHERE id = ?`, [status, id]);

        await logActivity("OPERATOR", id, "STATUS_CHANGE", `Changed status for ${existing.name} from ${existing.status} to ${status}`);
        
        const [updRows] = await dbTenant(`SELECT * FROM \`operators\` WHERE id = ? LIMIT 1`, [id]);
        return NextResponse.json(updRows[0]);
    } catch (error) {
        console.error("Error updating operator status:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
