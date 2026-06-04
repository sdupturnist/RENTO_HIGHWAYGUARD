import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { readCronJobs } from "@/app/lib/cron-v2/jobs-store";
import { readCronState } from "@/app/lib/cron-v2/state-store";

export async function GET(req) {
    try {
        const authHeader = req.headers.get("authorization");
        const secret = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

        if (!secret || secret !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get DB settings
        let s = await db.queryOne("SELECT * FROM `cron_settings` WHERE id = 1");
        if (!s) {
            await db("INSERT IGNORE INTO `cron_settings` (id) VALUES (1)");
            s = await db.queryOne("SELECT * FROM `cron_settings` WHERE id = 1");
        }

        const [jobs, cronState] = await Promise.all([
            readCronJobs().catch(() => []),
            readCronState().catch(() => null),
        ]);

        return NextResponse.json({
            cronSettings: {
                isEnabled: !!s.is_enabled,
                timezone: s.timezone || "UTC",
                frequencyMinutes: Number(s.frequency_minutes || 1),
            },
            jobs,
            state: cronState,
        });
    } catch (error) {
        console.error("Cron sync API error:", error);
        return NextResponse.json({ error: "Sync failed" }, { status: 500 });
    }
}
