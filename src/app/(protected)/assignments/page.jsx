import { getSession } from "@/app/lib/auth";
import { dbTenant } from "@/app/lib/db";
import { AssignmentsPageClient } from "@/app/Components/assignments/AssignmentsPageClient";
import { redirect } from "next/navigation";

export default async function AssignmentsPage() {
    const session = await getSession();
    if (!session || !session.userId) {
        redirect("/login");
    }

    const roleId = Number(session.roleId);
    if (!roleId) {
        return <div className="text-center text-muted-foreground">You do not have permission to view this module.</div>;
    }

    // Fetch role and its permissions via raw SQL
    let permissions = [];
    let isSystem = false;

    try {
        const [roleRows] = await dbTenant(
            `SELECT id, name, isSystem FROM \`roles\` WHERE id = ? LIMIT 1`,
            [roleId]
        );
        let role = roleRows?.[0] || null;

        // Fallback: if token roleId is stale, look up via userId
        if (!role && session.userId) {
            const [userRows] = await dbTenant(
                `SELECT u.roleId, r.name, r.isSystem
                 FROM \`users\` u LEFT JOIN \`roles\` r ON r.id = u.roleId
                 WHERE u.id = ? LIMIT 1`,
                [Number(session.userId)]
            );
            role = userRows?.[0] || null;
        }

        isSystem = !!(role?.isSystem || role?.name === "Super Admin");

        if (!isSystem && role) {
            const effectiveRoleId = role.id || role.roleId || roleId;
            const [permRows] = await dbTenant(
                `SELECT p.module, p.action
                 FROM \`permissions\` p
                 JOIN \`role_permissions\` rp ON rp.permissionId = p.id
                 WHERE rp.roleId = ?`,
                [effectiveRoleId]
            );
            permissions = permRows || [];
        }
    } catch (e) {
        console.error("Assignments page permission error:", e);
    }

    const hasPermission = (module, action) => {
        if (isSystem) return true;
        return permissions.some(p => p.module === module && p.action === action);
    };

    const canViewList = hasPermission("Assignment", "List View") || hasPermission("Assignment", "View");
    const canViewCalendar = hasPermission("Assignment", "Calendar View");
    const canAdd = hasPermission("Assignment", "Add");
    const canEdit = hasPermission("Assignment", "Edit");
    const canDelete = hasPermission("Assignment", "Delete");

    if (!canViewList && !canViewCalendar) {
        return <div className="text-center text-muted-foreground">You do not have permission to view this module.</div>;
    }

    return <AssignmentsPageClient canViewList={canViewList} canViewCalendar={canViewCalendar} canAdd={canAdd} canEdit={canEdit} canDelete={canDelete} />;
}
