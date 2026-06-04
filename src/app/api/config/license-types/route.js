import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { z } from "zod";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";

const createSchema = z.object({
    name: z.string().min(1, "Name is required"),
});

export async function GET() {
    try {
        const [types] = await dbTenant("SELECT * FROM `license_types` ORDER BY name ASC");
        return NextResponse.json(types || []);
    } catch (error) {
        console.error("Error fetching license types:", error);
        return NextResponse.json({ message: "Error fetching license types" }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    try {
        const body = await request.json();
        const { name } = createSchema.parse(body);
        const [res] = await dbTenant(`
            INSERT INTO \`license_types\` (name, createdAt, updatedAt)
            VALUES (?, NOW(), NOW())
        `, [name]);
        const [rows] = await dbTenant(`SELECT * FROM \`license_types\` WHERE id = ? LIMIT 1`, [res.insertId]);
        await logActivity("CONFIG", res.insertId, "CREATE", `License type created: ${name}`);
        return NextResponse.json(rows[0]);
    } catch (error) {
        console.error("Error creating license type:", error);
        return NextResponse.json({ message: "Error creating license type" }, { status: 500 });
    }
}
