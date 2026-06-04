import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { z } from "zod";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";

const projectSettingsSchema = z.object({
    prefix: z.string().min(1),
    startingNumber: z.number().min(1),
    padding: z.number().min(1).max(10),
    defaultBilling: z.enum(["HOURLY", "DAILY"]),
});

export async function GET(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    try {
        const [rows] = await dbTenant("SELECT * FROM `project_code_rules` LIMIT 1");
        const settings = rows?.[0];
        return NextResponse.json(settings || {
            prefix: "PRJ",
            startingNumber: 1001,
            padding: 4,
            defaultBilling: "DAILY"
        });
    } catch (error) {
        console.error("Error fetching project settings:", error);
        return NextResponse.json({ message: "Error fetching settings" }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    try {
        const body = await request.json();
        const data = projectSettingsSchema.parse(body);

        const [rows] = await dbTenant("SELECT id FROM `project_code_rules` LIMIT 1");
        const rule = rows?.[0];

        if (rule) {
            await dbTenant(`
                UPDATE \`project_code_rules\` 
                SET prefix = ?, startingNumber = ?, padding = ?, defaultBilling = ?, updatedAt = NOW()
                WHERE id = ?
            `, [data.prefix, data.startingNumber, data.padding, data.defaultBilling, rule.id]);
        } else {
            await dbTenant(`
                INSERT INTO \`project_code_rules\` (prefix, startingNumber, padding, defaultBilling, updatedAt)
                VALUES (?, ?, ?, ?, NOW())
            `, [data.prefix, data.startingNumber, data.padding, data.defaultBilling]);
        }

        const [updRows] = await dbTenant("SELECT * FROM `project_code_rules` LIMIT 1");
        await logActivity("SETTINGS", 0, "UPDATE", "Project code rules updated");
        return NextResponse.json(updRows[0]);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ message: "Validation error", errors: error.errors }, { status: 400 });
        }
        console.error("Error saving project settings:", error);
        return NextResponse.json({ message: "Error saving settings" }, { status: 500 });
    }
}
