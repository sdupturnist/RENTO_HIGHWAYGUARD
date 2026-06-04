import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";

// GET /api/profile - Get current user profile
export async function GET() {
    try {
        const session = await getSession();
        if (!session || !session.userId)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const [rows] = await dbTenant(`
            SELECT u.id, u.name, u.email, u.phone, u.avatarUrl, r.name as role_name
            FROM \`users\` u
            LEFT JOIN \`roles\` r ON r.id = u.roleId
            WHERE u.id = ? LIMIT 1
        `, [Number(session.userId)]);

        if (!rows || rows.length === 0)
            return NextResponse.json({ message: "User not found" }, { status: 404 });

        const row = rows[0];
        return NextResponse.json({
            id: row.id, name: row.name, email: row.email,
            phone: row.phone, avatarUrl: row.avatarUrl,
            role: row.role_name ? { name: row.role_name } : null,
        });
    } catch (error) {
        console.error("Error fetching profile:", error);
        return NextResponse.json({ message: "Error fetching profile" }, { status: 500 });
    }
}

// PUT /api/profile - Update user profile
export async function PUT(request) {
    try {
        const session = await getSession();
        if (!session || !session.userId)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const body = await request.json();
        const { name, phone } = body;
        if (!name)
            return NextResponse.json({ message: "Name is required" }, { status: 400 });

        await dbTenant(
            `UPDATE \`users\` SET name = ?, phone = ?, avatarUrl = ?, updatedAt = NOW() WHERE id = ?`,
            [name, phone || null, body.avatarUrl || null, Number(session.userId)]
        );

        const [rows] = await dbTenant(`
            SELECT u.id, u.name, u.email, u.phone, u.avatarUrl, r.name as role_name
            FROM \`users\` u
            LEFT JOIN \`roles\` r ON r.id = u.roleId
            WHERE u.id = ? LIMIT 1
        `, [Number(session.userId)]);

        const row = rows[0];
        await logActivity("USER", Number(session.userId), "UPDATE", `Profile updated: ${row.name} (${row.email})`);
        return NextResponse.json({
            id: row.id, name: row.name, email: row.email,
            phone: row.phone, avatarUrl: row.avatarUrl,
            role: row.role_name ? { name: row.role_name } : null,
        });
    } catch (error) {
        console.error("Error updating profile:", error);
        return NextResponse.json({ message: "Error updating profile" }, { status: 500 });
    }
}
