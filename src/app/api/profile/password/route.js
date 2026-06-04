import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession, setSession } from "@/app/lib/auth";
import bcrypt from "bcryptjs";
import { getTenantSecuritySettings, validatePasswordAgainstSettings } from "@/app/lib/security-settings";
import { logActivity } from "@/app/lib/logger";
// PUT /api/profile/password - Change user password
export async function PUT(request) {
    try {
        const session = await getSession();
        if (!session || !session.userId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const body = await request.json();
        const { currentPassword, newPassword } = body;
        if (!currentPassword || !newPassword) {
            return NextResponse.json({ message: "Current and new passwords are required" }, { status: 400 });
        }
        const [uRows] = await dbTenant(`SELECT * FROM \`users\` WHERE id = ? LIMIT 1`, [Number(session.userId)]);
        const user = uRows?.[0];
        if (!user)
            return NextResponse.json({ message: "User not found" }, { status: 404 });

        // Verify current password
        // Check if password is bcrypt-hashed (starts with $2a$ or $2b$)
        const isBcryptHash = user.password?.startsWith("$2");
        let isValid = false;

        if (isBcryptHash) {
            // Standard bcrypt comparison
            isValid = await bcrypt.compare(currentPassword, user.password);
        } else {
            // Plain text fallback (password was stored un-hashed — fix it on success)
            isValid = currentPassword === user.password;
            console.warn(`[password-change] User ${user.id} has plain-text password — will re-hash on success`);
        }

        if (!isValid) {
            return NextResponse.json({ message: "Incorrect current password" }, { status: 400 });
        }
        const securitySettings = await getTenantSecuritySettings();
        const validation = validatePasswordAgainstSettings(newPassword, securitySettings);
        if (!validation.valid) {
            return NextResponse.json({ message: validation.message }, { status: 400 });
        }
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        // Update password
        await dbTenant(
            `UPDATE \`users\` SET password = ?, mustChangePassword = 0, updatedAt = NOW() WHERE id = ?`,
            [hashedPassword, Number(session.userId)]
        );
        await setSession({
            userId: session.userId,
            roleId: session.roleId,
            role: session.role,
            email: session.email,
            subdomain: session.subdomain,
            forcePasswordChange: false,
        });
        await logActivity("USER", Number(session.userId), "PASSWORD_CHANGED", `Password changed by ${session.email || `user:${session.userId}`}`);
        return NextResponse.json({ message: "Password updated successfully" });
    }
    catch (error) {
        console.error("Error updating password:", error);
        return NextResponse.json({ message: "Error updating password" }, { status: 500 });
    }
}
