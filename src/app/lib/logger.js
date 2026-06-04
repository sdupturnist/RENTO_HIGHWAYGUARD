import { getSession } from "@/app/lib/auth";
import { appendLogLineToAll } from "@/app/lib/file-logging";
import {
    tenantAuditFile,
    entityActivityFile,
    isPerEntityType,
} from "@/app/lib/log-paths";
import { dbTenant } from "@/app/lib/db";

/**
 * Append a tenant activity-log entry. Writes to:
 *   1. The audit file at <dbname>/audit_logs/<date>.jsonl
 *   2. The per-entity activity file at
 *      <dbname>/<entityType>/<entityId>/activity_logs/<date>.jsonl
 *      (only for entity types in the per-entity allowlist).
 *
 * Supports two calling conventions:
 *   logActivity(entityType, entityId, action, description)
 *   logActivity({entityType, entityId, action, description, metadata?})
 */
export async function logActivity(...args) {
    try {
        let entityType, entityId, action, description, extra;

        if (args.length >= 1 && typeof args[0] === "object" && args[0] !== null && !Array.isArray(args[0])) {
            const o = args[0];
            entityType = o.entityType;
            entityId = o.entityId;
            action = o.action;
            description = o.description;
            extra = o.metadata || null;
        } else if (args.length >= 2 && typeof args[0] === "string" && typeof args[1] === "object") {
            // Legacy shape: logActivity(subdomain, {entityType, entityId, action, description})
            const o = args[1];
            entityType = o.entityType;
            entityId = o.entityId;
            action = o.action;
            description = o.description;
            extra = o.metadata || null;
        } else {
            [entityType, entityId, action, description] = args;
        }

        const session = await getSession().catch(() => null);

        // Silently skip audit logging for hidden backend-only users (isHidden = 1)
        if (session?.userId) {
            try {
                const [rows] = await dbTenant(
                    `SELECT isHidden FROM \`users\` WHERE id = ? LIMIT 1`,
                    [Number(session.userId)]
                );
                if (rows?.[0]?.isHidden) return;
            } catch { /* non-fatal — continue logging if check fails */ }
        }

        const actor = {
            userId: session?.userId ? Number(session.userId) : null,
            email: session?.email || null,
            scope: "tenant",
            isApi: !!session?.isApi,
        };

        const payload = {
            ts: new Date().toISOString(),
            actor,
            action: action || "UNKNOWN",
            entityType: entityType || null,
            entityId: entityId ?? null,
            description: description || null,
        };
        if (extra && typeof extra === "object") {
            payload.metadata = extra;
        }

        const targets = [tenantAuditFile()];
        if (isPerEntityType(entityType) && entityId !== undefined && entityId !== null) {
            targets.push(entityActivityFile(entityType, entityId));
        }

        await appendLogLineToAll(targets, payload);
    } catch (error) {
        console.error("Failed to write activity log:", error?.message || error);
    }
}
