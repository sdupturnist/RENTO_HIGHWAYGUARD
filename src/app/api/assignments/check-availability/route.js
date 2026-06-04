import { NextResponse } from "next/server";
import { z } from "zod";
import {
    checkVehicleAvailability,
    checkOperatorAvailability,
    checkMaterialAvailability,
    checkLabourAvailability,
} from "@/app/lib/availability";

const schema = z.object({
    vehicleId: z.coerce.number().nullable().optional(),
    operatorId: z.coerce.number().nullable().optional(),
    materialId: z.coerce.number().nullable().optional(),
    labourTypeId: z.coerce.number().nullable().optional(),
    quantity: z.coerce.number().nullable().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    includeWeekends: z.coerce.boolean().default(true),
    excludeAssignmentId: z.coerce.number().nullable().optional(),
});

export async function POST(request) {
    try {
        const body = await request.json();
        const data = schema.parse(body);
        const result = {};

        if (data.vehicleId) {
            const check = await checkVehicleAvailability(
                data.vehicleId, data.startDate, data.endDate,
                data.includeWeekends, data.excludeAssignmentId
            );
            result.vehicleAvailable = check.available;
            result.vehicleConflicts = check.conflicts;
        }

        if (data.operatorId) {
            const check = await checkOperatorAvailability(
                data.operatorId, data.startDate, data.endDate,
                data.includeWeekends, data.excludeAssignmentId
            );
            result.operatorAvailable = check.available;
            result.operatorConflicts = check.conflicts;
        }

        if (data.materialId && data.quantity) {
            const check = await checkMaterialAvailability(
                data.materialId, data.startDate, data.endDate,
                data.quantity, data.excludeAssignmentId
            );
            result.materialAvailable = check.available;
            result.materialAvailableQty = check.availableQuantity;
            result.materialTotalQty = check.totalQuantity;
            result.materialCommittedQty = check.committedQuantity;
        }

        if (data.labourTypeId && data.quantity) {
            const check = await checkLabourAvailability(
                data.labourTypeId, data.startDate, data.endDate,
                data.quantity, data.excludeAssignmentId
            );
            result.labourAvailable = check.available;
            result.labourAvailableQty = check.availableQuantity;
            result.labourTotalQty = check.totalQuantity;
            result.labourCommittedQty = check.committedQuantity;
        }

        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
        }
        console.error("check-availability error:", error);
        return NextResponse.json({ message: "Error checking availability" }, { status: 500 });
    }
}
