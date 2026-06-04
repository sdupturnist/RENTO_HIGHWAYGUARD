import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { dbTenant } from "@/app/lib/db";
import { setSession } from "@/app/lib/auth";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { clearUserLock, getTenantSecuritySettings, getLockoutExpiry, isUserCurrentlyLocked } from "@/app/lib/security-settings";
import { appendLogLine } from "@/app/lib/file-logging";
import { tenantAuditFile } from "@/app/lib/log-paths";

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

async function logAuth(action, description, userId, forEmail) {
    try {
        let isHidden = false;
        if (userId) {
            const [rows] = await dbTenant("SELECT isHidden FROM `users` WHERE id = ? LIMIT 1", [userId]);
            if (rows?.[0]?.isHidden) isHidden = true;
        } else if (forEmail) {
            const [rows] = await dbTenant("SELECT isHidden FROM `users` WHERE email = ? LIMIT 1", [forEmail]);
            if (rows?.[0]?.isHidden) isHidden = true;
        }
        if (isHidden) return;
    } catch {
        // Fallback in case table/columns don't exist yet during migration
    }

    await appendLogLine(tenantAuditFile(), {
        ts: new Date().toISOString(),
        actor: { userId: userId ?? null, scope: "tenant" },
        action,
        entityType: "AUTH",
        entityId: 0,
        description,
    });
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { email, password } = loginSchema.parse(body);

        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.ip || "unknown";
        const key = `login:${email}:${ip}`;
        const { limited, resetMs } = await checkRateLimit(key);
        if (limited) {
            await logAuth("LOGIN_FAILED_RATE_LIMIT", `Rate limit exceeded for ${email} from ${ip}`, null, email);
            return NextResponse.json(
                { message: "Too many attempts. Please wait and try again." },
                { status: 429, headers: { "Retry-After": Math.ceil(resetMs / 1000).toString() } }
            );
        }

        const [userRows] = await dbTenant(
            `SELECT u.*, r.name as roleName, r.isSystem as roleIsSystem
             FROM \`users\` u LEFT JOIN \`roles\` r ON r.id = u.roleId
             WHERE u.email = ? LIMIT 1`,
            [email]
        );
        const user = userRows?.[0] || null;
        if (!user) {
            await logAuth("LOGIN_FAILED", `Login failed (user not found): ${email} from ${ip}`, null, email);
            return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
        }

        user.role = { name: user.roleName, isSystem: !!user.roleIsSystem };

        const securitySettings = await getTenantSecuritySettings();
        let currentFailedCount = Number(user.failedLoginCount || 0);

        if (user.lockedAt) {
            if (isUserCurrentlyLocked(user, securitySettings)) {
                const expiry = getLockoutExpiry(user, securitySettings);
                const until = expiry ? ` until ${expiry.toLocaleString()}` : "";
                await logAuth("LOGIN_BLOCKED_LOCKED", `Locked account login attempt for ${email} from ${ip}`, user.id, email);
                return NextResponse.json(
                    { message: `Account locked due to failed sign-in attempts${until}.` },
                    { status: 423 }
                );
            }
            await clearUserLock(user.id);
            currentFailedCount = 0;
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            const nextFailedCount = currentFailedCount + 1;
            const maxAttempts = Number(securitySettings.maxFailedLoginAttempts || 5);
            const shouldLock = nextFailedCount >= maxAttempts;

            await dbTenant(
                `UPDATE \`users\` SET failedLoginCount = ?, lastFailedLoginAt = NOW()
                 ${shouldLock ? ", lockedAt = NOW(), lockedReason = 'FAILED_LOGIN_ATTEMPTS'" : ""}
                 WHERE id = ?`,
                [nextFailedCount, user.id]
            );

            await logAuth("LOGIN_FAILED", `Login failed (invalid password): ${email} from ${ip}`, user.id, email);
            if (shouldLock) {
                return NextResponse.json(
                    { message: "Account locked due to failed sign-in attempts. Contact your administrator or wait for the lockout period to expire." },
                    { status: 423 }
                );
            }
            return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
        }

        await dbTenant(
            `UPDATE \`users\` SET failedLoginCount = 0, lastFailedLoginAt = NULL,
             lockedAt = NULL, lockedReason = NULL, lastLogin = NOW() WHERE id = ?`,
            [user.id]
        );

        await setSession({
            userId: user.id,
            roleId: user.roleId,
            role: user.role?.name,
            email: user.email,
            forcePasswordChange: !!user.mustChangePassword,
        });

        await logAuth("LOGIN_SUCCESS", `Login successful: ${email} from ${ip}`, user.id, email);
        return NextResponse.json({ message: "Login successful", requiresPasswordChange: !!user.mustChangePassword });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ message: "Invalid input", errors: error.errors }, { status: 400 });
        }
        console.error("Login error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
