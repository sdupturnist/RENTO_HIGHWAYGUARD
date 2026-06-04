import { NextResponse } from "next/server";
import { z } from "zod";
import { dbTenant } from "@/app/lib/db";
import bcrypt from "bcryptjs";
import { jwtVerify } from "jose/jwt/verify";
import { getTenantSecuritySettings, validatePasswordAgainstSettings } from "@/app/lib/security-settings";
import { appendLogLine } from "@/app/lib/file-logging";
import { tenantAuditFile } from "@/app/lib/log-paths";

const schema = z.object({
    token: z.string().min(1),
    password: z.string().min(1),
});

export async function POST(request) {
    try {
        const body = await request.json();
        const { token, password } = schema.parse(body);
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error("JWT_SECRET missing");
        
        const key = new TextEncoder().encode(secret);
        const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
        
        if (payload.type !== "password-reset" || !payload.sub) {
            return NextResponse.json({ message: "Invalid token" }, { status: 400 });
        }

        const securitySettings = await getTenantSecuritySettings();
        const validation = validatePasswordAgainstSettings(password, securitySettings);
        if (!validation.valid) {
            return NextResponse.json({ message: validation.message }, { status: 400 });
        }

        const userId = Number(payload.sub);
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await dbTenant(
            `UPDATE \`users\` SET password = ?, mustChangePassword = 0, updatedAt = NOW() WHERE id = ?`,
            [hashedPassword, userId]
        );

        await appendLogLine(tenantAuditFile(), {
            ts: new Date().toISOString(),
            actor: { userId, scope: "tenant" },
            action: "PASSWORD_RESET",
            entityType: "AUTH",
            entityId: 0,
            description: `Password reset completed for user ID ${userId}`,
        });
        return NextResponse.json({ message: "Password reset successful" });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ message: "Invalid input", errors: error.errors }, { status: 400 });
        }
        if (error?.code === "ERR_JWT_EXPIRED") {
            return NextResponse.json({ message: "Reset link has expired" }, { status: 400 });
        }
        console.error("Reset password error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
