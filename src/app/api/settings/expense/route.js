import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";

const defaults = {
    codePrefix: "EXP",
    startingNumber: 1,
    numberPadding: 4,
};

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const [rows] = await dbTenant("SELECT * FROM `entity_code_settings` WHERE entityType = 'EXPENSE' LIMIT 1");
        let settings = rows?.[0];

        if (!settings) {
            const [res] = await dbTenant(`
                INSERT INTO \`entity_code_settings\` (entityType, codePrefix, startingNumber, numberPadding)
                VALUES ('EXPENSE', ?, ?, ?)
            `, [defaults.codePrefix, defaults.startingNumber, defaults.numberPadding]);
            const [newRows] = await dbTenant("SELECT * FROM `entity_code_settings` WHERE id = ?", [res.insertId]);
            settings = newRows[0];
        }

        return NextResponse.json(settings);
    } catch (error) {
        console.error("Error fetching expense settings:", error);
        return NextResponse.json({ message: "Error fetching expense settings" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const body = await request.json();
        const { codePrefix, startingNumber, numberPadding } = body;

        const [existingRows] = await dbTenant("SELECT id FROM `entity_code_settings` WHERE entityType = 'EXPENSE' LIMIT 1");
        const existing = existingRows?.[0];

        const data = {
            codePrefix: codePrefix || "EXP",
            startingNumber: parseInt(startingNumber) || 1,
            numberPadding: parseInt(numberPadding) || 4
        };

        if (existing) {
            await dbTenant(`
                UPDATE \`entity_code_settings\` SET
                    codePrefix = ?, startingNumber = ?, numberPadding = ?
                WHERE id = ?
            `, [data.codePrefix, data.startingNumber, data.numberPadding, existing.id]);
        } else {
            await dbTenant(`
                INSERT INTO \`entity_code_settings\` (entityType, codePrefix, startingNumber, numberPadding)
                VALUES ('EXPENSE', ?, ?, ?)
            `, [data.codePrefix, data.startingNumber, data.numberPadding]);
        }

        const [updRows] = await dbTenant("SELECT * FROM `entity_code_settings` WHERE entityType = 'EXPENSE' LIMIT 1");
        await logActivity("SETTINGS", 0, "UPDATE", "Expense settings updated");
        return NextResponse.json(updRows[0]);
    } catch (error) {
        console.error("Error saving expense settings:", error);
        return NextResponse.json({ message: "Error saving expense settings" }, { status: 500 });
    }
}
