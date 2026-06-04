import { NextResponse } from "next/server";
import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import { reserveSequentialCode } from "@/app/lib/sequential-code";
import { z } from "zod";

const requirementSchema = z.object({
    resourceType: z.enum(["MATERIAL", "LABOUR"]),
    resourceId: z.number().int().positive(),
    quantity: z.number().min(0.01),
});

const templateSchema = z.object({
    name: z.string().min(1),
    vehicleCount: z.number().int().min(0).default(0),
    operatorCount: z.number().int().min(0).default(0),
    bundleCostEnabled: z.boolean().default(false),
    bundleCostPerDay: z.number().min(0).default(0),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
    remarks: z.string().optional().nullable(),
    requirements: z.array(requirementSchema).optional().default([]),
});

export async function GET(req) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canView = await verifySessionPermission(session, "Detour Services", "View");
        if (!canView) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const [templates] = await dbTenant(`
            SELECT * FROM \`detour_service_templates\` ORDER BY createdAt DESC, id DESC
        `);

        const templateIds = (templates || []).map((t) => t.id);
        const reqsByTemplate = {};
        if (templateIds.length > 0) {
            const placeholders = templateIds.map(() => "?").join(",");
            const [allReqs] = await dbTenant(`
                SELECT dtr.*,
                       CASE dtr.resourceType
                           WHEN 'MATERIAL' THEN (SELECT name FROM \`materials\` WHERE id = dtr.resourceId)
                           WHEN 'LABOUR'   THEN (SELECT labourType FROM \`labours\` WHERE id = dtr.resourceId)
                       END as resourceName
                FROM \`detour_template_requirements\` dtr
                WHERE dtr.templateId IN (${placeholders})
            `, templateIds);
            for (const req of allReqs) {
                if (!reqsByTemplate[req.templateId]) reqsByTemplate[req.templateId] = [];
                reqsByTemplate[req.templateId].push(req);
            }
        }

        const enriched = (templates || []).map((t) => ({ ...t, requirements: reqsByTemplate[t.id] || [] }));

        return NextResponse.json(enriched);
    } catch (error) {
        console.error("GET detour-templates error:", error);
        return NextResponse.json({ message: "Error fetching detour templates" }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canAdd = await verifySessionPermission(session, "Detour Services", "Add");
        if (!canAdd) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const body = await req.json();
        const data = templateSchema.parse(body);

        const templateId = await withTenantTransaction(async (tx) => {
            const { code } = await reserveSequentialCode(tx, {
                tableName: "detour_settings",
                createSql: "INSERT INTO `detour_settings` (codePrefix, startingNumber, numberPadding, defaultBundleBilling, updatedAt) VALUES (?, ?, ?, ?, NOW())",
                createParams: ["DET", 1001, 4, 0],
                prefixField: "codePrefix",
                numberField: "startingNumber",
                paddingField: "numberPadding",
                separator: "-",
                entityTableName: "detour_service_templates",
                entityCodeField: "templateCode",
            });

            const [result] = await tx.execute(
                `INSERT INTO \`detour_service_templates\`
                 (templateCode, name, vehicleCount, operatorCount, bundleCostEnabled, bundleCostPerDay, status, remarks, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                    code, data.name, data.vehicleCount, data.operatorCount,
                    data.bundleCostEnabled ? 1 : 0, data.bundleCostPerDay,
                    data.status, data.remarks ?? null
                ]
            );
            const newId = result.insertId;

            for (const req of data.requirements) {
                await tx.execute(
                    `INSERT INTO \`detour_template_requirements\` (templateId, resourceType, resourceId, quantity) VALUES (?, ?, ?, ?)`,
                    [newId, req.resourceType, req.resourceId, req.quantity]
                );
            }

            return newId;
        });

        await logActivity("DETOUR_TEMPLATE", templateId, "CREATE", `Created detour template: ${data.name}`);
        return NextResponse.json({ id: templateId, success: true }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError)
            return NextResponse.json({ message: "Validation failed", errors: error.errors }, { status: 400 });
        console.error("POST detour-template error:", error);
        return NextResponse.json({ message: "Error creating detour template" }, { status: 500 });
    }
}
