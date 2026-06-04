import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import { checkEntityUsage, buildUsageError } from "@/app/lib/entity-usage";
import { z } from "zod";

const updateSchema = z.object({
    labourType: z.string().min(1),
    totalQuantity: z.number().min(0),
    costPerDay: z.number().min(0),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
    remarks: z.string().optional().nullable(),
});

export async function GET(request, props) {
    const params = await props.params;
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canView = await verifySessionPermission(session, "Labours", "View");
    if (!canView) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt(params.id);
    const [rows] = await dbTenant(`SELECT * FROM \`labours\` WHERE id = ? LIMIT 1`, [id]);
    if (!rows || rows.length === 0)
        return NextResponse.json({ message: "Labour not found" }, { status: 404 });
    return NextResponse.json(rows[0]);
}

export async function PUT(request, props) {
    const params = await props.params;
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canEdit = await verifySessionPermission(session, "Labours", "Edit");
        if (!canEdit) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const id = parseInt(params.id);
        const body = await request.json();
        const data = updateSchema.parse(body);

        await dbTenant(
            `UPDATE \`labours\` SET labourType = ?, totalQuantity = ?, costPerDay = ?, status = ?, remarks = ?, updatedAt = NOW()
             WHERE id = ?`,
            [data.labourType, data.totalQuantity, data.costPerDay, data.status, data.remarks ?? null, id]
        );

        await logActivity("LABOUR", id, "UPDATE", `Updated labour type: ${data.labourType}`);
        const [rows] = await dbTenant(`SELECT * FROM \`labours\` WHERE id = ? LIMIT 1`, [id]);
        return NextResponse.json(rows[0]);
    } catch (error) {
        if (error instanceof z.ZodError)
            return NextResponse.json({ message: "Validation failed", errors: error.errors }, { status: 400 });
        console.error("PUT labour error:", error);
        return NextResponse.json({ message: "Error updating labour" }, { status: 500 });
    }
}

export async function DELETE(request, props) {
    const params = await props.params;
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canDelete = await verifySessionPermission(session, "Labours", "Delete");
        if (!canDelete) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const id = parseInt(params.id);

        const [rows] = await dbTenant(`SELECT labourType, labourCode FROM \`labours\` WHERE id = ? LIMIT 1`, [id]);
        if (!rows || rows.length === 0)
            return NextResponse.json({ message: "Labour not found" }, { status: 404 });
        const labour = rows[0];

        const { inUse, usedIn, counts } = await checkEntityUsage("labour", id);
        if (inUse)
            return NextResponse.json({ message: buildUsageError(usedIn, counts) }, { status: 409 });

        await dbTenant(`DELETE FROM \`labours\` WHERE id = ?`, [id]);
        await logActivity("LABOUR", id, "DELETE", `Deleted labour type: ${labour.labourType} (${labour.labourCode})`);
        return NextResponse.json({ message: "Labour deleted successfully." });
    } catch (error) {
        console.error("DELETE labour error:", error);
        return NextResponse.json({ message: "Error deleting labour" }, { status: 500 });
    }
}
