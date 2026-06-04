import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getClientDb } from "@/app/lib/db";
import { z } from "zod";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";

const changeOperatorSchema = z.object({
    changeDate: z.string().transform((val) => new Date(val)),
    newOperatorId: z.coerce.number().min(1),
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
        const { changeDate, newOperatorId, reason } = changeOperatorSchema.parse(body);


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
                throw new Error("Cannot change operator on a stopped block");
            }

            if (changeDate <= originalBlock.startDate || changeDate > originalBlock.endDate) {
                throw new Error("Change date must be within the block's current period and strictly after the start date.");
            }

            // 2. Validate availability of the new operator
            const end = originalBlock.endDate; // The new block will go until the original end date

            const operatorConflict = await tx.assignmentBlock.findFirst({
                where: {
                    operatorId: newOperatorId,
                    assignment: { status: "ACTIVE" },
                    startDate: { lte: end },
                    endDate: { gte: changeDate },
                },
                include: { assignment: { include: { customer: true } } }
            });

            if (operatorConflict) {
                throw new Error(`Replacement operator is already assigned to ${operatorConflict.assignment.customer.companyName} from ${operatorConflict.startDate.toDateString()} to ${operatorConflict.endDate.toDateString()}`);
            }

            // 3. Update original block (set end date to changeDate - 1 day)
            const newOriginalEndDate = new Date(changeDate);
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
                    vehicleId: originalBlock.vehicleId, // Keep same vehicle
                    operatorId: newOperatorId, 
                    withOperator: true, // Safety ensure
                    startDate: changeDate,
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

        const logMsg = `Operator changed on block ${blockId}. New operator ID: ${newOperatorId} starting on ${changeDate.toDateString()}. Reason: ${reason || 'N/A'}`;
        await logActivity("ASSIGNMENT", assignmentId, "UPDATE", logMsg);

        return NextResponse.json({ message: "Operator changed successfully", newBlock: result });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
        }
        if (error instanceof Error && (error.message.includes("already assigned") || error.message.includes("must be within") || error.message.includes("not found") || error.message.includes("stopped"))) {
            return NextResponse.json({ message: error.message }, { status: 400 });
        }
        console.error("Error changing operator:", error);
        return NextResponse.json({ message: "Error changing operator", error: String(error) }, { status: 500 });
    }
}
