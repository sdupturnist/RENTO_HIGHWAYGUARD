import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { writeCronState } from "@/app/lib/cron-v2/state-store";
import { logActivity } from "@/app/lib/logger";

export async function POST() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Write the manual trigger request flag to state.json
        await writeCronState({
            manualTriggerRequested: true,
            manualTriggerSource: "manual"
        });

        await logActivity("CRON", 0, "MANUAL_RUN", "Cron scheduler triggered manually");
        return NextResponse.json({ success: true, result: { executed: false, queued: true } });
    } catch (error) {
        console.error("Manual cron run error:", error);
        return NextResponse.json({ error: "Manual run failed." }, { status: 500 });
    }
}
