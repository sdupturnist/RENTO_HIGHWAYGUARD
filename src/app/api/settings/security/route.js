import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { verifySession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { DEFAULT_SECURITY_SETTINGS, getTenantSecuritySettings } from "@/app/lib/security-settings";
import { logActivity } from "@/app/lib/logger";

export async function GET() {
    const session = await verifySession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const settings = await getTenantSecuritySettings();
        return NextResponse.json(settings);
    } catch (error) {
        console.error("Failed to fetch security settings:", error);
        return NextResponse.json({ error: "Failed to fetch security settings" }, { status: 500 });
    }
}

export async function PUT(request) {
    const session = await verifySession();
    const canEdit = session ? await verifySessionPermission(session, "Settings", "Edit") : false;
    if (!session || !canEdit) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await request.json();
        const payload = {
            minPasswordLength: Math.max(6, Math.min(128, Number(body.minPasswordLength || DEFAULT_SECURITY_SETTINGS.minPasswordLength))),
            requireUppercase: body.requireUppercase ? 1 : 0,
            requireLowercase: body.requireLowercase ? 1 : 0,
            requireNumber: body.requireNumber ? 1 : 0,
            requireSpecialCharacter: body.requireSpecialCharacter ? 1 : 0,
            maxFailedLoginAttempts: Math.max(1, Math.min(20, Number(body.maxFailedLoginAttempts || DEFAULT_SECURITY_SETTINGS.maxFailedLoginAttempts))),
            lockoutDurationMinutes: Math.max(1, Math.min(1440, Number(body.lockoutDurationMinutes || DEFAULT_SECURITY_SETTINGS.lockoutDurationMinutes))),
        };

        const [existingRows] = await dbTenant("SELECT id FROM `security_settings` LIMIT 1");
        const existing = existingRows?.[0];

        if (existing) {
            await dbTenant(`
                UPDATE \`security_settings\` SET
                    minPasswordLength = ?, requireUppercase = ?, requireLowercase = ?, 
                    requireNumber = ?, requireSpecialCharacter = ?, maxFailedLoginAttempts = ?, 
                    lockoutDurationMinutes = ?, updatedAt = NOW()
                WHERE id = ?
            `, [
                payload.minPasswordLength, payload.requireUppercase, payload.requireLowercase,
                payload.requireNumber, payload.requireSpecialCharacter, payload.maxFailedLoginAttempts,
                payload.lockoutDurationMinutes, existing.id
            ]);
        } else {
            await dbTenant(`
                INSERT INTO \`security_settings\` (
                    minPasswordLength, requireUppercase, requireLowercase,
                    requireNumber, requireSpecialCharacter, maxFailedLoginAttempts,
                    lockoutDurationMinutes, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                payload.minPasswordLength, payload.requireUppercase, payload.requireLowercase,
                payload.requireNumber, payload.requireSpecialCharacter, payload.maxFailedLoginAttempts,
                payload.lockoutDurationMinutes
            ]);
        }

        const [updRows] = await dbTenant("SELECT * FROM `security_settings` LIMIT 1");
        await logActivity("SETTINGS", 0, "UPDATE", "Security settings updated");
        return NextResponse.json(updRows[0]);
    } catch (error) {
        console.error("Failed to update security settings:", error);
        return NextResponse.json({ error: "Failed to update security settings" }, { status: 500 });
    }
}
