import { dbTenant } from "@/app/lib/db";

const DAY_NAME_TO_NUM = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

async function getWeekendNumbers() {
    const [rows] = await dbTenant("SELECT weekendDays FROM `company_settings` LIMIT 1");
    const days = rows?.[0]?.weekendDays ?? [];
    return days.map(d => DAY_NAME_TO_NUM[d] ?? -1).filter(n => n >= 0);
}

function generateDateSet(startDate, endDate, includeWeekends, weekendNumbers) {
    const set = new Set();
    
    // Parse start date safely to local midnight
    let cur;
    if (startDate instanceof Date) {
        cur = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
    } else {
        const [y, m, d] = String(startDate).split('T')[0].split('-').map(Number);
        cur = new Date(y, m - 1, d, 0, 0, 0, 0);
    }

    // Parse end date safely to local midnight
    let end;
    if (endDate instanceof Date) {
        end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 0, 0, 0, 0);
    } else {
        const [y, m, d] = String(endDate).split('T')[0].split('-').map(Number);
        end = new Date(y, m - 1, d, 0, 0, 0, 0);
    }

    while (cur <= end) {
        const isWeekend = weekendNumbers.includes(cur.getDay());
        if (includeWeekends || !isWeekend) {
            const yyyy = cur.getFullYear();
            const mm = String(cur.getMonth() + 1).padStart(2, '0');
            const dd = String(cur.getDate()).padStart(2, '0');
            set.add(`${yyyy}-${mm}-${dd}`);
        }
        cur.setDate(cur.getDate() + 1);
    }
    return set;
}

export async function checkVehicleAvailability(vehicleId, startDate, endDate, includeWeekends = true, excludeAssignmentId = null) {
    const [vRows] = await dbTenant("SELECT status FROM `vehicles` WHERE id = ? LIMIT 1", [vehicleId]);
    if (!vRows?.[0] || vRows[0].status !== "ACTIVE") {
        return { available: false, conflicts: [] };
    }

    const weekendNumbers = await getWeekendNumbers();
    const proposedDates = generateDateSet(startDate, endDate, includeWeekends, weekendNumbers);
    if (proposedDates.size === 0) return { available: true, conflicts: [] };

    const params = [vehicleId];
    if (excludeAssignmentId) params.push(excludeAssignmentId);

    const [blocks] = await dbTenant(`
        SELECT b.startDate, b.endDate, b.includeWeekendsForAutoLogs,
               a.id AS assignmentId, c.companyName, p.name AS projectName
        FROM \`assignment_blocks\` b
        JOIN \`assignments\` a ON a.id = b.assignmentId
        LEFT JOIN \`customers\` c ON c.id = a.customerId
        LEFT JOIN \`projects\` p ON p.id = a.projectId
        WHERE b.vehicleId = ?
          AND b.status != 'STOPPED'
          AND a.status IN ('ACTIVE', 'DRAFT')
          ${excludeAssignmentId ? "AND a.id != ?" : ""}
    `, params);

    const conflicts = [];
    for (const block of blocks || []) {
        const blockDates = generateDateSet(
            new Date(block.startDate), new Date(block.endDate),
            !!block.includeWeekendsForAutoLogs, weekendNumbers
        );
        if ([...proposedDates].some(d => blockDates.has(d))) {
            conflicts.push({
                assignmentId: block.assignmentId,
                customer: block.companyName || "Internal",
                project: block.projectName || "N/A",
                startDate: block.startDate,
                endDate: block.endDate,
            });
        }
    }

    return { available: conflicts.length === 0, conflicts };
}

