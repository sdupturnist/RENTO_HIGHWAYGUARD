/**
 * File-based distributed lock used by the cron-v2 engine.
 *
 * Replaces the previous MySQL `GET_LOCK()` approach. Works correctly when all
 * Node instances share the underlying filesystem (NFS / EFS / single host).
 * On serverless or multi-host without shared storage the cron should not be
 * used at all — the scheduler relies on a single-runner-at-a-time invariant.
 *
 * Algorithm:
 *   1. Try `fs.writeFile(path, meta, { flag: "wx" })` — atomic create-if-absent.
 *   2. If EEXIST, read the existing lock and check `acquiredAt`. If older than
 *      STALE_LOCK_MS (default 30 minutes — well above any legitimate cron
 *      cycle), unlink it and try once more.
 *   3. On exit, unlink the lock file.
 *
 * This is a *cooperative* lock — a process that hard-crashes leaves the file
 * behind, hence the staleness sweep on the next attempt.
 */

import fs from "fs/promises";
import path from "path";

const STALE_LOCK_MS = Math.max(60_000, Number(process.env.MASTER_CRON_LOCK_STALE_MS || 30 * 60 * 1000));

function buildMeta() {
    return {
        pid: process.pid,
        host: process.env.HOSTNAME || process.env.COMPUTERNAME || "unknown-host",
        acquiredAt: new Date().toISOString(),
    };
}

async function tryCreateLockFile(lockPath, meta) {
    await fs.mkdir(path.dirname(lockPath), { recursive: true });
    try {
        await fs.writeFile(lockPath, JSON.stringify(meta), { flag: "wx", mode: 0o600 });
        return true;
    } catch (err) {
        if (err?.code === "EEXIST") return false;
        throw err;
    }
}

async function isLockStale(lockPath) {
    try {
        const raw = await fs.readFile(lockPath, "utf8");
        const meta = JSON.parse(raw);
        const acquiredAt = new Date(meta?.acquiredAt || 0).getTime();
        if (!acquiredAt) return true;
        return Date.now() - acquiredAt > STALE_LOCK_MS;
    } catch (err) {
        if (err?.code === "ENOENT") return false;
        // If the file is unreadable / corrupt, consider it stale so we can move on.
        return true;
    }
}

export async function acquireFileLock(lockPath) {
    const meta = buildMeta();

    if (await tryCreateLockFile(lockPath, meta)) {
        return { acquired: true, lockPath };
    }

    if (await isLockStale(lockPath)) {
        await fs.unlink(lockPath).catch(() => { });
        if (await tryCreateLockFile(lockPath, meta)) {
            return { acquired: true, lockPath, recoveredFromStale: true };
        }
    }

    return { acquired: false };
}

export async function releaseFileLock(lockPath) {
    if (!lockPath) return;
    await fs.unlink(lockPath).catch(() => { });
}

/**
 * Convenience wrapper: acquire, run, release. If the lock can't be acquired
 * the callback is skipped and `{ acquired: false, skipped: true }` is returned.
 */
export async function withFileLock(lockPath, callback) {
    const lock = await acquireFileLock(lockPath);
    if (!lock.acquired) {
        return { acquired: false, skipped: true };
    }
    try {
        const result = await callback();
        return { acquired: true, skipped: false, result };
    } finally {
        await releaseFileLock(lockPath);
    }
}
