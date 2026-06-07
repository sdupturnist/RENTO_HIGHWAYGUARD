import { NextResponse } from "next/server";
import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";
import { verifySessionPermission } from "@/app/lib/permissions";
import { format, min, startOfDay, addDays } from "date-fns";

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const canEdit = await verifySessionPermission(session, "Settings", "Edit");
    if (!canEdit) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    try {
        const { assignmentId } = await request.json();
        if (!assignmentId) return NextResponse.json({ message: "Missing assignmentId" }, { status: 400 });

        const [companyRows] = await dbTenant("SELECT * FROM `company_settings` LIMIT 1");
        const companySettings = companyRows?.[0] || {};
        
        const [assignSettingsRows] = await dbTenant("SELECT * FROM `assignment_settings` LIMIT 1");
        const assignmentSettings = assignSettingsRows?.[0] || {};

        const globalFullDayHours = Number(companySettings.fullDayHours || 8);
        const weekendDays = companySettings.weekendDays || [];

        const [aRows] = await dbTenant("SELECT * FROM `assignments` WHERE id = ?", [parseInt(assignmentId)]);
        const assignment = aRows?.[0];
        if (!assignment) return NextResponse.json({ message: "Assignment not found" }, { status: 404 });

        const [blocks] = await dbTenant("SELECT * FROM `assignment_blocks` WHERE assignmentId = ?", [parseInt(assignmentId)]);
        if (!blocks || blocks.length === 0) return NextResponse.json({ message: "No deployment blocks found for this assignment." }, { status: 400 });

        let totalCreated = 0;
        let totalSkipped = 0;

        await withTenantTransaction(async (tx) => {
            for (const block of blocks) {
                const blockType = block.blockType || "VEHICLE";

                // DETOUR parent blocks generate no DTLs — children handle their own
                if (blockType === "DETOUR") {
                    continue;
                }

                let enableAutoTimeLogs = block.enableAutoTimeLogs;
                let includeWeekendsForAutoLogs = block.includeWeekendsForAutoLogs;
                let plannedOvertimeHours = block.plannedOvertimeHours;

                if (block.detourBlockId) {
                    const [[parentBlock]] = await tx.execute(
                        "SELECT enableAutoTimeLogs, includeWeekendsForAutoLogs, plannedOvertimeHours FROM `assignment_blocks` WHERE id = ? LIMIT 1",
                        [block.detourBlockId]
                    );
                    if (parentBlock) {
                        enableAutoTimeLogs = parentBlock.enableAutoTimeLogs;
                        includeWeekendsForAutoLogs = parentBlock.includeWeekendsForAutoLogs;
                        plannedOvertimeHours = parentBlock.plannedOvertimeHours;
                    }
                }

                const today = startOfDay(new Date());
                let currentIterDate = startOfDay(new Date(block.startDate));
                const blockEndDate = startOfDay(new Date(block.endDate));
                const targetEndDate = min([today, blockEndDate]);

                // Fetch resource snapshot for the block
                let resourceNameSnapshot = null, rateSnapshot = null;
                if (blockType === "VEHICLE" && block.vehicleId) {
                    const [[vRow]] = await tx.execute("SELECT regNo, baseRentAmount FROM `vehicles` WHERE id = ? LIMIT 1", [block.vehicleId]);
                    resourceNameSnapshot = vRow?.regNo ?? null;
                    rateSnapshot = vRow?.baseRentAmount ?? null;
                } else if (blockType === "OPERATOR" && block.operatorId) {
                    const [[oRow]] = await tx.execute("SELECT name, hourlyRate FROM `operators` WHERE id = ? LIMIT 1", [block.operatorId]);
                    resourceNameSnapshot = oRow?.name ?? null;
                    rateSnapshot = oRow?.hourlyRate ?? null;
                } else if (blockType === "MATERIAL" && block.materialId) {
                    const [[mRow]] = await tx.execute("SELECT name, costPerDay FROM `materials` WHERE id = ? LIMIT 1", [block.materialId]);
                    resourceNameSnapshot = mRow?.name ?? null;
                    rateSnapshot = mRow?.costPerDay ?? null;
                } else if (blockType === "LABOUR" && block.labourTypeId) {
                    const [[lRow]] = await tx.execute("SELECT labourType, costPerDay FROM `labours` WHERE id = ? LIMIT 1", [block.labourTypeId]);
                    resourceNameSnapshot = lRow?.labourType ?? null;
                    rateSnapshot = lRow?.costPerDay ?? null;
                }

                while (currentIterDate <= targetEndDate) {
                    if (!enableAutoTimeLogs || block.status === 'STOPPED') {
                        totalSkipped++;
                        currentIterDate = addDays(currentIterDate, 1);
                        continue;
                    }

                    const [existing] = await tx.execute(
                        "SELECT id FROM `daily_time_logs` WHERE assignmentBlockId = ? AND date = ? LIMIT 1",
                        [block.id, currentIterDate]
                    );
                    if (existing && existing.length > 0) {
                        totalSkipped++;
                        currentIterDate = addDays(currentIterDate, 1);
                        continue;
                    }

                    const dayName = format(currentIterDate, "EEEE");
                    const isWknd = weekendDays.includes(dayName);
                    const includeWeekends = includeWeekendsForAutoLogs ?? assignmentSettings.includeWeekendsForAutoLogs ?? false;

                    if (isWknd && !includeWeekends) {
                        totalSkipped++;
                        currentIterDate = addDays(currentIterDate, 1);
                        continue;
                    }

                    if (blockType === "MATERIAL" || blockType === "LABOUR") {
                        const qty = block.quantity ?? null;
                        const workType = blockType === "MATERIAL" ? "Material" : "Labour";
                        await tx.execute(`
                            INSERT INTO \`daily_time_logs\` (
                                date, assignmentId, assignmentBlockId, customerId, projectId,
                                blockType, isBillable, isInternal,
                                vehicleId, operatorId, materialId, labourTypeId,
                                workType, quantity, workedHours, regularHours, overtimeHours, holidayHours,
                                isWeekend, isHoliday, autoGenerated,
                                resourceNameSnapshot, rateSnapshot, detourBlockId,
                                remarks, createdAt, updatedAt
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, 0, 0, 0, 0, ?, 0, 1, ?, ?, ?, ?, NOW(), NOW())
                        `, [
                            currentIterDate, assignment.id, block.id, assignment.customerId, assignment.projectId,
                            blockType, block.isBillable ?? 1, assignment.isInternal ?? 0,
                            blockType === "MATERIAL" ? block.materialId : null,
                            blockType === "LABOUR" ? block.labourTypeId : null,
                            workType, qty,
                            isWknd ? 1 : 0,
                            resourceNameSnapshot, rateSnapshot, block.detourBlockId ?? null,
                            "Auto-generated backfill missing logs",
                        ]);
                    } else {
                        const plannedOT = Number(plannedOvertimeHours || 0);
                        const workedHours = globalFullDayHours + plannedOT;
                        const regularHours = isWknd ? 0 : Math.min(workedHours, globalFullDayHours);
                        const overtimeHours = isWknd ? workedHours : Math.max(0, workedHours - globalFullDayHours);
                        const workType = blockType === "OPERATOR" ? (block.workType || "Full Day") : "Full Day";

                        await tx.execute(`
                            INSERT INTO \`daily_time_logs\` (
                                date, assignmentId, assignmentBlockId, customerId, projectId,
                                blockType, isBillable, isInternal,
                                vehicleId, operatorId, materialId, labourTypeId,
                                workType, quantity, workedHours, regularHours, overtimeHours, holidayHours,
                                isWeekend, isHoliday, autoGenerated,
                                resourceNameSnapshot, rateSnapshot, detourBlockId,
                                remarks, createdAt, updatedAt
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?, ?, ?, 0, ?, 0, 1, ?, ?, ?, ?, NOW(), NOW())
                        `, [
                            currentIterDate, assignment.id, block.id, assignment.customerId, assignment.projectId,
                            blockType, block.isBillable ?? 1, assignment.isInternal ?? 0,
                            blockType === "VEHICLE" ? (block.vehicleId || null) : null,
                            (blockType === "VEHICLE" || blockType === "OPERATOR") ? (block.operatorId || null) : null,
                            workType,
                            workedHours, regularHours, overtimeHours,
                            isWknd ? 1 : 0,
                            resourceNameSnapshot, rateSnapshot, block.detourBlockId ?? null,
                            "Auto-generated backfill missing logs",
                        ]);
                    }

                    totalCreated++;
                    currentIterDate = addDays(currentIterDate, 1);
                }
            }
        });

        await logActivity("ADMIN", 0, "GENERATE_MISSING_LOGS", `Missing logs generated for assignment ${assignmentId}: ${totalCreated} created, ${totalSkipped} skipped`);
        return NextResponse.json({
            message: `Successfully generated ${totalCreated} missing logs across all blocks (Skipped ${totalSkipped} existing or excluded logs).`,
            createdCount: totalCreated,
            skippedCount: totalSkipped
        }, { status: 200 });

    } catch (error) {
        console.error("Error generating missing logs:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
