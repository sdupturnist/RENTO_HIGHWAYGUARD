import { dbTenant } from "./db";

export async function ensureVehicleDocumentsSchema() {
    try {
        // 1. Check if documentTypeId exists in vehicle_documents
        const [columns] = await dbTenant(`
            SELECT COLUMN_NAME, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'vehicle_documents'
              AND COLUMN_NAME IN ('documentTypeId', 'name')
        `);

        const hasDocTypeId = columns.some(c => c.COLUMN_NAME === 'documentTypeId');
        const nameCol = columns.find(c => c.COLUMN_NAME === 'name');
        const isNameNullable = nameCol ? nameCol.IS_NULLABLE === 'YES' : false;

        if (!hasDocTypeId) {
            console.log("Adding column documentTypeId to vehicle_documents...");
            await dbTenant("ALTER TABLE `vehicle_documents` ADD COLUMN `documentTypeId` INT NULL");
            
            try {
                console.log("Adding foreign key constraint for documentTypeId to vehicle_documents...");
                await dbTenant("ALTER TABLE `vehicle_documents` ADD CONSTRAINT `fk_vd_document_type` FOREIGN KEY (`documentTypeId`) REFERENCES `document_types` (`id`) ON DELETE SET NULL");
            } catch (fkErr) {
                console.error("Failed to add foreign key constraint to vehicle_documents:", fkErr);
            }
        }

        if (!isNameNullable) {
            console.log("Modifying name column in vehicle_documents to be NULL...");
            await dbTenant("ALTER TABLE `vehicle_documents` MODIFY COLUMN `name` VARCHAR(191) NULL");
        }
    } catch (err) {
        console.error("Failed to ensure vehicle_documents schema:", err);
    }
}
