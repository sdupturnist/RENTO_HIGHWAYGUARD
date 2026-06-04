import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import { checkEntityUsage, buildUsageError } from "@/app/lib/entity-usage";
import { z } from "zod";

const updateSchema = z.object({
    name: z.string().min(1),
    totalQuantity: z.number().min(0),
    costPerDay: z.number().min(0),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
    remarks: z.string().optional().nullable(),
});

export async function GET(request, props) {
    const params = await props.params;
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canView = await verifySessionPermission(session, "Materials", "View");
    if (!canView) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt(params.id);
    const [rows] = await dbTenant(`SELECT * FROM \`materials\` WHERE id = ? LIMIT 1`, [id]);
    if (!rows || rows.length === 0)
        return NextResponse.json({ message: "Material not found" }, { status: 404 });
    return NextResponse.json(rows[0]);
}

export async function PUT(request, props) {
    const params = await props.params;
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canEdit = await verifySessionPermission(session, "Materials", "Edit");
        if (!canEdit) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const id = parseInt(params.id);
        const body = await request.json();
        const data = updateSchema.parse(body);

        await dbTenant(
            `UPDATE \`materials\` SET name = ?, totalQuantity = ?, costPerDay = ?, status = ?, remarks = ?, updatedAt = NOW()
             WHERE id = ?`,
            [data.name, data.totalQuantity, data.costPerDay, data.status, data.remarks ?? null, id]
        );

        await logActivity("MATERIAL", id, "UPDATE", `Updated material: ${data.name}`);
        const [rows] = await dbTenant(`SELECT * FROM \`materials\` WHERE id = ? LIMIT 1`, [id]);
        return NextResponse.json(rows[0]);
    } catch (error) {
        if (error instanceof z.ZodError)
            return NextResponse.json({ message: "Validation failed", errors: error.errors }, { status: 400 });
        console.error("PUT material error:", error);
        return NextResponse.json({ message: "Error updating material" }, { status: 500 });
    }
}

export async function DELETE(request, props) {
    const params = await props.params;
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canDelete = await verifySessionPermission(session, "Materials", "Delete");
        if (!canDelete) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const id = parseInt(params.id);

        const [rows] = await dbTenant(`SELECT name, materialCode FROM \`materials\` WHERE id = ? LIMIT 1`, [id]);
        if (!rows || rows.length === 0)
            return NextResponse.json({ message: "Material not found" }, { status: 404 });
        const material = rows[0];

        const { inUse, usedIn, counts } = await checkEntityUsage("material", id);
        if (inUse)
            return NextResponse.json({ message: buildUsageError(usedIn, counts) }, { status: 409 });

        await dbTenant(`DELETE FROM \`materials\` WHERE id = ?`, [id]);
        await logActivity("MATERIAL", id, "DELETE", `Deleted material: ${material.name} (${material.materialCode})`);
        return NextResponse.json({ message: "Material deleted successfully." });
    } catch (error) {
        console.error("DELETE material error:", error);
        return NextResponse.json({ message: "Error deleting material" }, { status: 500 });
    }
}
