import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { verifySession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";

const defaults = {
    codePrefix: "TS",
    startingNumber: 1,
    numberPadding: 5,
    allowRegenerationBeforeInvoice: true,
    lockTimesheetAfterInvoice: true,
};

export async function GET() {
    const session = await verifySession();
    const canView = session ? await verifySessionPermission(session, "Settings", "View") : false;
    if (!session || !canView) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const [rows] = await dbTenant("SELECT * FROM `timesheet_settings` LIMIT 1");
        return NextResponse.json(rows?.[0] || defaults);
    } catch (error) {
        console.error("Failed to fetch timesheet settings:", error);
        return NextResponse.json({ error: "Failed to fetch timesheet settings" }, { status: 500 });
    }
}

export async function PUT(request) {
    const session = await verifySession();
    const canEdit = session ? await verifySessionPermission(session, "Settings", "Edit") : false;
    if (!session || !canEdit) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await request.json();
        const { codePrefix, startingNumber, numberPadding, allowRegenerationBeforeInvoice, lockTimesheetAfterInvoice } = body;

        const [rows] = await dbTenant("SELECT id FROM `timesheet_settings` LIMIT 1");
        const existing = rows?.[0];

        if (existing) {
            await dbTenant(`
                UPDATE \`timesheet_settings\` SET
                    codePrefix = ?, startingNumber = ?, numberPadding = ?, 
                    allowRegenerationBeforeInvoice = ?, lockTimesheetAfterInvoice = ?, updatedAt = NOW()
                WHERE id = ?
            `, [
                codePrefix, Number(startingNumber), Number(numberPadding), 
                allowRegenerationBeforeInvoice ? 1 : 0, lockTimesheetAfterInvoice ? 1 : 0, existing.id
            ]);
        } else {
            await dbTenant(`
                INSERT INTO \`timesheet_settings\` (
                    codePrefix, startingNumber, numberPadding,
                    allowRegenerationBeforeInvoice, lockTimesheetAfterInvoice, updatedAt
                ) VALUES (?, ?, ?, ?, ?, NOW())
            `, [
                codePrefix, Number(startingNumber), Number(numberPadding),
                allowRegenerationBeforeInvoice ? 1 : 0, lockTimesheetAfterInvoice ? 1 : 0
            ]);
        }

        const [updRows] = await dbTenant("SELECT * FROM `timesheet_settings` LIMIT 1");
        await logActivity("SETTINGS", 0, "UPDATE", "Timesheet settings updated");
        return NextResponse.json(updRows[0]);
    } catch (error) {
        console.error("Failed to update timesheet settings:", error);
        return NextResponse.json({ error: "Failed to update timesheet settings" }, { status: 500 });
    }
}
