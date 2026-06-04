import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/app/lib/auth";
import { checkVehicleAvailability, checkOperatorAvailability } from "@/app/lib/availability";

const checkSchema = z.object({
    vehicleId: z.coerce.number().optional(),
    operatorId: z.coerce.number().optional(),
    startDate: z.string(),
    endDate: z.string(),
    includeWeekends: z.coerce.boolean().default(true),
    excludeBlockId: z.number().optional(),
    excludeAssignmentId: z.number().optional(),
});

export async function POST(request) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    try {
        const body = await request.json();
        const { vehicleId, operatorId, startDate, endDate, includeWeekends, excludeAssignmentId } = checkSchema.parse(body);
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start >= end) {
            return NextResponse.json({ conflict: true, message: "Start date must be before end date." });
        }

        if (vehicleId) {
            const check = await checkVehicleAvailability(vehicleId, start, end, includeWeekends, excludeAssignmentId);
            if (!check.available) {
                const conf = check.conflicts[0];
                return NextResponse.json({
                    conflict: true,
                    message: conf
                        ? `Vehicle is already assigned to ${conf.customer} from ${new Date(conf.startDate).toDateString()} to ${new Date(conf.endDate).toDateString()}`
                        : "Vehicle is not available during this period",
                });
            }
        }

        if (operatorId) {
            const check = await checkOperatorAvailability(operatorId, start, end, includeWeekends, excludeAssignmentId);
            if (!check.available) {
                const conf = check.conflicts[0];
                return NextResponse.json({
                    conflict: true,
                    message: conf
                        ? `Operator is already assigned to ${conf.customer} from ${new Date(conf.startDate).toDateString()} to ${new Date(conf.endDate).toDateString()}`
                        : "Operator is not available during this period",
                });
            }
        }

        return NextResponse.json({ conflict: false, message: "Available" });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ message: "Validation error", errors: error.errors }, { status: 400 });
        }
        console.error("Error checking conflict:", error);
        return NextResponse.json({ message: "Error checking conflict" }, { status: 500 });
    }
}
