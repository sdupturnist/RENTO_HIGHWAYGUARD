import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/app/lib/auth";
import { appendLogLine } from "@/app/lib/file-logging";
import { tenantAuditFile } from "@/app/lib/log-paths";
import { dbTenant } from "@/app/lib/db";

export async function POST(request) {
    try {
        const session = await getSession();
        if (session?.userId) {
            let isHidden = false;
            try {
                const [rows] = await dbTenant("SELECT isHidden FROM `users` WHERE id = ? LIMIT 1", [Number(session.userId)]);
                if (rows?.[0]?.isHidden) isHidden = true;
            } catch {
                // Fallback in case table/columns don't exist yet during migration
            }

            if (!isHidden) {
                const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.ip || "unknown";
                await appendLogLine(tenantAuditFile(), {
                    ts: new Date().toISOString(),
                    actor: { userId: Number(session.userId), email: session.email || null, scope: "tenant" },
                    action: "LOGOUT_SUCCESS",
                    entityType: "AUTH",
                    entityId: 0,
                    description: `Logout successful for ${session.email || `user:${session.userId}`} from ${ip}`,
                });
            }
        }
    } catch (error) {
        console.error("Tenant logout audit log failed:", error?.message || error);
    }

    await clearSession();
    return NextResponse.json({ message: "Logged out successfully" });
}