export async function checkOperatorAvailability(operatorId, startDate, endDate, includeWeekends = true, excludeAssignmentId = null) {
    const [oRows] = await dbTenant("SELECT status FROM `operators` WHERE id = ? LIMIT 1", [operatorId]);
    if (!oRows?.[0] || oRows[0].status !== "ACTIVE") {
        return { available: false, conflicts: [] };
    }

    const weekendNumbers = await getWeekendNumbers();
    const proposedDates = generateDateSet(startDate, endDate, includeWeekends, weekendNumbers);
    if (proposedDates.size === 0) return { available: true, conflicts: [] };

    const params = [operatorId];
    if (excludeAssignmentId) params.push(excludeAssignmentId);

    const [blocks] = await dbTenant(`
        SELECT b.startDate, b.endDate, b.includeWeekendsForAutoLogs,
               a.id AS assignmentId, c.companyName, p.name AS projectName
        FROM \`assignment_blocks\` b
        JOIN \`assignments\` a ON a.id = b.assignmentId
        LEFT JOIN \`customers\` c ON c.id = a.customerId
        LEFT JOIN \`projects\` p ON p.id = a.projectId
        WHERE b.operatorId = ?
          AND b.status != 'STOPPED'
          AND a.status IN ('ACTIVE', 'DRAFT')
          ${excludeAssignmentId ? "AND a.id != ?" : ""}
    `, params);

    const conflicts = [];
    for (const block of blocks || []) {
        const blockDates = generateDateSet(
            new Date(block.startDate), new Date(block.endDate),
            !!block.includeWeekendsForAutoLogs, weekendNumbers
        );
        if ([...proposedDates].some(d => blockDates.has(d))) {
            conflicts.push({
                assignmentId: block.assignmentId,
                customer: block.companyName || "Internal",
                project: block.projectName || "N/A",
                startDate: block.startDate,
                endDate: block.endDate,
            });
        }
    }

    return { available: conflicts.length === 0, conflicts };
}

export async function checkMaterialAvailability(materialId, startDate, endDate, requestedQty, excludeAssignmentId = null) {
    const [mRows] = await dbTenant("SELECT totalQuantity FROM `materials` WHERE id = ? LIMIT 1", [materialId]);
    if (!mRows?.[0]) return { available: false, totalQuantity: 0, committedQuantity: 0, availableQuantity: 0 };
    const total = Number(mRows[0].totalQuantity);

    const params = [materialId, endDate, startDate];
    if (excludeAssignmentId) params.push(excludeAssignmentId);

    const [rows] = await dbTenant(`
        SELECT COALESCE(SUM(b.quantity), 0) AS committed
        FROM \`assignment_blocks\` b
        JOIN \`assignments\` a ON a.id = b.assignmentId
        WHERE b.materialId = ?
          AND b.blockType = 'MATERIAL'
          AND b.status != 'STOPPED'
          AND a.status IN ('ACTIVE', 'DRAFT')
          AND b.startDate <= ? AND b.endDate >= ?
          ${excludeAssignmentId ? "AND a.id != ?" : ""}
    `, params);

    const committed = Number(rows?.[0]?.committed || 0);
    const available = Math.max(0, total - committed);
    return { available: available >= requestedQty, totalQuantity: total, committedQuantity: committed, availableQuantity: available };
}

export async function checkLabourAvailability(labourTypeId, startDate, endDate, requestedQty, excludeAssignmentId = null) {
    const [lRows] = await dbTenant("SELECT totalQuantity FROM `labours` WHERE id = ? LIMIT 1", [labourTypeId]);
    if (!lRows?.[0]) return { available: false, totalQuantity: 0, committedQuantity: 0, availableQuantity: 0 };
    const total = Number(lRows[0].totalQuantity);

    const params = [labourTypeId, endDate, startDate];
    if (excludeAssignmentId) params.push(excludeAssignmentId);

    const [rows] = await dbTenant(`
        SELECT COALESCE(SUM(b.quantity), 0) AS committed
        FROM \`assignment_blocks\` b
        JOIN \`assignments\` a ON a.id = b.assignmentId
        WHERE b.labourTypeId = ?
          AND b.blockType = 'LABOUR'
          AND b.status != 'STOPPED'
          AND a.status IN ('ACTIVE', 'DRAFT')
          AND b.startDate <= ? AND b.endDate >= ?
          ${excludeAssignmentId ? "AND a.id != ?" : ""}
    `, params);

    const committed = Number(rows?.[0]?.committed || 0);
    const available = Math.max(0, total - committed);
    return { available: available >= requestedQty, totalQuantity: total, committedQuantity: committed, availableQuantity: available };
}

// Legacy exports for backward compatibility with check-conflict/route.js and other callers
export async function getAvailableVehicles(startDate, endDate) {
    const weekendNumbers = await getWeekendNumbers();
    const proposedDates = generateDateSet(startDate, endDate, true, weekendNumbers);
    const proposedArr = [...proposedDates];

    const [allVehicles] = await dbTenant("SELECT * FROM `vehicles` WHERE status = 'ACTIVE'");
    if (!allVehicles?.length) return [];

    const [blocks] = await dbTenant(`
        SELECT b.vehicleId, b.startDate, b.endDate, b.includeWeekendsForAutoLogs
        FROM \`assignment_blocks\` b
        JOIN \`assignments\` a ON a.id = b.assignmentId
        WHERE b.vehicleId IS NOT NULL AND b.status != 'STOPPED' AND a.status IN ('ACTIVE', 'DRAFT')
    `);

    const unavailableIds = new Set();
    for (const block of blocks || []) {
        const blockDates = generateDateSet(new Date(block.startDate), new Date(block.endDate), !!block.includeWeekendsForAutoLogs, weekendNumbers);
        if (proposedArr.some(d => blockDates.has(d))) {
            unavailableIds.add(block.vehicleId);
        }
    }

    return allVehicles.filter(v => !unavailableIds.has(v.id));
}

