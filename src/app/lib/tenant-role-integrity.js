import { dbTenant } from "@/app/lib/db";

const REQUIRED_PERMISSIONS = [
    { module: "Dashboard", action: "View" },
    { module: "Vehicles", action: "View" },
    { module: "Vehicles", action: "Add" },
    { module: "Vehicles", action: "Edit" },
    { module: "Vehicles", action: "Delete" },
    { module: "Operators", action: "View" },
    { module: "Operators", action: "Add" },
    { module: "Operators", action: "Edit" },
    { module: "Operators", action: "Delete" },
    { module: "Customers", action: "View" },
    { module: "Customers", action: "Add" },
    { module: "Customers", action: "Edit" },
    { module: "Customers", action: "Delete" },
    { module: "Projects", action: "View" },
    { module: "Projects", action: "Add" },
    { module: "Projects", action: "Edit" },
    { module: "Projects", action: "Delete" },
    { module: "Assignment", action: "Add" },
    { module: "Assignment", action: "Edit" },
    { module: "Assignment", action: "Delete" },
    { module: "Daily Time Logs", action: "View" },
    { module: "Daily Time Logs", action: "Add" },
    { module: "Daily Time Logs", action: "Edit" },
    { module: "Daily Time Logs", action: "Delete" },
    { module: "Timesheet", action: "View" },
    { module: "Timesheet", action: "Add" },
    { module: "Timesheet", action: "Delete" },
    { module: "Invoices", action: "View" },
    { module: "Invoices", action: "Add" },
    { module: "Invoices", action: "Edit" },
    { module: "Invoices", action: "Delete" },
    { module: "Reports", action: "View" },
    { module: "Reports", action: "Export" },
    { module: "Settings", action: "View" },
    { module: "Settings", action: "Edit" },
    { module: "Users & Roles", action: "View" },
    { module: "Users & Roles", action: "Add" },
    { module: "Users & Roles", action: "Edit" },
    { module: "Users & Roles", action: "Delete" },
    { module: "Assignment", action: "Calendar View" },
    { module: "Maintenance", action: "View" },
    { module: "Maintenance", action: "Add" },
    { module: "Maintenance", action: "Edit" },
    { module: "Maintenance", action: "Delete" },
    { module: "Audit Logs", action: "View" },
    { module: "Timesheet", action: "Generate" },
    { module: "Expenses", action: "View" },
    { module: "Expenses", action: "Add" },
    { module: "Expenses", action: "Edit" },
    { module: "Expenses", action: "Delete" },
    { module: "Materials", action: "View" },
    { module: "Materials", action: "Add" },
    { module: "Materials", action: "Edit" },
    { module: "Materials", action: "Delete" },
    { module: "Labours", action: "View" },
    { module: "Labours", action: "Add" },
    { module: "Labours", action: "Edit" },
    { module: "Labours", action: "Delete" },
    { module: "Detour Services", action: "View" },
    { module: "Detour Services", action: "Add" },
    { module: "Detour Services", action: "Edit" },
    { module: "Detour Services", action: "Delete" },
    { module: "Assignment", action: "View" },
    { module: "Timesheet", action: "Regenerate" }
];

async function ensureAllPermissionsExist() {
    const [existingRows] = await dbTenant("SELECT COUNT(*) as count FROM `permissions`");
    if (!existingRows[0]?.count || existingRows[0].count < REQUIRED_PERMISSIONS.length) {
        for (const perm of REQUIRED_PERMISSIONS) {
            await dbTenant(
                "INSERT IGNORE INTO `permissions` (module, action) VALUES (?, ?)",
                [perm.module, perm.action]
            );
        }
    }
}

/**
 * Ensures tenant role model integrity using raw SQL:
 * - Super Admin exists and is marked as system role
 * - All permissions are attached to Super Admin
 * - Legacy ADMIN role is migrated and removed
 * - Any other system roles are downgraded to non-system
 */
