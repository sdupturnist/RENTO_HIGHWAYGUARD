/**
 * Cron-v2 engine — file-backed.
 *
 * Replaces the previous CMCronRun / CMCronJobRun / CMCronTenantRun /
 * CMCronState / CMCronJob DB persistence. The engine now stores all of its
 * runtime state on disk:
 *
 *   - jobs.json                       — registered job configs
 *   - state.json                      — last attempted/successful run + status
 *   - .lock                           — single-runner-at-a-time flock
 *   - .runs-this-minute/<runKey>.lock — "already ran this minute" guard
 *   - .job-windows/<jobKey>-<iso>.lock — per-job-window idempotency
 *   - runs/<YYYY-MM-DD>.jsonl         — append-only run history
 *
 * Tenant lookup still uses `masterDb.tenant.findMany()` because the tenants
 * table is *configuration*, not a log. Only the log/state/history tables are
 * file-backed.
 *
 * IDs (cronRunId / jobRunId) are now synthetic strings derived from ISO
 * timestamps so every emitted log entry can still be grouped by run/job.
 */

import fs from "fs/promises";
import path from "path";
import { withMasterCronLock } from "@/app/lib/cron-v2/lock";
import { getMinuteWindowBoundary } from "@/app/lib/cron-v2/windows";
import { cronJobRegistry } from "@/app/lib/cron-v2/jobs/registry";
import { appendCronLog } from "@/app/lib/cron-log";
import { readCronState, writeCronState } from "@/app/lib/cron-v2/state-store";
import { readEnabledCronJobs } from "@/app/lib/cron-v2/jobs-store";
import {
    masterCronMinuteMarkerDir,
    masterCronJobWindowMarkerDir,
} from "@/app/lib/log-paths";

const MAX_CATCHUP_WINDOWS = Math.max(1, Number(process.env.MASTER_CRON_V2_MAX_CATCHUP_WINDOWS || 1440));
const MARKER_TTL_MS = Math.max(60_000, Number(process.env.MASTER_CRON_MARKER_TTL_MS || 24 * 60 * 60 * 1000));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

const withTimeout = (promise, timeoutMs, timeoutLabel = "Job execution") => {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`${timeoutLabel} timed out after ${Math.ceil(timeoutMs / 1000)}s`)), timeoutMs);
        }),
    ]);
};

function minuteOfDay(date, timezone = "UTC") {
    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
        }).formatToParts(date);
        const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
        const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
        return hour * 60 + minute;
    } catch {
        return date.getHours() * 60 + date.getMinutes();
    }
}

function isJobDueAt(job, date, timezone = "UTC") {
    const frequency = Math.max(1, Number(job.frequencyMinutes || 1440));
    const startMinute = Math.max(0, Math.min(1439, Number(job.startMinuteOfDay || 0)));
    const current = minuteOfDay(date, timezone);
    if (current < startMinute) return false;
    return ((current - startMinute) % frequency) === 0;
}

function buildDueWindows(job, state, nowMinute, timezone = "UTC") {
    const frequency = Math.max(1, Number(job.frequencyMinutes || 1440));
    const runOnMissed = Boolean(job.runOnMissedWindows);
    let cursor = new Date(nowMinute);

    if (runOnMissed && state?.lastSuccessfulRunAt) {
        cursor = getMinuteWindowBoundary(new Date(state.lastSuccessfulRunAt));
        cursor = new Date(cursor.getTime() + 60 * 1000);
    }

    if (cursor > nowMinute) return [];

    const windows = [];
    while (cursor <= nowMinute && windows.length < MAX_CATCHUP_WINDOWS) {
        if (isJobDueAt(job, cursor, timezone)) {
            const windowStart = new Date(cursor);
            const windowEnd = new Date(cursor.getTime() + frequency * 60 * 1000 - 1);
            windows.push({ windowStart, windowEnd });
        }
        cursor = new Date(cursor.getTime() + 60 * 1000);
    }

    return windows;
}

function createRunKey(nowMinute) {
    return `v2:${nowMinute.toISOString()}`;
}

function getHostInstanceLabel() {
    const host = process.env.HOSTNAME || process.env.COMPUTERNAME || "unknown-host";
    return `${host}:${process.pid}`;
}

