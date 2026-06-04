/**
 * Cron-v2 job registry, persisted at `<masterFolder>/cron_job_logs/jobs.json`.
 *
 * Each entry is the per-job configuration the engine needs (frequency, retry
 * policy, timeout, etc.). The runtime executor for each job is registered
 * separately in `cron-v2/jobs/registry.js` — that's a code-time mapping
 * keyed on `jobKey`. This file only stores the *configuration*.
 *
 * If the file doesn't exist on first read, it is seeded from `DEFAULT_JOBS`
 * which mirrors what the previous DB seed produced. This keeps a fresh
 * deployment working with zero manual setup.
 */

import fs from "fs/promises";
import path from "path";
import { masterCronJobsFile } from "@/app/lib/log-paths";
import { CRON_JOB_KEYS } from "@/app/lib/cron-v2/jobs/registry";

const DEFAULT_JOBS = [
    {
        jobKey: CRON_JOB_KEYS.DAILY_TIME_LOGS,
        name: "Daily Time Log Generation",
        description: "Generate per-day time-log rows for active assignment blocks across all tenants.",
        isEnabled: true,
        frequencyMinutes: 1440,
        startMinuteOfDay: 0,
        maxRetries: 1,
        retryBackoffSeconds: 60,
        runOnMissedWindows: true,
        timeoutSeconds: 300,
    },
    {
        jobKey: CRON_JOB_KEYS.ASSIGNMENT_AUTO_COMPLETE,
        name: "Assignment Auto Complete",
        description: "Mark assignments whose endDate has passed as COMPLETED.",
        isEnabled: true,
        frequencyMinutes: 60,
        startMinuteOfDay: 0,
        maxRetries: 1,
        retryBackoffSeconds: 30,
        runOnMissedWindows: false,
        timeoutSeconds: 120,
    },
    {
        jobKey: CRON_JOB_KEYS.EXPIRY_EMAIL_REMINDERS,
        name: "Expiry Email Reminders",
        description: "Send expiry reminder emails for vehicle / operator documents.",
        isEnabled: true,
        frequencyMinutes: 1440,
        startMinuteOfDay: 60, // 01:00 in scheduler's configured timezone
        maxRetries: 0,
        retryBackoffSeconds: 0,
        runOnMissedWindows: true,
        timeoutSeconds: 300,
    },
];

function normalizeJob(raw, fallbackKey) {
    if (!raw || typeof raw !== "object") return null;
    const jobKey = String(raw.jobKey || fallbackKey || "").trim();
    if (!jobKey) return null;
    const num = (value, def, min, max) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return def;
        if (min !== undefined && n < min) return min;
        if (max !== undefined && n > max) return max;
        return Math.floor(n);
    };
    return {
        jobKey,
        name: String(raw.name || jobKey),
        description: typeof raw.description === "string" ? raw.description : null,
        isEnabled: Boolean(raw.isEnabled ?? true),
        frequencyMinutes: num(raw.frequencyMinutes, 1440, 1),
        startMinuteOfDay: num(raw.startMinuteOfDay, 0, 0, 1439),
        maxRetries: num(raw.maxRetries, 0, 0),
        retryBackoffSeconds: num(raw.retryBackoffSeconds, 60, 0),
        runOnMissedWindows: Boolean(raw.runOnMissedWindows ?? true),
        timeoutSeconds: num(raw.timeoutSeconds, 300, 1),
        updatedAt: raw.updatedAt || null,
    };
}

async function writeJobsFile(jobs) {
    const filePath = masterCronJobsFile();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(jobs, null, 2), { mode: 0o600 });
    await fs.rename(tmp, filePath);
}

export async function readCronJobs() {
    const filePath = masterCronJobsFile();
    try {
        const raw = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((job) => normalizeJob(job)).filter(Boolean);
    } catch (err) {
        if (err?.code === "ENOENT") {
            // First-run seed: write the defaults so subsequent reads are fast
            // and the master UI sees a populated registry.
            const seeded = DEFAULT_JOBS.map((job) => ({
                ...job,
                updatedAt: new Date().toISOString(),
            }));
            await writeJobsFile(seeded);
            return seeded.map((job) => normalizeJob(job)).filter(Boolean);
        }
        console.error("[cron-jobs] failed to read jobs.json:", err?.message || err);
        return [];
    }
}

export async function readEnabledCronJobs() {
    const all = await readCronJobs();
    return all.filter((job) => job.isEnabled);
}

export async function findCronJob(jobKey) {
    const all = await readCronJobs();
    return all.find((job) => job.jobKey === jobKey) || null;
}

/**
 * Update a single job's config. Returns the updated job, or null if not found.
 */
export async function updateCronJob(jobKey, patch) {
    const all = await readCronJobs();
    const idx = all.findIndex((job) => job.jobKey === jobKey);
    if (idx < 0) return null;

    const merged = normalizeJob({
        ...all[idx],
        ...patch,
        updatedAt: new Date().toISOString(),
    });
    all[idx] = merged;
    await writeJobsFile(all);
    return merged;
}

export async function countEnabledCronJobs() {
    const all = await readCronJobs();
    return all.filter((j) => j.isEnabled).length;
}
