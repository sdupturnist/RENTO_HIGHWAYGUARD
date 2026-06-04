import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { z } from "zod";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";

const updateSettingsSchema = z.object({
    codePrefix: z.string().min(1).default("ASG"),
    codeStartingNumber: z.number().int().min(1).default(1001),
    codePadding: z.number().int().min(1).max(10).default(4),
    enforceStrictAvailabilityLock: z.coerce.boolean(),
    defaultEnableAutoTimeLogs: z.coerce.boolean().default(true),
    includeWeekendsForAutoLogs: z.coerce.boolean().default(false),
    defaultBillingCycle: z.enum(["HOURLY", "DAILY"]).default("DAILY"),
    defaultWithOperator: z.coerce.boolean().default(false),
});

export async function GET(request) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    let [rows] = await dbTenant("SELECT * FROM `assignment_settings` LIMIT 1");
    let settings = rows?.[0];

    if (!settings) {
        await dbTenant(`
            INSERT INTO \`assignment_settings\`
            (codePrefix, codeStartingNumber, codePadding, enforceStrictAvailabilityLock, defaultEnableAutoTimeLogs, includeWeekendsForAutoLogs, defaultBillingCycle, defaultWithOperator, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, ["ASG", 1001, 4, 1, 1, 0, "DAILY", 0]);
        [rows] = await dbTenant("SELECT * FROM `assignment_settings` LIMIT 1");
        settings = rows?.[0];
    }
    return NextResponse.json(settings);
}

export async function PUT(request) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    try {
        const body = await request.json();
        const data = updateSettingsSchema.parse(body);

        let [rows] = await dbTenant("SELECT * FROM `assignment_settings` LIMIT 1");
        let settings = rows?.[0];

        if (!settings) {
            await dbTenant(`
                INSERT INTO \`assignment_settings\`
                (codePrefix, codeStartingNumber, codePadding, enforceStrictAvailabilityLock, defaultEnableAutoTimeLogs, includeWeekendsForAutoLogs, defaultBillingCycle, defaultWithOperator, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [data.codePrefix, data.codeStartingNumber, data.codePadding,
                data.enforceStrictAvailabilityLock ? 1 : 0,
                data.defaultEnableAutoTimeLogs ? 1 : 0,
                data.includeWeekendsForAutoLogs ? 1 : 0,
                data.defaultBillingCycle, data.defaultWithOperator ? 1 : 0]);
        } else {
            await dbTenant(`
                UPDATE \`assignment_settings\` SET
                codePrefix = ?, codeStartingNumber = ?, codePadding = ?,
                enforceStrictAvailabilityLock = ?, defaultEnableAutoTimeLogs = ?,
                includeWeekendsForAutoLogs = ?, defaultBillingCycle = ?, defaultWithOperator = ?,
                updatedAt = NOW()
                WHERE id = ?
            `, [data.codePrefix, data.codeStartingNumber, data.codePadding,
                data.enforceStrictAvailabilityLock ? 1 : 0,
                data.defaultEnableAutoTimeLogs ? 1 : 0,
                data.includeWeekendsForAutoLogs ? 1 : 0,
                data.defaultBillingCycle, data.defaultWithOperator ? 1 : 0,
                settings.id]);
        }

        [rows] = await dbTenant("SELECT * FROM `assignment_settings` LIMIT 1");
        await logActivity("SETTINGS", 0, "UPDATE", "Assignment settings updated");
        return NextResponse.json(rows?.[0]);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ message: "Validation error", errors: error.issues }, { status: 400 });
        }
        console.error("Error updating assignment settings:", error);
        return NextResponse.json({ message: "Error updating settings" }, { status: 500 });
    }
}
