import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const hasPermission = await verifySessionPermission(session, "Reports", "View");
        if (!hasPermission) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1") || 1;
        const perPage = parseInt(searchParams.get("perPage") || "50") || 50;
        const customerId = searchParams.get("customerId");
        const projectId = searchParams.get("projectId");
        const status = searchParams.get("status");
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");
        const offset = (page - 1) * perPage;

        let whereClause = "WHERE 1=1";
        const params = [];

        if (customerId) {
            whereClause += " AND i.customerId = ?";
            params.push(parseInt(customerId));
        }
        if (projectId) {
            whereClause += " AND i.projectId = ?";
            params.push(parseInt(projectId));
        }
        if (status) {
            whereClause += " AND i.status = ?";
            params.push(status);
        }
        if (dateFrom) {
            whereClause += " AND i.date >= ?";
            params.push(`${dateFrom.substring(0, 10)} 00:00:00`);
        }
        if (dateTo) {
            whereClause += " AND i.date <= ?";
            params.push(`${dateTo.substring(0, 10)} 23:59:59.999`);
        }

        const [invoices] = await dbTenant(`
            SELECT i.*, c.companyName as customer_companyName, p.name as project_name, t.id as timesheet_id
            FROM \`invoices\` i
            LEFT JOIN \`customers\` c ON c.id = i.customerId
            LEFT JOIN \`projects\` p ON p.id = i.projectId
            LEFT JOIN \`timesheets\` t ON t.id = i.timesheetId
            ${whereClause}
            ORDER BY i.date DESC
            LIMIT ${Number(perPage)} OFFSET ${Number(offset)}
        `, params);

        const [[{ total }]] = await dbTenant(`SELECT COUNT(*) as total FROM \`invoices\` i ${whereClause}`, params);

        const formattedInvoices = (invoices || []).map(i => ({
            ...i,
            customer: { companyName: i.customer_companyName },
            project: { name: i.project_name },
            timesheet: i.timesheet_id ? { id: i.timesheet_id } : null
        }));

        return NextResponse.json({
            invoices: formattedInvoices,
            total,
            page,
            perPage,
            totalPages: Math.ceil(total / perPage),
        });
    } catch (error) {
        console.error("Error fetching invoices report:", error);
        return NextResponse.json({ message: "Error fetching report data" }, { status: 500 });
    }
}
