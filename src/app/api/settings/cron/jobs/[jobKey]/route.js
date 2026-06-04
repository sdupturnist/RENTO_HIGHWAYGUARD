import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { findCronJob, updateCronJob } from "@/app/lib/cron-v2/jobs-store";
import { logActivity } from "@/app/lib/logger";

export async function PUT(req, { params }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { jobKey } = await params;
        if (!jobKey) return NextResponse.json({ error: "Missing job key." }, { status: 400 });

        const body = await req.json();
        const patch = {};

        if (typeof body.isEnabled === "boolean") patch.isEnabled = body.isEnabled;
        if (body.frequencyMinutes !== undefined) {
            const v = Number(body.frequencyMinutes);
            if (!Number.isFinite(v) || v < 1) return NextResponse.json({ error: "frequencyMinutes must be >= 1." }, { status: 400 });
            patch.frequencyMinutes = Math.floor(v);
        }
        if (body.startMinuteOfDay !== undefined) {
            const v = Number(body.startMinuteOfDay);
            if (!Number.isFinite(v) || v < 0 || v > 1439) return NextResponse.json({ error: "startMinuteOfDay must be 0-1439." }, { status: 400 });
            patch.startMinuteOfDay = Math.floor(v);
        }
        if (body.maxRetries !== undefined) {
            const v = Number(body.maxRetries);
            if (!Number.isFinite(v) || v < 0) return NextResponse.json({ error: "maxRetries must be >= 0." }, { status: 400 });
            patch.maxRetries = Math.floor(v);
        }
        if (body.retryBackoffSeconds !== undefined) {
            const v = Number(body.retryBackoffSeconds);
            if (!Number.isFinite(v) || v < 0) return NextResponse.json({ error: "retryBackoffSeconds must be >= 0." }, { status: 400 });
            patch.retryBackoffSeconds = Math.floor(v);
        }
        if (body.timeoutSeconds !== undefined) {
            const v = Number(body.timeoutSeconds);
            if (!Number.isFinite(v) || v < 1) return NextResponse.json({ error: "timeoutSeconds must be >= 1." }, { status: 400 });
            patch.timeoutSeconds = Math.floor(v);
        }
        if (typeof body.runOnMissedWindows === "boolean") patch.runOnMissedWindows = body.runOnMissedWindows;

        if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });

        const existing = await findCronJob(jobKey);
        if (!existing) return NextResponse.json({ error: "Cron job not found." }, { status: 404 });

        const updated = await updateCronJob(jobKey, patch);
        await logActivity("SETTINGS", 0, "UPDATE", `Cron job updated: ${jobKey}`);
        return NextResponse.json({ success: true, job: updated });
    } catch (error) {
        console.error("Cron job update error:", error);
        return NextResponse.json({ error: "Failed to update cron job." }, { status: 500 });
    }
}
