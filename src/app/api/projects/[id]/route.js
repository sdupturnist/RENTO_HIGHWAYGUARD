import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { z } from "zod";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import { checkEntityUsage, buildUsageError } from "@/app/lib/entity-usage";
import { revalidatePath } from "next/cache";

const updateProjectSchema = z.object({
    name: z.string().min(1),
    location: z.string().optional(),
    billingCycle: z.enum(["HOURLY", "DAILY"]),
    customerId: z.coerce.number(),
    status: z.enum(["ACTIVE", "INACTIVE", "COMPLETED"]).optional(),
    lpoNumber: z.string().optional().nullable(),
    lpoAttachmentPath: z.string().optional().nullable(),
    lpoAttachmentName: z.string().optional().nullable(),
});

export async function GET(request, { params }) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canView = await verifySessionPermission(session, "Projects", "View");
    if (!canView)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt((await params).id);
    const [rows] = await dbTenant(`
        SELECT p.*, c.id as customer_id, c.companyName
        FROM \`projects\` p
        LEFT JOIN \`customers\` c ON c.id = p.customerId
        WHERE p.id = ? LIMIT 1
    `, [id]);
    if (!rows || rows.length === 0)
        return NextResponse.json({ message: "Project not found" }, { status: 404 });

    const row = rows[0];
    return NextResponse.json({
        ...row,
        customer: row.customerId ? { id: row.customer_id, companyName: row.companyName } : null,
    });
}

export async function PUT(request, { params }) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canEdit = await verifySessionPermission(session, "Projects", "Edit");
    if (!canEdit)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt((await params).id);
    try {
        const body = await request.json();
        const data = updateProjectSchema.parse(body);

        await dbTenant(`
            UPDATE \`projects\` SET name = ?, location = ?, billingCycle = ?, customerId = ?, status = ?,
                lpoNumber = ?, lpoAttachmentPath = ?, lpoAttachmentName = ?, updatedAt = NOW()
            WHERE id = ?
        `, [data.name, data.location || null, data.billingCycle, data.customerId, data.status || null,
            data.lpoNumber || null, data.lpoAttachmentPath || null, data.lpoAttachmentName || null, id]);

        const [rows] = await dbTenant(`SELECT * FROM \`projects\` WHERE id = ? LIMIT 1`, [id]);
        await logActivity("PROJECT", id, "UPDATE", `Project ${data.name} updated`);
        revalidatePath("/projects");
        revalidatePath(`/projects/${id}`);
        return NextResponse.json(rows[0]);
    } catch (error) {
        if (error instanceof z.ZodError)
            return NextResponse.json({ message: "Validation error", errors: error.errors }, { status: 400 });
        return NextResponse.json({ message: "Error updating project" }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canDelete = await verifySessionPermission(session, "Projects", "Delete");
    if (!canDelete)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt((await params).id);
    try {
        const { inUse, usedIn, counts } = await checkEntityUsage("project", id);
        if (inUse)
            return NextResponse.json({ message: buildUsageError(usedIn, counts) }, { status: 409 });

        await dbTenant(`DELETE FROM \`projects\` WHERE id = ?`, [id]);
        await logActivity("PROJECT", id, "DELETE", `Project ID ${id} deleted`);
        revalidatePath("/projects");
        revalidatePath(`/projects/${id}`);
        return NextResponse.json({ message: "Project deleted successfully" });
    } catch (error) {
        console.error("Error deleting project:", error);
        return NextResponse.json({ message: "Error deleting project" }, { status: 500 });
    }
}

export async function PATCH(request, { params }) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canEdit = await verifySessionPermission(session, "Projects", "Edit");
    if (!canEdit)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt((await params).id);
    try {
        const body = await request.json();
        const data = updateProjectSchema.partial().parse(body);

        const fields = [];
        const values = [];
        if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
        if (data.location !== undefined) { fields.push("location = ?"); values.push(data.location || null); }
        if (data.billingCycle !== undefined) { fields.push("billingCycle = ?"); values.push(data.billingCycle); }
        if (data.customerId !== undefined) { fields.push("customerId = ?"); values.push(data.customerId); }
        if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
        if (data.lpoNumber !== undefined) { fields.push("lpoNumber = ?"); values.push(data.lpoNumber || null); }
        if (data.lpoAttachmentPath !== undefined) { fields.push("lpoAttachmentPath = ?"); values.push(data.lpoAttachmentPath || null); }
        if (data.lpoAttachmentName !== undefined) { fields.push("lpoAttachmentName = ?"); values.push(data.lpoAttachmentName || null); }
        fields.push("updatedAt = NOW()");

        await dbTenant(`UPDATE \`projects\` SET ${fields.join(", ")} WHERE id = ?`, [...values, id]);
        const [rows] = await dbTenant(`SELECT * FROM \`projects\` WHERE id = ? LIMIT 1`, [id]);
        await logActivity("PROJECT", id, "PATCH", `Project ${rows[0]?.name} partially updated`);
        revalidatePath("/projects");
        revalidatePath(`/projects/${id}`);
        return NextResponse.json(rows[0]);
    } catch (error) {
        if (error instanceof z.ZodError)
            return NextResponse.json({ message: "Validation error", errors: error.errors }, { status: 400 });
        return NextResponse.json({ message: "Error updating project" }, { status: 500 });
    }
}
