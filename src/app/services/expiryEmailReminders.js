import { getClientDb } from "@/app/lib/db";
import { getExpiryItemsForTenant } from "@/app/lib/services/expiry-service";
import { logActivity } from "@/app/lib/logger";
import nodemailer from "nodemailer";
import crypto from "crypto";

export async function processExpiryEmailReminders({ tenant, windowStart }) {
    const tenantDb = getClientDb(tenant.subdomain);
    const runIdStr = windowStart.toISOString();

    // 2. Gatekeep by Tenant Settings
    const settings = await tenantDb.notificationSettings.findFirst();
    if (!settings || !settings.enableExpiryEmailReminders) {
        return {
            processed: false,
            created: 0,
            skipped: 0,
            reason: "Expiry email reminders disabled in tenant settings",
        };
    }

    let recipients = Array.isArray(settings.expiryReminderRecipients)
        ? settings.expiryReminderRecipients.filter(r => r && typeof r === 'string' && r.trim().length > 0)
        : [];

    // Cap recipients to prevent spam/abuse
    if (recipients.length > 5) {
        recipients = recipients.slice(0, 5);
    }

    if (recipients.length === 0) {
        return {
            processed: false,
            created: 0,
            skipped: 0,
            reason: "No valid recipients configured",
        };
    }

    // 2.5 Gatekeep by Frequency
    if (settings.expiryReminderFrequency === "WEEKLY") {
        const dayOfWeek = windowStart.getDay();
        // 1 = Monday. Only send weekly reminders on Mondays.
        if (dayOfWeek !== 1) {
            return {
                processed: false,
                created: 0,
                skipped: 1,
                reason: "Job is set to WEEKLY but today is not Monday",
            };
        }
    }

    // 3. Deduplicate via ExpiryReminderLog
    // Ensure we don't send emails twice for the same window configuration
    const existingLog = await tenantDb.expiryReminderLog.findFirst({
        where: { runId: runIdStr, tenantSubdomain: tenant.subdomain }
    });

    if (existingLog && (existingLog.status === "SENT" || existingLog.status === "SKIPPED_EMPTY")) {
        return {
            processed: false,
            created: 0,
            skipped: 1,
            reason: `Already processed window ${runIdStr}`,
        };
    }

    // 4. Fetch the data payload from our centralized service
    const rawItems = await getExpiryItemsForTenant(tenantDb, settings);

    // Only care about things that are urgent or expired (within horizon)
    // getExpiryItemsForTenant already applies the threshold filtering
    const items = rawItems.filter(i => ["expired", "urgent", "upcoming", "due-in-7", "due-in-14", "due-in-30", "due-in-60", "due-in-180"].some(u => i.urgency.includes(u) || i.urgency === u));

    if (items.length === 0) {
        // Log that we checked, but there were zero items. This prevents re-checks in same window.
        await tenantDb.expiryReminderLog.create({
            data: {
                runId: runIdStr,
                tenantSubdomain: tenant.subdomain,
                recipient: "none",
                itemCount: 0,
                status: "SKIPPED_EMPTY",
                error: null
            }
        });
        return {
            processed: true,
            created: 0,
            skipped: 1,
            reason: "No expiry items met the threshold criteria",
        };
    }

    const expired = items.filter(i => i.daysRemaining < 0);
    const urgent = items.filter(i => i.daysRemaining >= 0 && i.daysRemaining <= 7);
    const upcoming = items.filter(i => i.daysRemaining > 7);

    // 5. Connect to SMTP (Fallback to Master DB SMTP if tenant fails / not supported yet, but standard approach requires reading tenant SMTP)
    // We will attempt to use the tenant's SMTP settings. If none exist, we will fail cleanly.
    let smtpSettings = await tenantDb.sMTPSettings.findFirst();
    if (!smtpSettings) {
        // Typically multitenant apps might fallback to a master SMTP. For now, require tenant SMTP.
        return {
            processed: false,
            created: 0,
            skipped: 1,
            reason: "No SMTP configuration found for this tenant",
        };
    }

    // Helper decrypt block for SMTP if you use enc: protocol
    let smtpPassword = smtpSettings.password;
    if (smtpPassword?.startsWith("enc:")) {
        function decrypt(value) {
            const ENC_PREFIX = "enc:";
            const buf = Buffer.from(value.slice(ENC_PREFIX.length), "base64");
            const iv = buf.subarray(0, 12);
            const tag = buf.subarray(12, 28);
            const data = buf.subarray(28);
            const key = crypto.createHash("sha256").update(process.env.SMTP_SECRET_KEY).digest();
            const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
            decipher.setAuthTag(tag);
            return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
        }
        smtpPassword = decrypt(smtpPassword);
    }

    const transporter = nodemailer.createTransport({
        host: smtpSettings.host,
        port: Number(smtpSettings.port),
        secure: smtpSettings.secure,
        auth: {
            user: smtpSettings.username,
            pass: smtpPassword,
        },
    });

    // 6. Generate HTML
    const branding = await tenantDb.branding_settings.findFirst();
    const appName = branding?.appName || tenant.companyName || "Rent ERP";
    const primaryColor = branding?.primaryColor || "#4f46e5";

    const generateTableRows = (list) => {
        if (!list || list.length === 0) return `<tr><td colspan="4" style="padding:12px;text-align:center;color:#6b7280;background-color:#f9fafb;">No items in this category.</td></tr>`;
        return list.map(item => `
            <tr>
                <td style="padding:12px;border-bottom:1px solid #e5e7eb;"><strong>${item.entityName}</strong></td>
                <td style="padding:12px;border-bottom:1px solid #e5e7eb;">${item.type}</td>
                <td style="padding:12px;border-bottom:1px solid #e5e7eb;">${item.reference}</td>
                <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:${item.daysRemaining < 0 ? '#dc2626' : (item.daysRemaining <= 7 ? '#d97706' : '#4b5563')};font-weight:bold;">
                    ${item.daysRemaining < 0 ? 'Expired' : (item.daysRemaining === 0 ? 'Today' : `In ${item.daysRemaining} days`)}
                </td>
            </tr>
        `).join('');
    };

    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="background-color: ${primaryColor}; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">${appName}</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0;">Automated Expiry Alert</p>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p>You have <strong>${items.length}</strong> items that require your attention regarding document and validity expirations.</p>
            
            ${expired.length > 0 ? `
                <h3 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 4px; margin-top: 24px;">Expired Items (${expired.length})</h3>
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="padding: 10px; border-bottom: 1px solid #e5e7eb;">Entity</th>
                            <th style="padding: 10px; border-bottom: 1px solid #e5e7eb;">Type</th>
                            <th style="padding: 10px; border-bottom: 1px solid #e5e7eb;">Reference</th>
                            <th style="padding: 10px; border-bottom: 1px solid #e5e7eb;">Status</th>
                        </tr>
                    </thead>
                    <tbody>${generateTableRows(expired)}</tbody>
                </table>
            ` : ''}

            ${urgent.length > 0 ? `
                <h3 style="color: #d97706; border-bottom: 2px solid #d97706; padding-bottom: 4px; margin-top: 24px;">Urgent Items [≤ 7 days] (${urgent.length})</h3>
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="padding: 10px; border-bottom: 1px solid #e5e7eb;">Entity</th>
                            <th style="padding: 10px; border-bottom: 1px solid #e5e7eb;">Type</th>
                            <th style="padding: 10px; border-bottom: 1px solid #e5e7eb;">Reference</th>
                            <th style="padding: 10px; border-bottom: 1px solid #e5e7eb;">Status</th>
                        </tr>
                    </thead>
                    <tbody>${generateTableRows(urgent)}</tbody>
                </table>
            ` : ''}

            ${upcoming.length > 0 ? `
                <h3 style="color: #4b5563; border-bottom: 2px solid #4b5563; padding-bottom: 4px; margin-top: 24px;">Upcoming Expiries (${upcoming.length})</h3>
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="padding: 10px; border-bottom: 1px solid #e5e7eb;">Entity</th>
                            <th style="padding: 10px; border-bottom: 1px solid #e5e7eb;">Type</th>
                            <th style="padding: 10px; border-bottom: 1px solid #e5e7eb;">Reference</th>
                            <th style="padding: 10px; border-bottom: 1px solid #e5e7eb;">Status</th>
                        </tr>
                    </thead>
                    <tbody>${generateTableRows(upcoming)}</tbody>
                </table>
            ` : ''}
            
            <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px;">
                <p>This is an automated notification from ${appName}. Please log in to your dashboard to take action.</p>
            </div>
        </div>
    </div>`;

    // 7. Send the Email
    try {
        await transporter.sendMail({
            from: `"${smtpSettings.fromName}" <${smtpSettings.fromEmail}>`,
            to: recipients.join(", "),
            subject: `[${appName}] Action Required: ${items.length} Expiry Alerts`,
            html: htmlContent,
        });

        // Track successful send
        await tenantDb.expiryReminderLog.create({
            data: {
                runId: runIdStr,
                tenantSubdomain: tenant.subdomain,
                recipient: recipients.join(","),
                itemCount: items.length,
                status: "SENT",
                error: null
            }
        });

        await tenantDb.notificationSettings.update({
            where: { id: settings.id },
            data: { lastExpiryReminderSentAt: new Date() }
        });

        await logActivity(tenant.subdomain, {
            entityType: "SYSTEM",
            entityId: 0,
            action: "EXPIRY_REMINDER_SENT",
            description: `Sent ${items.length} expiry alerts to ${recipients.length} recipients.`,
            metadata: { recipients, itemCount: items.length },
        });

        return {
            processed: true,
            created: 1,
            skipped: 0,
            reason: `Sent ${items.length} items to ${recipients.length} recipients`,
        };

    } catch (e) {
        console.error("Failed to send expiry email for tenant:", tenant.subdomain, e);

        // Track failure log
        await tenantDb.expiryReminderLog.create({
            data: {
                runId: runIdStr,
                tenantSubdomain: tenant.subdomain,
                recipient: recipients.join(","),
                itemCount: items.length,
                status: "FAILED",
                error: String(e.message).slice(0, 500)
            }
        });

        await logActivity(tenant.subdomain, {
            entityType: "SYSTEM",
            entityId: 0,
            action: "EXPIRY_REMINDER_FAILED",
            description: `Failed to send expiry alerts. Reason: ${String(e.message).slice(0, 200)}`,
            metadata: { recipients, itemCount: items.length },
        });

        throw e; // Rethrow to let the Cron engine handle retry/backoff if it wants to
    }
}
