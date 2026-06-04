import { NextResponse } from "next/server";
import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { z } from "zod";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import { reserveSequentialCode } from "@/app/lib/sequential-code";
import {
    checkVehicleAvailability,
    checkOperatorAvailability,
    checkMaterialAvailability,
    checkLabourAvailability,
} from "@/app/lib/availability";

const attachmentSchema = z.object({
    name: z.string().min(1),
    url: z.string().min(1),
    remarks: z.string().optional().nullable(),
});

// Child block for DETOUR — same resource types without further nesting
const detourChildSchema = z.object({
    blockType: z.enum(["VEHICLE", "OPERATOR", "MATERIAL", "LABOUR"]),
    vehicleId: z.coerce.number().nullable().optional(),
    operatorId: z.coerce.number().nullable().optional(),
    withOperator: z.coerce.boolean().default(false),
    workType: z.string().nullable().optional(),
    materialId: z.coerce.number().nullable().optional(),
    labourTypeId: z.coerce.number().nullable().optional(),
    quantity: z.coerce.number().nullable().optional(),
    billingCycle: z.enum(["HOURLY", "DAILY"]).nullable().optional(),
    enableAutoTimeLogs: z.coerce.boolean().default(true),
    plannedOvertimeHours: z.coerce.number().default(0),
    includeWeekendsForAutoLogs: z.coerce.boolean().default(false),
    attachments: z.array(attachmentSchema).nullable().optional(),
});

const blockSchema = z.object({
    blockType: z.enum(["VEHICLE", "OPERATOR", "MATERIAL", "LABOUR", "DETOUR"]).default("VEHICLE"),
    // VEHICLE / OPERATOR fields
    vehicleId: z.coerce.number().nullable().optional(),
    operatorId: z.coerce.number().nullable().optional(),
    withOperator: z.coerce.boolean().default(false),
    workType: z.string().nullable().optional(),
    // MATERIAL / LABOUR fields
    materialId: z.coerce.number().nullable().optional(),
    labourTypeId: z.coerce.number().nullable().optional(),
    quantity: z.coerce.number().nullable().optional(),
    // DETOUR fields
    detourTemplateId: z.coerce.number().nullable().optional(),
    defaultHours: z.coerce.number().nullable().optional(),
    bundleBilling: z.coerce.boolean().default(false),
    detourChildren: z.array(detourChildSchema).optional(),
    // Common
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    billingCycle: z.enum(["HOURLY", "DAILY"]).nullable().optional(),
    enableAutoTimeLogs: z.coerce.boolean().default(true),
    plannedOvertimeHours: z.coerce.number().default(0),
    includeWeekendsForAutoLogs: z.coerce.boolean().default(false),
    attachments: z.array(attachmentSchema).nullable().optional(),
});

const createAssignmentSchema = z.object({
    customerId: z.coerce.number().nullable().optional(),
    projectId: z.coerce.number().nullable().optional(),
    isInternal: z.coerce.boolean().default(false),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    billingCycle: z.enum(["HOURLY", "DAILY"]).default("DAILY"),
    status: z.enum(["DRAFT", "ACTIVE", "COMPLETED"]).default("ACTIVE"),
    enableAutoTimeLogs: z.coerce.boolean().default(true),
    blocks: z.array(blockSchema).min(1, "At least one block is required"),
    attachments: z.array(attachmentSchema).nullable().optional(),
}).refine(d => d.isInternal || (d.customerId != null && d.customerId > 0), {
    message: "Customer is required for non-internal assignments",
    path: ["customerId"],
}).refine(d => d.isInternal || (d.projectId != null && d.projectId > 0), {
    message: "Project is required for non-internal assignments",
    path: ["projectId"],
});

