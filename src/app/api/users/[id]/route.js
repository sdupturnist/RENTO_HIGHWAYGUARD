import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
export const dynamic = "force-dynamic";
import { getSession } from "@/app/lib/auth";
import { hash } from "bcryptjs";
import { z } from "zod";
import { getTenantSecuritySettings, validatePasswordAgainstSettings } from "@/app/lib/security-settings";
import { logActivity } from "@/app/lib/logger";

const updateUserSchema = z.object({
    name: z.string().min(1, "Name is required").optional(),
    email: z.string().email("Invalid email address").optional(),
    phone: z.string().optional(),
    password: z.string().min(1, "Password is required").optional(),
    roleId: z.number().int().positive("Role is required").optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
});

// GET /api/users/[id] - Get user by ID
export async function GET(request, props) {
    const params = await props.params;
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const userId = parseInt(params.id);

        const [rows] = await dbTenant(`
            SELECT u.id, u.name, u.email, u.phone, u.roleId, u.status, u.mustChangePassword, u.avatarUrl, u.isSystem, u.isHidden,
                   r.id as role_id, r.name as role_name, r.isSystem as role_isSystem
            FROM \`users\` u
            LEFT JOIN \`roles\` r ON r.id = u.roleId
            WHERE u.id = ? LIMIT 1
        `, [userId]);

        if (!rows || rows.length === 0) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        const user = rows[0];

        // Deny access to hidden users unless it is the user themselves querying their own profile
        if (user.isHidden && Number(session.userId) !== user.id) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }
        return NextResponse.json({
            ...user,
            isSystem: !!user.isSystem,
            role: user.role_id ? { id: user.role_id, name: user.role_name, isSystem: !!user.role_isSystem } : null
        });
    }
    catch (error) {
        console.error("Error fetching user:", error);
        return NextResponse.json({ message: "Error fetching user" }, { status: 500 });
    }
}

