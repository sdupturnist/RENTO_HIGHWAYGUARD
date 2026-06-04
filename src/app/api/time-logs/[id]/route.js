import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { z } from "zod";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";

const timeLogUpdateSchema = z.object({
    date: z.coerce.date().optional(),
    workType: z.string().min(1).optional(),
    workedHours: z.coerce.number().min(0).max(24).optional(),
    quantity: z.coerce.number().min(0).optional().nullable(),
    isWeekend: z.coerce.boolean().optional(),
    isHoliday: z.coerce.boolean().optional(),
    remarks: z.string().optional().nullable(),
});

export async function GET(request, { params }) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canView = await verifySessionPermission(session, "Daily Time Logs", "View");
    if (!canView)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt((await params).id);
    const [rows] = await dbTenant(`
        SELECT dtl.*,
               a.assignmentCode,
               c.companyName as customer_companyName,
               p.name as project_name,
               v.regNo as vehicle_regNo,
               vb.name as vehicle_brand_name,
               vm.name as vehicle_model_name,
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
        LEFT JOIN \`operators\` o ON o.id = dtl.operatorId
        LEFT JOIN \`materials\` mat ON mat.id = dtl.materialId
        LEFT JOIN \`labours\` lab ON lab.id = dtl.labourTypeId
        WHERE dtl.id = ? LIMIT 1
    `, [id]);

    if (!rows || rows.length === 0)
        return NextResponse.json({ message: "Time log not found" }, { status: 404 });

    const row = rows[0];
    return NextResponse.json({
        ...row,
        assignment: { assignmentCode: row.assignmentCode },
        customer: { companyName: row.customer_companyName },
        project: row.projectId ? { name: row.project_name } : null,
        vehicle: row.vehicle_regNo ? { regNo: row.vehicle_regNo, brand: { name: row.vehicle_brand_name }, model: { name: row.vehicle_model_name } } : null,
        operator: row.operatorId ? { name: row.operator_name } : null,
        material: row.material_name ? { name: row.material_name } : null,
        labour: row.labour_type_name ? { labourType: row.labour_type_name } : null,
    });
}

export async function PUT(request, { params }) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canEdit = await verifySessionPermission(session, "Daily Time Logs", "Edit");
    if (!canEdit)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt((await params).id);
    try {
        const body = await request.json();
        const data = timeLogUpdateSchema.parse(body);

        // Fetch existing log
        const [existing] = await dbTenant(`
            SELECT dtl.*, b.blockType as block_blockType
            FROM \`daily_time_logs\` dtl
            LEFT JOIN \`assignment_blocks\` b ON b.id = dtl.assignmentBlockId
            WHERE dtl.id = ? LIMIT 1
        `, [id]);
        if (!existing || existing.length === 0)
            return NextResponse.json({ message: "Time log not found" }, { status: 404 });
        const existingLog = existing[0];

        const blockType = existingLog.blockType || existingLog.block_blockType || "VEHICLE";
        const isQtyBased = blockType === "MATERIAL" || blockType === "LABOUR";

        let worked = existingLog.workedHours;
        let regularHours = existingLog.regularHours;
        let overtimeHours = existingLog.overtimeHours;
        let holidayHours = existingLog.holidayHours;

        if (!isQtyBased) {
            worked = data.workedHours ?? existingLog.workedHours;
            if (worked > 24)
                return NextResponse.json({ message: "Worked hours cannot exceed 24" }, { status: 400 });

            const isWeekend = data.isWeekend !== undefined ? data.isWeekend : !!existingLog.isWeekend;
            const isHoliday = data.isHoliday !== undefined ? data.isHoliday : !!existingLog.isHoliday;

            // Recalculate hour breakdown whenever workedHours, isWeekend, or isHoliday changes
            if (data.workedHours !== undefined || data.isWeekend !== undefined || data.isHoliday !== undefined) {
                const [csRows] = await dbTenant("SELECT fullDayHours FROM `company_settings` LIMIT 1");
                const fullDayHours = Number(csRows?.[0]?.fullDayHours || 8);
                if (isHoliday) {
                    regularHours = 0; overtimeHours = 0; holidayHours = worked;
                } else if (isWeekend) {
                    regularHours = 0; overtimeHours = worked; holidayHours = 0;
                } else {
                    regularHours = Math.min(worked, fullDayHours);
                    overtimeHours = Math.max(0, worked - fullDayHours);
                    holidayHours = 0;
                }
            }
        }

        const fields = [];
        const values = [];
        if (data.date !== undefined) { fields.push("date = ?"); values.push(data.date); }
        if (data.workType !== undefined) { fields.push("workType = ?"); values.push(data.workType); }
        
        if (isQtyBased) {
            if (data.quantity !== undefined) { fields.push("quantity = ?"); values.push(data.quantity); }
        } else {
            if (data.workedHours !== undefined) {
                fields.push("workedHours = ?", "regularHours = ?", "overtimeHours = ?", "holidayHours = ?");
                values.push(worked, regularHours, overtimeHours, holidayHours);
            } else if (data.isWeekend !== undefined || data.isHoliday !== undefined) {
                fields.push("regularHours = ?", "overtimeHours = ?", "holidayHours = ?");
                values.push(regularHours, overtimeHours, holidayHours);
            }
            if (data.isWeekend !== undefined) { fields.push("isWeekend = ?"); values.push(data.isWeekend ? 1 : 0); }
            if (data.isHoliday !== undefined) { fields.push("isHoliday = ?"); values.push(data.isHoliday ? 1 : 0); }
        }
        
        if (data.remarks !== undefined) { fields.push("remarks = ?"); values.push(data.remarks); }
        // Once manually edited, lock it from auto-generation overrides
        if (existingLog.autoGenerated) {
            fields.push("autoGenerated = 0");
        }
        fields.push("updatedAt = NOW()");

        await dbTenant(`UPDATE \`daily_time_logs\` SET ${fields.join(", ")} WHERE id = ?`, [...values, id]);

        const [updRows] = await dbTenant(`SELECT * FROM \`daily_time_logs\` WHERE id = ? LIMIT 1`, [id]);
        const updatedLog = updRows[0];

        await logActivity("DAILYTIMELOG", id, "UPDATE", `Time log updated for date ${new Date(updatedLog.date).toISOString().split('T')[0]}`);
        return NextResponse.json(updatedLog);
    } catch (error) {
        console.error("Error updating time log:", error);
        if (error instanceof z.ZodError)
            return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
        return NextResponse.json({ message: "Error updating time log", error: String(error) }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canDelete = await verifySessionPermission(session, "Daily Time Logs", "Delete");
    if (!canDelete)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt((await params).id);
    try {
        await dbTenant(`DELETE FROM \`daily_time_logs\` WHERE id = ?`, [id]);
        await logActivity("DAILYTIMELOG", id, "DELETE", `Time log deleted ID: ${id}`);
        return NextResponse.json({ message: "Time log deleted successfully" });
    } catch (error) {
        console.error("Error deleting time log:", error);
        return NextResponse.json({ message: "Error deleting time log" }, { status: 500 });
    }
}
