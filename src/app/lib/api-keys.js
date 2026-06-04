import crypto from "crypto";
import { dbTenant, dbQuery } from "@/app/lib/db";

const API_KEY_PREFIX = "sk_live_";

function toScopeKey(module, action) {
    return `${String(module)}::${String(action)}`;
}

export function normalizeApiKeyScopes(scopes) {
    if (!Array.isArray(scopes)) return [];

    const normalized = scopes
        .filter((scope) => scope && typeof scope === "object")
        .map((scope) => ({
            module: String(scope.module || "").trim(),
            action: String(scope.action || "").trim(),
        }))
        .filter((scope) => scope.module && scope.action);

    const deduped = new Map();
    for (const scope of normalized) {
        deduped.set(toScopeKey(scope.module, scope.action), scope);
    }
    return [...deduped.values()];
}

export function hashApiKey(rawKey) {
    return crypto.createHash("sha256").update(String(rawKey)).digest("hex");
}

export function generateApiKey() {
    const secret = crypto.randomBytes(32).toString("hex");
    const rawKey = `${API_KEY_PREFIX}${secret}`;
    return {
        rawKey,
        keyHash: hashApiKey(rawKey),
        keyPrefix: rawKey.slice(0, 16),
    };
}

export function maskApiKeyPreview(keyPrefix, fallbackRawKey = "") {
    const preview = keyPrefix || String(fallbackRawKey || "").slice(0, 16);
    if (!preview) return "Not available";
    return `${preview}...`;
}

export async function listAvailableApiScopes() {
    const permissions = await dbQuery.permission.findMany({
        select: { module: true, action: true },
        orderBy: [{ module: "asc" }, { action: "asc" }],
    });
    return permissions.map((permission) => ({
        module: permission.module,
        action: permission.action,
        key: toScopeKey(permission.module, permission.action),
    }));
}

export async function resolveApiKeyRecord(rawKey) {
    if (!rawKey) return null;

    const keyHash = hashApiKey(rawKey);
    let keyRecord = await dbQuery.apiKey.findUnique({
        where: { key: keyHash },
    });

    if (keyRecord) {
        return { keyRecord, isLegacyPlaintext: false };
    }

    keyRecord = await dbQuery.apiKey.findUnique({
        where: { key: rawKey },
    });
    if (!keyRecord) return null;

    return { keyRecord, isLegacyPlaintext: true };
}

export async function upgradeLegacyApiKeyIfNeeded(keyRecord, rawKey) {
    if (!keyRecord || !rawKey) return keyRecord;
    if (keyRecord.key !== rawKey) return keyRecord;

    const upgraded = await dbQuery.apiKey.update({
        where: { id: keyRecord.id },
        data: {
            key: hashApiKey(rawKey),
            keyPrefix: keyRecord.keyPrefix || rawKey.slice(0, 16),
            scopes: Array.isArray(keyRecord.scopes) ? keyRecord.scopes : [],
        },
    });
    return upgraded;
}

export function apiSessionHasScope(session, module, action) {
    if (!session?.isApi) return false;

    const scopes = normalizeApiKeyScopes(session.apiKeyScopes);
    return scopes.some((scope) => scope.module === module && scope.action === action);
}
