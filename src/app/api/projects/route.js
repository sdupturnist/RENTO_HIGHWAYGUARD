import { NextResponse } from "next/server";
import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { z } from "zod";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import { reserveSequentialCode } from "@/app/lib/sequential-code";
import { revalidatePath } from "next/cache";

const createProjectSchema = z.object({
    name: z.string().min(1),
    location: z.string().optional(),
    billingCycle: z.enum(["HOURLY", "DAILY"]),
    customerId: z.coerce.number(),
    lpoNumber: z.string().optional().nullable(),
    lpoAttachmentPath: z.string().optional().nullable(),
    lpoAttachmentName: z.string().optional().nullable(),
    fullDayHours: z.coerce.number().min(0).max(24).optional().nullable(),
    overtimeStartsAfter: z.coerce.number().min(0).max(24).optional().nullable(),
});

export async function GET(request) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canView = await verifySessionPermission(session, "Projects", "View");
    if (!canView)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const hasActiveAssignments = searchParams.get("hasActiveAssignments") === "true";

    let sql = `
        SELECT p.*, c.companyName as customer_companyName
        FROM \`projects\` p
        LEFT JOIN \`customers\` c ON c.id = p.customerId
    `;
    const params = [];
    const conditions = [];

    if (customerId) {
        conditions.push("p.customerId = ?");
        params.push(parseInt(customerId));
    }
    if (hasActiveAssignments) {
        conditions.push(`EXISTS (
            SELECT 1 FROM \`assignments\` a WHERE a.projectId = p.id AND a.status IN ('ACTIVE', 'COMPLETED')
        )`);
    }
    if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY p.name ASC";

    const [projects] = await dbTenant(sql, params);

    const result = (projects || []).map((p) => ({
        ...p,
        customer: { companyName: p.customer_companyName },
    }));

    return NextResponse.json(result);
}

export async function POST(request) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canEdit = await verifySessionPermission(session, "Projects", "Edit");
    if (!canEdit)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });


    try {
        const body = await request.json();
        const data = createProjectSchema.parse(body);

        const [existing] = await dbTenant(
            `SELECT id FROM \`projects\` WHERE customerId = ? AND name = ? LIMIT 1`,
            [data.customerId, data.name]
        );
        if (existing?.[0])
            return NextResponse.json({ message: "Project name already exists for this client." }, { status: 400 });

        const projectId = await withTenantTransaction(async (tx) => {
            const { code } = await reserveSequentialCode(tx, {
                tableName: "project_code_rules",
                createSql: "INSERT INTO `project_code_rules` (prefix, startingNumber, padding, defaultBilling, updatedAt) VALUES (?, ?, ?, ?, NOW())",
                createParams: ["PRJ", 1001, 4, "DAILY"],
                separator: "-",
                entityTableName: "projects",
                entityCodeField: "projectCode",
            });

            const [result] = await tx.execute(
                `INSERT INTO \`projects\` (projectCode, name, location, billingCycle, customerId, status, lpoNumber, lpoAttachmentPath, lpoAttachmentName, fullDayHours, overtimeStartsAfter, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, NOW(), NOW())`,
                [code, data.name, data.location || null, data.billingCycle, data.customerId,
                 data.lpoNumber || null, data.lpoAttachmentPath || null, data.lpoAttachmentName || null,
                 data.fullDayHours !== undefined ? data.fullDayHours : null,
                 data.overtimeStartsAfter !== undefined ? data.overtimeStartsAfter : null]
            );
            return result.insertId;
        });

        await logActivity("PROJECT", projectId, "CREATE", `Project created ID: ${projectId}`);
        const [rows] = await dbTenant(
            `SELECT p.*, c.companyName as customer_companyName
             FROM \`projects\` p LEFT JOIN \`customers\` c ON c.id = p.customerId
             WHERE p.id = ? LIMIT 1`,
            [projectId]
        );
        const p = rows?.[0];
        revalidatePath("/projects");
        return NextResponse.json({ ...p, customer: { companyName: p?.customer_companyName } });
    } catch (error) {
        if (error instanceof z.ZodError)
            return NextResponse.json({ message: "Validation error", errors: error.errors }, { status: 400 });
        return NextResponse.json({ message: "Error creating project" }, { status: 500 });
    }
}
