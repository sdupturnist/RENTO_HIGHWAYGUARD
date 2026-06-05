import { NextResponse } from "next/server";
import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import * as z from "zod";
import { checkEntityUsage, buildUsageError } from "@/app/lib/entity-usage";
import { revalidatePath } from "next/cache";

const operatorSchema = z.object({
    name: z.string().min(1),
    nationalityId: z.number().optional().nullable(),
    phoneNumber: z.string().optional().nullable(),
    phoneCountryCode: z.string().optional().nullable(),
    email: z.string().email().optional().nullable().or(z.literal("")),
    address: z.string().optional().nullable(),
    experienceYears: z.number().optional().nullable(),
    licenseTypeId: z.number(),
    licenseNumber: z.string().optional().nullable(),
    licenseIssueDate: z.string().optional().nullable(),
    licenseExpiry: z.string().optional().nullable(),
    status: z.enum(["ACTIVE", "INACTIVE", "DISABLED", "BLOCKED", "ON_LEAVE"]),
    baseRateType: z.literal("HOURLY"),
    hourlyRate: z.number().min(0),
    documents: z.array(z.object({
        id: z.number().optional(),
        documentTypeId: z.number(),
        name: z.string().optional().nullable(),
        url: z.string(),
        expiryDate: z.string().optional().nullable(),
    })).optional(),
});

export async function GET(request, props) {
    const params = await props.params;
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canView = await verifySessionPermission(session, "Operators", "View");
    if (!canView) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ message: "Invalid ID" }, { status: 400 });

    try {
        const [rows] = await dbTenant(`
            SELECT o.*, n.name as nationality_name, l.name as licenseType_name
            FROM \`operators\` o
            LEFT JOIN \`nationalities\` n ON n.id = o.nationalityId
            LEFT JOIN \`license_types\` l ON l.id = o.licenseTypeId
            WHERE o.id = ? LIMIT 1
        `, [id]);

        if (!rows || rows.length === 0)
            return NextResponse.json({ message: "Operator not found" }, { status: 404 });

        const operator = rows[0];
        const [docs] = await dbTenant(`SELECT * FROM \`operator_documents\` WHERE operatorId = ?`, [id]);
        operator.documents = docs || [];
        operator.nationality = operator.nationalityId ? { id: operator.nationalityId, name: operator.nationality_name } : null;
        operator.licenseType = operator.licenseTypeId ? { id: operator.licenseTypeId, name: operator.licenseType_name } : null;

        return NextResponse.json(operator);
    } catch (error) {
        console.error("Error fetching operator:", error);
        return NextResponse.json({ message: "Error fetching operator" }, { status: 500 });
    }
}

export async function PUT(request, props) {
    const params = await props.params;
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canEdit = await verifySessionPermission(session, "Operators", "Edit");
    if (!canEdit) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ message: "Invalid ID" }, { status: 400 });

    try {
        const body = await request.json();
        const data = operatorSchema.parse(body);

        await withTenantTransaction(async (tx) => {
            // Update operator
            await tx.execute(`
                UPDATE \`operators\` SET
                name = ?, nationalityId = ?, phoneNumber = ?, phoneCountryCode = ?, email = ?, address = ?,
                experienceYears = ?, licenseTypeId = ?, licenseNumber = ?,
                licenseIssueDate = ?, licenseExpiry = ?, status = ?,
                baseRateType = ?, hourlyRate = ?, updatedAt = NOW()
                WHERE id = ?
            `, [
                data.name, data.nationalityId || null, data.phoneNumber || null, data.phoneCountryCode || '+971', data.email || null, data.address || null,
                data.experienceYears || null, data.licenseTypeId, data.licenseNumber || null,
                data.licenseIssueDate ? new Date(data.licenseIssueDate) : null,
                data.licenseExpiry ? new Date(data.licenseExpiry) : null,
                data.status, data.baseRateType, data.hourlyRate, id
            ]);

            // Sync documents: Delete and recreate for simplicity
            await tx.execute(`DELETE FROM \`operator_documents\` WHERE operatorId = ?`, [id]);
            if (data.documents && data.documents.length > 0) {
                for (const doc of data.documents) {
                    await tx.execute(`
                        INSERT INTO \`operator_documents\` (operatorId, documentTypeId, name, url, expiryDate, createdAt)
                        VALUES (?, ?, ?, ?, ?, NOW())
                    `, [id, doc.documentTypeId, doc.name ?? "", doc.url, doc.expiryDate ? new Date(doc.expiryDate) : null]);
                }
            }
        });

        // Refetch for response
        const [rows] = await dbTenant(`SELECT * FROM \`operators\` WHERE id = ? LIMIT 1`, [id]);
        const operator = rows[0];
        const [docs] = await dbTenant(`SELECT * FROM \`operator_documents\` WHERE operatorId = ?`, [id]);
        operator.documents = docs || [];

        await logActivity("OPERATOR", id, "UPDATE", `Updated operator: ${operator.name} (Status: ${operator.status})`);
        revalidatePath("/operators");
        revalidatePath(`/operators/${id}`);
        return NextResponse.json(operator);
    } catch (error) {
        console.error("Error updating operator:", error);
        if (error instanceof z.ZodError) return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
        return NextResponse.json({ message: "Error updating operator" }, { status: 500 });
    }
}

export async function DELETE(request, props) {
    const params = await props.params;
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canDelete = await verifySessionPermission(session, "Operators", "Delete");
    if (!canDelete) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json({ message: "Invalid ID" }, { status: 400 });

    try {
        const { inUse, usedIn, counts } = await checkEntityUsage("operator", id);
        if (inUse)
            return NextResponse.json({ message: buildUsageError(usedIn, counts) }, { status: 409 });

        const [opRows] = await dbTenant(`SELECT name FROM \`operators\` WHERE id = ? LIMIT 1`, [id]);
        const opName = opRows?.[0]?.name ?? `ID:${id}`;

        await withTenantTransaction(async (tx) => {
            await tx.execute(`DELETE FROM \`operator_documents\` WHERE operatorId = ?`, [id]);
            await tx.execute(`DELETE FROM \`operators\` WHERE id = ?`, [id]);
        });

        await logActivity("OPERATOR", id, "DELETE", `Deleted operator: ${opName}`);
        revalidatePath("/operators");
        revalidatePath(`/operators/${id}`);
        return NextResponse.json({ message: "Operator deleted successfully" });
    } catch (error) {
        console.error("Error deleting operator:", error);
        return NextResponse.json({ message: "Error deleting operator" }, { status: 500 });
    }
}
