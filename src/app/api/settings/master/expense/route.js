import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const [types] = await dbTenant("SELECT * FROM `expense_types` ORDER BY name ASC");
        return NextResponse.json(types || []);
    } catch (error) {
        console.error("Error fetching expense types:", error);
        return NextResponse.json({ message: "Error fetching expense types" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const { name } = await request.json();
        if (!name) return NextResponse.json({ message: "Name is required" }, { status: 400 });

        const [res] = await dbTenant(`
            INSERT INTO \`expense_types\` (name, createdAt, updatedAt)
            VALUES (?, NOW(), NOW())
        `, [name.trim()]);

        const [rows] = await dbTenant("SELECT * FROM `expense_types` WHERE id = ?", [res.insertId]);
        await logActivity("CONFIG", res.insertId, "CREATE", `Expense type created: ${name.trim()}`);
        return NextResponse.json(rows[0]);
    } catch (error) {
        if (error?.code === "ER_DUP_ENTRY") {
            return NextResponse.json({ message: "Expense type already exists" }, { status: 400 });
        }
        console.error("Error creating expense type:", error);
        return NextResponse.json({ message: "Error creating expense type" }, { status: 500 });
    }
}
