import { NextResponse } from "next/server";
import { z } from "zod";
import { SignJWT } from "jose/jwt/sign";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { sendMail } from "@/app/lib/email";
import { dbTenant } from "@/app/lib/db";
import { appendLogLine } from "@/app/lib/file-logging";
import { tenantAuditFile } from "@/app/lib/log-paths";

const schema = z.object({
    email: z.string().email(),
});
const resetTtlMinutes = Number(process.env.RESET_TOKEN_TTL_MINUTES || 30);

async function logForgotEvent(action, description, userId) {
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
        const { email } = schema.parse(body);
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.ip || "unknown";

        const { limited, resetMs } = await checkRateLimit(`forgot:${email}:${ip}`);
        if (limited) {
            return NextResponse.json({ message: "Too many reset requests. Please wait and try again." }, { status: 429, headers: { "Retry-After": Math.ceil(resetMs / 1000).toString() } });
        }

        const [rows] = await dbTenant(`SELECT id, email, name FROM \`users\` WHERE email = ? LIMIT 1`, [email]);
        const user = rows?.[0];

        // Always respond success to avoid user enumeration
        if (!user) {
            await logForgotEvent("PASSWORD_RESET_REQUESTED", `Password reset requested for unknown email: ${email}`, null);
            return NextResponse.json({ message: "If that email exists, a reset link has been sent." });
        }

        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error("JWT_SECRET missing");
        
        const key = new TextEncoder().encode(secret);
        const token = await new SignJWT({ sub: String(user.id), email: user.email, type: "password-reset" })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime(`${resetTtlMinutes}m`)
            .sign(key);

        const baseUrl = process.env.APP_BASE_URL || request.nextUrl.origin;
        const resetUrl = `${baseUrl}/reset-password?token=${token}`;

        const [brandingRows] = await dbTenant("SELECT appName FROM `branding_settings` LIMIT 1");
        const appName = brandingRows?.[0]?.appName || "Upturnist";
        const initials = appName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

        await sendMail({
            to: email,
            subject: `${appName}: Reset your password`,
            text: `Reset your password using this link: ${resetUrl}`,
            template: "reset-password.html",
            variables: {
                APP_NAME: appName,
                APP_INITIALS: initials,
                RESET_URL: resetUrl,
                TTL_MINUTES: String(resetTtlMinutes),
            },
        });

        await logForgotEvent("PASSWORD_RESET_REQUESTED", `Password reset link sent to ${email}`, user.id);
        return NextResponse.json({ message: "If that email exists, a reset link has been sent." });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ message: "Invalid input", errors: error.errors }, { status: 400 });
        }
        console.error("Forgot password error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
