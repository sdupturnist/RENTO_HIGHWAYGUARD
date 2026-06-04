import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { z } from "zod";
import { getSession } from "@/app/lib/auth";
import { differenceInDays, max, min } from "date-fns";

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