export async function GET(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canView = await verifySessionPermission(session, "Assignment", "List View");
    if (!canView) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1") || 1;
    const perPage = parseInt(searchParams.get("perPage") || "10") || 10;
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const customerId = searchParams.get("customerId");
    const projectId = searchParams.get("projectId");
    const isInternal = searchParams.get("isInternal");

    let whereClause = "WHERE 1=1";
    const params = [];

    if (status) {
        whereClause += " AND a.status = ?";
        params.push(status);
    }
    if (customerId && !isNaN(parseInt(customerId))) {
        whereClause += " AND a.customerId = ?";
        params.push(parseInt(customerId));
    }
    if (projectId && !isNaN(parseInt(projectId))) {
        whereClause += " AND a.projectId = ?";
        params.push(parseInt(projectId));
    }
    if (isInternal !== null && isInternal !== undefined && isInternal !== "") {
        whereClause += " AND a.isInternal = ?";
        params.push(isInternal === "true" ? 1 : 0);
    }
    if (search) {
        whereClause += " AND (a.assignmentCode LIKE ? OR c.companyName LIKE ? OR p.name LIKE ?)";
        const s = `%${search}%`;
        params.push(s, s, s);
    }

    try {
        const offset = (page - 1) * perPage;
        const [assignments] = await dbTenant(`
            SELECT a.*, c.companyName AS customer_companyName, p.name AS project_name
            FROM \`assignments\` a
            LEFT JOIN \`customers\` c ON a.customerId = c.id
            LEFT JOIN \`projects\` p ON a.projectId = p.id
            ${whereClause}
            ORDER BY a.createdAt DESC, a.id DESC
            LIMIT ${perPage} OFFSET ${offset}
        `, params);

        const [countResult] = await dbTenant(`
            SELECT COUNT(*) AS total
            FROM \`assignments\` a
            LEFT JOIN \`customers\` c ON a.customerId = c.id
            LEFT JOIN \`projects\` p ON a.projectId = p.id
            ${whereClause}
        `, params);

        const assignmentIds = (assignments || []).map((a) => a.id);
        const blocksByAssignment = {};
        if (assignmentIds.length > 0) {
            const placeholders = assignmentIds.map(() => "?").join(",");
            const [allBlocks] = await dbTenant(`
                SELECT b.*, v.vehicleCode, v.regNo, o.name AS operatorName,
                       m.name AS materialName, l.labourType, dt.name AS detourTemplateName
                FROM \`assignment_blocks\` b
                LEFT JOIN \`vehicles\` v ON b.vehicleId = v.id
                LEFT JOIN \`operators\` o ON b.operatorId = o.id
                LEFT JOIN \`materials\` m ON b.materialId = m.id
                LEFT JOIN \`labours\` l ON b.labourTypeId = l.id
                LEFT JOIN \`detour_service_templates\` dt ON b.detourTemplateId = dt.id
                WHERE b.assignmentId IN (${placeholders}) AND (b.detourBlockId IS NULL)
            `, assignmentIds);
            for (const block of allBlocks) {
                if (!blocksByAssignment[block.assignmentId]) blocksByAssignment[block.assignmentId] = [];
                blocksByAssignment[block.assignmentId].push(block);
            }
        }

        const enriched = (assignments || []).map((a) => ({
            ...a,
            customer: a.customerId ? { companyName: a.customer_companyName } : null,
            project: a.projectId ? { name: a.project_name } : null,
            blocks: (blocksByAssignment[a.id] || []).map(enrichBlock),
        }));

        return NextResponse.json({
            assignments: enriched,
            total: countResult[0].total,
            page,
            perPage,
        });
    } catch (error) {
        console.error("GET assignments error:", error);
        return NextResponse.json({ message: "Error fetching assignments" }, { status: 500 });
    }
}

