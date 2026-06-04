import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const [rows] = await dbTenant("SELECT * FROM `registration_authorities` ORDER BY name ASC");
        return NextResponse.json(rows || []);
    } catch (error) {
        console.error("Error fetching authorities:", error);
        return NextResponse.json({ message: "Error fetching authorities" }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const { name } = await req.json();
        if (!name) return NextResponse.json({ message: "Name is required" }, { status: 400 });

        const [res] = await dbTenant(`
            INSERT INTO \`registration_authorities\` (name, createdAt, updatedAt)
            VALUES (?, NOW(), NOW())
        `, [name]);

        const [rows] = await dbTenant(`SELECT * FROM \`registration_authorities\` WHERE id = ? LIMIT 1`, [res.insertId]);
        await logActivity("CONFIG", res.insertId, "CREATE", `Registration authority created: ${name}`);
        return NextResponse.json(rows[0]);
    } catch (error) {
        console.error("Error creating authority:", error);
        return NextResponse.json({ message: "Error creating authority" }, { status: 500 });
    }
}
