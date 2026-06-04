import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";

export async function GET(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "utilization";

    if (type === "utilization") {
        const [rows] = await dbTenant(`
            SELECT v.regNo as name, 'Vehicle' as type, v.status,
                   (SELECT COUNT(*) FROM \`assignment_blocks\` b WHERE b.vehicleId = v.id) as usageCount
            FROM \`vehicles\` v
        `);
        return NextResponse.json(rows || []);
    }

    if (type === "timesheet") {
        const [rows] = await dbTenant(`
            SELECT b.startDate as \`from\`, b.endDate as \`to\`,
                   COALESCE(v.regNo, o.name, 'N/A') as resource,
                   c.companyName as customer,
                   p.name as project
            FROM \`assignment_blocks\` b
            JOIN \`assignments\` a ON a.id = b.assignmentId
            JOIN \`customers\` c ON c.id = a.customerId
            LEFT JOIN \`projects\` p ON p.id = a.projectId
            LEFT JOIN \`vehicles\` v ON v.id = b.vehicleId
            LEFT JOIN \`operators\` o ON o.id = b.operatorId
            ORDER BY b.startDate DESC
            LIMIT 50
        `);
        return NextResponse.json(rows.map(r => ({ ...r, hours: 0 })) || []);
    }

    return NextResponse.json([]);
}
