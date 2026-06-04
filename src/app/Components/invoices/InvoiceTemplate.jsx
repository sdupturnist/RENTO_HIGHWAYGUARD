import { format } from "date-fns";
import { AedSymbol } from "@/app/Components/ui/AedSymbol";

// Helper: format amount with official symbol for AED, else use currency code
function fmt(amount, currency) {
    const num = new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2 }).format(Number(amount));
    return num;
}

export function InvoiceTemplate({ invoice, settings, companySettings, branding }) {
    const totalAmount = Number(invoice.totalAmount);
    const pdfLogoUrl = companySettings?.pdfLogoUrl || branding?.logoUrl || "";
    const pdfThemeColor = companySettings?.pdfThemeColor || "#2980B9";
    return (<div className="bg-white text-black p-8 max-w-4xl mx-auto shadow-none print:shadow-none" id="invoice-template">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
            <div className="flex flex-col">
                {pdfLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pdfLogoUrl} alt="Company Logo" className="h-16 object-contain mb-4 w-auto self-start" />) : (<h1 className="text-2xl font-bold mb-4">{branding.appName}</h1>)}
                <div className="text-sm text-gray-600 space-y-1">
                    <p className="font-bold text-gray-900">{companySettings.companyName}</p>
                    <p>{companySettings.address}</p>
                    <p>{companySettings.city}, {companySettings.country}</p>
                    <p>Phone: {companySettings.phone}</p>
                    <p>Email: {companySettings.email || "info@company.com"}</p>
                    {companySettings.taxNumber && <p>TRN: {companySettings.taxNumber}</p>}
                </div>
            </div>

            <div className="text-right">
                <h1 className="text-4xl font-light mb-4" style={{ color: pdfThemeColor }}>
                    {invoice.vatEnabled ? "TAX INVOICE" : "INVOICE"}
                </h1>
                <div className="text-sm space-y-2">
                    <div className="flex justify-end gap-4">
                        <span className="text-gray-600">Invoice #:</span>
                        <span className="font-bold">{invoice.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-end gap-4">
                        <span className="text-gray-600">Date:</span>
                        <span className="font-medium">{format(new Date(invoice.date), "dd MMM yyyy")}</span>
                    </div>
                    <div className="flex justify-end gap-4">
                        <span className="text-gray-600">Due Date:</span>
                        <span className="font-medium">{invoice.dueDate ? format(new Date(invoice.dueDate), "dd MMM yyyy") : "On Receipt"}</span>
                    </div>
                    {invoice.reference && (<div className="flex justify-end gap-4">
                        <span className="text-gray-600">Reference:</span>
                        <span className="font-medium">{invoice.reference}</span>
                    </div>)}

                </div>
            </div>
        </div>

        {/* Bill To */}
        <div className="flex justify-between mb-8 border-t border-b py-6 border-slate-200">
            <div className="w-1/2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Bill To</h3>
                <p className="font-bold text-lg text-slate-900">{invoice.customer.companyName}</p>
                <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.customer.address}</p>
                {invoice.customer.email && <p className="text-sm text-gray-600 mt-1">{invoice.customer.email}</p>}
            </div>
            <div className="w-1/2 flex flex-col items-end text-right">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Project Details</h3>
                <p className="font-medium text-slate-900">{invoice.project?.name || "General Project"}</p>
                <p className="text-sm text-gray-600">
                    Period: {format(new Date(invoice.periodStart), "dd MMM yyyy")} - {format(new Date(invoice.periodEnd), "dd MMM yyyy")}
                </p>
                {settings.showTimesheetReference && invoice.timesheet && (<p className="text-sm text-gray-600 mt-1">
                    Timesheet: {invoice.timesheet.timesheetCode}
                </p>)}
            </div>
        </div>

        {/* Table */}
        <div className="mb-8">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b-2 text-white" style={{ backgroundColor: pdfThemeColor, borderColor: pdfThemeColor }}>
                        <th className="py-2 text-left w-[40%]">Description</th>
                        <th className="py-2 text-center">Regular</th>
                        <th className="py-2 text-center">OT</th>
                        <th className="py-2 text-center">Holiday</th>
                        <th className="py-2 text-right">Rate</th>
                        <th className="py-2 text-right">Amount</th>
                    </tr>
                </thead>
                <tbody className="text-slate-700">
                    {invoice.items.map((item, index) => (<tr key={index} className="border-b border-slate-100 last:border-0">
                        <td className="py-3 pr-4 font-medium">
                            {item.description}
                        </td>
                        <td className="py-3 text-center">{item.regularHours > 0 ? item.regularHours.toFixed(1) : "-"}</td>
                        <td className="py-3 text-center">{item.overtimeHours > 0 ? item.overtimeHours.toFixed(1) : "-"}</td>
                        <td className="py-3 text-center">{item.holidayHours > 0 ? item.holidayHours.toFixed(1) : "-"}</td>
                        <td className="py-3 text-right">
                            {fmt(item.unitPrice, companySettings.currency)}
                        </td>
                        <td className="py-3 text-right font-semibold text-slate-900">
                            {fmt(item.total, companySettings.currency)}
                        </td>
                    </tr>))}
                </tbody>
                <tfoot>
                    <tr className="border-t-2 border-slate-800">
                        <td colSpan={4}></td>
                        <td className="py-4 text-right font-bold text-slate-800">Subtotal</td>
                        <td className="py-4 text-right font-bold text-slate-900">
                            <span className="inline-flex items-center gap-1">
                                <AedSymbol size="0.9em" />
                                {fmt(invoice.subtotal || invoice.totalAmount, companySettings.currency)}
                            </span>
                        </td>
                    </tr>
                    {invoice.vatEnabled && (<tr>
                        <td colSpan={4}></td>
                        <td className="py-2 text-right font-medium text-slate-600">
                            VAT ({invoice.vatPercentage}%)
                        </td>
                        <td className="py-2 text-right font-medium text-slate-900">
                            <span className="inline-flex items-center gap-1">
                                <AedSymbol size="0.9em" />
                                {fmt(invoice.vatAmount, companySettings.currency)}
                            </span>
                        </td>
                    </tr>)}
                    {invoice.adjustmentAmount && Number(invoice.adjustmentAmount) !== 0 && (
                        <tr>
                            <td colSpan={4}></td>
                            <td className="py-2 text-right font-medium text-slate-600 flex flex-col items-end">
                                Adjustment
                                {invoice.adjustmentNote && <span className="text-xs text-gray-400 font-normal">{invoice.adjustmentNote}</span>}
                            </td>
                            <td className="py-2 text-right font-medium text-slate-900 align-top">
                                <span className="inline-flex items-center gap-1">
                                    <AedSymbol size="0.9em" />
                                    {fmt(invoice.adjustmentAmount, companySettings.currency)}
                                </span>
                            </td>
                        </tr>
                    )}
                    <tr>
                        <td colSpan={4}></td>
                        <td className="py-2 text-right font-bold text-lg text-slate-900 border-t border-slate-200">Total Due</td>
                        <td className="py-2 text-right font-bold text-lg text-slate-900 border-t border-slate-200">
                            <span className="inline-flex items-center gap-1">
                                <AedSymbol size="1em" />
                                {fmt(invoice.grandTotal || invoice.totalAmount, companySettings.currency)}
                            </span>
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>

        {/* Footer */}
        <div className="grid grid-cols-2 gap-8 text-sm mt-12 pt-8 border-t border-slate-200">
            <div>
                <h4 className="font-bold text-slate-800 mb-2">Terms & Conditions</h4>
                <p className="text-gray-600 mb-1">Payment is due within {settings.defaultDueDays || 30} days.</p>
                <p className="text-gray-600">Please include invoice number on your payment.</p>
                {invoice.notes && (<div className="mt-4">
                    <h4 className="font-bold text-slate-800 mb-1">Notes</h4>
                    <p className="text-gray-600 whitespace-pre-line">{invoice.notes}</p>
                </div>)}
            </div>
            <div className="text-right flex flex-col justify-end">
                <div className="h-16 border-b border-slate-300 mb-2 w-48 ml-auto"></div>
                <p className="font-medium text-slate-800">Authorized Signature</p>
                <p className="text-xs text-gray-500 mt-1">{companySettings.companyName}</p>
                {invoice.vatEnabled && companySettings.taxNumber && (<p className="text-xs text-gray-400 mt-1">TRN: {companySettings.taxNumber}</p>)}
            </div>
        </div>

        <div className="mt-12 text-center text-xs text-gray-400">
            <p>Use this invoice for all official tax and accounting purposes.</p>
        </div>
    </div>);
}
