import { NextResponse } from "next/server";
import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { ensureTenantRoleIntegrity } from "@/app/lib/tenant-role-integrity";
import { logActivity } from "@/app/lib/logger";

// GET /api/roles/[id] - Get role with permissions
export async function GET(request, props) {
    const params = await props.params;
    try {
        const session = await getSession();
        if (!session)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canView = await verifySessionPermission(session, "Users & Roles", "View");
        if (!canView)
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        await ensureTenantRoleIntegrity();
        const roleId = parseInt(params.id);

        const [rRows] = await dbTenant(`SELECT * FROM \`roles\` WHERE id = ? LIMIT 1`, [roleId]);
        if (!rRows || rRows.length === 0)
            return NextResponse.json({ message: "Role not found" }, { status: 404 });

        const [perms] = await dbTenant(`
            SELECT p.id, p.module, p.action, p.description, rp.permissionId
            FROM \`permissions\` p
            INNER JOIN \`role_permissions\` rp ON p.id = rp.permissionId
            WHERE rp.roleId = ?
        `, [roleId]);
        const [users] = await dbTenant(`SELECT id, name, email FROM \`users\` WHERE roleId = ?`, [roleId]);

        return NextResponse.json({ ...rRows[0], permissions: perms || [], users: users || [] });
    } catch (error) {
        console.error("Error fetching role:", error);
        return NextResponse.json({ message: "Error fetching role" }, { status: 500 });
    }
}

// PUT /api/roles/[id] - Update role
export async function PUT(request, props) {
    const params = await props.params;
    try {
        const session = await getSession();
        if (!session)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canEdit = await verifySessionPermission(session, "Users & Roles", "Edit");
        if (!canEdit)
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        await ensureTenantRoleIntegrity();
        const body = await request.json();
        const { name, description, permissionIds } = body;
        const roleId = parseInt(params.id);

        const [rRows] = await dbTenant(`SELECT * FROM \`roles\` WHERE id = ? LIMIT 1`, [roleId]);
        if (!rRows || rRows.length === 0)
            return NextResponse.json({ message: "Role not found" }, { status: 404 });
        if (rRows[0].isSystem || rRows[0].name === "Super Admin")
            return NextResponse.json({ message: "Cannot update system roles" }, { status: 400 });

        await withTenantTransaction(async (tx) => {
            await tx.execute(
                `UPDATE \`roles\` SET name = ?, description = ?, updatedAt = NOW() WHERE id = ?`,
                [name, description || null, roleId]
            );
            if (permissionIds && Array.isArray(permissionIds)) {
                await tx.execute(`DELETE FROM \`role_permissions\` WHERE roleId = ?`, [roleId]);
                for (const permissionId of permissionIds) {
                    await tx.execute(
                        `INSERT INTO \`role_permissions\` (roleId, permissionId) VALUES (?, ?)`,
                        [roleId, permissionId]
                    );
                }
            }
        });

        const [updRows] = await dbTenant(`SELECT * FROM \`roles\` WHERE id = ? LIMIT 1`, [roleId]);
        await logActivity("ROLE", roleId, "UPDATE", `Role updated: ${name}`);
        return NextResponse.json(updRows[0]);
    } catch (error) {
        console.error("Error updating role:", error);
        return NextResponse.json({ message: "Error updating role" }, { status: 500 });
    }
}

// DELETE /api/roles/[id] - Delete role
export async function DELETE(request, props) {
    const params = await props.params;
    try {
        const session = await getSession();
        if (!session)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canDelete = await verifySessionPermission(session, "Users & Roles", "Delete");
        if (!canDelete)
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        await ensureTenantRoleIntegrity();
        const roleId = parseInt(params.id);

        const [rRows] = await dbTenant(`SELECT * FROM \`roles\` WHERE id = ? LIMIT 1`, [roleId]);
        if (!rRows || rRows.length === 0)
            return NextResponse.json({ message: "Role not found" }, { status: 404 });
        if (rRows[0].isSystem || rRows[0].name === "Super Admin")
            return NextResponse.json({ message: "Cannot delete system roles" }, { status: 400 });

        const roleName = rRows[0].name;
        await withTenantTransaction(async (tx) => {
            // Detach users from this role before deleting
            await tx.execute(`UPDATE \`users\` SET roleId = NULL WHERE roleId = ?`, [roleId]);
            // Delete role permissions (cascade may handle this, but explicit is safer)
            await tx.execute(`DELETE FROM \`role_permissions\` WHERE roleId = ?`, [roleId]);
            await tx.execute(`DELETE FROM \`roles\` WHERE id = ?`, [roleId]);
        });

        await logActivity("ROLE", roleId, "DELETE", `Role deleted: ${roleName}`);
        return NextResponse.json({ message: "Role deleted successfully" });
    } catch (error) {
        console.error("Error deleting role:", error);
        return NextResponse.json({ message: "Error deleting role" }, { status: 500 });
    }
}
