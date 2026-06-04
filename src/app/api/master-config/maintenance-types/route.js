import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const hasPermission = await verifySessionPermission(session, "Settings", "View");
        if (!hasPermission) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const [types] = await dbTenant("SELECT * FROM `maintenance_types` ORDER BY name ASC");
        return NextResponse.json(types || []);
    } catch (error) {
        console.error("Error fetching maintenance types:", error);
        return NextResponse.json({ message: "Error fetching maintenance types" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const hasPermission = await verifySessionPermission(session, "Settings", "Edit");
        if (!hasPermission) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const { name, isActive } = await request.json();
        if (!name) return NextResponse.json({ message: "Name is required" }, { status: 400 });

        const [res] = await dbTenant(`
            INSERT INTO \`maintenance_types\` (name, isActive, createdAt, updatedAt)
            VALUES (?, ?, NOW(), NOW())
        `, [name, isActive !== undefined ? (isActive ? 1 : 0) : 1]);

        const [rows] = await dbTenant(`SELECT * FROM \`maintenance_types\` WHERE id = ? LIMIT 1`, [res.insertId]);
        await logActivity("CONFIG", res.insertId, "CREATE", `Maintenance type created: ${name}`);
        return NextResponse.json(rows[0], { status: 201 });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return NextResponse.json({ message: "Maintenance type already exists" }, { status: 400 });
        console.error("Error creating maintenance type:", error);
        return NextResponse.json({ message: "Error creating maintenance type" }, { status: 500 });
    }
}
