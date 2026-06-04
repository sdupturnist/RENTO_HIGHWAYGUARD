import { NextResponse } from "next/server";
import crypto from "crypto";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { generateApiKey, listAvailableApiScopes, maskApiKeyPreview, normalizeApiKeyScopes } from "@/app/lib/api-keys";
import { logActivity } from "@/app/lib/logger";

async function serializeApiKeys() {
    const [keys] = await dbTenant("SELECT * FROM `api_keys` ORDER BY createdAt DESC");

    return (keys || []).map((key) => ({
        id: key.id,
        name: key.name,
        keyPreview: maskApiKeyPreview(key.keyPrefix, key.key),
        isActive: !!key.isActive,
        createdAt: key.createdAt,
        lastUsed: key.lastUsed,
        scopes: normalizeApiKeyScopes(typeof key.scopes === 'string' ? JSON.parse(key.scopes) : key.scopes),
        createdByUserId: key.createdByUserId ?? null,
        isLegacyUnscoped: !Array.isArray(key.scopes) || (typeof key.scopes === 'string' ? JSON.parse(key.scopes) : key.scopes).length === 0,
    }));
}

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const canView = await verifySessionPermission(session, "Settings", "View");
    if (!canView) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    try {
        const [keys, availableScopes] = await Promise.all([
            serializeApiKeys(),
            listAvailableApiScopes(),
        ]);
        return NextResponse.json({ keys, availableScopes });
    } catch (error) {
        console.error("Error fetching keys:", error);
        return NextResponse.json({ message: "Error fetching keys" }, { status: 500 });
    }
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const canEdit = await verifySessionPermission(session, "Settings", "Edit");
    if (!canEdit) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    try {
        const body = await req.json();
        const name = String(body.name || "New API Key").trim();
        const requestedScopes = normalizeApiKeyScopes(body.scopes);

        if (!name) return NextResponse.json({ message: "Key name is required" }, { status: 400 });
        if (requestedScopes.length === 0) return NextResponse.json({ message: "Select at least one API permission scope" }, { status: 400 });

        for (const scope of requestedScopes) {
            const callerCanGrant = await verifySessionPermission(session, scope.module, scope.action);
            if (!callerCanGrant) {
                return NextResponse.json({ message: `You cannot grant scope ${scope.module} / ${scope.action}` }, { status: 403 });
            }
        }

        const { rawKey, keyHash, keyPrefix } = generateApiKey();
        const id = crypto.randomUUID();

        await dbTenant(`
            INSERT INTO \`api_keys\` (id, name, \`key\`, keyPrefix, scopes, isActive, createdByUserId, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        `, [id, name, keyHash, keyPrefix, JSON.stringify(requestedScopes), 1, session.userId ? Number(session.userId) : null]);

        const [rows] = await dbTenant("SELECT * FROM `api_keys` WHERE id = ?", [id]);
        const newKey = rows[0];

        await logActivity("SETTINGS", 0, "CREATE", `API key created: ${name}`);
        return NextResponse.json({
            id: newKey.id,
            key: rawKey,
            keyPreview: maskApiKeyPreview(newKey.keyPrefix),
            scopes: requestedScopes,
        });
    } catch (error) {
        console.error("Error generating key:", error);
        return NextResponse.json({ message: "Error generating key" }, { status: 500 });
    }
}
