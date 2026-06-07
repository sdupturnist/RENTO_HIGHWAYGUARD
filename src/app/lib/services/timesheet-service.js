import { dbTenant } from "@/app/lib/db";

export async function getTimesheets(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.customerId) { conditions.push("ts.customerId = ?"); params.push(filters.customerId); }
    if (filters.projectId) { conditions.push("ts.projectId = ?"); params.push(filters.projectId); }
    if (filters.status) { conditions.push("ts.status = ?"); params.push(filters.status); }
    if (filters.uninvoiced) { conditions.push("ts.status != 'INVOICED' AND ts.approvedAt IS NOT NULL"); }
    if (filters.periodStart) { conditions.push("ts.periodStart >= ?"); params.push(filters.periodStart); }
    if (filters.periodEnd) { conditions.push("ts.periodEnd <= ?"); params.push(filters.periodEnd); }
    if (filters.search) {
        conditions.push("(ts.timesheetCode LIKE ? OR c.companyName LIKE ?)");
        const s = `%${filters.search}%`;
        params.push(s, s);
    }

    const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

    const [timesheets] = await dbTenant(`
        SELECT ts.*,
               c.companyName as customer_companyName,
               p.name as project_name
        FROM \`timesheets\` ts
        LEFT JOIN \`customers\` c ON c.id = ts.customerId
        LEFT JOIN \`projects\` p ON p.id = ts.projectId
        ${where}
        ORDER BY ts.createdAt DESC
    `, params);

    const enriched = await Promise.all((timesheets || []).map(async (ts) => {
        const [agg] = await dbTenant(`
            SELECT
                COUNT(DISTINCT CASE WHEN blockType = 'VEHICLE' OR blockType IS NULL THEN vehicleId END) as uniqueVehicles,
                COUNT(DISTINCT CASE WHEN operatorId IS NOT NULL THEN operatorId END) as uniqueOperators,
                SUM(CASE WHEN blockType = 'OPERATOR' AND vehicleId IS NOT NULL THEN 0 ELSE totalHours END) as totalHours,
                SUM(calculatedAmount) as totalAmount
            FROM \`timesheet_lines\`
            WHERE timesheetId = ?
        `, [ts.id]);

        const a = agg?.[0] || {};
        return {
            ...ts,
            customer: ts.customer_companyName ? { companyName: ts.customer_companyName } : null,
            project: ts.project_name ? { name: ts.project_name } : null,
            totalVehicles: Number(a.uniqueVehicles || 0),
            totalOperators: Number(a.uniqueOperators || 0),
            totalHours: Number(a.totalHours || 0),
            totalAmount: Number(a.totalAmount || 0),
        };
    }));

    return enriched;
}

