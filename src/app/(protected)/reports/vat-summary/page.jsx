"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ReportHeader } from "@/app/Components/reports/ReportHeader";
import { ReportFilterPanel } from "@/app/Components/reports/ReportFilterPanel";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { Label } from "@/app/Components/ui/label";
import { Button } from "@/app/Components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { Card, CardContent } from "@/app/Components/ui/card";
import { toast } from "sonner";
import { generateReportPDF, generateReportExcel, formatDataForExport } from "@/app/lib/export-utils";
import { useSettings } from "@/app/Components/providers/SettingsProvider";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";
import { Alert, AlertDescription } from "@/app/Components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/Components/ui/select";
export default function VATSummaryReportPage() {
    const { currencySymbol } = useSettings();
    const [page, setPage] = useState(1);
    const perPage = 50;
    const [dateFrom, setDateFrom] = useState(undefined);
    const [dateTo, setDateTo] = useState(undefined);
    const [customerId, setCustomerId] = useState("all");

    const { data: customers = [] } = useQuery({
        queryKey: ["clients"],
        queryFn: async () => {
            const res = await fetch("/api/clients");
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        },
    });

    const { data: reportData, isLoading: loading } = useQuery({
        queryKey: ["report-vat-summary", page, dateFrom?.toISOString(), dateTo?.toISOString(), customerId],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append("page", page.toString());
            params.append("perPage", perPage.toString());
            if (dateFrom) params.append("dateFrom", dateFrom.toISOString());
            if (dateTo) params.append("dateTo", dateTo.toISOString());
            if (customerId !== "all") params.append("customerId", customerId);
            const res = await fetch(`/api/reports/vat-summary?${params.toString()}`);
            if (res.status === 400) {
                return { invoices: [], total: 0, vatEnabled: false };
            }
            if (!res.ok) throw new Error("Failed to fetch report data");
            const data = await res.json();
            const mapped = (data.invoices || []).map((inv) => ({
                ...inv,
                invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString() : null,
                subtotal: Number(inv.subtotal || 0),
                vatAmount: Number(inv.vatAmount || 0),
                total: Number(inv.total || inv.grandTotal || 0),
            }));
            return { invoices: mapped, total: data.total || 0, vatEnabled: data.vatEnabled !== false };
        },
    });

    const invoices = reportData?.invoices || [];
    const total = reportData?.total || 0;
    const vatEnabled = reportData?.vatEnabled !== false;

    const clearFilters = () => {
        setDateFrom(undefined);
        setDateTo(undefined);
        setCustomerId("all");
        setPage(1);
    };
    const totalVAT = invoices.reduce((sum, inv) => sum + inv.vatAmount, 0);
    if (!vatEnabled && !loading) {
        return (<div className="p-6 space-y-6">
                <ReportHeader title="VAT Summary Report" description="VAT breakdown by invoice" canExport={false}/>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4"/>
                    <AlertDescription>
                        VAT is not enabled in company settings. Please enable VAT to view this report.
                    </AlertDescription>
                </Alert>
            </div>);
    }
    const handleExportPDF = async () => {
        try {
            const { headers, rows } = formatDataForExport(invoices, [
                { key: "invoiceNumber", header: "Invoice #" },
                { key: "invoiceDate", header: "Date", format: (v) => (v ? format(new Date(v), "dd MMM yyyy") : "-") },
                { key: "customer", header: "Customer", format: (v) => v.companyName },
                { key: "subtotal", header: "Subtotal", format: (v) => `${currencySymbol}${v.toFixed(2)}` },
                { key: "vatAmount", header: "VAT Amount", format: (v) => `${currencySymbol}${v.toFixed(2)}` },
                { key: "total", header: "Grand Total", format: (v) => `${currencySymbol}${v.toFixed(2)}` },
            ]);
            generateReportPDF("VAT Summary Report", headers, rows, `vat-summary-${format(new Date(), "yyyy-MM-dd")}`);
            toast.success("PDF exported successfully");
        }
        catch (error) {
            console.error(error);
            toast.error("Failed to export PDF");
        }
    };
    const handleExportExcel = async () => {
        try {
            const { headers, rows } = formatDataForExport(invoices, [
                { key: "invoiceNumber", header: "Invoice #" },
                { key: "invoiceDate", header: "Date", format: (v) => (v ? format(new Date(v), "dd MMM yyyy") : "-") },
                { key: "customer", header: "Customer", format: (v) => v.companyName },
                { key: "subtotal", header: "Subtotal", format: (v) => v.toFixed(2) },
                { key: "vatAmount", header: "VAT Amount", format: (v) => v.toFixed(2) },
                { key: "total", header: "Grand Total", format: (v) => v.toFixed(2) },
            ]);
            generateReportExcel("VAT Summary Report", headers, rows, `vat-summary-${format(new Date(), "yyyy-MM-dd")}`);
            toast.success("Excel exported successfully");
        }
        catch (error) {
            console.error(error);
            toast.error("Failed to export Excel");
        }
    };
    return (<div className="p-6 space-y-6">
            <ReportHeader title="VAT Summary Report" description="Summary of VAT collected from invoices" onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} backHref="/reports"/>

            <ReportFilterPanel onClear={clearFilters}>
                <div>
                    <Label>From Date</Label>
                    <FormattedDatePicker value={dateFrom} onChange={setDateFrom} placeholder="Select start date"/>
                </div>
                <div>
                    <Label>Customer</Label>
                    <Select value={customerId} onValueChange={setCustomerId}>
                        <SelectTrigger>
                            <SelectValue placeholder="All"/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {customers.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>To Date</Label>
                    <FormattedDatePicker value={dateTo} onChange={setDateTo} placeholder="Select end date"/>
                </div>
            </ReportFilterPanel>

            <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
                <CardContent className="p-0">
                    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                                <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                                    <TableHead className="h-10">Invoice #</TableHead>
                                    <TableHead className="h-10">Date</TableHead>
                                    <TableHead className="h-10">Customer</TableHead>
                                    <TableHead className="h-10">Tax Number</TableHead>
                                    <TableHead className="h-10 text-right">Subtotal</TableHead>
                                    <TableHead className="h-10 text-center">VAT %</TableHead>
                                    <TableHead className="h-10 text-right">VAT Amount</TableHead>
                                    <TableHead className="h-10 text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (<TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">Loading...</TableCell>
                                    </TableRow>) : invoices.length === 0 ? (<TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">No invoices found.</TableCell>
                                    </TableRow>) : (<>
                                        {invoices.map((invoice) => (<TableRow key={invoice.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60">
                                                <TableCell className="font-mono text-xs">{invoice.invoiceNumber}</TableCell>
                                                <TableCell>{format(new Date(invoice.invoiceDate), "dd MMM yyyy")}</TableCell>
                                                <TableCell className="max-w-[200px] truncate">{invoice.customer.companyName}</TableCell>
                                                <TableCell className="font-mono text-xs">{invoice.customer.taxNumber || "-"}</TableCell>
                                                <TableCell className="text-right"><CurrencySymbol symbol={currencySymbol} />{invoice.subtotal.toFixed(2)}</TableCell>
                                                <TableCell className="text-center">{invoice.vatPercent}%</TableCell>
                                                <TableCell className="text-right font-medium"><CurrencySymbol symbol={currencySymbol} />{invoice.vatAmount.toFixed(2)}</TableCell>
                                                <TableCell className="text-right font-bold"><CurrencySymbol symbol={currencySymbol} />{invoice.total.toFixed(2)}</TableCell>
                                            </TableRow>))}
                                        <TableRow className="bg-slate-100/50 dark:bg-slate-800/50 font-bold">
                                            <TableCell colSpan={6} className="text-right">Total VAT:</TableCell>
                                            <TableCell className="text-right"><CurrencySymbol symbol={currencySymbol} />{totalVAT.toFixed(2)}</TableCell>
                                            <TableCell></TableCell>
                                        </TableRow>
                                    </>)}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="mt-4 px-4 pb-4 flex items-center justify-between text-sm text-muted-foreground">
                        <div>Showing {invoices.length} of {total} entries</div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                            <Button variant="outline" size="sm" disabled={invoices.length < perPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>);
}
