import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { z } from "zod";
import { getSession, verifySession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { differenceInDays, max, min, format } from "date-fns";

function cleanDescription(desc) {
    if (!desc) return "";
    return desc
        .replace(/\s*\(Dry Rent\)/gi, "")
        .replace(/\s*\(\d+(?:\.\d+)?\s*Days?\)/gi, "")
        .replace(/\s*\(.*?\bDays?\b\)/gi, "")
        .trim();
}

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
                   ab.bundleBilling, dst.name as detourTemplateName, dst.bundleCostPerDay
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
                    bundleCostPerDay: Number(line.bundleCostPerDay || 0),
                    regularHours: 0, overtimeHours: 0, holidayHours: 0,
                    quantity: 0,
                    totalAmount: 0,
                    dates: new Set(),
                };
            } else {
                if (line.baseRentType === "DAILY") {
                    groups[key].baseRentType = "DAILY";
                }
            }

            const g = groups[key];
            g.regularHours += Number(line.regularHours || 0);
            g.overtimeHours += Number(line.overtimeHours || 0);
            g.holidayHours += Number(line.holidayHours || 0);
            g.quantity += Number(line.quantity || 0);
            g.totalAmount += Number(line.calculatedAmount || 0);

            const dVal = new Date(line.date);
            const dateStr = !isNaN(dVal.getTime()) ? dVal.toISOString().slice(0, 10) : "";
            if (dateStr) {
                g.dates.add(dateStr);
            }
        }

        for (const key in groups) {
            const g = groups[key];
            const bt = g.blockType;
            const daysCount = g.dates.size;

            const fallbackRate = bt === "VEHICLE" ? g.vehicleBaseRent : g.operatorHourlyRate;
            const basePrice = g.rateSnapshot > 0 ? g.rateSnapshot : fallbackRate;
            const desc = cleanDescription(g.description);

            if (bt === "BUNDLE") {
                const days = daysCount > 0 ? daysCount : 1;
                const price = g.bundleCostPerDay;
                const total = days * price;
                items.push({
                    description: desc,
                    quantity: 1,
                    days: days,
                    unitPrice: parseFloat(price.toFixed(4)),
                    total: parseFloat(total.toFixed(4)),
                    regularHours: 0,
                    overtimeHours: 0,
                    holidayHours: 0,
                });
                totalInvoiceAmount += total;
            } else if (bt === "MATERIAL" || bt === "LABOUR") {
                const days = daysCount > 0 ? daysCount : 1;
                const qty = days > 0 ? g.quantity / days : g.quantity || 1;
                const price = basePrice;
                const total = qty * days * price;
                items.push({
                    description: desc,
                    quantity: parseFloat(qty.toFixed(4)),
                    days: days,
                    unitPrice: parseFloat(price.toFixed(4)),
                    total: parseFloat(total.toFixed(4)),
                    regularHours: 0,
                    overtimeHours: 0,
                    holidayHours: 0,
                });
                totalInvoiceAmount += total;
            } else if (bt === "VEHICLE") {
                const days = daysCount > 0 ? daysCount : 1;
                const unitPrice = g.baseRentType === "DAILY" ? basePrice / fullDayHours 
                               : (g.baseRentType === "MONTHLY" ? basePrice / 30 / fullDayHours : basePrice);
                const regularHours = g.baseRentType === "DAILY" ? Math.max(g.regularHours, days * fullDayHours) : g.regularHours;
                const qty = regularHours + g.overtimeHours + g.holidayHours;
                const total = qty * unitPrice;

                items.push({
                    description: desc,
                    quantity: parseFloat(qty.toFixed(4)),
                    days: days,
                    unitPrice: parseFloat(unitPrice.toFixed(4)),
                    total: parseFloat(total.toFixed(4)),
                    regularHours: regularHours,
                    overtimeHours: g.overtimeHours,
                    holidayHours: g.holidayHours,
                });
                totalInvoiceAmount += total;
            } else if (bt === "OPERATOR") {
                const days = daysCount > 0 ? daysCount : 1;
                const unitPrice = basePrice;
                const regularHours = g.baseRentType === "DAILY" ? Math.max(g.regularHours, days * fullDayHours) : g.regularHours;
                const qty = regularHours + g.overtimeHours + g.holidayHours;

                const regTotal = regularHours * unitPrice;
                const otPrice = unitPrice * overtimeMultiplier;
                const otTotal = g.overtimeHours * otPrice;
                const holPrice = unitPrice * holidayMultiplier;
                const holTotal = g.holidayHours * holPrice;
                const total = regTotal + otTotal + holTotal;

                items.push({
                    description: desc,
                    quantity: parseFloat(qty.toFixed(4)),
                    days: days,
                    unitPrice: parseFloat(unitPrice.toFixed(4)),
                    total: parseFloat(total.toFixed(4)),
                    regularHours: regularHours,
                    overtimeHours: g.overtimeHours,
                    holidayHours: g.holidayHours,
                });
                totalInvoiceAmount += total;
            } else {
                // Fallback
                const qty = g.quantity || 1;
                const days = daysCount > 0 ? daysCount : 1;
                items.push({
                    description: desc,
                    quantity: parseFloat(qty.toFixed(4)),
                    days: days,
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

        const [settingsRows] = await dbTenant("SELECT * FROM `company_settings` LIMIT 1");
        const companySettings = settingsRows?.[0] || {};
        const fullDayHours = Number(companySettings.fullDayHours || 8);
        const overtimeMultiplier = Number(companySettings.overtimeMultiplier || 1.5);

        for (const assignment of (assignments || [])) {
            const [blocks] = await dbTenant(`
                SELECT b.*, 
                       v.regNo, v.baseRentAmount, v.baseRentType,
                       o.name as operatorName, o.hourlyRate,
                       mat.name as materialName, mat.costPerDay as materialCostPerDay,
                       lab.labourType as labourTypeName, lab.costPerDay as labourCostPerDay,
                       dt.name as detourTemplateName, dt.bundleCostPerDay,
                       pb.bundleBilling as parentBundleBilling
                FROM \`assignment_blocks\` b
                LEFT JOIN \`vehicles\` v ON v.id = b.vehicleId
                LEFT JOIN \`operators\` o ON o.id = b.operatorId
                LEFT JOIN \`materials\` mat ON mat.id = b.materialId
                LEFT JOIN \`labours\` lab ON lab.id = b.labourTypeId
                LEFT JOIN \`detour_service_templates\` dt ON dt.id = b.detourTemplateId
                LEFT JOIN \`assignment_blocks\` pb ON pb.id = b.detourBlockId
                WHERE b.assignmentId = ?
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

                // Detour handling
                if (bt === "DETOUR") {
                    if (block.bundleBilling) {
                        const price = Number(block.bundleCostPerDay || 0);
                        const total = days * price;
                        items.push({
                            description: cleanDescription(block.detourTemplateName || "Detour Service"),
                            quantity: 1,
                            days: days,
                            unitPrice: parseFloat(price.toFixed(2)),
                            total: parseFloat(total.toFixed(2)),
                            regularHours: 0,
                            overtimeHours: 0,
                            holidayHours: 0,
                            details: {
                                period: `${effectiveStart.toLocaleDateString()} - ${effectiveEnd.toLocaleDateString()}`
                            }
                        });
                        totalAmount += total;
                    }
                    continue;
                }

                if (block.detourBlockId && block.parentBundleBilling) {
                    continue;
                }

                if (bt === "VEHICLE") {
                    const rentAmount = Number(block.baseRentAmount || 0);
                    const unitPrice = block.billingCycle === "DAILY" ? rentAmount / fullDayHours 
                                   : (block.billingCycle === "MONTHLY" ? rentAmount / 30 / fullDayHours : rentAmount);
                    const regularHours = block.billingCycle === "DAILY" ? days * fullDayHours : days * 8;
                    const overtimeHours = days * (block.plannedOvertimeHours || 0);
                    const qty = regularHours + overtimeHours;
                    const total = qty * unitPrice;
                    const vehicleDesc = cleanDescription(`${block.regNo || "Vehicle"}`);

                    items.push({
                        description: vehicleDesc,
                        quantity: parseFloat(qty.toFixed(2)),
                        days: days,
                        unitPrice: parseFloat(unitPrice.toFixed(2)),
                        total: parseFloat(total.toFixed(2)),
                        regularHours: regularHours,
                        overtimeHours: overtimeHours,
                        holidayHours: 0,
                        details: {
                            period: `${effectiveStart.toLocaleDateString()} - ${effectiveEnd.toLocaleDateString()}`
                        }
                    });
                    totalAmount += total;

                    if (block.withOperator) {
                        const opRate = Number(block.hourlyRate || 0);
                        const opRegHours = block.billingCycle === "DAILY" ? days * fullDayHours : days * 8;
                        const opOtHours = days * (block.plannedOvertimeHours || 0);
                        const opQty = opRegHours + opOtHours;
                        const opTotal = opRegHours * opRate + opOtHours * opRate * overtimeMultiplier;
                        const opDesc = cleanDescription(`Operator: ${block.operatorName || "N/A"} (on ${block.regNo || "Vehicle"})`);

                        items.push({
                            description: opDesc,
                            quantity: parseFloat(opQty.toFixed(2)),
                            days: days,
                            unitPrice: parseFloat(opRate.toFixed(2)),
                            total: parseFloat(opTotal.toFixed(2)),
                            regularHours: opRegHours,
                            overtimeHours: opOtHours,
                            holidayHours: 0,
                            details: {
                                period: `${effectiveStart.toLocaleDateString()} - ${effectiveEnd.toLocaleDateString()}`
                            }
                        });
                        totalAmount += opTotal;
                    }
                } else if (bt === "OPERATOR") {
                    const opRate = Number(block.hourlyRate || 0);
                    const opRegHours = block.billingCycle === "DAILY" ? days * fullDayHours : days * 8;
                    const opOtHours = days * (block.plannedOvertimeHours || 0);
                    const opQty = opRegHours + opOtHours;
                    const opTotal = opRegHours * opRate + opOtHours * opRate * overtimeMultiplier;
                    const opDesc = cleanDescription(`Operator: ${block.operatorName || "N/A"}`);

                    items.push({
                        description: opDesc,
                        quantity: parseFloat(opQty.toFixed(2)),
                        days: days,
                        unitPrice: parseFloat(opRate.toFixed(2)),
                        total: parseFloat(opTotal.toFixed(2)),
                        regularHours: opRegHours,
                        overtimeHours: opOtHours,
                        holidayHours: 0,
                        details: {
                            period: `${effectiveStart.toLocaleDateString()} - ${effectiveEnd.toLocaleDateString()}`
                        }
                    });
                    totalAmount += opTotal;
                } else if (bt === "MATERIAL") {
                    const qty = Number(block.quantity || 1);
                    const unitPrice = Number(block.materialCostPerDay || 0);
                    const total = qty * days * unitPrice;
                    items.push({
                        description: cleanDescription(`Material: ${block.materialName || "N/A"}`),
                        quantity: qty,
                        days: days,
                        unitPrice: parseFloat(unitPrice.toFixed(2)),
                        total: parseFloat(total.toFixed(2)),
                        regularHours: 0,
                        overtimeHours: 0,
                        holidayHours: 0,
                        details: {
                            period: `${effectiveStart.toLocaleDateString()} - ${effectiveEnd.toLocaleDateString()}`
                        }
                    });
                    totalAmount += total;
                } else if (bt === "LABOUR") {
                    const qty = Number(block.quantity || 1);
                    const unitPrice = Number(block.labourCostPerDay || 0);
                    const total = qty * days * unitPrice;
                    items.push({
                        description: cleanDescription(`Labour: ${block.labourTypeName || "N/A"}`),
                        quantity: qty,
                        days: days,
                        unitPrice: parseFloat(unitPrice.toFixed(2)),
                        total: parseFloat(total.toFixed(2)),
                        regularHours: 0,
                        overtimeHours: 0,
                        holidayHours: 0,
                        details: {
                            period: `${effectiveStart.toLocaleDateString()} - ${effectiveEnd.toLocaleDateString()}`
                        }
                    });
                    totalAmount += total;
                }
            }
        }

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