function enrichBlock(b) {
    return {
        ...b,
        vehicle: b.vehicleId ? { id: b.vehicleId, vehicleCode: b.vehicleCode, regNo: b.regNo } : null,
        operator: b.operatorId ? { id: b.operatorId, name: b.operatorName } : null,
        material: b.materialId ? { id: b.materialId, name: b.materialName } : null,
        labour: b.labourTypeId ? { id: b.labourTypeId, labourType: b.labourType } : null,
        detourTemplate: b.detourTemplateId ? { id: b.detourTemplateId, name: b.detourTemplateName } : null,
    };
}

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canEdit = await verifySessionPermission(session, "Assignment", "Edit");
    if (!canEdit) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    try {


        const body = await request.json();
        const parsed = createAssignmentSchema.parse(body);

        // Maintenance check for VEHICLE blocks
        const vehicleIds = parsed.blocks
            .filter(b => b.blockType === "VEHICLE" && b.vehicleId)
            .map(b => b.vehicleId);
        if (vehicleIds.length > 0) {
            const placeholders = vehicleIds.map(() => "?").join(",");
            const [mRows] = await dbTenant(
                `SELECT vehicleCode FROM \`vehicles\` WHERE id IN (${placeholders}) AND status = 'UNDER_MAINTENANCE'`,
                vehicleIds
            );
            if (mRows.length > 0) {
                return NextResponse.json(
                    { message: `Vehicles under maintenance: ${mRows.map(r => r.vehicleCode).join(", ")}` },
                    { status: 400 }
                );
            }
        }

        // Availability and required field validations before transaction
        const { validateAssignmentBlocks } = await import("@/app/lib/availability");
        await validateAssignmentBlocks(parsed.blocks);

        const assignmentId = await withTenantTransaction(async (tx) => {
            const { code } = await reserveSequentialCode(tx, {
                tableName: "assignment_settings",
                createSql: "INSERT INTO `assignment_settings` (codePrefix, codeStartingNumber, codePadding, updatedAt) VALUES (?, ?, ?, NOW())",
                createParams: ["ASG", 1001, 4],
                prefixField: "codePrefix",
                numberField: "codeStartingNumber",
                paddingField: "codePadding",
                separator: "-",
                entityTableName: "assignments",
                entityCodeField: "assignmentCode",
            });

            const [asgResult] = await tx.execute(`
                INSERT INTO \`assignments\`
                (assignmentCode, customerId, projectId, isInternal, startDate, endDate, billingCycle, status, enableAutoTimeLogs, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
                code,
                parsed.customerId ?? null,
                parsed.projectId ?? null,
                parsed.isInternal ? 1 : 0,
                parsed.startDate,
                parsed.endDate,
                parsed.billingCycle,
                parsed.status,
                parsed.enableAutoTimeLogs ? 1 : 0,
            ]);

            const newId = asgResult.insertId;

            for (const block of parsed.blocks) {
                if (block.blockType === "DETOUR") {
                    // Insert DETOUR parent block
                    const [detourResult] = await tx.execute(`
                        INSERT INTO \`assignment_blocks\`
                        (assignmentId, blockType, detourTemplateId, startDate, endDate, defaultHours,
                         plannedOvertimeHours, bundleBilling, billingCycle, enableAutoTimeLogs,
                         includeWeekendsForAutoLogs, status, createdAt, updatedAt)
                        VALUES (?, 'DETOUR', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())
                    `, [
                        newId,
                        block.detourTemplateId ?? null,
                        block.startDate,
                        block.endDate,
                        block.defaultHours ?? 8,
                        block.plannedOvertimeHours ?? 0,
                        block.bundleBilling ? 1 : 0,
                        block.billingCycle ?? null,
                        block.enableAutoTimeLogs ? 1 : 0,
                        block.includeWeekendsForAutoLogs ? 1 : 0,
                    ]);
                    const detourBlockId = detourResult.insertId;

                    // Insert child blocks
                    for (const child of block.detourChildren || []) {
                        await insertBlock(tx, newId, child, block.startDate, block.endDate, detourBlockId);
                    }
                } else {
                    await insertBlock(tx, newId, block, null, null, null);
                }
            }

            if (parsed.attachments?.length > 0) {
                for (const att of parsed.attachments) {
                    await tx.execute(
                        "INSERT INTO `assignment_attachments` (assignmentId, name, url, remarks, createdAt) VALUES (?, ?, ?, ?, NOW())",
                        [newId, att.name, att.url, att.remarks ?? null]
                    );
                }
            }

            return newId;
        });

        await logActivity("ASSIGNMENT", assignmentId, "CREATE", `Assignment created ID: ${assignmentId}`);

        if (parsed.status === "ACTIVE") {
            try {
                const { generateDailyTimeLogs } = await import("@/app/services/timeLogGenerator");
                await generateDailyTimeLogs(new Date());
            } catch (e) { console.error("Auto log trigger failed:", e); }
        }

        sendAssignmentNotifications(assignmentId).catch(err => console.error("Notification failed:", err));
        return NextResponse.json({ id: assignmentId, success: true }, { status: 201 });
    } catch (error) {
        console.error("POST assignment error:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
        }
        const status = (error.message?.includes("not available") || error.message?.includes("quantity") || error.message?.includes("maintenance")) ? 400 : 500;
        return NextResponse.json({ message: error.message || "Error creating assignment" }, { status });
    }
}

