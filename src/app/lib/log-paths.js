/**
 * Log path resolver.
 *
 * Layout (relative to UPLOAD_PATH, which MUST be outside `public/` in
 * production — see .env.example):
 *
 *   master/
 *     audit_logs/<YYYY-MM-DD>.jsonl                  ← master portal audit
 *     cron_job_logs/
 *       state.json                                   ← scheduler state
 *       jobs.json                                    ← cron job registry
 *       runs/<YYYY-MM-DD>.jsonl                      ← cron run history
 *       .lock                                        ← flock distributed lock
 *       .runs-this-minute/<runKey>.lock              ← per-minute idempotency
 *
 *   <subdomain>/
 *     audit_logs/<YYYY-MM-DD>.jsonl                  ← tenant general audit
 *     <entityType>/<entityId>/activity_logs/<YYYY-MM-DD>.jsonl
 */

import path from "path";
import { getScopedDir, getDbScope } from "@/app/lib/file-storage";

// Reserved log subfolder names. Never serve these via the upload-serve route.
export const LOG_SUBFOLDERS = Object.freeze({
    AUDIT: "audit_logs",
    CRON: "cron_job_logs",
    ACTIVITY: "activity_logs",
});

// Entity types that get per-row activity-log directories. Anything not in this
// list still writes to the tenant-wide audit log but does NOT get a per-id
// activity_logs/ subfolder (avoids creating folders for transient/lookup tables).
const PER_ENTITY_TYPES = new Set([
    "VEHICLE",
    "OPERATOR",
    "PROJECT",
    "CUSTOMER",
    "ASSIGNMENT",
    "ASSIGNMENTBLOCK",
    "MAINTENANCE",
    "DAILYTIMELOG",
    "EXPENSE",
    "TIMESHEET",
    "INVOICE",
    "USER",
]);

export function isPerEntityType(entityType) {
    if (!entityType) return false;
    return PER_ENTITY_TYPES.has(String(entityType).toUpperCase());
}

function sanitizeEntityFolder(entityType) {
    return String(entityType || "")
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "");
}

function sanitizeId(entityId) {
    const num = Number(entityId);
    if (Number.isFinite(num) && num >= 0) return String(Math.trunc(num));
    return String(entityId || "")
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "")
        .slice(0, 64) || "0";
}

function dailyFileName(date = new Date()) {
    const iso = date.toISOString().slice(0, 10);
    return `${iso}.jsonl`;
}

/* ---------------- Master / Cron ---------------- */

export function masterAuditDir() {
    return path.join(getScopedDir(getDbScope()), LOG_SUBFOLDERS.AUDIT);
}

export function masterAuditFile(date = new Date()) {
    return path.join(masterAuditDir(), dailyFileName(date));
}

export function masterCronDir() {
    return path.join(getScopedDir(getDbScope()), LOG_SUBFOLDERS.CRON);
}

export function masterCronStateFile() {
    return path.join(masterCronDir(), "state.json");
}

export function masterCronJobsFile() {
    return path.join(masterCronDir(), "jobs.json");
}

export function masterCronLockFile() {
    return path.join(masterCronDir(), ".lock");
}

export function masterCronMinuteMarkerDir() {
    return path.join(masterCronDir(), ".runs-this-minute");
}

export function masterCronJobWindowMarkerDir() {
    return path.join(masterCronDir(), ".job-windows");
}

export function masterCronRunsDir() {
    return path.join(masterCronDir(), "runs");
}

export function masterCronRunFile(date = new Date()) {
    return path.join(masterCronRunsDir(), dailyFileName(date));
}

/* ---------------- Audit / Activity ---------------- */

export function tenantAuditDir() {
    return path.join(getScopedDir(getDbScope()), LOG_SUBFOLDERS.AUDIT);
}

export function tenantAuditFile(date = new Date()) {
    return path.join(tenantAuditDir(), dailyFileName(date));
}

export function entityActivityDir(entityType, entityId) {
    return path.join(
        getScopedDir(getDbScope()),
        sanitizeEntityFolder(entityType),
        sanitizeId(entityId),
        LOG_SUBFOLDERS.ACTIVITY,
    );
}

export function entityActivityFile(entityType, entityId, date = new Date()) {
    return path.join(entityActivityDir(entityType, entityId), dailyFileName(date));
}

/* ---------------- Helpers ---------------- */

/**
 * Returns true if a path segment list (as parsed from /api/uploads/[...path])
 * targets any of the reserved log directories. Used by the upload-serve
 * routes to refuse to expose audit / activity / cron files.
 */
export function pathContainsLogSegment(segments) {
    if (!Array.isArray(segments)) return false;
    const reserved = new Set(Object.values(LOG_SUBFOLDERS));
    return segments.some((seg) => reserved.has(String(seg).toLowerCase()));
}
