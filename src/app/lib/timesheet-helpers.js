import { dbTenant } from "@/app/lib/db";
import { format } from "date-fns";

/**
 * Fetch timesheet_lines with all resource JOINs for a given timesheet ID.
 * Used by: [id]/route.js (GET), [id]/send/route.js, generate/route.js (notification)
 */
export async function fetchTimesheetLines(timesheetId) {
    const [lines] = await dbTenant(`
        SELECT l.*, v.vehicleCode, m.name as modelName, o.name as operatorName,
               mat.name as materialName, lab.labourType as labourTypeName
        FROM \`timesheet_lines\` l
        LEFT JOIN \`vehicles\` v ON v.id = l.vehicleId
        LEFT JOIN \`vehicle_models\` m ON m.id = v.modelId
        LEFT JOIN \`operators\` o ON o.id = l.operatorId
        LEFT JOIN \`materials\` mat ON mat.id = l.materialId
        LEFT JOIN \`labours\` lab ON lab.id = l.labourTypeId
        WHERE l.timesheetId = ?
        ORDER BY l.date ASC
    `, [timesheetId]);
    return lines || [];
}

/**
 * Build the daily_time_logs SELECT query with all resource JOINs.
 * Returns { sql, params } ready for dbTenant(sql, params).
 * Used by: generate/route.js, regenerate/route.js
 */
export function buildDTLQuery({ isInternal, customerId, projectId, periodStart, periodEnd }) {
    let sql = `
        SELECT l.*,
            v.baseRentAmount, v.baseRentType, v.defaultRentCycle, v.regNo as vehicle_regNo,
            o.hourlyRate, o.name as operator_name,
            mat.costPerDay as material_costPerDay, mat.name as material_name,
            lab.costPerDay as labour_costPerDay, lab.labourType as labour_type_name,
            ab.billingCycle as block_billingCycle
        FROM \`daily_time_logs\` l
        JOIN \`assignments\` a ON a.id = l.assignmentId
        LEFT JOIN \`vehicles\` v ON v.id = l.vehicleId
        LEFT JOIN \`operators\` o ON o.id = l.operatorId
        LEFT JOIN \`materials\` mat ON mat.id = l.materialId
        LEFT JOIN \`labours\` lab ON lab.id = l.labourTypeId
        LEFT JOIN \`assignment_blocks\` ab ON ab.id = l.assignmentBlockId
        WHERE l.date >= ? AND l.date <= ?
          AND l.isBillable = 1
          AND a.status IN ('ACTIVE', 'COMPLETED')
    `;
    const params = [periodStart, periodEnd];

    if (isInternal) {
        sql += " AND l.isInternal = 1";
    } else {
        sql += " AND l.customerId = ?";
        params.push(customerId);
        if (projectId) {
            sql += " AND l.projectId = ?";
            params.push(projectId);
        }
    }

    return { sql, params };
}

/**
 * Aggregate daily_time_log rows into grouped timesheet line entries (one per resource per day).
 * Used by: generate/route.js, regenerate/route.js
 */
