import { getTenantPool } from "@/app/lib/db";

function getTenantSubdomain(request) {
    return request?.headers?.get("x-subdomain") || "admin";
}

export async function ensureCompanySettingsColumns(request) {
    const subdomain = getTenantSubdomain(request);
    const pool = getTenantPool(subdomain);

    const [rows] = await pool.query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'company_settings'
           AND COLUMN_NAME IN (
             'pdfLogoUrl', 'pdfThemeColor', 'onboardingCompleted', 'onboardingCompletedAt',
             'enableVat', 'vatPercentage', 'taxNumber',
             'weekendDays', 'weekendTreatedAs', 'fullDayHours',
             'overtimeStartsAfter', 'overtimeMultiplier', 'holidayMultiplier', 'weekendMultiplier',
             'companyEmail', 'weekStartsOn', 'phoneCountryCode'
           )`
    );

    const existingColumns = new Set((rows || []).map((row) => row.COLUMN_NAME));

    if (!existingColumns.has("pdfLogoUrl")) {
        await pool.query("ALTER TABLE `company_settings` ADD COLUMN `pdfLogoUrl` VARCHAR(191) NULL");
    }
    if (!existingColumns.has("pdfThemeColor")) {
        await pool.query("ALTER TABLE `company_settings` ADD COLUMN `pdfThemeColor` VARCHAR(191) NULL");
    }
    if (!existingColumns.has("onboardingCompleted")) {
        await pool.query("ALTER TABLE `company_settings` ADD COLUMN `onboardingCompleted` TINYINT(1) NOT NULL DEFAULT 1");
    }
    if (!existingColumns.has("onboardingCompletedAt")) {
        await pool.query("ALTER TABLE `company_settings` ADD COLUMN `onboardingCompletedAt` DATETIME NULL");
    }
    if (!existingColumns.has("enableVat")) {
        await pool.query("ALTER TABLE `company_settings` ADD COLUMN `enableVat` TINYINT(1) NOT NULL DEFAULT 0");
    }
    if (!existingColumns.has("vatPercentage")) {
        await pool.query("ALTER TABLE `company_settings` ADD COLUMN `vatPercentage` DECIMAL(10,2) NOT NULL DEFAULT 5.0");
    }
    if (!existingColumns.has("taxNumber")) {
        await pool.query("ALTER TABLE `company_settings` ADD COLUMN `taxNumber` VARCHAR(191) NULL");
    }
    if (!existingColumns.has("weekendDays")) {
        await pool.query("ALTER TABLE `company_settings` ADD COLUMN `weekendDays` JSON NULL");
    }
    if (!existingColumns.has("weekendTreatedAs")) {
        await pool.query("ALTER TABLE `company_settings` ADD COLUMN `weekendTreatedAs` VARCHAR(191) NOT NULL DEFAULT 'NORMAL'");
    }
    if (!existingColumns.has("fullDayHours")) {
        await pool.query("ALTER TABLE `company_settings` ADD COLUMN `fullDayHours` DOUBLE NOT NULL DEFAULT 8");
    }
    if (!existingColumns.has("overtimeStartsAfter")) {
        await pool.query("ALTER TABLE `company_settings` ADD COLUMN `overtimeStartsAfter` DOUBLE NOT NULL DEFAULT 8");
    }
    if (!existingColumns.has("overtimeMultiplier")) {
        await pool.query("ALTER TABLE `company_settings` ADD COLUMN `overtimeMultiplier` DOUBLE NOT NULL DEFAULT 1.5");
    }
    if (!existingColumns.has("holidayMultiplier")) {
        await pool.query("ALTER TABLE `company_settings` ADD COLUMN `holidayMultiplier` DOUBLE NOT NULL DEFAULT 2");
    }
    if (!existingColumns.has("weekendMultiplier")) {
        await pool.query("ALTER TABLE `company_settings` ADD COLUMN `weekendMultiplier` DOUBLE NOT NULL DEFAULT 1.5");
    }
    if (!existingColumns.has("companyEmail")) {
        await pool.query("ALTER TABLE `company_settings` ADD COLUMN `companyEmail` VARCHAR(191) NULL");
    }
    if (!existingColumns.has("weekStartsOn")) {
        await pool.query("ALTER TABLE `company_settings` ADD COLUMN `weekStartsOn` VARCHAR(191) NOT NULL DEFAULT 'Monday'");
    }
    if (!existingColumns.has("phoneCountryCode")) {
        await pool.query("ALTER TABLE `company_settings` ADD COLUMN `phoneCountryCode` VARCHAR(10) NOT NULL DEFAULT '+971'");
    }
}
