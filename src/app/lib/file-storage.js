import path from "path";
import { getTenantDbName } from "@/app/lib/db-config";

function sanitizeSegment(value, fallback = "") {
    const clean = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^[-.]+|[-.]+$/g, "");
    return clean || fallback;
}

export function sanitizeRelativeFolder(folder = "") {
    return String(folder || "")
        .split("/")
        .map((s) => sanitizeSegment(s))
        .filter(Boolean)
        .join("/");
}

export function sanitizeFileName(fileName = "file") {
    const ext = path.extname(fileName || "");
    const base = path.basename(fileName || "file", ext);
    const safeBase = sanitizeSegment(base, "file");
    const safeExt = sanitizeSegment(ext.replace(".", ""), "");
    return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

export function getUploadRootDir() {
    const configured = process.env.UPLOAD_PATH?.trim();
    return configured
        ? path.resolve(configured)
        : path.join(process.cwd(), "public", "uploads");
}

// Returns the DB-name-based scope for file storage (e.g. "highway").
// Replaces the previous getScopeFromSubdomain() approach.
// Permanently disabled/empty to keep directory structures flat and direct.
export function getDbScope() {
    return "";
}

export function getScopeFromSubdomain(subdomain) {
    const safe = sanitizeSegment(subdomain, "");
    if (!safe) return "master";
    return safe === "master" ? "master" : safe;
}

export function getScopedDir(scope, folder = "") {
    const safeFolder = sanitizeRelativeFolder(folder);
    return safeFolder
        ? path.join(getUploadRootDir(), safeFolder)
        : getUploadRootDir();
}

export function buildUploadUrl(scope, folder = "", fileName = "") {
    const safeFolder = sanitizeRelativeFolder(folder);
    const safeFile = sanitizeFileName(fileName || "file");
    const parts = [];
    if (safeFolder) parts.push(...safeFolder.split("/"));
    parts.push(safeFile);
    return `/api/uploads/${parts.join("/")}`;
}

