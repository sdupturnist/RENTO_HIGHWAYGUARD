import { NextResponse } from "next/server";
import { verifySession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { dbTenant } from "@/app/lib/db";
import { sendMail } from "@/app/lib/email";
import { format } from "date-fns";
import { logActivity } from "@/app/lib/logger";

export async function POST(_, { params }) {
    const session = await verifySession();
    const canView = session ? await verifySessionPermission(session, "Invoices", "View") : false;
    if (!session || !canView) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const id = parseInt((await params).id);

    const [rows] = await dbTenant(`
        SELECT i.*, 
               c.companyName as customer_companyName, c.email as customer_email,
               p.name as project_name
        FROM \`invoices\` i
        LEFT JOIN \`customers\` c ON c.id = i.customerId
        LEFT JOIN \`projects\` p ON p.id = i.projectId
        WHERE i.id = ? LIMIT 1
    `, [id]);

    if (!rows || rows.length === 0)
        return NextResponse.json({ message: "Not found" }, { status: 404 });
    const invoice = rows[0];

    if (!invoice.customer_email)
        return NextResponse.json({ message: "Customer has no email" }, { status: 400 });

    const [items] = await dbTenant(`SELECT * FROM \`invoice_items\` WHERE invoiceId = ?`, [id]);
    invoice.items = items || [];
    invoice.customer = { companyName: invoice.customer_companyName, email: invoice.customer_email };
    invoice.project = { name: invoice.project_name };

    const [settingsRows] = await dbTenant("SELECT * FROM `company_settings` LIMIT 1");
    const companySettings = settingsRows?.[0] || {};

    const [brandingRows] = await dbTenant("SELECT * FROM `branding_settings` LIMIT 1");
    const branding = brandingRows?.[0] || {};
    const appName = branding.appName || "Upturnist";

    const [invoiceSettingsRows] = await dbTenant("SELECT * FROM `invoice_settings` LIMIT 1");
    const invoiceSettings = invoiceSettingsRows?.[0] || {};

    const [notifRows] = await dbTenant("SELECT attachTimesheetWithInvoice FROM `notification_settings` LIMIT 1");
    const notif = notifRows?.[0] || {};

    let invoiceBuffer = null;
    try {
        const { generateInvoicePDFBuffer } = await import("@/app/lib/pdfGenerator");
        invoiceBuffer = await generateInvoicePDFBuffer(invoice, companySettings, branding);
    } catch (e) {
        console.error("Failed to generate PDF for manual invoice email:", e);
    }

    let timesheetBuffer = null;
    let timesheetCode = "Timesheet";
    if (notif.attachTimesheetWithInvoice && invoice.timesheetId) {
        try {
            const [tsRows] = await dbTenant(`
                SELECT t.*, c.companyName as customer_companyName, p.name as project_name
                FROM \`timesheets\` t
                LEFT JOIN \`customers\` c ON c.id = t.customerId
                LEFT JOIN \`projects\` p ON p.id = t.projectId
                WHERE t.id = ? LIMIT 1
            `, [invoice.timesheetId]);

            if (tsRows && tsRows.length > 0) {
                const fullTimesheet = tsRows[0];
                const [lines] = await dbTenant(`
                    SELECT tl.*, v.regNo as vehicle_regNo, vm.name as vehicle_model_name, o.name as operator_name
                    FROM \`timesheet_lines\` tl
                    LEFT JOIN \`vehicles\` v ON v.id = tl.vehicleId
                    LEFT JOIN \`vehicle_models\` vm ON vm.id = v.modelId
                    LEFT JOIN \`operators\` o ON o.id = tl.operatorId
                    WHERE tl.timesheetId = ?
                `, [invoice.timesheetId]);

                timesheetCode = fullTimesheet.timesheetCode;
                const formattedLines = (lines || []).map(l => ({
                    ...l,
                    vehicle: { regNo: l.vehicle_regNo, model: { name: l.vehicle_model_name } },
                    operator: l.operatorId ? { name: l.operator_name } : null
                }));

                const { generateTimesheetPDFBuffer } = await import("@/app/lib/timesheet-pdf");
                timesheetBuffer = await generateTimesheetPDFBuffer({
                    ...fullTimesheet,
                    customer: { companyName: fullTimesheet.customer_companyName },
                    project: { name: fullTimesheet.project_name },
                    lines: formattedLines,
                    totalHours: formattedLines.reduce((sum, l) => {
                        if (l.blockType === "OPERATOR" && l.vehicleId) return sum;
                        return sum + Number(l.totalHours || 0);
                    }, 0),
                    totalVehicles: new Set(formattedLines.map((l) => l.vehicleId)).size,
                    totalOperators: new Set(formattedLines.map((l) => l.operatorId).filter(Boolean)).size,
                    companySettings,
                    branding,
                });
            }
        } catch (e) {
            console.error("Failed to append timesheet PDF to manual invoice email:", e);
        }
    }

    const attachments = [];
    if (invoiceBuffer) {
        attachments.push({ filename: `${invoice.invoiceNumber}.pdf`, content: invoiceBuffer });
    }
    if (timesheetBuffer) {
        attachments.push({ filename: `${timesheetCode}.pdf`, content: timesheetBuffer });
    }

    const appInitials = appName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

    // Render the InvoiceTemplate to HTML for the email body
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { InvoiceTemplate } = await import("@/app/Components/invoices/InvoiceTemplate");
    const invoiceHtml = renderToStaticMarkup(
        InvoiceTemplate({ invoice, settings: invoiceSettings, companySettings, branding })
    );

    const emailHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:20px;background:#f9fafb;}table{border-collapse:collapse;width:100%;}th,td{padding:8px 12px;text-align:left;}</style></head><body>${invoiceHtml}</body></html>`;

    await sendMail({
        to: invoice.customer.email,
        subject: `${appName}: Invoice ${invoice.invoiceNumber}`,
        html: emailHtml,
        attachments: attachments.length > 0 ? attachments : undefined,
    });
    await logActivity("INVOICE", id, "SENT", `Invoice ${invoice.invoiceNumber} emailed to ${invoice.customer.email}`);
    return NextResponse.json({ message: "Invoice emailed successfully" });
}