export function aggregateLogsIntoLines(logs, { fullDayHours, overtimeMultiplier, holidayMultiplier }) {
    const groupedLines = new Map();

    for (const log of logs) {
        const blockType = log.blockType || "VEHICLE";
        const d = new Date(log.date);
        const dateStr = !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : "";

        if (blockType === "VEHICLE" && log.operatorId) {
            // 1. Process Vehicle Part (Dry Rent)
            const vehicleKey = `V-${dateStr}-${log.vehicleId}-0`;
            if (!groupedLines.has(vehicleKey)) {
                groupedLines.set(vehicleKey, {
                    blockType: "VEHICLE",
                    isBillable: log.isBillable ?? 1,
                    date: log.date,
                    vehicleId: log.vehicleId || null,
                    operatorId: null,
                    materialId: null,
                    labourTypeId: null,
                    regularHours: 0, overtimeHours: 0, holidayHours: 0,
                    quantity: 0, calculatedAmount: 0,
                    detourBlockId: log.detourBlockId ?? null,
                    resourceNameSnapshot: log.vehicle_regNo ?? log.resourceNameSnapshot ?? null,
                    rateSnapshot: log.baseRentAmount ?? null,
                });
            }

            const vehicleEntry = groupedLines.get(vehicleKey);
            const worked = Number(log.workedHours || 0);

            let logRegular = 0, logOvertime = 0, logHoliday = 0;
            if (log.isHoliday) logHoliday = worked;
            else if (log.isWeekend) logOvertime = worked;
            else {
                logRegular = Math.min(worked, fullDayHours);
                logOvertime = Math.max(0, worked - fullDayHours);
            }
            vehicleEntry.regularHours += logRegular;
            vehicleEntry.overtimeHours += logOvertime;
            vehicleEntry.holidayHours += logHoliday;

            const rawRate = Number(log.baseRentAmount || 0);
            const vHourlyRate = log.baseRentType === "HOURLY" ? rawRate
                : log.baseRentType === "DAILY" ? rawRate / fullDayHours
                : rawRate / 30 / fullDayHours;
            const totalHrs = logRegular + logOvertime + logHoliday;
            const effectiveCycle = log.block_billingCycle || log.defaultRentCycle;
            let vehicleCost = 0;
            if (totalHrs === 0) {
                vehicleCost = 0;
            } else if (effectiveCycle === "DAILY") {
                const dailyRate = vHourlyRate * fullDayHours;
                vehicleCost = totalHrs <= fullDayHours ? dailyRate : dailyRate + (totalHrs - fullDayHours) * vHourlyRate;
            } else {
                vehicleCost = totalHrs * vHourlyRate;
            }
            vehicleEntry.calculatedAmount += vehicleCost;

            // 2. Process Operator Part
            const operatorKey = `O-${dateStr}-${log.operatorId}`;
            if (!groupedLines.has(operatorKey)) {
                const operatorName = log.operator_name || "Operator";
                const vehicleReg = log.vehicle_regNo ? ` (on ${log.vehicle_regNo})` : "";
                groupedLines.set(operatorKey, {
                    blockType: "OPERATOR",
                    isBillable: log.isBillable ?? 1,
                    date: log.date,
                    vehicleId: null,
                    operatorId: log.operatorId || null,
                    materialId: null,
                    labourTypeId: null,
                    regularHours: 0, overtimeHours: 0, holidayHours: 0,
                    quantity: 0, calculatedAmount: 0,
                    detourBlockId: log.detourBlockId ?? null,
                    resourceNameSnapshot: `${operatorName}${vehicleReg}`,
                    rateSnapshot: log.hourlyRate ?? null,
                });
            }

            const operatorEntry = groupedLines.get(operatorKey);
            operatorEntry.regularHours += logRegular;
            operatorEntry.overtimeHours += logOvertime;
            operatorEntry.holidayHours += logHoliday;

            const opRate = Number(log.hourlyRate || 0);
            operatorEntry.calculatedAmount += logRegular * opRate
                + logOvertime * opRate * overtimeMultiplier
                + logHoliday * opRate * holidayMultiplier;

        } else {
            // Process normally (VEHICLE without operator, OPERATOR, MATERIAL, LABOUR)
            let key;
            if (blockType === "VEHICLE") key = `V-${dateStr}-${log.vehicleId}-0`;
            else if (blockType === "OPERATOR") key = `O-${dateStr}-${log.operatorId}`;
            else if (blockType === "MATERIAL") key = `M-${dateStr}-${log.materialId}`;
            else key = `L-${dateStr}-${log.labourTypeId}`;

            if (!groupedLines.has(key)) {
                let resourceNameSnapshot = null, rateSnapshot = null;
                if (blockType === "VEHICLE") { resourceNameSnapshot = log.vehicle_regNo; rateSnapshot = log.baseRentAmount; }
                else if (blockType === "OPERATOR") { resourceNameSnapshot = log.operator_name; rateSnapshot = log.hourlyRate; }
                else if (blockType === "MATERIAL") { resourceNameSnapshot = log.material_name; rateSnapshot = log.material_costPerDay; }
                else { resourceNameSnapshot = log.labour_type_name; rateSnapshot = log.labour_costPerDay; }

                groupedLines.set(key, {
                    blockType,
                    isBillable: log.isBillable ?? 1,
                    date: log.date,
                    vehicleId: blockType === "VEHICLE" ? (log.vehicleId || null) : null,
                    operatorId: (blockType === "VEHICLE" || blockType === "OPERATOR") ? (log.operatorId || null) : null,
                    materialId: blockType === "MATERIAL" ? (log.materialId || null) : null,
                    labourTypeId: blockType === "LABOUR" ? (log.labourTypeId || null) : null,
                    regularHours: 0, overtimeHours: 0, holidayHours: 0,
                    quantity: 0, calculatedAmount: 0,
                    detourBlockId: log.detourBlockId ?? null,
                    resourceNameSnapshot: resourceNameSnapshot ?? log.resourceNameSnapshot ?? null,
                    rateSnapshot: rateSnapshot ?? null,
                });
            }

            const entry = groupedLines.get(key);
            const worked = Number(log.workedHours || 0);

            if (blockType === "MATERIAL" || blockType === "LABOUR") {
                const qty = Number(log.quantity || 0);
                const rate = blockType === "MATERIAL"
                    ? Number(log.material_costPerDay || 0)
                    : Number(log.labour_costPerDay || 0);
                entry.quantity += qty;
                entry.calculatedAmount += rate * qty;
            } else {
                let logRegular = 0, logOvertime = 0, logHoliday = 0;
                if (log.isHoliday) logHoliday = worked;
                else if (log.isWeekend) logOvertime = worked;
                else {
                    logRegular = Math.min(worked, fullDayHours);
                    logOvertime = Math.max(0, worked - fullDayHours);
                }
                entry.regularHours += logRegular;
                entry.overtimeHours += logOvertime;
                entry.holidayHours += logHoliday;

                if (blockType === "VEHICLE") {
                    const rawRate = Number(log.baseRentAmount || 0);
                    const vHourlyRate = log.baseRentType === "HOURLY" ? rawRate
                        : log.baseRentType === "DAILY" ? rawRate / fullDayHours
                        : rawRate / 30 / fullDayHours;
                    const totalHrs = logRegular + logOvertime + logHoliday;
                    const effectiveCycle = log.block_billingCycle || log.defaultRentCycle;
                    let vehicleCost = 0;
                    if (totalHrs === 0) {
                        vehicleCost = 0;
                    } else if (effectiveCycle === "DAILY") {
                        const dailyRate = vHourlyRate * fullDayHours;
                        vehicleCost = totalHrs <= fullDayHours ? dailyRate : dailyRate + (totalHrs - fullDayHours) * vHourlyRate;
                    } else {
                        vehicleCost = totalHrs * vHourlyRate;
                    }
                    entry.calculatedAmount += vehicleCost;
                } else if (blockType === "OPERATOR") {
                    const opRate = Number(log.hourlyRate || 0);
                    entry.calculatedAmount += logRegular * opRate
                        + logOvertime * opRate * overtimeMultiplier
                        + logHoliday * opRate * holidayMultiplier;
                }
            }
        }
    }

    return Array.from(groupedLines.values());
}

/**
 * Insert timesheet_lines rows for a given timesheetId within an existing transaction.
 * Used by: generate/route.js, regenerate/route.js
 */
export async function insertTimesheetLines(tx, timesheetId, lines) {
    for (const line of lines) {
        const totalHours = line.regularHours + line.overtimeHours + line.holidayHours;
        await tx.execute(`
            INSERT INTO \`timesheet_lines\` (
                timesheetId, date,
                blockType, isBillable,
                vehicleId, operatorId, materialId, labourTypeId,
                regularHours, overtimeHours, holidayHours, totalHours,
                quantity, calculatedAmount,
                detourBlockId, resourceNameSnapshot, rateSnapshot,
                createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [
            timesheetId, line.date,
            line.blockType, line.isBillable,
            line.vehicleId, line.operatorId, line.materialId, line.labourTypeId,
            line.regularHours, line.overtimeHours, line.holidayHours, totalHours,
            line.quantity || null, line.calculatedAmount,
            line.detourBlockId, line.resourceNameSnapshot, line.rateSnapshot,
        ]);
    }
}
