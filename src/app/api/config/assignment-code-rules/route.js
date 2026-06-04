import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    try {
        const [rows] = await dbTenant("SELECT * FROM `assignment_settings` LIMIT 1");
        const settings = rows?.[0];
        if (!settings) {
            return NextResponse.json({ prefix: "ASG", startingNumber: 1001, padding: 4 });
        }
        return NextResponse.json({
            prefix: settings.codePrefix,
            startingNumber: settings.codeStartingNumber,
            padding: settings.codePadding
        });
    } catch (error) {
        console.error("Error fetching assignment settings:", error);
        return NextResponse.json({ message: "Error fetching settings" }, { status: 500 });
    }
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    try {
        const data = await req.json();
        const { prefix, startingNumber, padding } = data;

        const [rows] = await dbTenant("SELECT id FROM `assignment_settings` LIMIT 1");
        const settings = rows?.[0];

        if (settings) {
            await dbTenant(`
                UPDATE \`assignment_settings\` 
                SET codePrefix = ?, codeStartingNumber = ?, codePadding = ?, updatedAt = NOW()
                WHERE id = ?
            `, [prefix, startingNumber, padding, settings.id]);
        } else {
            await dbTenant(`
                INSERT INTO \`assignment_settings\` (codePrefix, codeStartingNumber, codePadding, updatedAt)
                VALUES (?, ?, ?, NOW())
            `, [prefix, startingNumber, padding]);
        }

        const [updRows] = await dbTenant("SELECT * FROM `assignment_settings` LIMIT 1");
        const upd = updRows[0];
        await logActivity("SETTINGS", 0, "UPDATE", "Assignment code rules updated");
        return NextResponse.json({
            prefix: upd.codePrefix,
            startingNumber: upd.codeStartingNumber,
            padding: upd.codePadding
        });
    } catch (error) {
        console.error("Error saving assignment settings:", error);
        return NextResponse.json({ message: "Error saving settings" }, { status: 500 });
    }
}
