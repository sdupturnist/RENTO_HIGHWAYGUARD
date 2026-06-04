import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { formatAuditLog } from "@/app/lib/audit-log-format";
import { readLogPage } from "@/app/lib/audit-reader";
import { tenantAuditDir } from "@/app/lib/log-paths";
export async function GET(request) {
    const session = await getSession();
    if (!session) {
        return new NextResponse("Unauthorized", { status: 401 });
    }
    const canView = await verifySessionPermission(session, "Audit Logs", "View");
    if (!canView) {
        return new NextResponse("Forbidden", { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");
    const search = searchParams.get("search") || "";
    try {
        const pageData = await readLogPage({
            directory: tenantAuditDir(),
            filters: search ? { search } : {},
            limit: pageSize * page,
        });
        const total = pageData.entries.length;
        const sliceStart = Math.max(0, (page - 1) * pageSize);
        const logs = pageData.entries.slice(sliceStart, sliceStart + pageSize).map((entry, index) => ({
            id: `${entry.ts || "log"}:${sliceStart + index}`,
            timestamp: entry.ts,
            createdAt: entry.ts,
            action: entry.action,
            entityType: entry.entityType,
            entityId: entry.entityId,
            description: entry.description,
            user: entry.actor?.email ? { email: entry.actor.email, name: entry.actor.email } : null,
            userId: entry.actor?.userId ?? null,
        }));
        return NextResponse.json({
            data: logs.map(formatAuditLog),
            meta: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            },
        });
    }
    catch (error) {
        console.error("Failed to fetch audit logs:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