async function insertBlock(tx, assignmentId, block, overrideStart, overrideEnd, detourBlockId) {
    const startDate = overrideStart ?? block.startDate;
    const endDate = overrideEnd ?? block.endDate;
    const enableAuto = block.enableAutoTimeLogs ? 1 : 0;

    const [res] = await tx.execute(`
        INSERT INTO \`assignment_blocks\`
        (assignmentId, blockType, vehicleId, operatorId, withOperator, workType, isBillable,
         materialId, labourTypeId, quantity, detourBlockId,
         startDate, endDate, billingCycle, enableAutoTimeLogs, plannedOvertimeHours,
         includeWeekendsForAutoLogs, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())
    `, [
        assignmentId,
        block.blockType ?? "VEHICLE",
        block.vehicleId ?? null,
        block.operatorId ?? null,
        block.withOperator ? 1 : 0,
        block.workType ?? null,
        block.materialId ?? null,
        block.labourTypeId ?? null,
        block.quantity ?? null,
        detourBlockId ?? null,
        startDate,
        endDate,
        block.billingCycle ?? null,
        enableAuto,
        block.plannedOvertimeHours ?? 0,
        block.includeWeekendsForAutoLogs ? 1 : 0,
    ]);

    const blockId = res.insertId;
    return blockId;
}

async function sendAssignmentNotifications(assignmentId) {
    const [settingsRows] = await dbTenant("SELECT * FROM `notification_settings` LIMIT 1");
    const settings = settingsRows[0];
    if (!settings) return;

    const [asgRows] = await dbTenant(`
        SELECT a.*, c.companyName, c.email AS customerEmail, p.name AS projectName
        FROM \`assignments\` a
        LEFT JOIN \`customers\` c ON a.customerId = c.id
        LEFT JOIN \`projects\` p ON a.projectId = p.id
        WHERE a.id = ?
    `, [assignmentId]);
    const assignment = asgRows[0];
    if (!assignment) return;

    const [blockRows] = await dbTenant(`
        SELECT b.blockType, v.vehicleCode, o.name AS operatorName, m.name AS materialName, l.labourType
        FROM \`assignment_blocks\` b
        LEFT JOIN \`vehicles\` v ON b.vehicleId = v.id
        LEFT JOIN \`operators\` o ON b.operatorId = o.id
        LEFT JOIN \`materials\` m ON b.materialId = m.id
        LEFT JOIN \`labours\` l ON b.labourTypeId = l.id
        WHERE b.assignmentId = ? AND b.detourBlockId IS NULL
    `, [assignmentId]);

    const [brandingRows] = await dbTenant("SELECT appName FROM `branding_settings` LIMIT 1");
    const appName = brandingRows[0]?.appName || "RentERP";
    const initials = appName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

    const blocksHtml = blockRows.map(b => {
        if (b.blockType === "VEHICLE") return `<div style="margin-bottom:6px;">• Vehicle: ${b.vehicleCode || "Unassigned"} — Operator: ${b.operatorName || "None"}</div>`;
        if (b.blockType === "MATERIAL") return `<div style="margin-bottom:6px;">• Material: ${b.materialName}</div>`;
        if (b.blockType === "LABOUR") return `<div style="margin-bottom:6px;">• Labour: ${b.labourType}</div>`;
        return `<div style="margin-bottom:6px;">• ${b.blockType} block</div>`;
    }).join("");

    const recipients = new Set();
    const [compRows] = await dbTenant("SELECT companyEmail FROM `company_settings` LIMIT 1");
    if (settings.sendAssignmentToCustomer && assignment.customerEmail) recipients.add(assignment.customerEmail);
    if (settings.sendAssignmentToOwner && compRows[0]?.companyEmail) recipients.add(compRows[0].companyEmail);
    if (recipients.size === 0) return;

    const { sendMail } = await import("@/app/lib/email");
    await sendMail({
        to: Array.from(recipients),
        subject: `${appName}: Assignment ${assignment.assignmentCode}`,
        template: "assignment.html",
        variables: {
            APP_NAME: appName,
            APP_INITIALS: initials,
            ASSIGNMENT_CODE: assignment.assignmentCode,
            CUSTOMER: assignment.companyName || "Internal",
            PROJECT: assignment.projectName || "No project",
            START_DATE: new Date(assignment.startDate).toDateString(),
            END_DATE: new Date(assignment.endDate).toDateString(),
            BLOCKS_HTML: blocksHtml,
        },
    });
}
