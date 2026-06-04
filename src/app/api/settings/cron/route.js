import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { readCronState } from "@/app/lib/cron-v2/state-store";
import { countEnabledCronJobs } from "@/app/lib/cron-v2/jobs-store";
import { logActivity } from "@/app/lib/logger";

function getSupportedTimezones() {
    try { return Intl.supportedValuesOf("timeZone"); } catch { return ["UTC"]; }
}

function normalizeTimezone(value) {
    const tz = String(value || "").trim();
    if (!tz) return "UTC";
    return getSupportedTimezones().includes(tz) ? tz : "UTC";
}

async function getOrCreateSettings() {
    let s = await db.queryOne("SELECT * FROM `cron_settings` WHERE id = 1");
    if (!s) {
        await db("INSERT IGNORE INTO `cron_settings` (id) VALUES (1)");
        s = await db.queryOne("SELECT * FROM `cron_settings` WHERE id = 1");
    }
    return s;
}

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const s = await getOrCreateSettings();
        const [cronState, enabledJobs] = await Promise.all([
            readCronState().catch(() => null),
            countEnabledCronJobs().catch(() => 0),
        ]);

        return NextResponse.json({
            cronSettings: {
                isEnabled: !!s.is_enabled,
                timezone: s.timezone || "UTC",
                frequencyMinutes: Number(s.frequency_minutes || 1),
            },
            v2: {
                enabled: true,
                enabledJobs,
                state: cronState,
            },
        });
    } catch (error) {
        console.error("Error fetching cron settings:", error);
        return NextResponse.json({ error: "Failed to fetch cron settings" }, { status: 500 });
    }
}

export async function PUT(req) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const timezone = normalizeTimezone(body.timezone || "UTC");
        const frequencyMinutes = Math.max(1, parseInt(body.frequencyMinutes || 1, 10));
        const isEnabled = typeof body.isEnabled === "boolean" ? body.isEnabled : true;

        await db(`
            INSERT INTO \`cron_settings\` (id, is_enabled, timezone, frequency_minutes)
            VALUES (1, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                is_enabled = VALUES(is_enabled),
                timezone = VALUES(timezone),
                frequency_minutes = VALUES(frequency_minutes),
                updated_at = NOW()
        `, [isEnabled ? 1 : 0, timezone, frequencyMinutes]);

        const s = await db.queryOne("SELECT * FROM `cron_settings` WHERE id = 1");
        await logActivity("SETTINGS", 0, "UPDATE", "Cron settings updated");
        return NextResponse.json({
            success: true,
            cronSettings: {
                isEnabled: !!s.is_enabled,
                timezone: s.timezone || "UTC",
                frequencyMinutes: Number(s.frequency_minutes || 1),
            },
        });
    } catch (error) {
        console.error("Error updating cron settings:", error);
        return NextResponse.json({ error: "Failed to update cron settings" }, { status: 500 });
    }
}
