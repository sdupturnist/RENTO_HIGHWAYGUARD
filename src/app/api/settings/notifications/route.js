import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { z } from "zod";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";

const notificationSettingsSchema = z.object({
    sendAssignmentToCustomer: z.coerce.boolean().default(false),
    sendAssignmentToOwner: z.coerce.boolean().default(false),
    sendAssignmentToThirdParty: z.coerce.boolean().default(false),
    sendTimesheetToCustomer: z.coerce.boolean().default(false),
    sendInvoiceToCustomer: z.coerce.boolean().default(false),
    attachTimesheetWithInvoice: z.coerce.boolean().default(false),
    enableExpiryNotifications: z.coerce.boolean().default(true),
    vehicleExpiryThresholds: z.array(z.number()).default([7, 14, 30]),
    operatorExpiryThresholds: z.array(z.number()).default([7, 14, 30]),
    enableExpiryEmailReminders: z.coerce.boolean().default(false),
    expiryReminderRecipients: z.array(z.string().email()).optional().default([]),
    expiryReminderFrequency: z.enum(["DAILY", "WEEKLY"]).default("DAILY"),
    expiryReminderSendTime: z.string().default("08:00"),
});

function transformRow(settings, emailRemindersEnabled = true) {
    return {
        ...defaults,
        ...settings,
        sendAssignmentToCustomer: !!settings.sendAssignmentToCustomer,
        sendAssignmentToOwner: !!settings.sendAssignmentToOwner,
        sendAssignmentToThirdParty: !!settings.sendAssignmentToThirdParty,
        sendTimesheetToCustomer: !!settings.sendTimesheetToCustomer,
        sendInvoiceToCustomer: !!settings.sendInvoiceToCustomer,
        attachTimesheetWithInvoice: !!settings.attachTimesheetWithInvoice,
        enableExpiryNotifications: !!settings.enableExpiryNotifications,
        enableExpiryEmailReminders: emailRemindersEnabled ? !!settings.enableExpiryEmailReminders : false,
        vehicleExpiryThresholds: typeof settings.vehicleExpiryThresholds === 'string'
            ? JSON.parse(settings.vehicleExpiryThresholds)
            : settings.vehicleExpiryThresholds || defaults.vehicleExpiryThresholds,
        operatorExpiryThresholds: typeof settings.operatorExpiryThresholds === 'string'
            ? JSON.parse(settings.operatorExpiryThresholds)
            : settings.operatorExpiryThresholds || defaults.operatorExpiryThresholds,
        expiryReminderRecipients: typeof settings.expiryReminderRecipients === 'string'
            ? JSON.parse(settings.expiryReminderRecipients)
            : settings.expiryReminderRecipients || defaults.expiryReminderRecipients,
    };
}