/* -------------- Idempotency markers (file-based) -------------- */

async function tryClaimMarker(filePath, payload) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    try {
        await fs.writeFile(filePath, JSON.stringify(payload), { flag: "wx", mode: 0o600 });
        return true;
    } catch (err) {
        if (err?.code === "EEXIST") return false;
        throw err;
    }
}

async function sweepStaleMarkers(dir, ttlMs) {
    try {
        const entries = await fs.readdir(dir);
        const cutoff = Date.now() - ttlMs;
        await Promise.all(entries.map(async (name) => {
            const full = path.join(dir, name);
            try {
                const stat = await fs.stat(full);
                if (stat.mtimeMs < cutoff) {
                    await fs.unlink(full).catch(() => { });
                }
            } catch {
                // ignore — file may have been removed concurrently
            }
        }));
    } catch (err) {
        if (err?.code === "ENOENT") return;
        // Don't break the cycle for cleanup errors.
        console.error("[cron-v2] marker sweep failed:", err?.message || err);
    }
}

/* -------------- Job-window execution (per tenant) -------------- */

async function executeJobWindow({ cronRunId, job, windowStart, windowEnd, tenants }) {
    const runner = cronJobRegistry[job.jobKey]?.runForTenant;
    if (!runner) {
        throw new Error(`Cron runner missing for job key: ${job.jobKey}`);
    }

    // Synthetic stable id usable for log-row grouping.
    const jobRunId = `${job.jobKey}:${windowStart.toISOString()}`;

    let successCount = 0;
    let failedCount = 0;
    const maxRetries = Math.max(0, Number(job.maxRetries || 0));
    const retryBackoffMs = Math.max(0, Number(job.retryBackoffSeconds || 0) * 1000);
    const timeoutMs = Math.max(1000, Number(job.timeoutSeconds || 300) * 1000);

    appendCronLog({
        action: "CRON_JOB_STARTED",
        cronRunId,
        jobRunId,
        jobKey: job.jobKey,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        tenantCount: tenants.length,
    }).catch(() => { });

    for (const tenant of tenants) {
        let attempt = 0;
        let ok = false;
        let lastError = null;

        while (attempt <= maxRetries && !ok) {
            attempt += 1;
            try {
                await withTimeout(
                    runner({ tenant, windowStart, windowEnd, now: new Date(), attempt }),
                    timeoutMs,
                    `Cron job "${job.jobKey}" for tenant "${tenant.subdomain}"`,
                );
                ok = true;
            } catch (error) {
                lastError = error;
                if (attempt <= maxRetries && retryBackoffMs > 0) {
                    await sleep(retryBackoffMs);
                }
            }
        }

        // One log line per (job-window, tenant) outcome — replaces the
        // CMCronTenantRun row that used to track this.
        appendCronLog({
            action: ok ? "CRON_TENANT_SUCCESS" : "CRON_TENANT_FAILED",
            cronRunId,
            jobRunId,
            jobKey: job.jobKey,
            tenantId: tenant.id,
            subdomain: tenant.subdomain,
            attempt,
            errorMessage: ok ? null : (lastError?.message || "Unknown tenant cron error").slice(0, 1000),
        }).catch(() => { });

        if (ok) successCount += 1;
        else failedCount += 1;
    }

    const finalStatus = failedCount > 0 ? (successCount > 0 ? "partial" : "failed") : "success";

    appendCronLog({
        action: failedCount > 0 ? "CRON_JOB_FAILED" : "CRON_JOB_FINISHED",
        cronRunId,
        jobRunId,
        jobKey: job.jobKey,
        status: finalStatus,
        processedTenants: tenants.length,
        successCount,
        failedCount,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
    }).catch(() => { });

    return { skipped: false, status: finalStatus, successCount, failedCount, processedTenants: tenants.length };
}

/* -------------- Top-level cycle -------------- */

