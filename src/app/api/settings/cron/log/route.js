import { NextResponse } from "next/server";
import { appendCronLog } from "@/app/lib/cron-log";
import { writeCronState } from "@/app/lib/cron-v2/state-store";

export async function POST(req) {
    try {
        const authHeader = req.headers.get("authorization");
        const secret = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

        if (!secret || secret !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { logs, stateUpdate } = body || {};

        // 1. Process logs if any
        if (Array.isArray(logs) && logs.length > 0) {
            // Append all logs sequentially/concurrently to the JSONL log file
            await Promise.all(logs.map(log => appendCronLog(log).catch(err => {
                console.error("Failed to append cron log in API route:", err);
            })));
        }

        // 2. Process state update if any
        if (stateUpdate && typeof stateUpdate === "object") {
            await writeCronState(stateUpdate);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Cron logging API error:", error);
        return NextResponse.json({ error: "Logging failed" }, { status: 500 });
    }
}