const defaults = {
    sendAssignmentToCustomer: false,
    sendAssignmentToOwner: false,
    sendAssignmentToThirdParty: false,
    sendTimesheetToCustomer: false,
    sendInvoiceToCustomer: false,
    attachTimesheetWithInvoice: false,
    enableExpiryNotifications: true,
    vehicleExpiryThresholds: [7, 14, 30],
    operatorExpiryThresholds: [7, 14, 30],
    enableExpiryEmailReminders: false,
    expiryReminderRecipients: [],
    expiryReminderFrequency: "DAILY",
    expiryReminderSendTime: "08:00",
};

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const [rows] = await dbTenant("SELECT * FROM `notification_settings` LIMIT 1");
        let settings = rows?.[0];

        if (!settings) {
            const [res] = await dbTenant(`
                INSERT INTO \`notification_settings\` (
                    sendAssignmentToCustomer, sendAssignmentToOwner, sendAssignmentToThirdParty,
                    sendTimesheetToCustomer, sendInvoiceToCustomer, attachTimesheetWithInvoice,
                    enableExpiryNotifications, vehicleExpiryThresholds, operatorExpiryThresholds,
                    enableExpiryEmailReminders, expiryReminderRecipients, expiryReminderFrequency,
                    expiryReminderSendTime, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                defaults.sendAssignmentToCustomer ? 1 : 0, defaults.sendAssignmentToOwner ? 1 : 0, defaults.sendAssignmentToThirdParty ? 1 : 0,
                defaults.sendTimesheetToCustomer ? 1 : 0, defaults.sendInvoiceToCustomer ? 1 : 0, defaults.attachTimesheetWithInvoice ? 1 : 0,
                defaults.enableExpiryNotifications ? 1 : 0, JSON.stringify(defaults.vehicleExpiryThresholds), JSON.stringify(defaults.operatorExpiryThresholds),
                defaults.enableExpiryEmailReminders ? 1 : 0, JSON.stringify(defaults.expiryReminderRecipients), defaults.expiryReminderFrequency,
                defaults.expiryReminderSendTime
            ]);
            const [newRows] = await dbTenant("SELECT * FROM `notification_settings` WHERE id = ?", [res.insertId]);
            settings = newRows[0];
        }

        return NextResponse.json(transformRow(settings, true));
    } catch (error) {
        console.error("Error loading notification settings:", error);
        return NextResponse.json({ message: "Error loading settings", error: String(error) }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    try {
        const body = await request.json();
        const parsed = notificationSettingsSchema.parse(body);

        const data = parsed;

        const [existingRows] = await dbTenant("SELECT id FROM `notification_settings` LIMIT 1");
        const existing = existingRows?.[0];

        if (existing) {
            await dbTenant(`
                UPDATE \`notification_settings\` SET
                    sendAssignmentToCustomer = ?, sendAssignmentToOwner = ?, sendAssignmentToThirdParty = ?,
                    sendTimesheetToCustomer = ?, sendInvoiceToCustomer = ?, attachTimesheetWithInvoice = ?,
                    enableExpiryNotifications = ?, vehicleExpiryThresholds = ?, operatorExpiryThresholds = ?,
                    enableExpiryEmailReminders = ?, expiryReminderRecipients = ?, expiryReminderFrequency = ?,
                    expiryReminderSendTime = ?, updatedAt = NOW()
                WHERE id = ?
            `, [
                data.sendAssignmentToCustomer ? 1 : 0, data.sendAssignmentToOwner ? 1 : 0, data.sendAssignmentToThirdParty ? 1 : 0,
                data.sendTimesheetToCustomer ? 1 : 0, data.sendInvoiceToCustomer ? 1 : 0, data.attachTimesheetWithInvoice ? 1 : 0,
                data.enableExpiryNotifications ? 1 : 0, JSON.stringify(data.vehicleExpiryThresholds), JSON.stringify(data.operatorExpiryThresholds),
                data.enableExpiryEmailReminders ? 1 : 0, JSON.stringify(data.expiryReminderRecipients), data.expiryReminderFrequency,
                data.expiryReminderSendTime, existing.id
            ]);
        } else {
            await dbTenant(`
                INSERT INTO \`notification_settings\` (
                    sendAssignmentToCustomer, sendAssignmentToOwner, sendAssignmentToThirdParty,
                    sendTimesheetToCustomer, sendInvoiceToCustomer, attachTimesheetWithInvoice,
                    enableExpiryNotifications, vehicleExpiryThresholds, operatorExpiryThresholds,
                    enableExpiryEmailReminders, expiryReminderRecipients, expiryReminderFrequency,
                    expiryReminderSendTime, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                data.sendAssignmentToCustomer ? 1 : 0, data.sendAssignmentToOwner ? 1 : 0, data.sendAssignmentToThirdParty ? 1 : 0,
                data.sendTimesheetToCustomer ? 1 : 0, data.sendInvoiceToCustomer ? 1 : 0, data.attachTimesheetWithInvoice ? 1 : 0,
                data.enableExpiryNotifications ? 1 : 0, JSON.stringify(data.vehicleExpiryThresholds), JSON.stringify(data.operatorExpiryThresholds),
                data.enableExpiryEmailReminders ? 1 : 0, JSON.stringify(data.expiryReminderRecipients), data.expiryReminderFrequency,
                data.expiryReminderSendTime
            ]);
        }

        const [updRows] = await dbTenant("SELECT * FROM `notification_settings` LIMIT 1");
        await logActivity("SETTINGS", 0, "UPDATE", "Notification settings updated");
        return NextResponse.json(transformRow(updRows[0], true));
    } catch (error) {
        console.error("Error saving notification settings:", error);
        if (error instanceof z.ZodError) return NextResponse.json({ message: "Invalid input", errors: error.errors }, { status: 400 });
        return NextResponse.json({ message: "Error saving settings", error: String(error) }, { status: 500 });
    }
}
