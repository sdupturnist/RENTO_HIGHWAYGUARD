import { dbTenant, dbQuery } from "@/app/lib/db";

export const DEFAULT_SECURITY_SETTINGS = {
    minPasswordLength: 8,
    requireUppercase: true,
    requireLowercase: false,
    requireNumber: true,
    requireSpecialCharacter: false,
    maxFailedLoginAttempts: 5,
    lockoutDurationMinutes: 30,
};

export async function getTenantSecuritySettings() {
    try {
        const [rows] = await dbTenant(`SELECT * FROM \`security_settings\` LIMIT 1`, []);
        const settings = rows?.[0] || null;
        return {
            ...DEFAULT_SECURITY_SETTINGS,
            ...(settings || {}),
        };
    } catch {
        return { ...DEFAULT_SECURITY_SETTINGS };
    }
}

export function buildPasswordPolicyDescription(settings = DEFAULT_SECURITY_SETTINGS) {
    const rules = [`at least ${settings.minPasswordLength} characters`];
    if (settings.requireUppercase) rules.push("an uppercase letter");
    if (settings.requireLowercase) rules.push("a lowercase letter");
    if (settings.requireNumber) rules.push("a number");
    if (settings.requireSpecialCharacter) rules.push("a special character");
    return `Password must contain ${rules.join(", ")}.`;
}

export function validatePasswordAgainstSettings(password, settings = DEFAULT_SECURITY_SETTINGS) {
    const value = String(password || "");
    const errors = [];

    if (value.length < Number(settings.minPasswordLength || DEFAULT_SECURITY_SETTINGS.minPasswordLength)) {
        errors.push(`be at least ${settings.minPasswordLength} characters long`);
    }
    if (settings.requireUppercase && !/[A-Z]/.test(value)) {
        errors.push("include at least one uppercase letter");
    }
    if (settings.requireLowercase && !/[a-z]/.test(value)) {
        errors.push("include at least one lowercase letter");
    }
    if (settings.requireNumber && !/[0-9]/.test(value)) {
        errors.push("include at least one number");
    }
    if (settings.requireSpecialCharacter && !/[^A-Za-z0-9]/.test(value)) {
        errors.push("include at least one special character");
    }

    return {
        valid: errors.length === 0,
        errors,
        message: errors.length === 0 ? "" : `Password must ${errors.join(", ")}.`,
    };
}

export function getLockoutExpiry(user, settings = DEFAULT_SECURITY_SETTINGS) {
    if (!user?.lockedAt) return null;
    const minutes = Number(settings.lockoutDurationMinutes || 0);
    if (minutes <= 0) return null;
    return new Date(new Date(user.lockedAt).getTime() + minutes * 60 * 1000);
}

export function isUserCurrentlyLocked(user, settings = DEFAULT_SECURITY_SETTINGS) {
    if (!user?.lockedAt) return false;
    const expiry = getLockoutExpiry(user, settings);
    if (!expiry) return true;
    return expiry.getTime() > Date.now();
}

export async function clearUserLock(userId) {
    return dbTenant(
        `UPDATE \`users\` SET failedLoginCount = 0, lastFailedLoginAt = NULL,
         lockedAt = NULL, lockedReason = NULL WHERE id = ?`,
        [Number(userId)]
    );
}

export async function getTenantPrimaryContactEmailFromHeaders() {
    try {
        const [rows] = await dbTenant("SELECT companyEmail FROM `company_settings` LIMIT 1");
        return rows?.[0]?.companyEmail || null;
    } catch {
        return null;
    }
}

export async function getSecurityActorInfo(session) {
    const primaryEmail = await getTenantPrimaryContactEmailFromHeaders();
    const sessionEmail = session?.email?.trim?.().toLowerCase?.() || null;
    let callerUser = null;
    if (session?.userId) {
        try {
            const [rows] = await dbTenant(
                `SELECT u.id, u.email, r.name as roleName, r.isSystem
                 FROM \`users\` u LEFT JOIN \`roles\` r ON r.id = u.roleId
                 WHERE u.id = ? LIMIT 1`,
                [Number(session.userId)]
            );
            const row = rows?.[0];
            if (row) callerUser = { ...row, role: { name: row.roleName, isSystem: row.isSystem } };
        } catch { }
    }
    const isPrimaryUser = !!(primaryEmail && sessionEmail && primaryEmail === sessionEmail);
    const isSystemUser = !!(callerUser?.role?.isSystem || callerUser?.role?.name === "Super Admin");

    return {
        primaryEmail,
        callerUser,
        isPrimaryUser,
        isSystemUser,
        canUnlockLockedUsers: isPrimaryUser || isSystemUser,
    };
}
