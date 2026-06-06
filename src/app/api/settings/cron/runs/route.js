import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { readLogPage } from "@/app/lib/audit-reader";
import { masterCronRunsDir } from "@/app/lib/log-paths";

export async function GET(req) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, Number(searchParams.get("page") || 1));
        const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
        const status = (searchParams.get("status") || "").trim();
        const jobKey = (searchParams.get("jobKey") || "").trim();

        const pageData = await readLogPage({
            directory: masterCronRunsDir(),
            limit: 5000,
            lookbackDays: 90,
        });

        const runMap = new Map();
        // Reverse back to chronological order (oldest first) so we construct state sequentially
        const entries = (pageData.entries || []).slice().reverse();

        for (const entry of entries) {
            const cronRunId = entry.cronRunId ? String(entry.cronRunId) : "";
            if (!cronRunId) continue;

            let run = runMap.get(cronRunId);
            if (!run) {
                run = {
                    id: cronRunId,
                    runKey: entry.runKey || null,
                    triggerSource: entry.triggerSource || "internal",
                    status: "started",
                    startedAt: entry.startedAt || entry.ts,
                    finishedAt: null,
                    hostInstance: entry.hostInstance || null,
                    jobRuns: [],
                };
                runMap.set(cronRunId, run);
            }

            if (entry.action === "CRON_V2_STARTED") {
                run.runKey = entry.runKey || run.runKey;
                run.triggerSource = entry.triggerSource || run.triggerSource;
                run.startedAt = entry.startedAt || entry.ts || run.startedAt;
                run.hostInstance = entry.hostInstance || run.hostInstance;
            }
            if (entry.action === "CRON_V2_FINISHED" || entry.action === "CRON_V2_FINISHED_PARTIAL") {
                run.status = entry.status || (entry.action === "CRON_V2_FINISHED_PARTIAL" ? "partial" : "success");
                run.finishedAt = entry.finishedAt || entry.ts || null;
                run.totalJobWindows = entry.totalJobWindows ?? run.totalJobWindows ?? 0;
                run.failedTenantRuns = entry.failedTenantRuns ?? run.failedTenantRuns ?? 0;
            }
            if (entry.jobRunId && entry.jobKey) {
                const existingIndex = run.jobRuns.findIndex(jr => String(jr.id) === String(entry.jobRunId));
                let existingJobRun = existingIndex !== -1 ? run.jobRuns[existingIndex] : {
                    id: String(entry.jobRunId),
                    cronRunId,
                    jobKey: entry.jobKey,
                    status: "started",
                    windowStart: null,
                    windowEnd: null,
                    successCount: 0,
                    failedCount: 0,
                };

                if (entry.action === "CRON_JOB_STARTED") {
                    existingJobRun.status = "started";
                } else if (entry.action === "CRON_JOB_FINISHED" || entry.action === "CRON_JOB_FAILED") {
                    existingJobRun.status = entry.status || (entry.action === "CRON_JOB_FINISHED" ? "success" : "failed");
                }

                if (entry.windowStart) existingJobRun.windowStart = entry.windowStart;
                if (entry.windowEnd) existingJobRun.windowEnd = entry.windowEnd;
                if (entry.successCount !== undefined && entry.successCount !== null) {
                    existingJobRun.successCount = Number(entry.successCount);
                }
                if (entry.failedCount !== undefined && entry.failedCount !== null) {
                    existingJobRun.failedCount = Number(entry.failedCount);
                }

                if (existingIndex === -1) {
                    run.jobRuns.push(existingJobRun);
                } else {
                    run.jobRuns[existingIndex] = existingJobRun;
                }
            }
        }

        let runs = Array.from(runMap.values());
        if (status) runs = runs.filter(r => String(r.status || "").toLowerCase() === status.toLowerCase());
        if (jobKey) runs = runs.map(r => ({ ...r, jobRuns: r.jobRuns.filter(jr => jr.jobKey === jobKey) })).filter(r => r.jobRuns.length > 0);
        runs.sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime());

        const total = runs.length;
        return NextResponse.json({
            runs: runs.slice((page - 1) * limit, page * limit),
            pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        });
    } catch (error) {
        console.error("Cron runs fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch cron runs." }, { status: 500 });
    }
}