export async function ensureTenantRoleIntegrity() {
    // 0. Ensure all system permissions exist
    await ensureAllPermissionsExist();

    // 0.1 Migrate legacy 'Assignment' 'List View' permission to 'View'
    try {
        const [listViewRows] = await dbTenant("SELECT id FROM `permissions` WHERE module = 'Assignment' AND action = 'List View' LIMIT 1");
        const [viewRows] = await dbTenant("SELECT id FROM `permissions` WHERE module = 'Assignment' AND action = 'View' LIMIT 1");
        if (listViewRows?.[0] && viewRows?.[0]) {
            const listViewId = listViewRows[0].id;
            const viewId = viewRows[0].id;
            
            // Find all roles having the 'List View' permission
            const [rolesWithListView] = await dbTenant("SELECT roleId FROM `role_permissions` WHERE permissionId = ?", [listViewId]);
            for (const r of (rolesWithListView || [])) {
                // Check if the role already has 'View' permission
                const [hasView] = await dbTenant("SELECT 1 FROM `role_permissions` WHERE roleId = ? AND permissionId = ?", [r.roleId, viewId]);
                if (!hasView || hasView.length === 0) {
                    await dbTenant("INSERT INTO `role_permissions` (roleId, permissionId) VALUES (?, ?)", [r.roleId, viewId]);
                }
            }
            // Now safe to delete role_permissions mappings for 'List View'
            await dbTenant("DELETE FROM `role_permissions` WHERE permissionId = ?", [listViewId]);
            // And delete the permission itself
            await dbTenant("DELETE FROM `permissions` WHERE id = ?", [listViewId]);
        }
    } catch (migError) {
        console.error("Failed to migrate Assignment List View permission:", migError);
    }

    // 1. Upsert Super Admin role (default isSystem = 0 and don't overwrite if it exists)
    await dbTenant(
        `INSERT INTO \`roles\` (name, description, isSystem, createdAt, updatedAt)
         VALUES ('Super Admin', 'System Administrator', 0, NOW(), NOW())
         ON DUPLICATE KEY UPDATE description = 'System Administrator', updatedAt = NOW()`,
        []
    );


    const [superAdminRows] = await dbTenant(
        `SELECT id, isSystem FROM \`roles\` WHERE name = 'Super Admin' LIMIT 1`,
        []
    );
    const superAdmin = superAdminRows?.[0];
    if (!superAdmin) return null;

    const superAdminId = superAdmin.id;

    // 2. Migrate legacy ADMIN role users
    const [legacyRows] = await dbTenant(
        `SELECT id FROM \`roles\` WHERE name = 'ADMIN' AND id != ? LIMIT 1`,
        [superAdminId]
    );
    const legacyAdmin = legacyRows?.[0];

    if (legacyAdmin) {
        const legacyId = legacyAdmin.id;
        await dbTenant(`UPDATE \`users\` SET roleId = ? WHERE roleId = ?`, [superAdminId, legacyId]);
        await dbTenant(`DELETE FROM \`role_permissions\` WHERE roleId = ?`, [legacyId]);
        await dbTenant(`DELETE FROM \`roles\` WHERE id = ?`, [legacyId]);
    }

    // 3. Grant all permissions to Super Admin (skip duplicates)
    const [allPerms] = await dbTenant(`SELECT id FROM \`permissions\``, []);
    for (const perm of (allPerms || [])) {
        await dbTenant(
            `INSERT IGNORE INTO \`role_permissions\` (roleId, permissionId) VALUES (?, ?)`,
            [superAdminId, perm.id]
        );
    }

    // 4. Ensure the `isHidden` column exists on `users` (idempotent)
    try {
        await dbTenant(
            `ALTER TABLE \`users\` ADD COLUMN IF NOT EXISTS \`isHidden\` TINYINT(1) NOT NULL DEFAULT 0`
        );
    } catch (colErr) {
        // Older MySQL versions without IF NOT EXISTS support — ignore duplicate column errors
        if (colErr?.code !== "ER_DUP_FIELDNAME") {
            console.error("Failed to add isHidden column:", colErr);
        }
    }

    // 5. Ensure the `isSystem` column exists on `users` (idempotent)
    try {
        await dbTenant(
            `ALTER TABLE \`users\` ADD COLUMN IF NOT EXISTS \`isSystem\` TINYINT(1) NOT NULL DEFAULT 0`
        );
    } catch (colErr) {
        if (colErr?.code !== "ER_DUP_FIELDNAME") {
            console.error("Failed to add isSystem column to users:", colErr);
        }
    }



    return { id: superAdminId, name: "Super Admin", isSystem: !!superAdmin.isSystem };
}
