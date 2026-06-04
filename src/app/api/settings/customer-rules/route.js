import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const [rows] = await dbTenant("SELECT * FROM `customer_code_rules` LIMIT 1");
    return NextResponse.json(rows?.[0] || { prefix: "CST", startingNumber: 1001, padding: 4 });
}

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canEdit = await verifySessionPermission(session, "Settings", "Edit");
    if (!canEdit) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    try {
        const { prefix, startingNumber, padding } = await request.json();
        const [rows] = await dbTenant("SELECT id FROM `customer_code_rules` LIMIT 1");
        const existing = rows?.[0];

        if (existing) {
            await dbTenant(`
                UPDATE \`customer_code_rules\` SET
                    prefix = ?, startingNumber = ?, padding = ?, updatedAt = NOW()
                WHERE id = ?
            `, [prefix, Number(startingNumber), Number(padding), existing.id]);
        } else {
            await dbTenant(`
                INSERT INTO \`customer_code_rules\` (prefix, startingNumber, padding, updatedAt)
                VALUES (?, ?, ?, NOW())
            `, [prefix, Number(startingNumber), Number(padding)]);
        }

        const [updRows] = await dbTenant("SELECT * FROM `customer_code_rules` LIMIT 1");
        await logActivity("SETTINGS", 0, "UPDATE", "Customer code rules updated");
        return NextResponse.json(updRows[0]);
    } catch (error) {
        console.error("Error saving customer code rules:", error);
        return NextResponse.json({ message: "Error saving rules" }, { status: 500 });
    }
}
