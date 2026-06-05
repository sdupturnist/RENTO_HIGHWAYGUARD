import { NextResponse } from "next/server";
import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import { checkEntityUsage, buildUsageError } from "@/app/lib/entity-usage";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const requirementSchema = z.object({
    resourceType: z.enum(["MATERIAL", "LABOUR"]),
    resourceId: z.number().int().positive(),
    quantity: z.number().min(0.01),
});

const updateSchema = z.object({
    name: z.string().min(1),
    vehicleCount: z.number().int().min(0).default(0),
    operatorCount: z.number().int().min(0).default(0),
    bundleCostEnabled: z.boolean().default(false),
    bundleCostPerDay: z.number().min(0).default(0),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
    remarks: z.string().optional().nullable(),
    requirements: z.array(requirementSchema).optional().default([]),
});

async function fetchTemplate(id) {
    const [rows] = await dbTenant(`SELECT * FROM \`detour_service_templates\` WHERE id = ? LIMIT 1`, [id]);
    if (!rows || rows.length === 0) return null;
    const [reqs] = await dbTenant(`
        SELECT dtr.*,
               CASE dtr.resourceType
                   WHEN 'MATERIAL' THEN (SELECT name FROM \`materials\` WHERE id = dtr.resourceId)
                   WHEN 'LABOUR'   THEN (SELECT labourType FROM \`labours\` WHERE id = dtr.resourceId)
               END as resourceName
        FROM \`detour_template_requirements\` dtr
        WHERE dtr.templateId = ?
    `, [id]);
    return { ...rows[0], requirements: reqs || [] };
}

export async function GET(request, props) {
    const params = await props.params;
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canView = await verifySessionPermission(session, "Detour Services", "View");
    if (!canView) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt(params.id);
    const template = await fetchTemplate(id);
    if (!template) return NextResponse.json({ message: "Template not found" }, { status: 404 });
    return NextResponse.json(template);
}

export async function PUT(request, props) {
    const params = await props.params;
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canEdit = await verifySessionPermission(session, "Detour Services", "Edit");
        if (!canEdit) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const id = parseInt(params.id);
        const body = await request.json();
        const data = updateSchema.parse(body);

        await withTenantTransaction(async (tx) => {
            await tx.execute(
                `UPDATE \`detour_service_templates\`
                 SET name = ?, vehicleCount = ?, operatorCount = ?,
                     bundleCostEnabled = ?, bundleCostPerDay = ?,
                     status = ?, remarks = ?, updatedAt = NOW()
                 WHERE id = ?`,
                [
                    data.name, data.vehicleCount, data.operatorCount,
                    data.bundleCostEnabled ? 1 : 0, data.bundleCostPerDay,
                    data.status, data.remarks ?? null, id
                ]
            );

            // Replace requirements
            await tx.execute(`DELETE FROM \`detour_template_requirements\` WHERE templateId = ?`, [id]);
            for (const req of data.requirements) {
                await tx.execute(
                    `INSERT INTO \`detour_template_requirements\` (templateId, resourceType, resourceId, quantity) VALUES (?, ?, ?, ?)`,
                    [id, req.resourceType, req.resourceId, req.quantity]
                );
            }
        });

        await logActivity("DETOUR_TEMPLATE", id, "UPDATE", `Updated detour template: ${data.name}`);
        revalidatePath("/detour-services");
        revalidatePath(`/detour-services/${id}`);
        return NextResponse.json(await fetchTemplate(id));
    } catch (error) {
        if (error instanceof z.ZodError)
            return NextResponse.json({ message: "Validation failed", errors: error.errors }, { status: 400 });
        console.error("PUT detour-template error:", error);
        return NextResponse.json({ message: "Error updating detour template" }, { status: 500 });
    }
}

export async function DELETE(request, props) {
    const params = await props.params;
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canDelete = await verifySessionPermission(session, "Detour Services", "Delete");
        if (!canDelete) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const id = parseInt(params.id);
        const [rows] = await dbTenant(`SELECT name, templateCode FROM \`detour_service_templates\` WHERE id = ? LIMIT 1`, [id]);
        if (!rows || rows.length === 0)
            return NextResponse.json({ message: "Template not found" }, { status: 404 });
        const template = rows[0];

        const { inUse, usedIn, counts } = await checkEntityUsage("detourTemplate", id);
        if (inUse)
            return NextResponse.json({ message: buildUsageError(usedIn, counts) }, { status: 409 });

        // Requirements are CASCADE deleted by FK
        await dbTenant(`DELETE FROM \`detour_service_templates\` WHERE id = ?`, [id]);

        await logActivity("DETOUR_TEMPLATE", id, "DELETE", `Deleted detour template: ${template.name} (${template.templateCode})`);
        revalidatePath("/detour-services");
        revalidatePath(`/detour-services/${id}`);
        return NextResponse.json({ message: "Detour template deleted successfully." });
    } catch (error) {
        console.error("DELETE detour-template error:", error);
        return NextResponse.json({ message: "Error deleting detour template" }, { status: 500 });
    }
}
