import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { verifySession } from "@/app/lib/auth";

export async function GET(request) {
    const session = await verifySession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!from || !to) return NextResponse.json({ customers: [], projects: [] });

    try {
        const fromDateStr = `${from.substring(0, 10)} 00:00:00`;
        const toDateStr = `${to.substring(0, 10)} 23:59:59.999`;

        const [logRows] = await dbTenant(`
            SELECT DISTINCT customerId, projectId FROM \`daily_time_logs\`
            WHERE date >= ? AND date <= ?
        `, [fromDateStr, toDateStr]);

        const customerIds = Array.from(new Set((logRows || []).map(l => l.customerId)));
        const projectIds = Array.from(new Set((logRows || []).map(l => l.projectId).filter(id => id !== null)));

        if (customerIds.length === 0) return NextResponse.json({ customers: [], projects: [] });

        const [customers] = await dbTenant(`
            SELECT id, companyName FROM \`customers\`
            WHERE id IN (\${customerIds.map(() => '?').join(',')})
            ORDER BY companyName ASC
        `, customerIds);

        let projects = [];
        if (projectIds.length > 0) {
            [projects] = await dbTenant(`
                SELECT id, name, customerId FROM \`projects\`
                WHERE id IN (\${projectIds.map(() => '?').join(',')})
                ORDER BY name ASC
            `, projectIds);
        }

        return NextResponse.json({ customers: customers || [], projects: projects || [] });
    } catch (error) {
        console.error("Error fetching options:", error);
        return NextResponse.json({ customers: [], projects: [] }, { status: 500 });
    }
}
