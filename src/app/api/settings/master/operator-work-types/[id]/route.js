import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import { checkEntityUsage, buildUsageError } from "@/app/lib/entity-usage";
import { z } from "zod";

const schema = z.object({
    name: z.string().min(1),
    isBillable: z.boolean().default(true),
});

export async function PUT(request, props) {
    const params = await props.params;
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canEdit = await verifySessionPermission(session, "Settings", "Edit");
    if (!canEdit) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt(params.id);
    try {
        const body = await request.json();
        const data = schema.parse(body);

        const [dup] = await dbTenant(
            `SELECT id FROM \`operator_work_types\` WHERE name = ? AND id != ? LIMIT 1`,
            [data.name, id]
        );
        if (dup.length > 0)
            return NextResponse.json({ message: "A work type with this name already exists." }, { status: 409 });

        await dbTenant(
            `UPDATE \`operator_work_types\` SET name = ?, isBillable = ?, updatedAt = NOW() WHERE id = ?`,
            [data.name, data.isBillable ? 1 : 0, id]
        );
        await logActivity("OPERATOR_WORK_TYPE", id, "UPDATE", `Updated operator work type: ${data.name}`);
        const [rows] = await dbTenant(`SELECT * FROM \`operator_work_types\` WHERE id = ?`, [id]);
        return NextResponse.json(rows[0]);
    } catch (error) {
        if (error instanceof z.ZodError)
            return NextResponse.json({ message: "Validation failed", errors: error.errors }, { status: 400 });
        console.error("PUT operator-work-types error:", error);
        return NextResponse.json({ message: "Error updating work type" }, { status: 500 });
    }
}

export async function DELETE(request, props) {
    const params = await props.params;
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canEdit = await verifySessionPermission(session, "Settings", "Edit");
    if (!canEdit) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt(params.id);
    try {
        const [rows] = await dbTenant(`SELECT name FROM \`operator_work_types\` WHERE id = ? LIMIT 1`, [id]);
        if (!rows || rows.length === 0)
            return NextResponse.json({ message: "Work type not found" }, { status: 404 });
        const workType = rows[0];

        // operatorWorkType uses the text name in entity-usage, not the id
        const { inUse, usedIn, counts } = await checkEntityUsage("operatorWorkType", workType.name);
        if (inUse)
            return NextResponse.json({ message: buildUsageError(usedIn, counts) }, { status: 409 });

        await dbTenant(`DELETE FROM \`operator_work_types\` WHERE id = ?`, [id]);
        await logActivity("OPERATOR_WORK_TYPE", id, "DELETE", `Deleted operator work type: ${workType.name}`);
        return NextResponse.json({ message: "Work type deleted." });
    } catch (error) {
        console.error("DELETE operator-work-types error:", error);
        return NextResponse.json({ message: "Error deleting work type" }, { status: 500 });
    }
}
