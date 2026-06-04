import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { generateDailyTimeLogs } from "@/app/services/timeLogGenerator";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";

export async function POST(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });



        const { date } = await request.json().catch(() => ({}));
        const targetDate = date ? new Date(date) : new Date();
        const result = await generateDailyTimeLogs(targetDate);
        
        await logActivity("ADMIN", 0, "GENERATE_TIME_LOGS", `Auto-log generation run: ${result.created} created, ${result.skipped} skipped`);
        return NextResponse.json({
            success: true,
            message: `Generated ${result.created} logs. Skipped ${result.skipped}.`,
            data: result
        });
    }
    catch (error) {
        console.error("Error running auto-log generation:", error);
        return NextResponse.json({
            success: false,
            message: "Failed to generate logs",
            error: String(error)
        }, { status: 500 });
    }
}
