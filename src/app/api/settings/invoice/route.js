import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { verifySession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";

const defaults = {
    codePrefix: "INV",
    startingNumber: 1,
    numberPadding: 5,
    defaultDueDays: 30,
    showTimesheetReference: true,
    lockTimesheetOnCreate: true,
};

export async function GET() {
    const session = await verifySession();
    const canView = session ? await verifySessionPermission(session, "Settings", "View") : false;
    if (!session || !canView) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const [rows] = await dbTenant("SELECT * FROM `invoice_settings` LIMIT 1");
        const settings = rows?.[0];
        if (!settings) return NextResponse.json(defaults);
        return NextResponse.json(settings);
    } catch (error) {
        console.error("Failed to fetch invoice settings:", error);
        return NextResponse.json({ error: "Failed to fetch invoice settings" }, { status: 500 });
    }
}

export async function PUT(request) {
    const session = await verifySession();
    const canEdit = session ? await verifySessionPermission(session, "Settings", "Edit") : false;
    if (!session || !canEdit) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await request.json();
        const { codePrefix, startingNumber, numberPadding, defaultDueDays, showTimesheetReference, lockTimesheetOnCreate } = body;

        const [existingRows] = await dbTenant("SELECT id FROM `invoice_settings` LIMIT 1");
        const existing = existingRows?.[0];

        if (existing) {
            await dbTenant(`
                UPDATE \`invoice_settings\` SET
                    codePrefix = ?, startingNumber = ?, numberPadding = ?, defaultDueDays = ?,
                    showTimesheetReference = ?, lockTimesheetOnCreate = ?, updatedAt = NOW()
                WHERE id = ?
            `, [
                codePrefix, Number(startingNumber), Number(numberPadding), Number(defaultDueDays),
                showTimesheetReference ? 1 : 0, lockTimesheetOnCreate ? 1 : 0, existing.id
            ]);
        } else {
            await dbTenant(`
                INSERT INTO \`invoice_settings\` (
                    codePrefix, startingNumber, numberPadding, defaultDueDays,
                    showTimesheetReference, lockTimesheetOnCreate, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, NOW())
            `, [
                codePrefix, Number(startingNumber), Number(numberPadding), Number(defaultDueDays),
                showTimesheetReference ? 1 : 0, lockTimesheetOnCreate ? 1 : 0
            ]);
        }

        const [updRows] = await dbTenant("SELECT * FROM `invoice_settings` LIMIT 1");
        await logActivity("SETTINGS", 0, "UPDATE", "Invoice settings updated");
        return NextResponse.json(updRows[0]);
    } catch (error) {
        console.error("Failed to update invoice settings:", error);
        return NextResponse.json({ error: "Failed to update invoice settings" }, { status: 500 });
    }
}
