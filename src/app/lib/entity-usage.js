import { dbTenant } from "@/app/lib/db";

/**
 * Check whether an entity is referenced in any downstream table.
 * Call this at the top of every DELETE handler before touching the DB.
 *
 * Returns { inUse: boolean, usedIn: string[], counts: { [label]: number } }
 *
 * Usage:
 *   const { inUse, usedIn } = await checkEntityUsage("material", id);
 *   if (inUse) return 409 with error message listing usedIn
 */
export async function checkEntityUsage(entityType, entityId) {
    const rules = USAGE_RULES[entityType];
    if (!rules) return { inUse: false, usedIn: [], counts: {} };

    const usedIn = [];
    const counts = {};

    for (const rule of rules) {
        const extra = rule.extra || "";
        const [rows] = await dbTenant(
            `SELECT COUNT(*) as cnt FROM \`${rule.table}\` WHERE \`${rule.col}\` = ? ${extra}`,
            [entityId]
        );
        const cnt = Number(rows?.[0]?.cnt || 0);
        if (cnt > 0) {
            usedIn.push(rule.label);
            counts[rule.label] = cnt;
        }
    }

    return { inUse: usedIn.length > 0, usedIn, counts };
}

/**
 * Build a user-facing error message from a usage check result.
 *
 * Example: "Cannot delete: this record is used in Assignments (3), Daily Time Logs (12)."
 */
export function buildUsageError(usedIn, counts) {
    const parts = usedIn.map((label) =>
        counts[label] ? `${label} (${counts[label]})` : label
    );
    return `Cannot delete: this record is referenced in ${parts.join(", ")}.`;
}

// ---------------------------------------------------------------------------
// Usage rules per entity type.
// Each rule: { table, col, label, extra? }
//   table  — MySQL table name
//   col    — column that holds the FK or text reference
//   label  — human-readable name shown in error messages
//   extra  — optional extra WHERE clause fragment (no leading AND needed — added automatically)
// ---------------------------------------------------------------------------
const USAGE_RULES = {
    // ---------- Core operational resources ----------

    vehicle: [
        { table: "assignment_blocks", col: "vehicleId",  label: "Assignments" },
        { table: "daily_time_logs",   col: "vehicleId",  label: "Daily Time Logs" },
        { table: "timesheet_lines",   col: "vehicleId",  label: "Timesheets" },
        { table: "maintenances",      col: "vehicleId",  label: "Maintenance Records" },
        { table: "expenses",          col: "vehicleId",  label: "Expenses" },
    ],

    operator: [
        { table: "assignment_blocks",   col: "operatorId", label: "Assignments" },
        { table: "daily_time_logs",     col: "operatorId", label: "Daily Time Logs" },
        { table: "timesheet_lines",     col: "operatorId", label: "Timesheets" },
        { table: "expenses",            col: "operatorId", label: "Expenses" },
    ],

    material: [
        { table: "assignment_blocks",            col: "materialId",  label: "Assignments" },
        { table: "daily_time_logs",              col: "materialId",  label: "Daily Time Logs" },
        { table: "detour_template_requirements", col: "resourceId",  label: "Detour Templates",
          extra: "AND resourceType = 'MATERIAL'" },
    ],

    labour: [
        { table: "assignment_blocks",            col: "labourTypeId", label: "Assignments" },
        { table: "daily_time_logs",              col: "labourTypeId", label: "Daily Time Logs" },
        { table: "detour_template_requirements", col: "resourceId",   label: "Detour Templates",
          extra: "AND resourceType = 'LABOUR'" },
    ],

    // ---------- Reference data ----------

    customer: [
        { table: "assignments",     col: "customerId", label: "Assignments" },
        { table: "timesheets",      col: "customerId", label: "Timesheets" },
        { table: "invoices",        col: "customerId", label: "Invoices" },
        { table: "projects",        col: "customerId", label: "Projects" },
        { table: "daily_time_logs", col: "customerId", label: "Daily Time Logs" },
    ],

    project: [
        { table: "assignments", col: "projectId", label: "Assignments" },
        { table: "timesheets",  col: "projectId", label: "Timesheets" },
        { table: "invoices",    col: "projectId", label: "Invoices" },
        { table: "expenses",    col: "projectId", label: "Expenses" },
    ],

    detourTemplate: [
        { table: "assignment_blocks", col: "detourTemplateId", label: "Assignments" },
    ],

    // ---------- Master config / lookup tables ----------

    vehicleType: [
        { table: "vehicles",       col: "typeId",  label: "Vehicles" },
        { table: "vehicle_brands", col: "typeId",  label: "Vehicle Brands" },
    ],

    vehicleBrand: [
        { table: "vehicles",        col: "brandId", label: "Vehicles" },
        { table: "vehicle_models",  col: "brandId", label: "Vehicle Models" },
    ],

    vehicleModel: [
        { table: "vehicles", col: "modelId", label: "Vehicles" },
    ],

    licenseType: [
        { table: "operators", col: "licenseTypeId", label: "Operators" },
    ],

    nationality: [
        { table: "operators", col: "nationalityId", label: "Operators" },
    ],

    operatorDocType: [
        { table: "operator_documents", col: "documentTypeId", label: "Operator Documents" },
    ],

    documentType: [
        { table: "vehicle_documents", col: "documentTypeId", label: "Vehicle Documents" },
    ],

    registrationAuthority: [
        { table: "vehicles", col: "registrationAuthorityId", label: "Vehicles" },
    ],

    maintenanceType: [
        { table: "maintenances", col: "maintenanceTypeId", label: "Maintenance Records" },
    ],

    expenseType: [
        { table: "expenses", col: "expenseTypeId", label: "Expenses" },
    ],

    // workType is stored as free text in assignment_blocks (Option A decision).
    // entityId here should be the name string, not an integer.
    operatorWorkType: [
        { table: "assignment_blocks", col: "workType", label: "Assignments" },
    ],
};
