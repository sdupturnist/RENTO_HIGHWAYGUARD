import { NextResponse } from "next/server";
import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { z } from "zod";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";

const attachmentSchema = z.object({
    id: z.coerce.number().optional(),
    name: z.string().min(1),
    url: z.string().min(1),
    remarks: z.string().optional().nullable(),
});

const detourChildSchema = z.object({
    id: z.coerce.number().optional(),
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

const assignmentBlockSchema = z.object({
    id: z.coerce.number().optional(),
    blockType: z.enum(["VEHICLE", "OPERATOR", "MATERIAL", "LABOUR", "DETOUR"]).default("VEHICLE"),
    vehicleId: z.coerce.number().nullable().optional(),
    operatorId: z.coerce.number().nullable().optional(),
    withOperator: z.coerce.boolean().default(false),
    workType: z.string().nullable().optional(),
    materialId: z.coerce.number().nullable().optional(),
    labourTypeId: z.coerce.number().nullable().optional(),
    quantity: z.coerce.number().nullable().optional(),
    detourTemplateId: z.coerce.number().nullable().optional(),
    defaultHours: z.coerce.number().nullable().optional(),
    bundleBilling: z.coerce.boolean().default(false),
    detourChildren: z.array(detourChildSchema).optional(),
    startDate: z.string().transform((val) => new Date(val)),
    endDate: z.string().transform((val) => new Date(val)),
    billingCycle: z.enum(["HOURLY", "DAILY"]).nullable().optional(),
    enableAutoTimeLogs: z.coerce.boolean().default(true),
    plannedOvertimeHours: z.coerce.number().default(0),
    includeWeekendsForAutoLogs: z.coerce.boolean().default(false),
    attachments: z.array(attachmentSchema).nullable().optional(),
});

const updateAssignmentSchema = z.object({
    customerId: z.coerce.number().nullable().optional(),
    projectId: z.coerce.number().nullable().optional(),
    isInternal: z.coerce.boolean().default(false),
    startDate: z.string().transform((val) => new Date(val)),
    endDate: z.string().transform((val) => new Date(val)),
    billingCycle: z.enum(["HOURLY", "DAILY"]),
    status: z.enum(["DRAFT", "ACTIVE", "COMPLETED"]),
    enableAutoTimeLogs: z.coerce.boolean().default(true),
    blocks: z.array(assignmentBlockSchema).min(1),
    attachments: z.array(attachmentSchema).nullable().optional(),
}).refine(d => d.isInternal || (d.customerId != null && d.customerId > 0), {
    message: "Customer is required for non-internal assignments",
    path: ["customerId"],
}).refine(d => d.isInternal || (d.projectId != null && d.projectId > 0), {
    message: "Project is required for non-internal assignments",
    path: ["projectId"],
});

const partialUpdateSchema = z.object({
    status: z.enum(["DRAFT", "ACTIVE", "COMPLETED"]),
});

export async function GET(request, { params }) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canView = await verifySessionPermission(session, "Assignment", "List View");
    if (!canView)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt((await params).id);
    if (isNaN(id)) return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    const [aRows] = await dbTenant(`
        SELECT a.*, c.companyName as customer_companyName, p.name as project_name
        FROM \`assignments\` a
        LEFT JOIN \`customers\` c ON c.id = a.customerId
        LEFT JOIN \`projects\` p ON p.id = a.projectId
        WHERE a.id = ? LIMIT 1
    `, [id]);

    if (!aRows || aRows.length === 0)
        return NextResponse.json({ message: "Assignment not found" }, { status: 404 });

    const aRow = aRows[0];
    // Fetch top-level blocks (non-children)
    const [blocks] = await dbTenant(`
        SELECT b.*,
               v.vehicleCode, v.regNo,
               o.name AS operator_name, o.operatorCode AS operator_code,
               m.name AS material_name, m.materialCode,
               l.labourType, l.labourCode,
               dt.name AS detourTemplate_name, dt.templateCode
        FROM \`assignment_blocks\` b
        LEFT JOIN \`vehicles\` v ON v.id = b.vehicleId
        LEFT JOIN \`operators\` o ON o.id = b.operatorId
        LEFT JOIN \`materials\` m ON m.id = b.materialId
        LEFT JOIN \`labours\` l ON l.id = b.labourTypeId
        LEFT JOIN \`detour_service_templates\` dt ON dt.id = b.detourTemplateId
        WHERE b.assignmentId = ? AND b.detourBlockId IS NULL
        ORDER BY b.startDate ASC
    `, [id]);
    const [attachments] = await dbTenant(`SELECT * FROM \`assignment_attachments\` WHERE assignmentId = ?`, [id]);

    const enrichedBlocks = await Promise.all((blocks || []).map(async (b) => {
        // For DETOUR blocks, also fetch children
        let detourChildren = [];
        if (b.blockType === "DETOUR") {
            const [children] = await dbTenant(`
                SELECT c.*,
                       v.vehicleCode, v.regNo,
                       o.name AS operator_name, o.operatorCode AS operator_code,
                       m.name AS material_name,
                       l.labourType
                FROM \`assignment_blocks\` c
                LEFT JOIN \`vehicles\` v ON v.id = c.vehicleId
                LEFT JOIN \`operators\` o ON o.id = c.operatorId
                LEFT JOIN \`materials\` m ON m.id = c.materialId
                LEFT JOIN \`labours\` l ON l.id = c.labourTypeId
                WHERE c.detourBlockId = ?
                ORDER BY c.blockType, c.startDate ASC
            `, [b.id]);
            detourChildren = (children || []).map(c => ({
                ...c,
                vehicle: c.vehicleId ? { id: c.vehicleId, vehicleCode: c.vehicleCode, regNo: c.regNo } : null,
                operator: c.operatorId ? { id: c.operatorId, name: c.operator_name, operatorCode: c.operator_code } : null,
                material: c.materialId ? { id: c.materialId, name: c.material_name } : null,
                labour: c.labourTypeId ? { id: c.labourTypeId, labourType: c.labourType } : null,
            }));
        }

        return {
            ...b,
            vehicle: b.vehicleId ? { id: b.vehicleId, vehicleCode: b.vehicleCode, regNo: b.regNo } : null,
            operator: b.operatorId ? { id: b.operatorId, name: b.operator_name, operatorCode: b.operator_code } : null,
            material: b.materialId ? { id: b.materialId, name: b.material_name, materialCode: b.materialCode } : null,
            labour: b.labourTypeId ? { id: b.labourTypeId, labourType: b.labourType, labourCode: b.labourCode } : null,
            detourTemplate: b.detourTemplateId ? { id: b.detourTemplateId, name: b.detourTemplate_name, templateCode: b.templateCode } : null,
            detourChildren,
        };
    }));

    return NextResponse.json({
        ...aRow,
        customer: aRow.customerId ? { id: aRow.customerId, companyName: aRow.customer_companyName } : null,
        project: aRow.projectId ? { id: aRow.projectId, name: aRow.project_name } : null,
        blocks: enrichedBlocks,
        attachments: attachments || [],
    });
}

export async function PUT(request, { params }) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canEdit = await verifySessionPermission(session, "Assignment", "Edit");
    if (!canEdit)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt((await params).id);
    if (isNaN(id)) return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    try {
        const canSplit = true;

        const body = await request.json();
        const parsed = updateAssignmentSchema.parse(body);
        const data = {
            ...parsed,
            enableAutoTimeLogs: parsed.enableAutoTimeLogs,
            blocks: parsed.blocks.map((block) => ({
                ...block,
                enableAutoTimeLogs: block.enableAutoTimeLogs,
            })),
        };

        // --- Block: Vehicle Under Maintenance ---
        const vehicleIds = data.blocks.flatMap(b =>
            b.blockType === "DETOUR"
                ? (b.detourChildren || []).map(c => c.vehicleId).filter(Boolean)
                : b.vehicleId ? [b.vehicleId] : []
        );
        if (vehicleIds.length > 0) {
            const placeholders = vehicleIds.map(() => '?').join(',');
            const [maintenanceVehicles] = await dbTenant(
                `SELECT id, vehicleCode FROM \`vehicles\` WHERE id IN (${placeholders}) AND status = 'UNDER_MAINTENANCE'`,
                vehicleIds
            );
            if (maintenanceVehicles && maintenanceVehicles.length > 0) {
                const codes = maintenanceVehicles.map(v => v.vehicleCode).join(", ");
                return NextResponse.json({ message: `Cannot assign vehicles under maintenance: ${codes}` }, { status: 400 });
            }
        }

        // Fetch existing assignment with blocks (top-level only)
        const [existRows] = await dbTenant(`SELECT * FROM \`assignments\` WHERE id = ? LIMIT 1`, [id]);
        if (!existRows || existRows.length === 0)
            return NextResponse.json({ message: "Assignment not found" }, { status: 404 });
        const existingAssignment = existRows[0];

        // Fetch all existing blocks (both top-level and children)
        const [existBlocks] = await dbTenant(`SELECT * FROM \`assignment_blocks\` WHERE assignmentId = ?`, [id]);
        const existingBlocks = existBlocks || [];

        // For each existing block, check if it has time logs
        const existingBlocksWithLogs = await Promise.all(existingBlocks.map(async (b) => {
            const [tlCheck] = await dbTenant(`SELECT id FROM \`daily_time_logs\` WHERE assignmentBlockId = ? LIMIT 1`, [b.id]);
            return { ...b, hasTimeLogs: (tlCheck || []).length > 0 };
        }));

        // --- Block: Protect blocks with time logs from vehicle/operator change ---
        if (canSplit) {
            for (const block of data.blocks) {
                if (block.id) {
                    const oldBlock = existingBlocksWithLogs.find(b => b.id === block.id);
                    if (oldBlock && oldBlock.hasTimeLogs) {
                        if (block.vehicleId !== oldBlock.vehicleId || block.operatorId !== oldBlock.operatorId) {
                            return NextResponse.json(
                                { message: "Cannot modify vehicle or operator for a block that already has time logs. Use Replace/Change from the Assignment View page instead." },
                                { status: 400 }
                            );
                        }
                    }
                }
            }
        }

        // Availability and required field validations before transaction
        const { validateAssignmentBlocks } = await import("@/app/lib/availability");
        await validateAssignmentBlocks(data.blocks, id);

        // Collect all incoming top-level block IDs (exclude DETOUR children which are re-created)
        const existingTopLevelIds = existingBlocks.filter(b => !b.detourBlockId).map(b => b.id);
        const incomingTopLevelIds = data.blocks.map(b => b.id).filter(Boolean);
        const blocksToDelete = existingTopLevelIds.filter(bid => !incomingTopLevelIds.includes(bid));

        await withTenantTransaction(async (tx) => {
            // Delete removed top-level blocks and all their children
            for (const blockId of blocksToDelete) {
                // Delete children first
                const [childBlocks] = await tx.execute(`SELECT id FROM \`assignment_blocks\` WHERE detourBlockId = ?`, [blockId]);
                for (const child of childBlocks || []) {
                    await tx.execute(`DELETE FROM \`daily_time_logs\` WHERE assignmentBlockId = ?`, [child.id]);
                    await tx.execute(`DELETE FROM \`assignment_blocks\` WHERE id = ?`, [child.id]);
                }
                await tx.execute(`DELETE FROM \`assignment_blocks\` WHERE id = ?`, [blockId]);
            }

            for (const block of data.blocks) {
                if (block.id && existingTopLevelIds.includes(block.id)) {
                    // Update existing top-level block
                    const oldBlock = existingBlocksWithLogs.find(b => b.id === block.id);

                    // Sync time logs for VEHICLE blocks if resources changed
                    if (block.blockType === "VEHICLE" && oldBlock) {
                        const tlFields = [];
                        const tlVals = [];
                        if (block.vehicleId !== oldBlock.vehicleId && block.vehicleId != null) {
                            tlFields.push("vehicleId = ?"); tlVals.push(block.vehicleId);
                        }
                        if (block.operatorId !== oldBlock.operatorId) {
                            tlFields.push("operatorId = ?"); tlVals.push(block.operatorId ?? null);
                        }
                        if (tlFields.length > 0) {
                            await tx.execute(
                                `UPDATE \`daily_time_logs\` SET ${tlFields.join(", ")} WHERE assignmentBlockId = ?`,
                                [...tlVals, block.id]
                            );
                        }
                    }

                    await tx.execute(`
                        UPDATE \`assignment_blocks\` SET
                          blockType = ?, vehicleId = ?, operatorId = ?, withOperator = ?, workType = ?,
                          materialId = ?, labourTypeId = ?, quantity = ?,
                          detourTemplateId = ?, defaultHours = ?, bundleBilling = ?,
                          startDate = ?, endDate = ?, billingCycle = ?,
                          enableAutoTimeLogs = ?, plannedOvertimeHours = ?, includeWeekendsForAutoLogs = ?,
                          updatedAt = NOW()
                        WHERE id = ?
                    `, [
                        block.blockType ?? "VEHICLE",
                        block.vehicleId ?? null, block.operatorId ?? null, block.withOperator ? 1 : 0, block.workType ?? null,
                        block.materialId ?? null, block.labourTypeId ?? null, block.quantity ?? null,
                        block.detourTemplateId ?? null, block.defaultHours ?? null, block.bundleBilling ? 1 : 0,
                        block.startDate, block.endDate, block.billingCycle ?? null,
                        block.enableAutoTimeLogs ? 1 : 0, block.plannedOvertimeHours ?? 0, block.includeWeekendsForAutoLogs ? 1 : 0,
                        block.id,
                    ]);

                    // For DETOUR: replace all children
                    if (block.blockType === "DETOUR") {
                        const [oldChildren] = await tx.execute(`SELECT id FROM \`assignment_blocks\` WHERE detourBlockId = ?`, [block.id]);
                        for (const child of oldChildren || []) {
                            await tx.execute(`DELETE FROM \`assignment_blocks\` WHERE id = ?`, [child.id]);
                        }
                        for (const child of block.detourChildren || []) {
                            await insertBlockInTx(tx, id, child, block.startDate, block.endDate, block.id);
                        }
                    }
                } else {
                    // Create new block
                    if (block.blockType === "DETOUR") {
                        const [detourRes] = await tx.execute(`
                            INSERT INTO \`assignment_blocks\`
                            (assignmentId, blockType, detourTemplateId, startDate, endDate, defaultHours,
                             plannedOvertimeHours, bundleBilling, billingCycle, enableAutoTimeLogs,
                             includeWeekendsForAutoLogs, status, createdAt, updatedAt)
                            VALUES (?, 'DETOUR', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', NOW(), NOW())
                        `, [
                            id, block.detourTemplateId ?? null, block.startDate, block.endDate,
                            block.defaultHours ?? 8, block.plannedOvertimeHours ?? 0,
                            block.bundleBilling ? 1 : 0, block.billingCycle ?? null,
                            block.enableAutoTimeLogs ? 1 : 0,
                            block.includeWeekendsForAutoLogs ? 1 : 0,
                        ]);
                        const detourBlockId = detourRes.insertId;
                        for (const child of block.detourChildren || []) {
                            await insertBlockInTx(tx, id, child, block.startDate, block.endDate, detourBlockId);
                        }
                    } else {
                        await insertBlockInTx(tx, id, block, null, null, null);
                    }
                }
            }

            // Update assignment header
            await tx.execute(`DELETE FROM \`assignment_attachments\` WHERE assignmentId = ?`, [id]);
            await tx.execute(`
                UPDATE \`assignments\` SET
                customerId = ?, projectId = ?, isInternal = ?,
                startDate = ?, endDate = ?, billingCycle = ?,
                status = ?, enableAutoTimeLogs = ?, updatedAt = NOW()
                WHERE id = ?
            `, [
                data.customerId ?? null, data.projectId ?? null, data.isInternal ? 1 : 0,
                data.startDate, data.endDate, data.billingCycle,
                data.status, data.enableAutoTimeLogs ? 1 : 0, id,
            ]);

            if (data.attachments?.length > 0) {
                for (const att of data.attachments) {
                    await tx.execute(
                        `INSERT INTO \`assignment_attachments\` (assignmentId, name, url, remarks, createdAt) VALUES (?, ?, ?, ?, NOW())`,
                        [id, att.name, att.url, att.remarks || null]
                    );
                }
            }
        });

        // Clean up auto-generated time logs outside new date range
        if (data.startDate > new Date(existingAssignment.startDate) || data.endDate < new Date(existingAssignment.endDate)) {
            await dbTenant(`
                DELETE FROM \`daily_time_logs\`
                WHERE assignmentId = ? AND autoGenerated = 1
                AND (date < ? OR date > ?)
            `, [id, data.startDate, data.endDate]);
        }

        // Trigger time log generation (non-blocking)
        try {
            const { generateDailyTimeLogs } = await import("@/app/services/timeLogGenerator");
            await generateDailyTimeLogs({ assignmentId: id, triggerSource: "UPDATE" });
        } catch (genError) {
            console.error("Failed to auto-generate time logs after assignment update:", genError);
        }

        // Refetch updated assignment for response
        const [updRows] = await dbTenant(`SELECT assignmentCode FROM \`assignments\` WHERE id = ? LIMIT 1`, [id]);
        await logActivity("ASSIGNMENT", id, "UPDATE", `Assignment ${updRows[0]?.assignmentCode} updated`);

        return NextResponse.json({ id, message: "Assignment updated successfully" });
    } catch (error) {
        if (error instanceof z.ZodError)
            return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
        const isClientError = error.message?.includes("not available") || error.message?.includes("quantity") || error.message?.includes("maintenance");
        if (isClientError) return NextResponse.json({ message: error.message }, { status: 400 });
        console.error("Error updating assignment:", error);
        return NextResponse.json({ message: "Error updating assignment", error: String(error) }, { status: 500 });
    }
}

