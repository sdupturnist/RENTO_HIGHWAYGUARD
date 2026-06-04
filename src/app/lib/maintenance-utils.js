import { dbTenant, dbQuery } from "@/app/lib/db";
import { reserveSequentialCode } from "@/app/lib/sequential-code";
/**
 * Generate a unique maintenance code based on settings
 */
export async function generateMaintenanceCode(tx = dbQuery) {
    const { code } = await reserveSequentialCode(tx, {
        tableName: "entity_code_settings",
        createSql: "INSERT INTO `entity_code_settings` (entityType, codePrefix, startingNumber, numberPadding) VALUES (?, ?, ?, ?)",
        createParams: ["MAINTENANCE", "MAINT", 1, 4],
        whereKey: "entityType",
        whereValue: "MAINTENANCE",
        prefixField: "codePrefix",
        numberField: "startingNumber",
        paddingField: "numberPadding",
        separator: "-",
        entityTableName: "maintenances",
        entityCodeField: "maintenanceCode",
    });

    return code;
}
/**
 * Calculate maintenance status based on start date
 */
export function calculateMaintenanceStatus(startDate) {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const d = today.getDate();
    const todayStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    
    const startStr = startDate.toISOString ? startDate.toISOString().split("T")[0] : String(startDate).split("T")[0];
    
    return startStr <= todayStr ? "IN_PROGRESS" : "SCHEDULED";
}
/**
 * Validate maintenance cost based on vehicle ownership
 */
export function validateMaintenanceCost(ownership, amount) {
    if (ownership === "OWN") {
        if (amount === null || amount === undefined || amount <= 0) {
            return {
                valid: false,
                error: "Maintenance amount is required for own vehicles",
            };
        }
    }
    return { valid: true };
}
/**
 * Auto-complete all open maintenances for a vehicle
 * Called when vehicle status changes from UNDER_MAINTENANCE to ACTIVE
 */
export async function autoCompleteMaintenances(vehicleId) {
    const today = new Date();
    const result = await dbQuery.maintenance.updateMany({
        where: {
            vehicleId,
            status: {
                not: "COMPLETED",
            },
        },
        data: {
            status: "COMPLETED",
            endDate: today,
        },
    });
    return result.count;
}
