import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { z } from "zod";
import { getSession, verifySession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { differenceInDays, max, min } from "date-fns";

export async function GET(request) {
    const session = await verifySession();
    const canView = session ? await verifySessionPermission(session, "Invoices", "View") : false;
    const canEdit = session ? await verifySessionPermission(session, "Invoices", "Edit") : false;
    if (!session || (!canView && !canEdit)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const timesheetId = searchParams.get("timesheetId");
        if (!timesheetId) {
            return NextResponse.json({ error: "timesheetId is required" }, { status: 400 });
        }

        // Fetch Timesheet
        const [timesheetRows] = await dbTenant(`
            SELECT t.*, 
                   c.companyName as customer_companyName, 
                   p.name as project_name,
                   p.lpoNumber as project_lpoNumber,
                   p.lpoAttachmentPath as project_lpoAttachmentPath,
                   p.lpoAttachmentName as project_lpoAttachmentName
            FROM \`timesheets\` t
            LEFT JOIN \`customers\` c ON t.customerId = c.id
            LEFT JOIN \`projects\` p ON p.id = t.projectId
            WHERE t.id = ?
        `, [timesheetId]);
        const timesheet = timesheetRows[0];

        if (!timesheet) {
            return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
        }

        // Fetch Timesheet Lines
        const [lines] = await dbTenant(`
            SELECT l.*,
                   v.vehicleCode, vt.name as vehicleTypeName, v.baseRentType,
                   o.name as operatorName, o.operatorCode,
                   mat.name as materialName,
                   lab.labourType as labourTypeName,
                   ab.bundleBilling, dst.name as detourTemplateName
            FROM \`timesheet_lines\` l
            LEFT JOIN \`vehicles\` v ON l.vehicleId = v.id
            LEFT JOIN \`vehicle_types\` vt ON v.typeId = vt.id
            LEFT JOIN \`operators\` o ON l.operatorId = o.id
            LEFT JOIN \`materials\` mat ON mat.id = l.materialId
            LEFT JOIN \`labours\` lab ON lab.id = l.labourTypeId
            LEFT JOIN \`assignment_blocks\` ab ON ab.id = l.detourBlockId
            LEFT JOIN \`detour_service_templates\` dst ON dst.id = ab.detourTemplateId
            WHERE l.timesheetId = ?
            ORDER BY l.date ASC
        `, [timesheetId]);

        // Fetch Company Settings
        const [settingsRows] = await dbTenant("SELECT enableVat, vatPercentage, fullDayHours FROM `company_settings` LIMIT 1");
        const companySettings = settingsRows[0];
        const fullDayHours = Number(companySettings?.fullDayHours || 8);

        const items = [];
        let totalInvoiceAmount = 0;
        const groups = {};

        for (const line of lines) {
            const bt = line.blockType || "VEHICLE";
            const isBundled = line.detourBlockId && line.bundleBilling;

            let key, description;
            if (isBundled) {
                key = `BUNDLE-${line.detourBlockId}`;
                description = line.detourTemplateName || "Detour Service";
            } else if (bt === "VEHICLE" || !line.blockType) {
                const vc = line.vehicleCode || line.resourceNameSnapshot || "N/A";
                const op = line.operatorCode || "NO_OP";
                key = `V-${vc}-${op}`;
                description = `${line.vehicleTypeName || "Vehicle"} - ${vc}${line.operatorName ? ` (${line.operatorName})` : " (No Operator)"}`;
            } else if (bt === "OPERATOR") {
                key = `OP-${line.operatorId}`;
                description = `Operator: ${line.operatorName || line.resourceNameSnapshot || "N/A"}`;
            } else if (bt === "MATERIAL") {
                key = `MAT-${line.materialId}`;
                description = `Material: ${line.materialName || line.resourceNameSnapshot || "N/A"}`;
            } else if (bt === "LABOUR") {
                key = `LAB-${line.labourTypeId}`;
                description = `Labour: ${line.labourTypeName || line.resourceNameSnapshot || "N/A"}`;
            } else {
                key = `OTHER-${line.id}`;
                description = line.resourceNameSnapshot || "Unknown";
            }

            if (!groups[key]) {
                groups[key] = {
                    description,
                    blockType: isBundled ? "BUNDLE" : bt,
                    baseRentType: line.baseRentType || null,
                    regularHours: 0, overtimeHours: 0, holidayHours: 0,
                    quantity: 0,
                    totalAmount: 0,
                };
            }

            const g = groups[key];
            g.regularHours += Number(line.regularHours || 0);
            g.overtimeHours += Number(line.overtimeHours || 0);
            g.holidayHours += Number(line.holidayHours || 0);
            g.quantity += Number(line.quantity || 0);
            g.totalAmount += Number(line.calculatedAmount || 0);
        }

        for (const key in groups) {
            const g = groups[key];
            const bt = g.blockType;
            let quantity, unitPrice;

            if (bt === "MATERIAL" || bt === "LABOUR") {
                quantity = g.quantity || 1;
                unitPrice = quantity > 0 ? g.totalAmount / quantity : g.totalAmount;
            } else if (bt === "VEHICLE" && g.baseRentType === "DAILY") {
                const totalHours = g.regularHours + g.overtimeHours + g.holidayHours;
                quantity = totalHours / fullDayHours;
                unitPrice = quantity > 0 ? g.totalAmount / quantity : g.totalAmount;
                g.description += ` (${parseFloat(quantity.toFixed(2))} Days)`;
            } else {
                const totalHours = g.regularHours + g.overtimeHours + g.holidayHours;
                quantity = totalHours > 0 ? totalHours : 1;
                unitPrice = totalHours > 0 ? g.totalAmount / totalHours : g.totalAmount;
            }

            items.push({
                description: g.description,
                quantity: parseFloat(quantity.toFixed(4)),
                unitPrice: parseFloat(unitPrice.toFixed(4)),
                total: g.totalAmount,
                regularHours: g.regularHours,
                overtimeHours: g.overtimeHours,
                holidayHours: g.holidayHours,
            });
            totalInvoiceAmount += g.totalAmount;
        }

        const useVat = !!companySettings?.enableVat;
        const vatPercentage = useVat ? (Number(companySettings?.vatPercentage) || 0) : 0;
        const subtotal = totalInvoiceAmount;
        const vatAmount = useVat ? (subtotal * vatPercentage / 100) : 0;
        const grandTotal = subtotal + vatAmount;

        const lpoNumber = timesheet.lpoNumber || timesheet.project_lpoNumber || null;
        const lpoAttachmentPath = timesheet.lpoAttachmentPath || timesheet.project_lpoAttachmentPath || null;
        const lpoAttachmentName = timesheet.lpoAttachmentName || timesheet.project_lpoAttachmentName || null;

        return NextResponse.json({
            items,
            subtotal: parseFloat(subtotal.toFixed(4)),
            vatEnabled: useVat,
            vatPercentage: vatPercentage,
            vatAmount: parseFloat(vatAmount.toFixed(4)),
            grandTotal: parseFloat(grandTotal.toFixed(4)),
            totalAmount: parseFloat(grandTotal.toFixed(4)),
            lpoNumber,
            lpoAttachmentPath,
            lpoAttachmentName,
        });
    } catch (error) {
        console.error("Failed to generate preview from timesheet:", error);
        return NextResponse.json({ error: "Failed to generate preview from timesheet" }, { status: 500 });
    }
}

const previewSchema = z.object({
    customerId: z.coerce.number(),
    projectId: z.coerce.number().optional().nullable(),
    startDate: z.string(),
    endDate: z.string(),
});


export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    try {
        const body = await request.json();
        const { customerId, projectId, startDate, endDate } = previewSchema.parse(body);
        const start = new Date(startDate);
        const end = new Date(endDate);

        let query = `
            SELECT a.*, p.name as projectName
            FROM \`assignments\` a
            LEFT JOIN \`projects\` p ON p.id = a.projectId
            WHERE a.customerId = ?
              AND (a.startDate <= ? AND a.endDate >= ?)
        `;
        const params = [customerId, end, start];
        if (projectId) {
            query += " AND a.projectId = ?";
            params.push(projectId);
        }

        const [assignments] = await dbTenant(query, params);

        let items = [];
        let totalAmount = 0;

        for (const assignment of (assignments || [])) {
            const [blocks] = await dbTenant(`
                SELECT b.*, v.regNo, v.baseRentAmount, o.name as operatorName, o.hourlyRate,
                       mat.name as materialName, mat.costPerDay as materialCostPerDay,
                       lab.labourType as labourTypeName, lab.costPerDay as labourCostPerDay
                FROM \`assignment_blocks\` b
                LEFT JOIN \`vehicles\` v ON v.id = b.vehicleId
                LEFT JOIN \`operators\` o ON o.id = b.operatorId
                LEFT JOIN \`materials\` mat ON mat.id = b.materialId
                LEFT JOIN \`labours\` lab ON lab.id = b.labourTypeId
                WHERE b.assignmentId = ? AND (b.blockType IS NULL OR b.blockType != 'DETOUR')
            `, [assignment.id]);

            for (const block of (blocks || [])) {
                const blockStart = new Date(block.startDate);
                const blockEnd = new Date(block.endDate);
                const effectiveStart = max([start, blockStart]);
                const effectiveEnd = min([end, blockEnd]);

                if (effectiveStart > effectiveEnd) continue;
                const days = differenceInDays(effectiveEnd, effectiveStart) + 1;
                if (days <= 0) continue;

                const bt = block.blockType || "VEHICLE";
                let description, quantity, unitPrice, total;

                if (bt === "VEHICLE") {
                    const rentAmount = Number(block.baseRentAmount || 0);
                    const operatorRate = block.withOperator ? Number(block.hourlyRate || 0) * 8 : 0;
                    unitPrice = rentAmount + operatorRate;
                    quantity = days;
                    total = unitPrice * days;
                    description = `${block.regNo || "Vehicle"} / ${block.operatorName || "No Operator"} (${block.billingCycle || "DAILY"}) - ${days} Days`;
                } else if (bt === "OPERATOR") {
                    unitPrice = Number(block.hourlyRate || 0) * 8;
                    quantity = days;
                    total = unitPrice * days;
                    description = `Operator: ${block.operatorName || "N/A"} - ${days} Days`;
                } else if (bt === "MATERIAL") {
                    const qty = Number(block.quantity || 1);
                    unitPrice = Number(block.materialCostPerDay || 0) * qty;
                    quantity = days;
                    total = unitPrice * days;
                    description = `Material: ${block.materialName || "N/A"} × ${qty} units - ${days} Days`;
                } else if (bt === "LABOUR") {
                    const qty = Number(block.quantity || 1);
                    unitPrice = Number(block.labourCostPerDay || 0) * qty;
                    quantity = days;
                    total = unitPrice * days;
                    description = `Labour: ${block.labourTypeName || "N/A"} × ${qty} - ${days} Days`;
                } else {
                    continue;
                }

                items.push({
                    description,
                    quantity,
                    unitPrice: parseFloat(unitPrice.toFixed(2)),
                    total: parseFloat(total.toFixed(2)),
                    details: {
                        period: `${effectiveStart.toLocaleDateString()} - ${effectiveEnd.toLocaleDateString()}`
                    }
                });
                totalAmount += total;
            }
        }

        const [settingsRows] = await dbTenant("SELECT * FROM `company_settings` LIMIT 1");
        const companySettings = settingsRows?.[0] || {};
        const enableVat = !!companySettings.enableVat;
        const vatPercentage = enableVat ? (Number(companySettings.vatPercentage) || 0) : 0;
        
        const subtotal = totalAmount;
        const vatAmount = (subtotal * vatPercentage) / 100;
        const grandTotal = subtotal + vatAmount;

        return NextResponse.json({
            items,
            subtotal: parseFloat(subtotal.toFixed(2)),
            vatEnabled: enableVat,
            vatPercentage: vatPercentage,
            vatAmount: parseFloat(vatAmount.toFixed(2)),
            grandTotal: parseFloat(grandTotal.toFixed(2)),
            totalAmount: parseFloat(grandTotal.toFixed(2))
        });
    } catch (error) {
        if (error instanceof z.ZodError) return NextResponse.json({ message: "Validation error", errors: error.errors }, { status: 400 });
        console.error("Invoice preview error:", error);
        return NextResponse.json({ message: "Error calculating invoice" }, { status: 500 });
    }
}
