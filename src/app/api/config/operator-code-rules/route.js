import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const [rows] = await dbTenant("SELECT * FROM `operator_code_rules` LIMIT 1");
        const rule = rows?.[0];
        if (!rule) {
            return NextResponse.json({
                prefix: "OPR",
                startingNumber: 1,
                padding: 4,
                autoSelectOperatorCost: true,
                defaultHourlyRate: null
            });
        }
        return NextResponse.json(rule);
    } catch (error) {
        console.error("Error fetching operator code rules:", error);
        return NextResponse.json({ message: "Error fetching code rules" }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const data = await req.json();

        const [rows] = await dbTenant("SELECT id FROM `operator_code_rules` LIMIT 1");
        const rule = rows?.[0];

        if (rule) {
            await dbTenant(`
                UPDATE \`operator_code_rules\` 
                SET prefix = ?, startingNumber = ?, padding = ?, updatedAt = NOW()
                WHERE id = ?
            `, [data.prefix, parseInt(data.startingNumber), parseInt(data.padding), rule.id]);
        } else {
            await dbTenant(`
                INSERT INTO \`operator_code_rules\` (prefix, startingNumber, padding, updatedAt)
                VALUES (?, ?, ?, NOW())
            `, [data.prefix, parseInt(data.startingNumber), parseInt(data.padding)]);
        }

        const [updRows] = await dbTenant("SELECT * FROM `operator_code_rules` LIMIT 1");
        await logActivity("SETTINGS", 0, "UPDATE", "Operator code rules updated");
        return NextResponse.json(updRows[0]);
    } catch (error) {
        console.error("Error saving operator code rules:", error);
        return NextResponse.json({ message: "Error saving code rules" }, { status: 500 });
    }
}
