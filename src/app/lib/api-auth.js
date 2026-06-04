import { dbTenant, dbQuery } from "@/app/lib/db";
import { upgradeLegacyApiKeyIfNeeded, normalizeApiKeyScopes, resolveApiKeyRecord } from "@/app/lib/api-keys";

/**
 * Validates the API Key from the request header "x-api-key"
 * @param {Request} req
 * @returns {Promise<object|null>} Returns a scoped API session object if valid, null otherwise
 */
export async function validateApiKey(req) {
    try {
        const apiKey = req.headers.get("x-api-key");
        if (!apiKey) return null;

        const resolved = await resolveApiKeyRecord(apiKey);
        if (!resolved?.keyRecord) return null;

        let keyRecord = resolved.keyRecord;
        if (resolved.isLegacyPlaintext) {
            keyRecord = await upgradeLegacyApiKeyIfNeeded(keyRecord, apiKey);
        }

        if (!keyRecord?.isActive) return null;

        const scopes = normalizeApiKeyScopes(keyRecord.scopes);
        if (scopes.length === 0) return null;

        dbQuery.apiKey.update({
            where: { id: keyRecord.id },
            data: { lastUsed: new Date() },
        }).catch((err) => console.error("Error updating API key stats:", err));

        return {
            id: keyRecord.createdByUserId ?? null,
            userId: keyRecord.createdByUserId ?? null,
            roleId: null,
            role: "API",
            email: "api@integration",
            isApi: true,
            apiKeyId: keyRecord.id,
            apiKeyName: keyRecord.name || "External API",
            apiKeyScopes: scopes,
        };
    } catch (error) {
        console.error("API Key validation error:", error);
        return null;
    }
}
