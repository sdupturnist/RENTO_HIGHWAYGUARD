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
        const year = searchParams.get("year");
        const customerId = searchParams.get("customerId");
        const projectId = searchParams.get("projectId");

        let whereClause = "WHERE i.status != 'CANCELLED'";
        const params = [];

        if (year) {
            whereClause += " AND YEAR(i.date) = ?";
            params.push(parseInt(year));
        }
        if (customerId) { whereClause += " AND i.customerId = ?"; params.push(parseInt(customerId)); }
        if (projectId) { whereClause += " AND i.projectId = ?"; params.push(parseInt(projectId)); }

        const [rows] = await dbTenant(`
            SELECT
                DATE_FORMAT(i.date, '%Y-%m') as monthKey,
                DATE_FORMAT(i.date, '%b %Y') as monthLabel,
                COUNT(i.id) as invoiceCount,
                COUNT(DISTINCT i.customerId) as customerCount,
                SUM(i.subtotal) as subtotal,
                SUM(i.vatAmount) as vatAmount,
                SUM(i.grandTotal) as grandTotal,
                SUM(CASE WHEN i.status = 'PAID' THEN i.grandTotal ELSE 0 END) as paidAmount,
                SUM(CASE WHEN i.status != 'PAID' THEN i.grandTotal ELSE 0 END) as unpaidAmount
            FROM \`invoices\` i
            ${whereClause}
            GROUP BY DATE_FORMAT(i.date, '%Y-%m'), DATE_FORMAT(i.date, '%b %Y')
            ORDER BY monthKey DESC
        `, params);

        const totals = (rows || []).reduce((acc, r) => ({
            subtotal: acc.subtotal + Number(r.subtotal || 0),
            vatAmount: acc.vatAmount + Number(r.vatAmount || 0),
            grandTotal: acc.grandTotal + Number(r.grandTotal || 0),
            paidAmount: acc.paidAmount + Number(r.paidAmount || 0),
            unpaidAmount: acc.unpaidAmount + Number(r.unpaidAmount || 0),
            invoiceCount: acc.invoiceCount + Number(r.invoiceCount || 0),
        }), { subtotal: 0, vatAmount: 0, grandTotal: 0, paidAmount: 0, unpaidAmount: 0, invoiceCount: 0 });

        return NextResponse.json({
            rows: (rows || []).map(r => ({
                ...r,
                subtotal: Number(r.subtotal || 0),
                vatAmount: Number(r.vatAmount || 0),
                grandTotal: Number(r.grandTotal || 0),
                paidAmount: Number(r.paidAmount || 0),
                unpaidAmount: Number(r.unpaidAmount || 0),
            })),
            totals,
        });
    } catch (error) {
        console.error("Error fetching revenue report:", error);
        return NextResponse.json({ message: "Error fetching report data" }, { status: 500 });
    }
}
