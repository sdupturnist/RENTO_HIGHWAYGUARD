import { InvoiceForm } from "@/app/Components/invoices/InvoiceForm";
import { PageHeader } from "@/app/Components/ui/page-header";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default async function NewInvoicePage({ searchParams }) {
    const session = await getSession();
    const canAdd = session ? await verifySessionPermission(session, "Invoices", "Add") : false;
    if (!canAdd) {
        return <Forbidden module="invoices" action="create" />;
    }

    const { timesheetId } = await searchParams;

    return (<div className="flex-1 space-y-4 pt-6">
            <PageHeader title="Create New Invoice" description="Generate an invoice from an approved timesheet."/>
            <div className="max-w-5xl mx-auto">
                <InvoiceForm defaultTimesheetId={timesheetId} />
            </div>
        </div>);
}
