import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const [rows] = await dbTenant("SELECT * FROM `vehicle_code_rules` ORDER BY id ASC");
        if (!rows || rows.length === 0) {
            return NextResponse.json([]);
        }
        return NextResponse.json(rows);
    } catch (error) {
        console.error("Error fetching vehicle code rules:", error);
        return NextResponse.json({ message: "Error fetching code rules" }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const data = await req.json();

        const [result] = await dbTenant(`
            INSERT INTO \`vehicle_code_rules\` (prefix, startingNumber, padding, defaultRentCycle, updatedAt)
            VALUES (?, ?, ?, ?, NOW())
        `, [data.prefix, parseInt(data.startingNumber), parseInt(data.padding), data.defaultRentCycle || "DAILY"]);

        const [newRows] = await dbTenant("SELECT * FROM `vehicle_code_rules` WHERE id = ?", [result.insertId]);
        await logActivity("CONFIG", result.insertId, "CREATE", `Vehicle code rule created: ${data.prefix}`);
        return NextResponse.json(newRows[0]);
    } catch (error) {
        console.error("Error creating vehicle code rule:", error);
        return NextResponse.json({ message: "Error creating code rule" }, { status: 500 });
    }
}
