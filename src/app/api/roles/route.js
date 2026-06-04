import { NextResponse } from "next/server";
import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { ensureTenantRoleIntegrity } from "@/app/lib/tenant-role-integrity";
import { logActivity } from "@/app/lib/logger";

// GET /api/roles - List all roles with permission counts
export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const canView = await verifySessionPermission(session, "Users & Roles", "View");
        if (!canView) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
        await ensureTenantRoleIntegrity();

        const [roles] = await dbTenant(`
            SELECT r.*, 
                   (SELECT COUNT(*) FROM \`role_permissions\` p WHERE p.roleId = r.id) as permissionCount,
                   (SELECT COUNT(*) FROM \`users\` u WHERE u.roleId = r.id) as userCount
            FROM \`roles\` r
            ORDER BY r.createdAt ASC
        `);

        return NextResponse.json(roles || []);
    }
    catch (error) {
        console.error("Error fetching roles:", error);
        return NextResponse.json({ message: "Error fetching roles", error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
}

// POST /api/roles - Create new role
export async function POST(request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const canEdit = await verifySessionPermission(session, "Users & Roles", "Edit");
        if (!canEdit) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
        await ensureTenantRoleIntegrity();


        const body = await request.json();
        const { name, description, permissionIds } = body;
        if (!name) {
            return NextResponse.json({ message: "Role name is required" }, { status: 400 });
        }

        // Check if role name already exists
        const [existing] = await dbTenant(`SELECT id FROM \`roles\` WHERE name = ? LIMIT 1`, [name]);
        if (existing && existing.length > 0) {
            return NextResponse.json({ message: "Role name already exists" }, { status: 400 });
        }

        let newRole;
        await withTenantTransaction(async (tx) => {
            const [res] = await tx.execute(`
                INSERT INTO \`roles\` (name, description, isSystem, createdAt, updatedAt)
                VALUES (?, ?, 0, NOW(), NOW())
            `, [name, description || null]);
            
            const roleId = res.insertId;
            newRole = { id: roleId, name, description, isSystem: false };

            if (permissionIds && Array.isArray(permissionIds)) {
                for (const permissionId of permissionIds) {
                    await tx.execute(`
                        INSERT INTO \`role_permissions\` (roleId, permissionId)
                        VALUES (?, ?)
                    `, [roleId, permissionId]);
                }
            }
        });

        await logActivity("ROLE", newRole.id, "CREATE", `Role created: ${name}`);
        return NextResponse.json(newRole, { status: 201 });
    }
    catch (error) {
        console.error("Error creating role:", error);
        return NextResponse.json({ message: "Error creating role" }, { status: 500 });
    }
}
