import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { readCronJobs } from "@/app/lib/cron-v2/jobs-store";

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const jobs = await readCronJobs().catch(() => []);
        return NextResponse.json({ jobs });
    } catch (error) {
        console.error("Cron jobs fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch cron jobs." }, { status: 500 });
    }
}
