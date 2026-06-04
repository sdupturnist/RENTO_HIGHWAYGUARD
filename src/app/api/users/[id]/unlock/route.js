import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { getSecurityActorInfo, clearUserLock } from "@/app/lib/security-settings";
import { appendLogLineToAll } from "@/app/lib/file-logging";
import { tenantAuditFile, entityActivityFile } from "@/app/lib/log-paths";

export async function POST(request, props) {
    const params = await props.params;
    try {
        const session = await getSession();
        if (!session?.userId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const actor = await getSecurityActorInfo(session, dbTenant);
        if (!actor.canUnlockLockedUsers) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const userId = parseInt(params.id, 10);
        const [uRows] = await dbTenant(`
            SELECT u.*, r.isSystem as role_isSystem, r.name as role_name
            FROM \`users\` u LEFT JOIN \`roles\` r ON r.id = u.roleId
            WHERE u.id = ? LIMIT 1
        `, [userId]);
        const user = uRows?.[0];
        if (!user)
            return NextResponse.json({ message: "User not found" }, { status: 404 });

        const targetEmail = user.email?.trim().toLowerCase() || "";
        if (actor.primaryEmail && targetEmail === actor.primaryEmail) {
            return NextResponse.json({ message: "Primary tenant user must be unlocked from client master reset flow." }, { status: 400 });
        }
        if (!user.lockedAt) {
            return NextResponse.json({ message: "User is not locked." }, { status: 400 });
        }

        await clearUserLock(dbTenant, user.id);

        const auditPayload = {
            ts: new Date().toISOString(),
            actor: {
                userId: Number(session.userId),
                email: session.email || null,
                scope: "tenant",
            },
            action: "USER_UNLOCKED",
            entityType: "USER",
            entityId: user.id,
            description: `User ${user.email} was unlocked manually by ${session.email || `user:${session.userId}`}.`,
        };
        await appendLogLineToAll(
            [tenantAuditFile(), entityActivityFile("USER", user.id)],
            auditPayload
        );
        return NextResponse.json({ message: "User unlocked successfully." });
    } catch (error) {
        console.error("Error unlocking user:", error);
        return NextResponse.json({ message: "Error unlocking user" }, { status: 500 });
    }
}