export async function getTimesheetById(id) {
    const [tsRows] = await dbTenant(`
        SELECT ts.*,
               c.companyName, c.address as customer_address, c.email as customer_email,
               p.name as project_name
        FROM \`timesheets\` ts
        LEFT JOIN \`customers\` c ON c.id = ts.customerId
        LEFT JOIN \`projects\` p ON p.id = ts.projectId
        WHERE ts.id = ? LIMIT 1
    `, [id]);
    const ts = tsRows?.[0];
    if (!ts) return null;

    const [lineRows] = await dbTenant(`
        SELECT tl.*,
               v.vehicleCode, v.regNo, v.baseRentAmount, v.capacity, v.defaultRentCycle,
               vm.name as vehicle_model,
               vt.name as vehicle_type_name,
               o.name as operator_name, o.hourlyRate as operator_hourlyRate,
               mat.name as material_name,
               lab.labourType as labour_type_name,
               ab.detourTemplateId,
               dst.name as detour_template_name
        FROM \`timesheet_lines\` tl
        LEFT JOIN \`vehicles\` v ON v.id = tl.vehicleId
        LEFT JOIN \`vehicle_models\` vm ON vm.id = v.modelId
        LEFT JOIN \`vehicle_types\` vt ON vt.id = v.typeId
        LEFT JOIN \`operators\` o ON o.id = tl.operatorId
        LEFT JOIN \`materials\` mat ON mat.id = tl.materialId
        LEFT JOIN \`labours\` lab ON lab.id = tl.labourTypeId
        LEFT JOIN \`assignment_blocks\` ab ON ab.id = tl.detourBlockId
        LEFT JOIN \`detour_service_templates\` dst ON dst.id = ab.detourTemplateId
        WHERE tl.timesheetId = ?
        ORDER BY tl.date ASC
    `, [id]);

    const [settingsRows] = await dbTenant(`SELECT * FROM \`company_settings\` LIMIT 1`, []);
    const companySettings = settingsRows?.[0] || null;

    // Outdated check — use isInternal flag or customerId
    let isOutdated = false;
    try {
        let outdatedQuery, outdatedParams;
        if (ts.isInternal) {
            outdatedQuery = `
                SELECT updatedAt FROM \`daily_time_logs\`
                WHERE isInternal = 1
                  AND date BETWEEN ? AND ?
                  AND updatedAt > ?
                ORDER BY updatedAt DESC LIMIT 1
            `;
            outdatedParams = [ts.periodStart, ts.periodEnd, ts.generatedAt];
        } else {
            outdatedQuery = `
                SELECT updatedAt FROM \`daily_time_logs\`
                WHERE customerId = ?
                  AND (projectId = ? OR (projectId IS NULL AND ? IS NULL))
                  AND date BETWEEN ? AND ?
                  AND updatedAt > ?
                ORDER BY updatedAt DESC LIMIT 1
            `;
            outdatedParams = [ts.customerId, ts.projectId || null, ts.projectId || null, ts.periodStart, ts.periodEnd, ts.generatedAt];
        }
        const [latestRows] = await dbTenant(outdatedQuery, outdatedParams);
        isOutdated = (latestRows?.length ?? 0) > 0;
    } catch (_) {}

    const sanitizedLines = (lineRows || []).map((line) => ({
        ...line,
        calculatedAmount: Number(line.calculatedAmount || 0),
        vehicle: line.vehicleId ? {
            id: line.vehicleId,
            vehicleCode: line.vehicleCode,
            regNo: line.regNo,
            baseRentAmount: Number(line.baseRentAmount || 0),
            capacity: line.capacity ? Number(line.capacity) : null,
            defaultRentCycle: line.defaultRentCycle,
            model: { name: line.vehicle_model },
            vehicleType: { name: line.vehicle_type_name },
        } : null,
        operator: line.operatorId ? {
            id: line.operatorId,
            name: line.operator_name,
            hourlyRate: Number(line.operator_hourlyRate || 0),
        } : null,
        material: line.materialId ? { id: line.materialId, name: line.material_name } : null,
        labour: line.labourTypeId ? { id: line.labourTypeId, labourType: line.labour_type_name } : null,
        detourTemplateName: line.detour_template_name ?? null,
        vehicleTypeName: line.vehicle_type_name ?? null,
    }));

    return {
        ...ts,
        customer: ts.companyName ? { companyName: ts.companyName, address: ts.customer_address, email: ts.customer_email } : null,
        project: ts.project_name ? { name: ts.project_name } : null,
        lines: sanitizedLines,
        isOutdated,
        totalHours: sanitizedLines.reduce((s, l) => {
            if (l.blockType === "OPERATOR" && l.vehicleId) return s;
            return s + Number(l.totalHours || 0);
        }, 0),
        totalRegularHours: sanitizedLines.reduce((s, l) => {
            if (l.blockType === "OPERATOR" && l.vehicleId) return s;
            return s + Number(l.regularHours || 0);
        }, 0),
        totalOvertimeHours: sanitizedLines.reduce((s, l) => {
            if (l.blockType === "OPERATOR" && l.vehicleId) return s;
            return s + Number(l.overtimeHours || 0);
        }, 0),
        totalHolidayHours: sanitizedLines.reduce((s, l) => {
            if (l.blockType === "OPERATOR" && l.vehicleId) return s;
            return s + Number(l.holidayHours || 0);
        }, 0),
        totalAmount: sanitizedLines.reduce((s, l) => s + Number(l.calculatedAmount || 0), 0),
        companySettings,
    };
}
