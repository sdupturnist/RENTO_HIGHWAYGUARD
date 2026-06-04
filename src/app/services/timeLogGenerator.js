import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { format } from "date-fns";

export async function generateDailyTimeLogs(params = new Date()) {
    const isManualTrigger = typeof params === "object" && "assignmentId" in params;
    const targetDate = isManualTrigger ? new Date() : params;
    const specificAssignmentId = isManualTrigger ? params.assignmentId : undefined;

    const y = targetDate.getFullYear();
    const m = targetDate.getMonth() + 1;
    const d = targetDate.getDate();
    const targetDateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    const [companyRows] = await dbTenant("SELECT * FROM `company_settings` LIMIT 1");
    const companySettings = companyRows?.[0] || {};
    const [assignSettingsRows] = await dbTenant("SELECT * FROM `assignment_settings` LIMIT 1");
    const assignmentSettings = assignSettingsRows?.[0] || {};

    const globalFullDayHours = Number(companySettings.fullDayHours || 8);
    const weekendDays = companySettings.weekendDays || [];
    const dayName = format(targetDate, "EEEE");
    const isWknd = weekendDays.includes(dayName);

    let query = `
        SELECT a.*
        FROM \`assignments\` a
        WHERE a.status = 'ACTIVE'
          AND DATE(a.startDate) <= ?
          AND DATE(a.endDate) >= ?
    `;
    const qParams = [targetDateStr, targetDateStr];
    if (specificAssignmentId) {
        query += " AND a.id = ?";
        qParams.push(specificAssignmentId);
    }

    const [activeAssignments] = await dbTenant(query, qParams);

    let createdCount = 0;
    let skippedCount = 0;

    for (const assignment of (activeAssignments || [])) {
        await withTenantTransaction(async (tx) => {
            const [blocks] = await tx.execute(`
                SELECT b.* FROM \`assignment_blocks\` b
                WHERE b.assignmentId = ?
            `, [assignment.id]);

            for (const block of (blocks || [])) {
                const blockType = block.blockType || "VEHICLE";

                // DETOUR parent blocks generate no DTL — children handle their own
                if (blockType === "DETOUR") continue;

                const blockStartStr = block.startDate.toISOString ? block.startDate.toISOString().split("T")[0] : String(block.startDate).split("T")[0];
                const blockEndStr = block.endDate.toISOString ? block.endDate.toISOString().split("T")[0] : String(block.endDate).split("T")[0];

                if (targetDateStr < blockStartStr || targetDateStr > blockEndStr) continue;
                if (!block.enableAutoTimeLogs) continue;
                if (block.status === "STOPPED") continue;

                const includeWeekends = block.includeWeekendsForAutoLogs ?? assignmentSettings.includeWeekendsForAutoLogs ?? false;
                if (isWknd && !includeWeekends) continue;

                const [existing] = await tx.execute(
                    `SELECT id FROM \`daily_time_logs\` WHERE assignmentBlockId = ? AND date = ? LIMIT 1`,
                    [block.id, targetDateStr]
                );
                if (existing?.length > 0) { skippedCount++; continue; }

                let vehicleId = null, operatorId = null, materialId = null, labourTypeId = null;
                let workType = null, quantity = null;
                let workedHours = 0, regularHours = 0, overtimeHours = 0;
                let resourceNameSnapshot = null, rateSnapshot = null;

                if (blockType === "VEHICLE") {
                    vehicleId = block.vehicleId || null;
                    operatorId = block.operatorId || null;
                    workType = "Full Day";
                    const plannedOT = Number(block.plannedOvertimeHours || 0);
                    workedHours = globalFullDayHours + plannedOT;
                    regularHours = isWknd ? 0 : Math.min(workedHours, globalFullDayHours);
                    overtimeHours = isWknd ? workedHours : Math.max(0, workedHours - globalFullDayHours);
                    if (block.vehicleId) {
                        const [vRows] = await tx.execute(
                            `SELECT regNo, baseRentAmount FROM \`vehicles\` WHERE id = ? LIMIT 1`,
                            [block.vehicleId]
                        );
                        resourceNameSnapshot = vRows?.[0]?.regNo ?? null;
                        rateSnapshot = vRows?.[0]?.baseRentAmount ?? null;
                    }
                } else if (blockType === "OPERATOR") {
                    operatorId = block.operatorId || null;
                    workType = block.workType || "Full Day";
                    const plannedOT = Number(block.plannedOvertimeHours || 0);
                    workedHours = globalFullDayHours + plannedOT;
                    regularHours = isWknd ? 0 : Math.min(workedHours, globalFullDayHours);
                    overtimeHours = isWknd ? workedHours : Math.max(0, workedHours - globalFullDayHours);
                    if (block.operatorId) {
                        const [oRows] = await tx.execute(
                            `SELECT name, hourlyRate FROM \`operators\` WHERE id = ? LIMIT 1`,
                            [block.operatorId]
                        );
                        resourceNameSnapshot = oRows?.[0]?.name ?? null;
                        rateSnapshot = oRows?.[0]?.hourlyRate ?? null;
                    }
                } else if (blockType === "MATERIAL") {
                    materialId = block.materialId || null;
                    quantity = block.quantity ?? null;
                    workType = "Material";
                    if (block.materialId) {
                        const [mRows] = await tx.execute(
                            `SELECT name, costPerDay FROM \`materials\` WHERE id = ? LIMIT 1`,
                            [block.materialId]
                        );
                        resourceNameSnapshot = mRows?.[0]?.name ?? null;
                        rateSnapshot = mRows?.[0]?.costPerDay ?? null;
                    }
                } else if (blockType === "LABOUR") {
                    labourTypeId = block.labourTypeId || null;
                    quantity = block.quantity ?? null;
                    workType = "Labour";
                    if (block.labourTypeId) {
                        const [lRows] = await tx.execute(
                            `SELECT labourType, costPerDay FROM \`labours\` WHERE id = ? LIMIT 1`,
                            [block.labourTypeId]
                        );
                        resourceNameSnapshot = lRows?.[0]?.labourType ?? null;
                        rateSnapshot = lRows?.[0]?.costPerDay ?? null;
                    }
                }

                await tx.execute(`
                    INSERT INTO \`daily_time_logs\` (
                        date, assignmentId, assignmentBlockId, customerId, projectId,
                        blockType, isBillable, isInternal,
                        vehicleId, operatorId, materialId, labourTypeId,
                        workType, quantity,
                        workedHours, regularHours, overtimeHours, holidayHours,
                        isWeekend, isHoliday, autoGenerated,
                        resourceNameSnapshot, rateSnapshot, detourBlockId,
                        remarks, createdAt, updatedAt
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, 1, ?, ?, ?, ?, NOW(), NOW())
                `, [
                    targetDateStr, assignment.id, block.id,
                    assignment.customerId || null, assignment.projectId || null,
                    blockType, block.isBillable ?? 1, assignment.isInternal ?? 0,
                    vehicleId, operatorId, materialId, labourTypeId,
                    workType, quantity,
                    workedHours, regularHours, overtimeHours,
                    isWknd ? 1 : 0,
                    resourceNameSnapshot, rateSnapshot, block.detourBlockId ?? null,
                    "Auto-generated based on assignment plan",
                ]);

                createdCount++;
            }
        });
    }

    return { created: createdCount, skipped: skippedCount };
}
