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
                   v.vehicleCode, vt.name as vehicleTypeName, v.baseRentType, v.baseRentAmount as vehicleBaseRent,
                   o.name as operatorName, o.operatorCode, o.hourlyRate as operatorHourlyRate,
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
        const overtimeMultiplier = Number(timesheet.overtimeMultiplier || 1.5);
        const holidayMultiplier = Number(timesheet.holidayMultiplier || 2.0);

        for (const line of lines) {
            const bt = line.blockType || "VEHICLE";
            const isBundled = line.detourBlockId && line.bundleBilling;

            let key, description;
            if (isBundled) {
                key = `BUNDLE-${line.detourBlockId}`;
                description = line.detourTemplateName || "Detour Service";
            } else if (bt === "VEHICLE" || !line.blockType) {
                const vc = line.vehicleCode || line.resourceNameSnapshot || "N/A";
                key = `V-${line.vehicleId || vc}`;
                description = `${line.vehicleTypeName || "Vehicle"} - ${vc}`;
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
                    rateSnapshot: Number(line.rateSnapshot || 0),
                    vehicleBaseRent: Number(line.vehicleBaseRent || 0),
                    operatorHourlyRate: Number(line.operatorHourlyRate || 0),
                    regularHours: 0, overtimeHours: 0, holidayHours: 0,
                    quantity: 0,
                    totalAmount: 0,
                    daysCount: 0,
                    totalOtHours: 0,
                };
            }

            const g = groups[key];
            g.regularHours += Number(line.regularHours || 0);
            g.overtimeHours += Number(line.overtimeHours || 0);
            g.holidayHours += Number(line.holidayHours || 0);
            g.quantity += Number(line.quantity || 0);
            g.totalAmount += Number(line.calculatedAmount || 0);

            const totalHours = Number(line.regularHours || 0) + Number(line.overtimeHours || 0) + Number(line.holidayHours || 0);
            if (totalHours > 0) {
                g.daysCount += 1;
            }
            if (bt === "VEHICLE" && line.baseRentType === "DAILY") {
                g.totalOtHours += Math.max(0, totalHours - fullDayHours);
            }
        }

        for (const key in groups) {
            const g = groups[key];
            const bt = g.blockType;

            const fallbackRate = bt === "VEHICLE" ? g.vehicleBaseRent : g.operatorHourlyRate;
            const basePrice = g.rateSnapshot > 0 ? g.rateSnapshot : fallbackRate;

            if (bt === "MATERIAL" || bt === "LABOUR") {
                const qty = g.quantity || 1;
                const price = qty > 0 ? g.totalAmount / qty : g.totalAmount;
                items.push({
                    description: g.description,
                    quantity: parseFloat(qty.toFixed(4)),
                    unitPrice: parseFloat(price.toFixed(4)),
                    total: g.totalAmount,
                    regularHours: 0,
                    overtimeHours: 0,
                    holidayHours: 0,
                });
                totalInvoiceAmount += g.totalAmount;
            } else if (bt === "VEHICLE") {
                if (g.baseRentType === "DAILY") {
                    // Vehicle Base Rent
                    const baseQty = g.daysCount > 0 ? g.daysCount : 1;
                    const baseTotal = baseQty * basePrice;
                    items.push({
                        description: `${g.description} (Dry Rent) (${parseFloat(baseQty.toFixed(2))} Days)`,
                        quantity: parseFloat(baseQty.toFixed(4)),
                        unitPrice: parseFloat(basePrice.toFixed(4)),
                        total: baseTotal,
                        regularHours: g.regularHours,
                        overtimeHours: 0,
                        holidayHours: 0,
                    });
                    totalInvoiceAmount += baseTotal;

                    // Vehicle Overtime
                    if (g.totalOtHours > 0) {
                        const vHourlyRate = basePrice / fullDayHours;
                        const otTotal = g.totalOtHours * vHourlyRate;
                        items.push({
                            description: `${g.description} (Overtime)`,
                            quantity: parseFloat(g.totalOtHours.toFixed(4)),
                            unitPrice: parseFloat(vHourlyRate.toFixed(4)),
                            total: otTotal,
                            regularHours: 0,
                            overtimeHours: g.totalOtHours,
                            holidayHours: 0,
                        });
                        totalInvoiceAmount += otTotal;
                    }
                } else {
                    // HOURLY
                    const totalHours = g.regularHours + g.overtimeHours + g.holidayHours;
                    const qty = totalHours > 0 ? totalHours : 1;
                    const total = qty * basePrice;
                    items.push({
                        description: g.description,
                        quantity: parseFloat(qty.toFixed(4)),
                        unitPrice: parseFloat(basePrice.toFixed(4)),
                        total: total,
                        regularHours: g.regularHours,
                        overtimeHours: g.overtimeHours,
                        holidayHours: g.holidayHours,
                    });
                    totalInvoiceAmount += total;
                }
            } else if (bt === "OPERATOR") {
                // 1. Regular Hours
                if (g.regularHours > 0) {
                    const regTotal = g.regularHours * basePrice;
                    items.push({
                        description: `${g.description} (Normal Hours)`,
                        quantity: parseFloat(g.regularHours.toFixed(4)),
                        unitPrice: parseFloat(basePrice.toFixed(4)),
                        total: regTotal,
                        regularHours: g.regularHours,
                        overtimeHours: 0,
                        holidayHours: 0,
                    });
                    totalInvoiceAmount += regTotal;
                }

                // 2. Overtime Hours
                if (g.overtimeHours > 0) {
                    const otPrice = basePrice * overtimeMultiplier;
                    const otTotal = g.overtimeHours * otPrice;
                    items.push({
                        description: `${g.description} (Overtime Hours)`,
                        quantity: parseFloat(g.overtimeHours.toFixed(4)),
                        unitPrice: parseFloat(otPrice.toFixed(4)),
                        total: otTotal,
                        regularHours: 0,
                        overtimeHours: g.overtimeHours,
                        holidayHours: 0,
                    });
                    totalInvoiceAmount += otTotal;
                }

                // 3. Holiday Hours
                if (g.holidayHours > 0) {
                    const holPrice = basePrice * holidayMultiplier;
                    const holTotal = g.holidayHours * holPrice;
                    items.push({
                        description: `${g.description} (Holiday Hours)`,
                        quantity: parseFloat(g.holidayHours.toFixed(4)),
                        unitPrice: parseFloat(holPrice.toFixed(4)),
                        total: holTotal,
                        regularHours: 0,
                        overtimeHours: 0,
                        holidayHours: g.holidayHours,
                    });
                    totalInvoiceAmount += holTotal;
                }
            } else {
                // Fallback
                const qty = g.quantity || 1;
                items.push({
                    description: g.description,
                    quantity: parseFloat(qty.toFixed(4)),
                    unitPrice: parseFloat((g.totalAmount / qty).toFixed(4)),
                    total: g.totalAmount,
                    regularHours: g.regularHours,
                    overtimeHours: g.overtimeHours,
                    holidayHours: g.holidayHours,
                });
                totalInvoiceAmount += g.totalAmount;
            }
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

                if (bt === "VEHICLE") {
                    const rentAmount = Number(block.baseRentAmount || 0);
                    const vehicleDesc = `${block.regNo || "Vehicle"} (Dry Rent) (${block.billingCycle || "DAILY"}) - ${days} Days`;
                    items.push({
                        description: vehicleDesc,
                        quantity: days,
                        unitPrice: parseFloat(rentAmount.toFixed(2)),
                        total: parseFloat((rentAmount * days).toFixed(2)),
                        details: {
                            period: `${effectiveStart.toLocaleDateString()} - ${effectiveEnd.toLocaleDateString()}`
                        }
                    });
                    totalAmount += rentAmount * days;

                    if (block.withOperator) {
                        const opRate = Number(block.hourlyRate || 0) * 8;
                        const opDesc = `Operator: ${block.operatorName || "N/A"} (on ${block.regNo || "Vehicle"}) - ${days} Days`;
                        items.push({
                            description: opDesc,
                            quantity: days,
                            unitPrice: parseFloat(opRate.toFixed(2)),
                            total: parseFloat((opRate * days).toFixed(2)),
                            details: {
                                period: `${effectiveStart.toLocaleDateString()} - ${effectiveEnd.toLocaleDateString()}`
                            }
                        });
                        totalAmount += opRate * days;
                    }
                } else if (bt === "OPERATOR") {
                    const opRate = Number(block.hourlyRate || 0) * 8;
                    const opDesc = `Operator: ${block.operatorName || "N/A"} - ${days} Days`;
                    items.push({
                        description: opDesc,
                        quantity: days,
                        unitPrice: parseFloat(opRate.toFixed(2)),
                        total: parseFloat((opRate * days).toFixed(2)),
                        details: {
                            period: `${effectiveStart.toLocaleDateString()} - ${effectiveEnd.toLocaleDateString()}`
                        }
                    });
                    totalAmount += opRate * days;
                } else if (bt === "MATERIAL") {
                    const qty = Number(block.quantity || 1);
                    const unitPrice = Number(block.materialCostPerDay || 0) * qty;
                    const total = unitPrice * days;
                    items.push({
                        description: `Material: ${block.materialName || "N/A"} × ${qty} units - ${days} Days`,
                        quantity: days,
                        unitPrice: parseFloat(unitPrice.toFixed(2)),
                        total: parseFloat(total.toFixed(2)),
                        details: {
                            period: `${effectiveStart.toLocaleDateString()} - ${effectiveEnd.toLocaleDateString()}`
                        }
                    });
                    totalAmount += total;
                } else if (bt === "LABOUR") {
                    const qty = Number(block.quantity || 1);
                    const unitPrice = Number(block.labourCostPerDay || 0) * qty;
                    const total = unitPrice * days;
                    items.push({
                        description: `Labour: ${block.labourTypeName || "N/A"} × ${qty} - ${days} Days`,
                        quantity: days,
                        unitPrice: parseFloat(unitPrice.toFixed(2)),
                        total: parseFloat(total.toFixed(2)),
                        details: {
                            period: `${effectiveStart.toLocaleDateString()} - ${effectiveEnd.toLocaleDateString()}`
                        }
                    });
                    totalAmount += total;
                }
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