async function insertBlockInTx(tx, assignmentId, block, overrideStart, overrideEnd, detourBlockId) {
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
        block.vehicleId ?? null, block.operatorId ?? null, block.withOperator ? 1 : 0, block.workType ?? null,
        block.materialId ?? null, block.labourTypeId ?? null, block.quantity ?? null,
        detourBlockId ?? null,
        startDate, endDate, block.billingCycle ?? null,
        enableAuto,
        block.plannedOvertimeHours ?? 0, block.includeWeekendsForAutoLogs ? 1 : 0,
    ]);
    const blockId = res.insertId;
    return blockId;
}

export async function PATCH(request, { params }) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canEdit = await verifySessionPermission(session, "Assignment", "Edit");
    if (!canEdit)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt((await params).id);
    if (isNaN(id)) return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    try {
        const body = await request.json();
        const data = partialUpdateSchema.parse(body);

        await dbTenant(`UPDATE \`assignments\` SET status = ?, updatedAt = NOW() WHERE id = ?`, [data.status, id]);
        const [rows] = await dbTenant(`SELECT assignmentCode FROM \`assignments\` WHERE id = ? LIMIT 1`, [id]);

        await logActivity("ASSIGNMENT", id, "UPDATE", `Assignment status updated to ${data.status}`);
        return NextResponse.json({ id, assignmentCode: rows[0]?.assignmentCode, status: data.status });
    } catch (error) {
        if (error instanceof z.ZodError)
            return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
        return NextResponse.json({ message: "Error updating assignment" }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canDelete = await verifySessionPermission(session, "Assignment", "Delete");
    if (!canDelete)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt((await params).id);
    if (isNaN(id)) return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
    try {
        // Cascade-delete: blocks → block attachments, time logs, then assignment
        const [blocks] = await dbTenant(`SELECT id FROM \`assignment_blocks\` WHERE assignmentId = ?`, [id]);
        await withTenantTransaction(async (tx) => {
            for (const b of (blocks || [])) {
                await tx.execute(`DELETE FROM \`daily_time_logs\` WHERE assignmentBlockId = ?`, [b.id]);
                await tx.execute(`DELETE FROM \`assignment_blocks\` WHERE id = ?`, [b.id]);
            }
            await tx.execute(`DELETE FROM \`assignment_attachments\` WHERE assignmentId = ?`, [id]);
            await tx.execute(`DELETE FROM \`assignments\` WHERE id = ?`, [id]);
        });

        await logActivity("ASSIGNMENT", id, "DELETE", `Assignment ID ${id} deleted`);
        return NextResponse.json({ message: "Assignment deleted successfully" });
    } catch (error) {
        console.error("Error deleting assignment:", error);
        return NextResponse.json({ message: "Error deleting assignment" }, { status: 500 });
    }
}
