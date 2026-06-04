export * from "./permissions-constants";
import { apiSessionHasScope } from "@/app/lib/api-keys";
/**
 * Verify if a session has permission for a specific module and action
 * @param session - User session object (JWTPayload from getSession)
 * @param module - Module name (e.g., "Reports", "Vehicles")
 * @param action - Action name (e.g., "View", "Edit", "Delete")
 * @returns Promise<boolean> - true if user has permission
 */
export async function verifySessionPermission(session, // JWTPayload from jose
    module, action) {
    if (session?.isApi) {
        return apiSessionHasScope(session, module, action);
    }

    if (!session?.roleId)
        return false;

    // Allow backward-compatible aliasing for renamed actions
    const actionAliases = [action];
    if (module === "Assignment") {
        if (action === "List View")
            actionAliases.push("View");
        if (action === "View")
            actionAliases.push("List View");
    }

    try {
        const { dbTenant } = await import("@/app/lib/db");

        // System roles like Super Admin have all permissions implicitly
        let effectiveRoleId = Number(session.roleId);
        let [roleRows] = await dbTenant("SELECT isSystem, name FROM roles WHERE id = ?", [effectiveRoleId]);
        let role = roleRows[0];

        // If token roleId is stale (e.g., legacy ADMIN role migrated), fall back to current DB user role.
        const sessionUserId = Number(session?.userId ?? session?.id);
        if (!role && sessionUserId) {
            const [userRows] = await dbTenant(`
                SELECT u.roleId, r.isSystem, r.name 
                FROM User u 
                LEFT JOIN roles r ON u.roleId = r.id 
                WHERE u.id = ?
            `, [sessionUserId]);
            const user = userRows[0];
            if (user?.roleId && user.name) {
                effectiveRoleId = user.roleId;
                role = { isSystem: user.isSystem, name: user.name };
            }
        }

        if (role?.isSystem || role?.name === "Super Admin") {
            return true;
        }

        // Check explicit permission mapping
        const [permissionRows] = await dbTenant(`
            SELECT p.id 
            FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permissionId
            WHERE p.module = ? 
              AND p.action IN (${actionAliases.map(() => "?").join(",")})
              AND rp.roleId = ?
            LIMIT 1
        `, [module, ...actionAliases, effectiveRoleId]);
        
        return permissionRows.length > 0;
    }
    catch (error) {
        console.error("Error verifying permission:", error);
        return false;
    }
}

