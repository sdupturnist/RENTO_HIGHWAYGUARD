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

        const [settingsRows] = await dbTenant("SELECT enableVat FROM `company_settings` LIMIT 1");
        const companySettings = settingsRows?.[0];
        if (!companySettings?.enableVat) {
            return NextResponse.json({ message: "VAT is not enabled" }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1") || 1;
        const perPage = parseInt(searchParams.get("perPage") || "50") || 50;
        const customerId = searchParams.get("customerId");
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");
        const offset = (page - 1) * perPage;

        let whereClause = "WHERE 1=1";
        const params = [];

        if (customerId) {
            whereClause += " AND i.customerId = ?";
            params.push(parseInt(customerId));
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
            SELECT i.*, c.companyName as customer_companyName
            FROM \`invoices\` i
            LEFT JOIN \`customers\` c ON c.id = i.customerId
            ${whereClause}
            ORDER BY i.date DESC
            LIMIT ${Number(perPage)} OFFSET ${Number(offset)}
        `, params);

        const [[{ total }]] = await dbTenant(`SELECT COUNT(*) as total FROM \`invoices\` i ${whereClause}`, params);

        const formattedInvoices = (invoices || []).map(i => ({
            ...i,
            customer: { companyName: i.customer_companyName }
        }));

        return NextResponse.json({
            invoices: formattedInvoices,
            total,
            page,
            perPage,
            totalPages: Math.ceil(total / perPage),
            vatEnabled: true,
        });
    } catch (error) {
        console.error("Error fetching VAT summary report:", error);
        return NextResponse.json({ message: "Error fetching report data" }, { status: 500 });
    }
}
