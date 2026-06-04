import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";

const defaults = {
    prefix: "MAINT",
    startingNumber: 1,
    padding: 4,
};

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const hasPermission = await verifySessionPermission(session, "Settings", "View");
        if (!hasPermission) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const [rows] = await dbTenant("SELECT * FROM `entity_code_settings` WHERE entityType = 'MAINTENANCE' LIMIT 1");
        const row = rows?.[0];
        if (!row) return NextResponse.json(defaults);
        return NextResponse.json({ prefix: row.codePrefix, startingNumber: row.startingNumber, padding: row.numberPadding });
    } catch (error) {
        console.error("Error fetching maintenance settings:", error);
        return NextResponse.json({ message: "Error fetching settings" }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const hasPermission = await verifySessionPermission(session, "Settings", "Edit");
        if (!hasPermission) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const body = await request.json();
        const { prefix, startingNumber, padding } = body;

        if (!prefix || startingNumber < 1 || padding < 1) {
            return NextResponse.json({ message: "Invalid settings values" }, { status: 400 });
        }

        const [rows] = await dbTenant("SELECT id FROM `entity_code_settings` WHERE entityType = 'MAINTENANCE' LIMIT 1");
        const existing = rows?.[0];

        if (existing) {
            await dbTenant(`
                UPDATE \`entity_code_settings\` SET
                    codePrefix = ?, startingNumber = ?, numberPadding = ?
                WHERE id = ?
            `, [prefix, parseInt(startingNumber), parseInt(padding), existing.id]);
        } else {
            await dbTenant(`
                INSERT INTO \`entity_code_settings\` (entityType, codePrefix, startingNumber, numberPadding)
                VALUES ('MAINTENANCE', ?, ?, ?)
            `, [prefix, parseInt(startingNumber), parseInt(padding)]);
        }

        const [updRows] = await dbTenant("SELECT * FROM `entity_code_settings` WHERE entityType = 'MAINTENANCE' LIMIT 1");
        const row = updRows[0];
        await logActivity("SETTINGS", 0, "UPDATE", "Maintenance settings updated");
        return NextResponse.json({ prefix: row.codePrefix, startingNumber: row.startingNumber, padding: row.numberPadding });
    } catch (error) {
        console.error("Error updating maintenance settings:", error);
        return NextResponse.json({ message: "Error updating settings" }, { status: 500 });
    }
}
