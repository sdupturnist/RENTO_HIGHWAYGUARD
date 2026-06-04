import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
export const dynamic = "force-dynamic";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { hash } from "bcryptjs";
import { z } from "zod";
import { getSecurityActorInfo, getTenantSecuritySettings, validatePasswordAgainstSettings } from "@/app/lib/security-settings";
import { logActivity } from "@/app/lib/logger";

const userSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),
    password: z.string().min(1, "Password is required").optional(),
    roleId: z.number().int().positive("Role is required"),
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).default("ACTIVE"),
    avatarUrl: z.string().optional(),
});

// GET /api/users - List all users
export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const canView = await verifySessionPermission(session, "Users & Roles", "View");
        if (!canView) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");

        let query = `
            SELECT u.id, u.name, u.email, u.phone, u.status, u.lastLogin, u.lockedAt, u.mustChangePassword, u.createdAt, u.avatarUrl,
                   u.isSystem as user_isSystem, u.isHidden as user_isHidden,
                   r.id as role_id, r.name as role_name, r.isSystem as role_isSystem
            FROM \`users\` u
            LEFT JOIN \`roles\` r ON r.id = u.roleId
            WHERE (u.isHidden IS NULL OR u.isHidden = 0)
        `;
        const params = [];
        if (status && status !== "all") {
            query += ` AND u.status = ?`;
            params.push(status);
        }
        query += ` ORDER BY u.createdAt DESC`;

        const [users] = await dbTenant(query, params);

        // Security Actor Info (manually handle dbQuery → dbTenant)
        const { primaryEmail: primaryContactEmail, canUnlockLockedUsers } = await getSecurityActorInfo(session, dbTenant);

        const sanitizedUsers = (users || []).map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            status: user.status,
            lastLogin: user.lastLogin,
            lockedAt: user.lockedAt,
            mustChangePassword: !!user.mustChangePassword,
            createdAt: user.createdAt,
            avatarUrl: user.avatarUrl,
            isSystem: !!user.user_isSystem,
            role: user.role_id ? {
                id: user.role_id,
                name: user.role_name,
                isSystem: !!user.role_isSystem,
            } : null,
            isPrimaryTenantUser: !!(primaryContactEmail && user.email?.trim().toLowerCase() === primaryContactEmail),
            isLocked: !!user.lockedAt,
            canUnlock: !!(canUnlockLockedUsers && user.lockedAt && !(primaryContactEmail && user.email?.trim().toLowerCase() === primaryContactEmail)),
        }));

        return NextResponse.json(sanitizedUsers);
    }
    catch (error) {
        console.error("Error fetching users:", error);
        return NextResponse.json({ message: "Error fetching users" }, { status: 500 });
    }
}

// POST /api/users - Create new user
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


        const body = await request.json();
        const validatedData = userSchema.parse(body);

        // Fetch target role
        const [roles] = await dbTenant(`SELECT id, name, isSystem FROM \`roles\` WHERE id = ? LIMIT 1`, [validatedData.roleId]);
        const targetRole = roles?.[0];
        if (!targetRole) {
            return NextResponse.json({ message: "Selected role does not exist" }, { status: 400 });
        }

        if (targetRole.isSystem || targetRole.name === "Super Admin") {
            const callerRoleId = Number(session.roleId);
            const [callerRoles] = callerRoleId 
                ? await dbTenant(`SELECT isSystem, name FROM \`roles\` WHERE id = ? LIMIT 1`, [callerRoleId])
                : [[]];
            const callerRole = callerRoles?.[0];
            const callerIsSystem = !!(callerRole?.isSystem || callerRole?.name === "Super Admin");
            if (!callerIsSystem) {
                return NextResponse.json(
                    { message: "Only Super Admin users can create users in a system role." },
                    { status: 403 }
                );
            }
        }

        // Check if email already exists
        const [existing] = await dbTenant(`SELECT id FROM \`users\` WHERE email = ? LIMIT 1`, [validatedData.email]);
        if (existing && existing.length > 0) {
            return NextResponse.json({ message: "Email already exists" }, { status: 400 });
        }

        // Hash password
        if (!validatedData.password) {
            return NextResponse.json({ message: "Password is required for new users" }, { status: 400 });
        }
        const securitySettings = await getTenantSecuritySettings();
        const validation = validatePasswordAgainstSettings(validatedData.password, securitySettings);
        if (!validation.valid) {
            return NextResponse.json({ message: validation.message }, { status: 400 });
        }
        const hashedPassword = await hash(validatedData.password, 10);

        // Create user
        const [res] = await dbTenant(`
            INSERT INTO \`users\` (name, email, phone, password, roleId, status, avatarUrl, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [
            validatedData.name,
            validatedData.email,
            validatedData.phone || null,
            hashedPassword,
            validatedData.roleId,
            validatedData.status,
            validatedData.avatarUrl || null
        ]);

        const newUserId = res.insertId;

        // Fetch the created user
        const [uRows] = await dbTenant(`
            SELECT u.*, r.name as role_name
            FROM \`users\` u
            LEFT JOIN \`roles\` r ON r.id = u.roleId
            WHERE u.id = ? LIMIT 1
        `, [newUserId]);
        const newUser = uRows[0];

        // Don't send password to frontend
        const { password, ...sanitizedUser } = newUser;
        sanitizedUser.role = { id: newUser.roleId, name: newUser.role_name };

        await logActivity("USER", newUserId, "CREATE", `User created: ${validatedData.name} (${validatedData.email})`);
        return NextResponse.json(sanitizedUser, { status: 201 });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ message: "Validation error", errors: error.errors }, { status: 400 });
        }
        console.error("Error creating user:", error);
        return NextResponse.json({ message: "Error creating user" }, { status: 500 });
    }
}
