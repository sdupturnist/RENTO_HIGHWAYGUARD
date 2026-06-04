import { verifySession } from "@/app/lib/auth";
import { dbTenant, dbQuery } from "@/app/lib/db";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/app/Components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { InvoiceTemplate } from "@/app/Components/invoices/InvoiceTemplate";
import { InvoiceActions } from "@/app/Components/invoices/InvoiceActions";
import { InvoiceSendButton } from "@/app/Components/invoices/InvoiceSendButton";
import { InvoiceAdjustment } from "@/app/Components/invoices/InvoiceAdjustment";
import { InvoiceAttachment } from "@/app/Components/invoices/InvoiceAttachment";
import { ActivityLogList } from "@/app/Components/common/ActivityLogList";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default async function InvoiceViewPage({ params }) {
    const session = await verifySession();
    if (!session)
        redirect("/login");

    const canView = await verifySessionPermission(session, "Invoices", "View");
    if (!canView) {
        return <Forbidden module="invoices" action="view" />;
    }

    const { id: paramId } = await params;
    const id = parseInt(paramId);
    if (isNaN(id))
        notFound();
    const [invRows] = await dbTenant(`
        SELECT i.*,
               c.companyName as customer_companyName, c.id as customer_id, c.email as customer_email,
               p.name as project_name,
               t.timesheetCode
        FROM \`invoices\` i
        LEFT JOIN \`customers\` c ON c.id = i.customerId
        LEFT JOIN \`projects\` p ON p.id = i.projectId
        LEFT JOIN \`timesheets\` t ON t.id = i.timesheetId
        WHERE i.id = ? LIMIT 1
    `, [id]);
    if (!invRows || invRows.length === 0)
        notFound();
    const iRow = invRows[0];
    const [items] = await dbTenant(`SELECT * FROM \`invoice_items\` WHERE invoiceId = ? ORDER BY id ASC`, [id]);
    const invoice = {
        ...iRow,
        customer: { id: iRow.customer_id, companyName: iRow.customer_companyName, email: iRow.customer_email },
        project: iRow.projectId ? { id: iRow.projectId, name: iRow.project_name } : null,
        timesheet: iRow.timesheetId ? { id: iRow.timesheetId, timesheetCode: iRow.timesheetCode } : null,
        items: items || [],
    };
    const settings = (await dbTenant("SELECT * FROM `invoice_settings` LIMIT 1"))[0][0] || {};
    const companySettings = (await dbTenant("SELECT * FROM `company_settings` LIMIT 1"))[0][0] || { companyName: "My Company" };
    const branding = (await dbTenant("SELECT * FROM `branding_settings` LIMIT 1"))[0][0] || { appName: "RentERP" };
    return (<div className="flex-1 space-y-4 pt-6">
            <div className="flex items-center justify-between print:hidden">
                <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/invoices">
                            <ArrowLeft className="h-4 w-4"/>
                        </Link>
                    </Button>
                    <h2 className="text-3xl font-bold tracking-tight">Invoice Details</h2>
                </div>
                <div className="flex items-center gap-2">
                    <InvoiceSendButton invoiceId={invoice.id}/>
                    <InvoiceActions invoiceId={invoice.id}/>
                </div>
            </div>

            <div className="space-y-6 print:space-y-0">
                <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-2xl shadow-sm overflow-hidden print:w-full">
                    <InvoiceTemplate invoice={invoice} settings={settings} companySettings={companySettings} branding={branding}/>
                </div>
                <div className="w-full print:hidden space-y-4">
                    <InvoiceAdjustment
                        invoiceId={invoice.id}
                        initialAmount={Number(invoice.adjustmentAmount || 0)}
                        initialNote={invoice.adjustmentNote || ""}
                        currency={companySettings?.currency || "AED"}
                    />
                    <InvoiceAttachment
                        invoiceId={invoice.id}
                        initial={{
                            attachmentPath: iRow.attachmentPath || null,
                            attachmentName: iRow.attachmentName || null,
                            isSignedTimesheet: !!(iRow.isSignedTimesheet),
                            signatureDate: iRow.signatureDate || null,
                            lpoNumber: iRow.lpoNumber || null,
                            lpoAttachmentPath: iRow.lpoAttachmentPath || null,
                            lpoAttachmentName: iRow.lpoAttachmentName || null,
                        }}
                    />
                    <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium">Activity Log</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ActivityLogList entityType="INVOICE" entityId={invoice.id} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>);
}