async function runCycleUnlocked(now = new Date(), options = {}) {
    const timezone = String(options?.timezone || "UTC");

    const state = await readCronState();
    const jobs = await readEnabledCronJobs();

    if (jobs.length === 0) {
        return { executed: false, reason: "no-enabled-jobs" };
    }

    const nowMinute = getMinuteWindowBoundary(now);
    const runKey = createRunKey(nowMinute);

    // Per-minute idempotency marker — replaces the unique constraint on
    // CMCronRun.runKey. EEXIST means another process (or a previous tick of
    // this process) has already started this minute's cycle.
    const minuteMarkerPath = path.join(masterCronMinuteMarkerDir(), `${encodeURIComponent(runKey)}.lock`);
    const claimed = await tryClaimMarker(minuteMarkerPath, {
        runKey,
        host: getHostInstanceLabel(),
        startedAt: new Date().toISOString(),
    });
    if (!claimed) {
        return { executed: false, reason: "already-ran-this-minute" };
    }

    // Synthetic ID used to group all log lines of this cycle.
    const cronRunId = nowMinute.toISOString();

    // Best-effort marker cleanup. Cheap, doesn't block the tick on errors.
    sweepStaleMarkers(masterCronMinuteMarkerDir(), MARKER_TTL_MS).catch(() => { });
    sweepStaleMarkers(masterCronJobWindowMarkerDir(), MARKER_TTL_MS).catch(() => { });

    await writeCronState({ lastAttemptedRunAt: new Date().toISOString() });

    appendCronLog({
        action: "CRON_V2_STARTED",
        cronRunId,
        runKey,
        triggerSource: options?.triggerSource || "internal",
        hostInstance: getHostInstanceLabel(),
        startedAt: new Date().toISOString(),
    }).catch(() => { });

    const tenants = [{ id: 1, subdomain: "standalone" }];

    let totalJobWindows = 0;
    let totalFailedTenantRuns = 0;

    for (const job of jobs) {
        const windows = buildDueWindows(job, state, nowMinute, timezone);
        for (const window of windows) {
            // Per-job-window idempotency — replaces the
            // (jobKey, windowStart) unique constraint on CMCronJobRun.
            const jobMarker = path.join(
                masterCronJobWindowMarkerDir(),
                `${encodeURIComponent(job.jobKey)}__${encodeURIComponent(window.windowStart.toISOString())}.lock`,
            );
            const ok = await tryClaimMarker(jobMarker, {
                jobKey: job.jobKey,
                windowStart: window.windowStart.toISOString(),
                windowEnd: window.windowEnd.toISOString(),
                claimedAt: new Date().toISOString(),
            });
            if (!ok) {
                appendCronLog({
                    action: "CRON_JOB_SKIPPED",
                    cronRunId,
                    jobKey: job.jobKey,
                    reason: "idempotent-duplicate",
                    windowStart: window.windowStart.toISOString(),
                }).catch(() => { });
                continue;
            }

            totalJobWindows += 1;
            const result = await executeJobWindow({
                cronRunId,
                job,
                windowStart: window.windowStart,
                windowEnd: window.windowEnd,
                tenants,
            });

            if (!result.skipped) {
                totalFailedTenantRuns += Number(result.failedCount || 0);
            }
        }
    }

    const finalStatus = totalJobWindows === 0
        ? "success"
        : (totalFailedTenantRuns > 0 ? "partial" : "success");

    await writeCronState({
        lastRunStatus: finalStatus,
        ...(finalStatus === "success" ? { lastSuccessfulRunAt: new Date().toISOString() } : {}),
    });

    appendCronLog({
        action: totalFailedTenantRuns > 0 ? "CRON_V2_FINISHED_PARTIAL" : "CRON_V2_FINISHED",
        cronRunId,
        runKey,
        status: finalStatus,
        totalJobWindows,
        failedTenantRuns: totalFailedTenantRuns,
        finishedAt: new Date().toISOString(),
    }).catch(() => { });

    return {
        executed: true,
        status: finalStatus,
        totalJobWindows,
        failedTenantRuns: totalFailedTenantRuns,
    };
}

export async function runSchedulerV2Cycle(now = new Date()) {
    return runSchedulerV2CycleWithOptions(now, {});
}

export async function runSchedulerV2CycleWithOptions(now = new Date(), options = {}) {
    return withMasterCronLock("master_cron_runner_v2", () => runCycleUnlocked(now, options));
}
