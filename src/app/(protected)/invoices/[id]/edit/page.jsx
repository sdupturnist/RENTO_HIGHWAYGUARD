import { InvoiceForm } from "@/app/Components/invoices/InvoiceForm";
import { PageHeader } from "@/app/Components/ui/page-header";
import { verifySession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";
import { dbTenant } from "@/app/lib/db";
import { notFound, redirect } from "next/navigation";

export default async function InvoiceEditPage({ params }) {
    const session = await verifySession();
    if (!session) redirect("/login");

    const canEdit = await verifySessionPermission(session, "Invoices", "Edit");
    if (!canEdit) {
        return <Forbidden module="invoices" action="edit" />;
    }

    const { id: paramId } = await params;
    const id = parseInt(paramId);
    if (isNaN(id)) notFound();

    // Fetch Invoice
    const [invRows] = await dbTenant(`
        SELECT i.*,
               c.companyName as customer_companyName, c.id as customer_id, c.email as customer_email,
               p.name as project_name,
               t.timesheetCode, t.periodStart, t.periodEnd
        FROM \`invoices\` i
        LEFT JOIN \`customers\` c ON c.id = i.customerId
        LEFT JOIN \`projects\` p ON p.id = i.projectId
        LEFT JOIN \`timesheets\` t ON t.id = i.timesheetId
        WHERE i.id = ? LIMIT 1
    `, [id]);

    if (!invRows || invRows.length === 0) notFound();
    const iRow = invRows[0];

    // Fetch Invoice items
    const [items] = await dbTenant(`SELECT * FROM \`invoice_items\` WHERE invoiceId = ? ORDER BY id ASC`, [id]);

    const invoice = {
        ...iRow,
        customer: { id: iRow.customer_id, companyName: iRow.customer_companyName, email: iRow.customer_email },
        project: iRow.projectId ? { id: iRow.projectId, name: iRow.project_name } : null,
        timesheet: iRow.timesheetId ? { 
            id: iRow.timesheetId, 
            timesheetCode: iRow.timesheetCode,
            periodStart: iRow.periodStart,
            periodEnd: iRow.periodEnd,
            customer: { id: iRow.customer_id, companyName: iRow.customer_companyName },
            project: iRow.projectId ? { id: iRow.projectId, name: iRow.project_name } : null
        } : null,
        items: items || [],
    };

    return (
        <div className="flex-1 space-y-4 pt-6">
            <PageHeader title="Edit Invoice" description={`Modify details for invoice ${invoice.invoiceNumber || ""}`} />
            <div className="max-w-7xl mx-auto">
                <InvoiceForm mode="edit" initialData={invoice} />
            </div>
        </div>
    );
}
