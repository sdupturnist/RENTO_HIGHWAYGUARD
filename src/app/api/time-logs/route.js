import { NextResponse } from "next/server";
import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { z } from "zod";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";

const timeLogSchema = z.object({
    date: z.coerce.date(),
    assignmentId: z.coerce.number(),
    assignmentBlockId: z.coerce.number(),
    workType: z.string().optional().nullable(),
    workedHours: z.coerce.number().min(0).max(24).default(0),
    quantity: z.coerce.number().min(0).optional().nullable(),
    isWeekend: z.coerce.boolean().default(false),
    isHoliday: z.coerce.boolean().default(false),
    remarks: z.string().optional().nullable(),
});

export async function GET(request) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canView = await verifySessionPermission(session, "Daily Time Logs", "View");
    if (!canView)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1") || 1;
    const perPage = parseInt(searchParams.get("perPage") || "50") || 50;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const assignmentId = searchParams.get("assignmentId");
    const customerId = searchParams.get("customerId");
    const vehicleId = searchParams.get("vehicleId");
    const blockType = searchParams.get("blockType");
    const search = searchParams.get("search");

    const conditions = [];
    const params = [];

    let fromDateStr = null;
    let toDateStr = null;
    if (from) fromDateStr = `${from.substring(0, 10)} 00:00:00`;
    if (to) toDateStr = `${to.substring(0, 10)} 23:59:59.999`;

    if (fromDateStr && toDateStr) { conditions.push("dtl.date BETWEEN ? AND ?"); params.push(fromDateStr, toDateStr); }
    else if (fromDateStr) { conditions.push("dtl.date >= ?"); params.push(fromDateStr); }
    else if (toDateStr) { conditions.push("dtl.date <= ?"); params.push(toDateStr); }
    if (assignmentId) { conditions.push("dtl.assignmentId = ?"); params.push(parseInt(assignmentId)); }
    if (customerId) { conditions.push("dtl.customerId = ?"); params.push(parseInt(customerId)); }
    if (vehicleId) { conditions.push("dtl.vehicleId = ?"); params.push(parseInt(vehicleId)); }
    if (blockType) { conditions.push("dtl.blockType = ?"); params.push(blockType); }
    if (search) {
        conditions.push("(a.assignmentCode LIKE ? OR c.companyName LIKE ? OR p.name LIKE ? OR v.regNo LIKE ? OR dtl.remarks LIKE ?)");
        const s = `%${search}%`;
        params.push(s, s, s, s, s);
    }

    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

    try {
        const offset = (page - 1) * perPage;
        const [timeLogs] = await dbTenant(`
            SELECT dtl.*,
                   a.assignmentCode,
                   c.companyName as customer_companyName,
                   p.name as project_name,
                   v.regNo as vehicle_regNo,
                   vb.name as vehicle_brand,
                   vm.name as vehicle_model,
                   vt.name as vehicle_type,
                   o.name as operator_name,
                   mat.name as material_name,
                   lab.labourType as labour_type_name
            FROM \`daily_time_logs\` dtl
            LEFT JOIN \`assignments\` a ON a.id = dtl.assignmentId
            LEFT JOIN \`customers\` c ON c.id = dtl.customerId
            LEFT JOIN \`projects\` p ON p.id = dtl.projectId
            LEFT JOIN \`vehicles\` v ON v.id = dtl.vehicleId
            LEFT JOIN \`vehicle_brands\` vb ON vb.id = v.brandId
            LEFT JOIN \`vehicle_models\` vm ON vm.id = v.modelId
            LEFT JOIN \`vehicle_types\` vt ON vt.id = v.typeId
            LEFT JOIN \`operators\` o ON o.id = dtl.operatorId
            LEFT JOIN \`materials\` mat ON mat.id = dtl.materialId
            LEFT JOIN \`labours\` lab ON lab.id = dtl.labourTypeId
            ${where}
            ORDER BY dtl.date DESC
            LIMIT ${perPage} OFFSET ${offset}
        `, params);

        const [countResult] = await dbTenant(`
            SELECT COUNT(*) as total FROM \`daily_time_logs\` dtl
            LEFT JOIN \`assignments\` a ON a.id = dtl.assignmentId
            LEFT JOIN \`customers\` c ON c.id = dtl.customerId
            LEFT JOIN \`projects\` p ON p.id = dtl.projectId
            LEFT JOIN \`vehicles\` v ON v.id = dtl.vehicleId
            ${where}
        `, params);

        const result = (timeLogs || []).map(row => ({
            ...row,
            assignment: { assignmentCode: row.assignmentCode },
            customer: row.customer_companyName ? { companyName: row.customer_companyName } : null,
            project: row.project_name ? { name: row.project_name } : null,
            vehicle: row.vehicle_regNo ? {
                regNo: row.vehicle_regNo,
                brand: { name: row.vehicle_brand },
                model: { name: row.vehicle_model },
                vehicleType: { name: row.vehicle_type },
            } : null,
            operator: row.operator_name ? { name: row.operator_name } : null,
            material: row.material_name ? { name: row.material_name } : null,
            labour: row.labour_type_name ? { labourType: row.labour_type_name } : null,
        }));

        return NextResponse.json({ timeLogs: result, total: countResult[0]?.total || 0, page, perPage });
    } catch (error) {
        console.error("Error fetching time logs - Full Error:", error);
        return NextResponse.json({ message: "Error fetching time logs", error: String(error) }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canEdit = await verifySessionPermission(session, "Daily Time Logs", "Edit");
    if (!canEdit)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });


    try {
        const body = await request.json();
        const data = timeLogSchema.parse(body);

        // Fetch assignment
        const [assignRows] = await dbTenant(`SELECT * FROM \`assignments\` WHERE id = ? LIMIT 1`, [data.assignmentId]);
        const assignment = assignRows?.[0];
        if (!assignment)
            return NextResponse.json({ message: "Assignment not found" }, { status: 400 });

        const logDateStr = data.date.toISOString().split("T")[0];
        const assignmentStartStr = assignment.startDate.toISOString ? assignment.startDate.toISOString().split("T")[0] : String(assignment.startDate).split("T")[0];
        const assignmentEndStr = assignment.endDate.toISOString ? assignment.endDate.toISOString().split("T")[0] : String(assignment.endDate).split("T")[0];

        if (logDateStr < assignmentStartStr || logDateStr > assignmentEndStr) {
            return NextResponse.json({
                message: `Date ${logDateStr} is outside the assignment's date range (${assignmentStartStr} – ${assignmentEndStr}). Please select a date within the assignment period.`
            }, { status: 400 });
        }

        // Fetch selected block
        const [blockRows] = await dbTenant(
            `SELECT * FROM \`assignment_blocks\` WHERE id = ? AND assignmentId = ? LIMIT 1`,
            [data.assignmentBlockId, data.assignmentId]
        );
        const block = blockRows?.[0];
        if (!block)
            return NextResponse.json({ message: "Assignment block not found" }, { status: 400 });

        const blockType = block.blockType || "VEHICLE";

        // Validate that log date falls within the block's specific date range
        const blockStartStr = block.startDate.toISOString ? block.startDate.toISOString().split("T")[0] : String(block.startDate).split("T")[0];
        const blockEndStr = block.endDate.toISOString ? block.endDate.toISOString().split("T")[0] : String(block.endDate).split("T")[0];

        if (logDateStr < blockStartStr || logDateStr > blockEndStr) {
            return NextResponse.json({
                message: `Date ${logDateStr} is outside the selected block's date range (${blockStartStr} – ${blockEndStr}).`
            }, { status: 400 });
        }

        // Duplicate prevention — check by assignmentBlockId and date
        const [existingByBlockDate] = await dbTenant(
            `SELECT id, autoGenerated FROM \`daily_time_logs\`
             WHERE assignmentBlockId = ? AND date = ? LIMIT 1`,
            [data.assignmentBlockId, data.date]
        );
        if (existingByBlockDate?.[0]) {
            const existing = existingByBlockDate[0];
            const kind = existing.autoGenerated ? "auto-generated" : "manual";
            return NextResponse.json({
                message: `A ${kind} time log already exists for this resource block on this date. You can edit it instead.`,
                existingLogId: existing.id,
                shouldRedirect: true
            }, { status: 409 });
        }

        let vehicleId = null, operatorId = null, materialId = null, labourTypeId = null;
        let workType = data.workType || block.workType || "Full Day";
        let quantity = null;
        let workedHours = 0;
        let regularHours = 0, overtimeHours = 0, holidayHours = 0;
        let resourceNameSnapshot = null;
        let rateSnapshot = null;

        if (blockType === "VEHICLE") {
            vehicleId = block.vehicleId || null;
            operatorId = block.operatorId || null;
            workedHours = data.workedHours;
            if (vehicleId) {
                const [vRows] = await dbTenant(
                    `SELECT regNo, baseRentAmount FROM \`vehicles\` WHERE id = ? LIMIT 1`,
                    [vehicleId]
                );
                resourceNameSnapshot = vRows?.[0]?.regNo ?? null;
                rateSnapshot = vRows?.[0]?.baseRentAmount ?? null;
            }
        } else if (blockType === "OPERATOR") {
            operatorId = block.operatorId || null;
            workedHours = data.workedHours;
            if (operatorId) {
                const [oRows] = await dbTenant(
                    `SELECT name, hourlyRate FROM \`operators\` WHERE id = ? LIMIT 1`,
                    [operatorId]
                );
                resourceNameSnapshot = oRows?.[0]?.name ?? null;
                rateSnapshot = oRows?.[0]?.hourlyRate ?? null;
            }
        } else if (blockType === "MATERIAL") {
            materialId = block.materialId || null;
            quantity = data.quantity ?? block.quantity ?? 1;
            workType = "Material";
            if (materialId) {
                const [mRows] = await dbTenant(
                    `SELECT name, costPerDay FROM \`materials\` WHERE id = ? LIMIT 1`,
                    [materialId]
                );
                resourceNameSnapshot = mRows?.[0]?.name ?? null;
                rateSnapshot = mRows?.[0]?.costPerDay ?? null;
            }
        } else if (blockType === "LABOUR") {
            labourTypeId = block.labourTypeId || null;
            quantity = data.quantity ?? block.quantity ?? 1;
            workType = "Labour";
            if (labourTypeId) {
                const [lRows] = await dbTenant(
                    `SELECT labourType, costPerDay FROM \`labours\` WHERE id = ? LIMIT 1`,
                    [labourTypeId]
                );
                resourceNameSnapshot = lRows?.[0]?.labourType ?? null;
                rateSnapshot = lRows?.[0]?.costPerDay ?? null;
            }
        }

        if (blockType === "VEHICLE" || blockType === "OPERATOR") {
            if (workedHours > 24)
                return NextResponse.json({ message: "Worked hours cannot exceed 24" }, { status: 400 });

            const [csRows] = await dbTenant("SELECT fullDayHours FROM `company_settings` LIMIT 1");
            const fullDayHours = Number(csRows?.[0]?.fullDayHours || 8);

            if (data.isHoliday) {
                holidayHours = workedHours;
            } else if (data.isWeekend) {
                overtimeHours = workedHours;
            } else {
                regularHours = Math.min(workedHours, fullDayHours);
                overtimeHours = Math.max(0, workedHours - fullDayHours);
            }
        }

        const [result] = await dbTenant(
            `INSERT INTO \`daily_time_logs\` (
                date, assignmentId, assignmentBlockId, customerId, projectId,
                blockType, isBillable, isInternal,
                vehicleId, operatorId, materialId, labourTypeId,
                workType, quantity,
                workedHours, regularHours, overtimeHours, holidayHours,
                isWeekend, isHoliday, autoGenerated,
                resourceNameSnapshot, rateSnapshot, detourBlockId,
                remarks, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, NOW(), NOW())`,
            [
                data.date, data.assignmentId, data.assignmentBlockId,
                assignment.customerId || null, assignment.projectId || null,
                blockType, block.isBillable ?? 1, assignment.isInternal ? 1 : 0,
                vehicleId, operatorId, materialId, labourTypeId,
                workType, quantity,
                workedHours, regularHours, overtimeHours, holidayHours,
                data.isWeekend ? 1 : 0, data.isHoliday ? 1 : 0,
                resourceNameSnapshot, rateSnapshot, block.detourBlockId ?? null,
                data.remarks || null,
            ]
        );
        const newId = result.insertId;
        await logActivity("DAILYTIMELOG", newId, "CREATE", `Manual time log created for ${data.date.toISOString().split('T')[0]} - Block ID: ${data.assignmentBlockId} (${blockType})`);

        const [rows] = await dbTenant(`SELECT * FROM \`daily_time_logs\` WHERE id = ? LIMIT 1`, [newId]);
        return NextResponse.json(rows?.[0] || { id: newId }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError)
            return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
        console.error("Error creating time log:", error);
        return NextResponse.json({ message: "Error creating time log", error: String(error) }, { status: 500 });
    }
}

export async function DELETE(request) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canDelete = await verifySessionPermission(session, "Daily Time Logs", "Delete");
    if (!canDelete)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    try {
        const { ids } = await request.json();
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ message: "No IDs provided" }, { status: 400 });
        }

        await withTenantTransaction(async (tx) => {
            const placeholders = ids.map(() => "?").join(",");
            await tx.execute(`DELETE FROM \`daily_time_logs\` WHERE id IN (${placeholders})`, ids);
            for (const id of ids) {
                await logActivity("DAILYTIMELOG", id, "DELETE", `Bulk deleted time log ID: ${id}`);
            }
        });

        return NextResponse.json({ message: `${ids.length} time logs deleted successfully` });
    } catch (error) {
        console.error("Error bulk deleting time logs:", error);
        return NextResponse.json({ message: "Error deleting time logs", error: String(error) }, { status: 500 });
    }
}