export async function getAvailableOperators(startDate, endDate) {
    const weekendNumbers = await getWeekendNumbers();
    const proposedDates = generateDateSet(startDate, endDate, true, weekendNumbers);
    const proposedArr = [...proposedDates];

    const [allOperators] = await dbTenant("SELECT * FROM `operators` WHERE status = 'ACTIVE'");
    if (!allOperators?.length) return [];

    const [blocks] = await dbTenant(`
        SELECT b.operatorId, b.startDate, b.endDate, b.includeWeekendsForAutoLogs
        FROM \`assignment_blocks\` b
        JOIN \`assignments\` a ON a.id = b.assignmentId
        WHERE b.operatorId IS NOT NULL AND b.status != 'STOPPED' AND a.status IN ('ACTIVE', 'DRAFT')
    `);

    const unavailableIds = new Set();
    for (const block of blocks || []) {
        const blockDates = generateDateSet(new Date(block.startDate), new Date(block.endDate), !!block.includeWeekendsForAutoLogs, weekendNumbers);
        if (proposedArr.some(d => blockDates.has(d))) {
            unavailableIds.add(block.operatorId);
        }
    }

    return allOperators.filter(o => !unavailableIds.has(o.id));
}

export async function validateAssignmentBlocks(blocks, excludeAssignmentId = null) {
    const weekendNumbers = await getWeekendNumbers();
    const allocations = [];

    // Collect all allocations and check required fields
    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
        const block = blocks[blockIndex];
        const blockType = block.blockType || "VEHICLE";

        if (blockType === "DETOUR") {
            const children = block.detourChildren || [];
            if (children.length === 0) {
                throw new Error(`Detour Service #${blockIndex + 1} must have at least one resource slot.`);
            }

            for (let childIndex = 0; childIndex < children.length; childIndex++) {
                const child = children[childIndex];
                const childType = child.blockType;

                if (childType === "VEHICLE") {
                    if (!child.vehicleId) {
                        throw new Error(`Resource selection is required: Detour Service #${blockIndex + 1} slot #${childIndex + 1} (Vehicle) has no vehicle selected.`);
                    }
                    allocations.push({
                        type: "VEHICLE",
                        id: Number(child.vehicleId),
                        startDate: block.startDate,
                        endDate: block.endDate,
                        includeWeekends: child.includeWeekendsForAutoLogs || block.includeWeekendsForAutoLogs || false,
                        source: `Detour Service #${blockIndex + 1} -> Vehicle Slot #${childIndex + 1}`
                    });
                    if (child.withOperator) {
                        if (!child.operatorId) {
                            throw new Error(`Resource selection is required: Detour Service #${blockIndex + 1} slot #${childIndex + 1} (Vehicle with Operator) has no operator selected.`);
                        }
                        allocations.push({
                            type: "OPERATOR",
                            id: Number(child.operatorId),
                            startDate: block.startDate,
                            endDate: block.endDate,
                            includeWeekends: child.includeWeekendsForAutoLogs || block.includeWeekendsForAutoLogs || false,
                            source: `Detour Service #${blockIndex + 1} -> Operator in Vehicle Slot #${childIndex + 1}`
                        });
                    }
                } else if (childType === "OPERATOR") {
                    if (!child.operatorId) {
                        throw new Error(`Resource selection is required: Detour Service #${blockIndex + 1} slot #${childIndex + 1} (Operator) has no operator selected.`);
                    }
                    allocations.push({
                        type: "OPERATOR",
                        id: Number(child.operatorId),
                        startDate: block.startDate,
                        endDate: block.endDate,
                        includeWeekends: child.includeWeekendsForAutoLogs || block.includeWeekendsForAutoLogs || false,
                        source: `Detour Service #${blockIndex + 1} -> Operator Slot #${childIndex + 1}`
                    });
                } else if (childType === "MATERIAL") {
                    if (!child.materialId) {
                        throw new Error(`Resource selection is required: Detour Service #${blockIndex + 1} slot #${childIndex + 1} (Material) has no material selected.`);
                    }
                } else if (childType === "LABOUR") {
                    if (!child.labourTypeId) {
                        throw new Error(`Resource selection is required: Detour Service #${blockIndex + 1} slot #${childIndex + 1} (Labour) has no labour type selected.`);
                    }
                }
            }
        } else if (blockType === "VEHICLE") {
            if (!block.vehicleId) {
                throw new Error(`Resource selection is required: Vehicle Block #${blockIndex + 1} has no vehicle selected.`);
            }
            allocations.push({
                type: "VEHICLE",
                id: Number(block.vehicleId),
                startDate: block.startDate,
                endDate: block.endDate,
                includeWeekends: block.includeWeekendsForAutoLogs || false,
                source: `Vehicle Block #${blockIndex + 1}`
            });
            if (block.withOperator) {
                if (!block.operatorId) {
                    throw new Error(`Resource selection is required: Vehicle Block #${blockIndex + 1} (With Operator) has no operator selected.`);
                }
                allocations.push({
                    type: "OPERATOR",
                    id: Number(block.operatorId),
                    startDate: block.startDate,
                    endDate: block.endDate,
                    includeWeekends: block.includeWeekendsForAutoLogs || false,
                    source: `Operator in Vehicle Block #${blockIndex + 1}`
                });
            }
        } else if (blockType === "OPERATOR") {
            if (!block.operatorId) {
                throw new Error(`Resource selection is required: Operator Block #${blockIndex + 1} has no operator selected.`);
            }
            allocations.push({
                type: "OPERATOR",
                id: Number(block.operatorId),
                startDate: block.startDate,
                endDate: block.endDate,
                includeWeekends: block.includeWeekendsForAutoLogs || false,
                source: `Operator Block #${blockIndex + 1}`
            });
        } else if (blockType === "MATERIAL") {
            if (!block.materialId) {
                throw new Error(`Resource selection is required: Material Block #${blockIndex + 1} has no material selected.`);
            }
        } else if (blockType === "LABOUR") {
            if (!block.labourTypeId) {
                throw new Error(`Resource selection is required: Labour Block #${blockIndex + 1} has no labour type selected.`);
            }
        }
    }

    // 1. Check double booking / duplicate conflicts inside the payload itself (Internal Overlap Check)
    for (let i = 0; i < allocations.length; i++) {
        const a = allocations[i];
        const aDates = generateDateSet(a.startDate, a.endDate, a.includeWeekends, weekendNumbers);

        for (let j = i + 1; j < allocations.length; j++) {
            const b = allocations[j];
            if (a.type === b.type && a.id === b.id) {
                const bDates = generateDateSet(b.startDate, b.endDate, b.includeWeekends, weekendNumbers);
                const overlap = [...aDates].filter(d => bDates.has(d));
                if (overlap.length > 0) {
                    throw new Error(`Double Booking Conflict inside this assignment: The ${a.type.toLowerCase()} is selected for both "${a.source}" and "${b.source}" with overlapping dates on: ${overlap.join(', ')}.`);
                }
            }
        }
    }

    // 2. Check overlap conflicts against the Database (External check)
    for (const a of allocations) {
        if (a.type === "VEHICLE") {
            const check = await checkVehicleAvailability(a.id, a.startDate, a.endDate, a.includeWeekends, excludeAssignmentId);
            if (!check.available) {
                const conf = check.conflicts[0];
                throw new Error(`Double Booking Conflict: Vehicle is already active/assigned to another assignment (ASG-${conf.assignmentId}, Customer: ${conf.customer}) during the period ${new Date(conf.startDate).toLocaleDateString()} to ${new Date(conf.endDate).toLocaleDateString()}.`);
            }
        } else if (a.type === "OPERATOR") {
            const check = await checkOperatorAvailability(a.id, a.startDate, a.endDate, a.includeWeekends, excludeAssignmentId);
            if (!check.available) {
                const conf = check.conflicts[0];
                throw new Error(`Double Booking Conflict: Operator is already active/assigned to another assignment (ASG-${conf.assignmentId}, Customer: ${conf.customer}) during the period ${new Date(conf.startDate).toLocaleDateString()} to ${new Date(conf.endDate).toLocaleDateString()}.`);
            }
        }
    }
}
