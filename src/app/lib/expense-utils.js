import { dbTenant, dbQuery } from "@/app/lib/db";
import { reserveSequentialCode } from "@/app/lib/sequential-code";

/**
 * Generate a unique expense code based on settings
 */
export async function generateExpenseCode(tx = dbQuery) {
    const { code } = await reserveSequentialCode(tx, {
        tableName: "entity_code_settings",
        createSql: "INSERT INTO `entity_code_settings` (entityType, codePrefix, startingNumber, numberPadding) VALUES (?, ?, ?, ?)",
        createParams: ["EXPENSE", "EXP", 1, 4],
        whereKey: "entityType",
        whereValue: "EXPENSE",
        prefixField: "codePrefix",
        numberField: "startingNumber",
        paddingField: "numberPadding",
        separator: "-",
        entityTableName: "expenses",
        entityCodeField: "expenseCode",
    });

    return code;
}
