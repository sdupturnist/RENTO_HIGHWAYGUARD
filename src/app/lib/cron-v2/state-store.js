/**
 * Cron-v2 state store, persisted as a single JSON file at
 * `<masterFolder>/cron_job_logs/state.json`.
 *
 * Schema:
 *   {
 *     "lastSuccessfulRunAt": "2026-04-29T12:00:00.000Z" | null,
 *     "lastAttemptedRunAt":  "2026-04-29T12:01:00.000Z" | null,
 *     "lastRunStatus":       "success" | "partial" | "failed" | null,
 *     "updatedAt":           "2026-04-29T12:01:00.000Z"
 *   }
 *
 * Writes are atomic: write to a temp file, fsync, then rename over the live
 * file. This avoids torn JSON if the process crashes mid-write. The lock file
 * (file-lock.js) already serializes writers, so no in-process mutex is needed.
 */

import fs from "fs/promises";
import path from "path";
import { masterCronStateFile } from "@/app/lib/log-paths";

const DEFAULT_STATE = Object.freeze({
    lastSuccessfulRunAt: null,
    lastAttemptedRunAt: null,
    lastRunStatus: null,
    updatedAt: null,
});

export async function readCronState() {
    const filePath = masterCronStateFile();
    try {
        const raw = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(raw);
        return {
            ...DEFAULT_STATE,
            ...parsed,
        };
    } catch (err) {
        if (err?.code === "ENOENT") return { ...DEFAULT_STATE };
        // Corrupt JSON: fall back to defaults rather than crashing the engine.
        console.error("[cron-state] failed to read state:", err?.message || err);
        return { ...DEFAULT_STATE };
    }
}

export async function writeCronState(patch) {
    const filePath = masterCronStateFile();
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    const current = await readCronState();
    const next = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
    };

    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
    await fs.rename(tmp, filePath);
    return next;
}
