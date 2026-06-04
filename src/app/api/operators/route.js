import { NextResponse } from "next/server";
import { dbTenant, getTenantPool, withTenantTransaction } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import * as z from "zod";
import { reserveSequentialCode } from "@/app/lib/sequential-code";
import { getSubdomain } from "@/app/lib/db";

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
    baseRateType: z.literal("HOURLY").default("HOURLY"),
    hourlyRate: z.number().min(0),
    documents: z.array(z.object({
        documentTypeId: z.number(),
        name: z.string().optional().nullable(),
        url: z.string(),
        expiryDate: z.string().optional().nullable(),
    })).optional(),
});

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canView = await verifySessionPermission(session, "Operators", "View");
        if (!canView)
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const [operators] = await dbTenant(
            `SELECT o.*,
                    n.name as nationality_name,
                    lt.name as licenseType_name
             FROM \`operators\` o
             LEFT JOIN \`nationalities\` n ON n.id = o.nationalityId
             LEFT JOIN \`license_types\` lt ON lt.id = o.licenseTypeId
             ORDER BY o.createdAt DESC, o.id DESC`,
            []
        );

        const operatorIds = (operators || []).map((op) => op.id);
        const docsByOperator = {};
        if (operatorIds.length > 0) {
            const placeholders = operatorIds.map(() => "?").join(",");
            const [allDocs] = await dbTenant(
                `SELECT od.*, dt.name as documentTypeName
                 FROM \`operator_documents\` od
                 LEFT JOIN \`operator_document_types\` dt ON dt.id = od.documentTypeId
                 WHERE od.operatorId IN (${placeholders})`,
                operatorIds
            );
            for (const doc of allDocs) {
                if (!docsByOperator[doc.operatorId]) docsByOperator[doc.operatorId] = [];
                docsByOperator[doc.operatorId].push(doc);
            }
        }

        const enriched = (operators || []).map((op) => ({
            ...op,
            nationality: op.nationalityId ? { id: op.nationalityId, name: op.nationality_name } : null,
            licenseType: { id: op.licenseTypeId, name: op.licenseType_name },
            documents: docsByOperator[op.id] || [],
        }));

        return NextResponse.json(enriched);
    } catch (error) {
        console.error("Error fetching operators:", error);
        return NextResponse.json({ message: "Error fetching operators" }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canEdit = await verifySessionPermission(session, "Operators", "Edit");
    if (!canEdit)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });


    try {
        const body = await request.json();
        const data = operatorSchema.parse(body);

        if (data.licenseNumber) {
            const [existing] = await dbTenant(`SELECT id, name FROM \`operators\` WHERE licenseNumber = ? LIMIT 1`, [data.licenseNumber]);
            if (existing?.[0])
                return NextResponse.json({ message: `An operator with license number "${data.licenseNumber}" already exists (${existing[0].name}).` }, { status: 409 });
        }
        if (data.email) {
            const [existing] = await dbTenant(`SELECT id, name FROM \`operators\` WHERE email = ? LIMIT 1`, [data.email]);
            if (existing?.[0])
                return NextResponse.json({ message: `An operator with email "${data.email}" already exists (${existing[0].name}).` }, { status: 409 });
        }

        const operatorId = await withTenantTransaction(async (tx) => {
            const { code } = await reserveSequentialCode(tx, {
                tableName: "operator_code_rules",
                createSql: "INSERT INTO `operator_code_rules` (prefix, startingNumber, padding, updatedAt) VALUES (?, ?, ?, NOW())",
                createParams: ["OPR", 1, 4],
                separator: "-",
                entityTableName: "operators",
                entityCodeField: "operatorCode",
            });

            const [result] = await tx.execute(
                `INSERT INTO \`operators\` (operatorCode, name, nationalityId, phoneNumber, phoneCountryCode, email, address,
                 experienceYears, licenseTypeId, licenseNumber, licenseIssueDate, licenseExpiry,
                 status, baseRateType, hourlyRate, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                    code, data.name, data.nationalityId || null, data.phoneNumber || null,
                    data.phoneCountryCode || '+971', data.email || null, data.address || null, data.experienceYears || null,
                    data.licenseTypeId, data.licenseNumber || null,
                    data.licenseIssueDate ? new Date(data.licenseIssueDate) : null,
                    data.licenseExpiry ? new Date(data.licenseExpiry) : null,
                    data.status, data.baseRateType, data.hourlyRate,
                ]
            );
            const newId = result.insertId;

            if (data.documents?.length > 0) {
                for (const doc of data.documents) {
                    await tx.execute(
                        `INSERT INTO \`operator_documents\` (documentTypeId, name, url, expiryDate, operatorId, createdAt)
                         VALUES (?, ?, ?, ?, ?, NOW())`,
                        [doc.documentTypeId, doc.name || "", doc.url, doc.expiryDate ? new Date(doc.expiryDate) : null, newId]
                    );
                }
            }
            return newId;
        });

        await logActivity("OPERATOR", operatorId, "CREATE", `Created operator ID: ${operatorId}`);
        const [rows] = await dbTenant(`SELECT * FROM \`operators\` WHERE id = ? LIMIT 1`, [operatorId]);
        return NextResponse.json(rows?.[0] || { id: operatorId });
    } catch (error) {
        console.error("Error creating operator:", error);
        if (error instanceof z.ZodError)
            return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
        return NextResponse.json({ message: "Error creating operator" }, { status: 500 });
    }
}