// PUT /api/users/[id] - Update user
export async function PUT(request, props) {
    const params = await props.params;
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const body = await request.json();
        const validatedData = updateUserSchema.parse(body);
        const userId = parseInt(params.id);

        // Fetch existing user
        const [existRows] = await dbTenant(`
            SELECT u.*, r.isSystem as role_isSystem, r.name as role_name
            FROM \`users\` u
            LEFT JOIN \`roles\` r ON r.id = u.roleId
            WHERE u.id = ? LIMIT 1
        `, [userId]);

        if (!existRows || existRows.length === 0) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }
        const existingUser = existRows[0];

        // Deny access/modification to hidden users by other users (return 404 to keep them fully hidden)
        if (existingUser.isHidden && Number(session.userId) !== existingUser.id) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        // Prevent modification of vital fields for System Users (role-level)
        if (existingUser.role_isSystem) {
            if (validatedData.roleId && validatedData.roleId !== existingUser.roleId) {
                return NextResponse.json({ message: "Cannot change the role of a system user" }, { status: 400 });
            }
            if (validatedData.status && validatedData.status !== "ACTIVE") {
                return NextResponse.json({ message: "Cannot deactivate or suspend a system user" }, { status: 400 });
            }
        }

        // Prevent modification of vital fields for individually protected users (user-level)
        if (existingUser.isSystem) {
            if (validatedData.roleId && validatedData.roleId !== existingUser.roleId) {
                return NextResponse.json({ message: "Cannot change the role of a protected user" }, { status: 400 });
            }
            if (validatedData.status && validatedData.status !== "ACTIVE") {
                return NextResponse.json({ message: "Cannot deactivate or suspend a protected user" }, { status: 400 });
            }
        }

        // Block all modifications to hidden backend-only users
        if (existingUser.isHidden) {
            return NextResponse.json({ message: "This user cannot be modified" }, { status: 403 });
        }

        // Privilege-escalation guard
        if (validatedData.roleId && validatedData.roleId !== existingUser.roleId) {
            const [targetRoles] = await dbTenant(`SELECT id, name, isSystem FROM \`roles\` WHERE id = ? LIMIT 1`, [validatedData.roleId]);
            const targetRole = targetRoles?.[0];
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
                        { message: "Only Super Admin users can assign a system role." },
                        { status: 403 }
                    );
                }
            }
        }

        // Email update check
        if (validatedData.email && validatedData.email !== existingUser.email) {
            const [emailRows] = await dbTenant(`SELECT id FROM \`users\` WHERE email = ? LIMIT 1`, [validatedData.email]);
            if (emailRows && emailRows.length > 0) {
                return NextResponse.json({ message: "Email already exists" }, { status: 400 });
            }
        }

        // Prepare update
        const fields = [];
        const values = [];
        if (validatedData.name !== undefined) { fields.push("name = ?"); values.push(validatedData.name); }
        if (validatedData.email !== undefined) { fields.push("email = ?"); values.push(validatedData.email); }
        if (validatedData.phone !== undefined) { fields.push("phone = ?"); values.push(validatedData.phone || null); }
        if (validatedData.roleId !== undefined) { fields.push("roleId = ?"); values.push(validatedData.roleId); }
        if (validatedData.status !== undefined) { fields.push("status = ?"); values.push(validatedData.status); }

        if (validatedData.password) {
            const securitySettings = await getTenantSecuritySettings();
            const validation = validatePasswordAgainstSettings(validatedData.password, securitySettings);
            if (!validation.valid) {
                return NextResponse.json({ message: validation.message }, { status: 400 });
            }
            fields.push("password = ?");
            values.push(await hash(validatedData.password, 10));
            fields.push("mustChangePassword = 0");
        }
        fields.push("updatedAt = NOW()");

        await dbTenant(`UPDATE \`users\` SET ${fields.join(", ")} WHERE id = ?`, [...values, userId]);

        // Refetch updated user
        const [updRows] = await dbTenant(`
            SELECT u.id, u.name, u.email, u.phone, u.roleId, u.status, u.mustChangePassword, u.avatarUrl,
                   r.id as role_id, r.name as role_name, r.isSystem as role_isSystem
            FROM \`users\` u
            LEFT JOIN \`roles\` r ON r.id = u.roleId
            WHERE u.id = ? LIMIT 1
        `, [userId]);
        const user = updRows[0];

        await logActivity("USER", userId, "UPDATE", `User updated: ${user.name} (${user.email})`);
        return NextResponse.json({
            ...user,
            role: user.role_id ? { id: user.role_id, name: user.role_name, isSystem: !!user.role_isSystem } : null
        });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ message: "Validation error", errors: error.errors }, { status: 400 });
        }
        console.error("Error updating user:", error);
        return NextResponse.json({ message: "Error updating user" }, { status: 500 });
    }
}

// DELETE /api/users/[id] - Delete user
export async function DELETE(request, props) {
    const params = await props.params;
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const userId = parseInt(params.id);

        // Fetch existing user
        const [uRows] = await dbTenant(`
            SELECT u.*, r.isSystem as role_isSystem, r.name as role_name
            FROM \`users\` u
            LEFT JOIN \`roles\` r ON r.id = u.roleId
            WHERE u.id = ? LIMIT 1
        `, [userId]);

        if (!uRows || uRows.length === 0) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }
        const user = uRows[0];

        // Hide user existence from unauthorized users entirely
        if (user.isHidden && Number(session.userId) !== user.id) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        if (user.isSystem || user.isHidden) {
            return NextResponse.json({ message: "Cannot delete a protected user" }, { status: 400 });
        }
        if (Number(session.userId) === userId) {
            return NextResponse.json({ message: "Cannot delete your own account" }, { status: 400 });
        }

        await dbTenant(`DELETE FROM \`users\` WHERE id = ?`, [userId]);
        await logActivity("USER", userId, "DELETE", `User deleted: ${user.name} (${user.email})`);
        return NextResponse.json({ message: "User deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting user:", error);
        return NextResponse.json({ message: "Error deleting user" }, { status: 500 });
    }
}
