import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getClientDb } from "@/app/lib/db";
import { z } from "zod";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";

const replaceVehicleSchema = z.object({
    replacementDate: z.string().transform((val) => new Date(val)),
    newVehicleId: z.coerce.number().min(1),
    reason: z.string().optional()
});

export async function POST(request, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const canEdit = await verifySessionPermission(session, "Assignment", "Edit");
    if (!canEdit) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const assignmentId = parseInt((await params).id);
    const blockId = parseInt((await params).blockId);

    try {
        const body = await request.json();
        const { replacementDate, newVehicleId, reason } = replaceVehicleSchema.parse(body);

        const reqHeaders = await headers();
        const subdomain = reqHeaders.get("x-subdomain") || "admin";
        const tenantDb = getClientDb(subdomain);

        // Run entire split logic inside a transaction
        const result = await tenantDb.$transaction(async (tx) => {
            // 1. Fetch original block and assignment
            const originalBlock = await tx.assignmentBlock.findUnique({
                where: { id: blockId, assignmentId: assignmentId },
                include: {
                    assignment: true,
                    attachments: true
                }
            });

            if (!originalBlock) {
                throw new Error("Assignment block not found");
            }

            if (originalBlock.status === "STOPPED") {
                throw new Error("Cannot replace vehicle on a stopped block");
            }

            if (replacementDate <= originalBlock.startDate || replacementDate > originalBlock.endDate) {
                throw new Error("Replacement date must be within the block's current period and strictly after the start date.");
            }

            // 2. Validate availability of the new vehicle
            const end = originalBlock.endDate; // The new block will go until the original end date

            const vehicleConflict = await tx.assignmentBlock.findFirst({
                where: {
                    vehicleId: newVehicleId,
                    assignment: { status: "ACTIVE" },
                    startDate: { lte: end },
                    endDate: { gte: replacementDate },
                },
                include: { assignment: { include: { customer: true } } }
            });

            if (vehicleConflict) {
                throw new Error(`Replacement vehicle is already assigned to ${vehicleConflict.assignment.customer.companyName} from ${vehicleConflict.startDate.toDateString()} to ${vehicleConflict.endDate.toDateString()}`);
            }

            // Also check if vehicle is under maintenance
            const maintenanceVehicle = await tx.vehicle.findUnique({
                where: { id: newVehicleId },
                select: { status: true, vehicleCode: true }
            });

            if (maintenanceVehicle?.status === "UNDER_MAINTENANCE") {
                throw new Error(`Cannot assign replacement vehicle: ${maintenanceVehicle.vehicleCode} is under maintenance.`);
            }

            // 3. Update original block (set end date to replacementDate - 1 day)
            const newOriginalEndDate = new Date(replacementDate);
            newOriginalEndDate.setDate(newOriginalEndDate.getDate() - 1);

            await tx.assignmentBlock.update({
                where: { id: blockId },
                data: {
                    endDate: newOriginalEndDate
                }
            });

            // 4. Create the new segment block
            const newBlock = await tx.assignmentBlock.create({
                data: {
                    assignmentId: assignmentId,
                    vehicleId: newVehicleId,
                    operatorId: originalBlock.operatorId, // Keep same operator
                    withOperator: originalBlock.withOperator,
                    startDate: replacementDate,
                    endDate: originalBlock.endDate, // Keep original end date
                    billingCycle: originalBlock.billingCycle,
                    enableAutoTimeLogs: originalBlock.enableAutoTimeLogs,
                    plannedOvertimeHours: originalBlock.plannedOvertimeHours,
                    includeWeekendsForAutoLogs: originalBlock.includeWeekendsForAutoLogs,
                    // Duplicate attachments if any
                    attachments: originalBlock.attachments.length > 0 ? {
                        create: originalBlock.attachments.map(att => ({
                            name: att.name,
                            url: att.url,
                            remarks: att.remarks
                        }))
                    } : undefined
                }
            });

            return newBlock;
        });

        const logMsg = `Vehicle replaced on block ${blockId}. New vehicle ID: ${newVehicleId} starting on ${replacementDate.toDateString()}. Reason: ${reason || 'N/A'}`;
        await logActivity("ASSIGNMENT", assignmentId, "UPDATE", logMsg);

        return NextResponse.json({ message: "Vehicle replaced successfully", newBlock: result });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
        }
        if (error instanceof Error && (error.message.includes("already assigned") || error.message.includes("must be within") || error.message.includes("under maintenance") || error.message.includes("not found") || error.message.includes("stopped"))) {
            return NextResponse.json({ message: error.message }, { status: 400 });
        }
        console.error("Error replacing vehicle:", error);
        return NextResponse.json({ message: "Error replacing vehicle", error: String(error) }, { status: 500 });
    }
}
