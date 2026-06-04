/**
 * Atomic JSONL appender for audit / activity / cron logs.
 *
 * All log writers in the app go through `appendLogLine`. The function:
 *  - Ensures the parent directory exists.
 *  - Trims the JSON serialization to <4 KB so the underlying POSIX
 *    `appendFile` (O_APPEND) stays atomic per-line. Larger payloads can
 *    interleave under concurrent writers, which corrupts JSONL.
 *  - Never throws — failures are logged to console only, because audit
 *    failure must never break the user's primary action (matches the
 *    existing fire-and-forget semantics of `dbQuery.activityLog.create`).
 *
 * MULTI-INSTANCE NOTE: `fs.appendFile` is line-atomic on POSIX up to
 * PIPE_BUF (4 KB) within a single host. For multi-host deploys (e.g.
 * NFS / EFS) ordering and atomicity depend on the underlying filesystem.
 * For serverless deployments, file logging should not be used.
 */

import fs from "fs/promises";
import path from "path";

const MAX_LINE_BYTES = 4000;

function safeStringify(payload) {
    try {
        return JSON.stringify(payload);
    } catch (err) {
        try {
            // Last-ditch fallback: drop circular refs by replacing them.
            return JSON.stringify(payload, makeReplacer());
        } catch {
            return JSON.stringify({
                ts: new Date().toISOString(),
                action: "LOG_SERIALIZE_FAILED",
                description: String(err?.message || err),
            });
        }
    }
}

function makeReplacer() {
    const seen = new WeakSet();
    return (_key, value) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) return "[Circular]";
            seen.add(value);
        }
        return value;
    };
}

function trimToBudget(line) {
    if (Buffer.byteLength(line, "utf8") <= MAX_LINE_BYTES) return line;

    // Try to drop heavy fields first (`metadata`, `description`) before resorting
    // to a hard truncation, so the entry remains valid JSON.
    let parsed;
    try {
        parsed = JSON.parse(line);
    } catch {
        return line.slice(0, MAX_LINE_BYTES - 16) + "...TRUNCATED";
    }

    const reduced = { ...parsed };
    if (reduced.metadata) {
        reduced.metadata = { __dropped: true, reason: "exceeded-line-budget" };
    }
    if (typeof reduced.description === "string" && reduced.description.length > 200) {
        reduced.description = reduced.description.slice(0, 200) + "…(truncated)";
    }

    let candidate = JSON.stringify(reduced);
    if (Buffer.byteLength(candidate, "utf8") <= MAX_LINE_BYTES) return candidate;

    // Still too big — hard cut as a JSON string with a truncation marker.
    return JSON.stringify({
        ts: reduced.ts,
        action: reduced.action,
        entityType: reduced.entityType,
        entityId: reduced.entityId,
        truncated: true,
    });
}

/**
 * Append a single JSON object as one line to the given file path. Creates
 * the parent directory tree if needed. Never throws.
 */
export async function appendLogLine(filePath, payload) {
    try {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        const enriched = {
            ts: payload?.ts || new Date().toISOString(),
            ...payload,
        };
        const line = trimToBudget(safeStringify(enriched)) + "\n";
        // mode 0o600: only the process user can read; logs are sensitive.
        await fs.appendFile(filePath, line, { encoding: "utf8", mode: 0o600 });
    } catch (err) {
        console.error("[file-logging] append failed:", err?.message || err, "path=", filePath);
    }
}

/**
 * Append the same payload to multiple files in parallel. Used by `logActivity`
 * to write to BOTH the tenant general audit and the per-entity activity log.
 */
export async function appendLogLineToAll(filePaths, payload) {
    if (!Array.isArray(filePaths) || filePaths.length === 0) return;
    await Promise.all(filePaths.map((p) => appendLogLine(p, payload)));
}
