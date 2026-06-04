import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { formatAuditLog } from "@/app/lib/audit-log-format";
import { readLogPage } from "@/app/lib/audit-reader";
import { entityActivityDir } from "@/app/lib/log-paths";
export async function GET(req) {
    try {
        const session = await getSession();
        if (!session)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const { searchParams } = new URL(req.url);
        const entityType = searchParams.get("entityType");
        const entityId = searchParams.get("entityId");
        if (!entityType || !entityId) {
            return NextResponse.json({ message: "Missing params" }, { status: 400 });
        }
        const pageData = await readLogPage({
            directory: entityActivityDir(entityType, entityId),
            limit: 200,
        });
        const logs = pageData.entries.map((entry, index) => ({
            id: `${entry.ts || "log"}:${index}`,
            timestamp: entry.ts,
            createdAt: entry.ts,
            action: entry.action,
            entityType: entry.entityType,
            entityId: entry.entityId,
            description: entry.description,
            user: entry.actor?.email ? { email: entry.actor.email, name: entry.actor.email } : null,
            userId: entry.actor?.userId ?? null,
        }));
        return NextResponse.json(logs.map(formatAuditLog));
    }
    catch (error) {
        console.error("Error fetching logs:", error);
        return NextResponse.json({ message: "Error fetching logs" }, { status: 500 });
    }
}
