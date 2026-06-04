/**
 * Tail-first paginated JSONL reader for audit / activity / cron logs.
 *
 * The on-disk layout uses daily-rotated files (e.g. `2026-04-29.jsonl`).
 * A "page" of results comes from walking back through the day files until
 * we have `limit` matching entries OR we exhaust the requested date range.
 *
 * Filters supported:
 *   - action (exact match)
 *   - entityType (exact match)
 *   - entityId (number, matches stringified)
 *   - userId (number)
 *   - search (substring, case-insensitive, matched against description+action)
 *   - from / to (ISO date strings inclusive — limits which day files we touch)
 *
 * Pagination uses an opaque cursor of the form `<dayIso>:<lineIndexFromEnd>`
 * so callers can request "more" without re-loading from the very latest day.
 */

import fs from "fs/promises";
import path from "path";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const DEFAULT_LOOKBACK_DAYS = 30;

function parseLineSafe(line) {
    if (!line) return null;
    try {
        return JSON.parse(line);
    } catch {
        return null;
    }
}

function dayIso(date) {
    return date.toISOString().slice(0, 10);
}

function listDayFiles(directory, fromIso, toIso) {
    // Generate ISO day strings between fromIso..toIso inclusive, walked backwards.
    const out = [];
    const cursor = new Date(`${toIso}T00:00:00Z`);
    const stop = new Date(`${fromIso}T00:00:00Z`);
    while (cursor.getTime() >= stop.getTime()) {
        out.push({
            iso: dayIso(cursor),
            file: path.join(directory, `${dayIso(cursor)}.jsonl`),
        });
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return out;
}

function matchesFilters(entry, filters) {
    if (!entry) return false;
    if (filters.action && entry.action !== filters.action) return false;
    if (filters.entityType && entry.entityType !== filters.entityType) return false;
    if (filters.entityId !== undefined && filters.entityId !== null) {
        const want = String(filters.entityId);
        if (String(entry.entityId ?? "") !== want) return false;
    }
    if (filters.userId !== undefined && filters.userId !== null) {
        const actor = entry.actor || entry.user || {};
        const want = Number(filters.userId);
        const got = Number(actor.userId ?? entry.userId ?? NaN);
        if (got !== want) return false;
    }
    if (filters.search) {
        const haystack = `${entry.description || ""} ${entry.action || ""}`.toLowerCase();
        if (!haystack.includes(String(filters.search).toLowerCase())) return false;
    }
    return true;
}

async function readDayLinesReversed(filePath) {
    try {
        const raw = await fs.readFile(filePath, "utf8");
        if (!raw) return [];
        const lines = raw.split("\n");
        // Drop trailing empty line from final newline.
        while (lines.length && lines[lines.length - 1] === "") lines.pop();
        // Reverse so newest-first within the day.
        return lines.reverse();
    } catch (err) {
        if (err?.code === "ENOENT") return [];
        throw err;
    }
}

/**
 * Read a paginated page of entries from a directory of daily JSONL files.
 *
 * @param {object} opts
 * @param {string} opts.directory     - Absolute directory containing <iso>.jsonl files.
 * @param {object} [opts.filters]     - See header for shape.
 * @param {number} [opts.limit]       - Max entries to return (default 50, capped at 500).
 * @param {string} [opts.cursor]      - Opaque cursor from a previous response.
 * @param {number} [opts.lookbackDays] - How many days back to walk if no `from` filter.
 *
 * @returns {Promise<{entries: object[], nextCursor: string|null, scanned: number}>}
 */
export async function readLogPage({
    directory,
    filters = {},
    limit = DEFAULT_LIMIT,
    cursor = null,
    lookbackDays = DEFAULT_LOOKBACK_DAYS,
}) {
    const cap = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || DEFAULT_LIMIT));

    const today = new Date();
    const toIso = filters.to ? String(filters.to).slice(0, 10) : dayIso(today);
    const defaultFrom = new Date(today.getTime() - (lookbackDays - 1) * 86400000);
    const fromIso = filters.from ? String(filters.from).slice(0, 10) : dayIso(defaultFrom);

    let cursorDay = null;
    let cursorOffset = 0;
    if (cursor) {
        const parts = String(cursor).split(":");
        if (parts.length === 2) {
            cursorDay = parts[0];
            cursorOffset = Math.max(0, Number.parseInt(parts[1], 10) || 0);
        }
    }

    const days = listDayFiles(directory, fromIso, cursorDay || toIso);
    const entries = [];
    let scanned = 0;
    let nextCursor = null;

    for (const day of days) {
        const lines = await readDayLinesReversed(day.file);
        const startIndex = (cursorDay && day.iso === cursorDay) ? cursorOffset : 0;
        for (let i = startIndex; i < lines.length; i += 1) {
            scanned += 1;
            const entry = parseLineSafe(lines[i]);
            if (!entry) continue;
            if (!matchesFilters(entry, filters)) continue;

            entries.push(entry);
            if (entries.length >= cap) {
                // Build the cursor pointing at the NEXT line within this day file.
                const nextOffset = i + 1;
                if (nextOffset < lines.length) {
                    nextCursor = `${day.iso}:${nextOffset}`;
                } else {
                    // Roll forward to the next (older) day, offset 0.
                    const next = new Date(`${day.iso}T00:00:00Z`);
                    next.setUTCDate(next.getUTCDate() - 1);
                    if (dayIso(next) >= fromIso) {
                        nextCursor = `${dayIso(next)}:0`;
                    }
                }
                return { entries, nextCursor, scanned };
            }
        }
        // If we cursor-started in the middle of this day, reset for older days.
        cursorDay = null;
        cursorOffset = 0;
    }

    return { entries, nextCursor, scanned };
}
