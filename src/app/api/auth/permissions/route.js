import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { dbTenant } from "@/app/lib/db";
import { ensureTenantRoleIntegrity } from "@/app/lib/tenant-role-integrity";

export async function GET() {
    const session = await getSession();
    if (!session?.roleId) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    try {
        await ensureTenantRoleIntegrity();

        const [roleRows] = await dbTenant(
            `SELECT id, name, isSystem FROM \`roles\` WHERE id = ? LIMIT 1`,
            [Number(session.roleId)]
        );
        const role = roleRows?.[0] ?? null;

        const [permRows] = await dbTenant(
            `SELECT p.module, p.action
             FROM \`role_permissions\` rp
             JOIN \`permissions\` p ON p.id = rp.permissionId
             WHERE rp.roleId = ?`,
            [Number(session.roleId)]
        );
        const permissions = (permRows || []).map((rp) => ({
            module: rp.module,
            action: rp.action,
        }));

        return NextResponse.json({
            role: role?.name ?? session.role,
            isSystem: role?.isSystem ? true : false,
            permissions,
        });
    } catch (error) {
        console.error("Error loading permissions", error);
        return NextResponse.json({ message: "Failed to load permissions" }, { status: 500 });
    }
}
