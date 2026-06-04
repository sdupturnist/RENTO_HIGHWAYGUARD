"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ReportHeader } from "@/app/Components/reports/ReportHeader";
import { ReportFilterPanel } from "@/app/Components/reports/ReportFilterPanel";
import { Label } from "@/app/Components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/Components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { Card, CardContent } from "@/app/Components/ui/card";
import { toast } from "sonner";
import { generateReportPDF, generateReportExcel, formatDataForExport } from "@/app/lib/export-utils";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";
import { useSettings } from "@/app/Components/providers/SettingsProvider";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => String(CURRENT_YEAR - i));

export default function RevenueReportPage() {
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [customerId, setCustomerId] = useState("all");
    const [projectId, setProjectId] = useState("all");
    const { currencySymbol } = useSettings();

    const { data: customers = [] } = useQuery({
        queryKey: ["clients"],
        queryFn: async () => {
            const res = await fetch("/api/clients");
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        },
    });

    const { data: projects = [] } = useQuery({
        queryKey: ["projects", customerId],
        queryFn: async () => {
            const url = customerId !== "all" ? `/api/projects?customerId=${customerId}` : "/api/projects";
            const res = await fetch(url);
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        },
    });

    const { data: reportData, isLoading: loading } = useQuery({
        queryKey: ["report-revenue", year, customerId, projectId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (year) params.append("year", year);
            if (customerId !== "all") params.append("customerId", customerId);
            if (projectId !== "all") params.append("projectId", projectId);
            const res = await fetch(`/api/reports/revenue?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch report data");
            return res.json();
        },
    });

    const rows = reportData?.rows || [];
    const totals = reportData?.totals || {};

    const clearFilters = () => {
        setYear(String(CURRENT_YEAR));
        setCustomerId("all");
        setProjectId("all");
    };

    const fmt = (v) => new Intl.NumberFormat("en-AE", { minimumFractionDigits: 2 }).format(v || 0);

    const prepareExportData = () => rows.map(r => ({
        _month: r.monthLabel,
        _invoices: String(r.invoiceCount),
        _customers: String(r.customerCount),
        _subtotal: fmt(r.subtotal),
        _vat: fmt(r.vatAmount),
        _total: fmt(r.grandTotal),
        _paid: fmt(r.paidAmount),
        _unpaid: fmt(r.unpaidAmount),
    }));

    const exportColumns = [
        { key: "_month", header: "Month" },
        { key: "_invoices", header: "Invoices" },
        { key: "_customers", header: "Customers" },
        { key: "_subtotal", header: "Subtotal" },
        { key: "_vat", header: "VAT" },
        { key: "_total", header: "Grand Total" },
        { key: "_paid", header: "Paid" },
        { key: "_unpaid", header: "Outstanding" },
    ];

    const handleExportPDF = async () => {
        try {
            const { headers, rows: exportedRows } = formatDataForExport(prepareExportData(), exportColumns);
            generateReportPDF(`Revenue Report ${year}`, headers, exportedRows, `revenue-${year}`);
            toast.success("PDF exported successfully");
        } catch (e) { console.error(e); toast.error("Failed to export PDF"); }
    };

    const handleExportExcel = async () => {
        try {
            const { headers, rows: exportedRows } = formatDataForExport(prepareExportData(), exportColumns);
            generateReportExcel(`Revenue Report ${year}`, headers, exportedRows, `revenue-${year}`);
            toast.success("Excel exported successfully");
        } catch (e) { console.error(e); toast.error("Failed to export Excel"); }
    };

    return (
        <div className="p-6 space-y-6">
            <ReportHeader
                title="Revenue Report"
                description="Monthly invoice revenue breakdown with paid vs outstanding amounts"
                backHref="/reports"
                onExportPDF={handleExportPDF}
                onExportExcel={handleExportExcel}
            />

            <ReportFilterPanel onClear={clearFilters}>
                <div>
                    <Label>Year</Label>
                    <Select value={year} onValueChange={setYear}>
                        <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
                        <SelectContent>
                            {YEARS.map(y => (<SelectItem key={y} value={y}>{y}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Customer</Label>
                    <Select value={customerId} onValueChange={(val) => { setCustomerId(val); setProjectId("all"); }}>
                        <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {customers.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Project</Label>
                    <Select value={projectId} onValueChange={setProjectId}>
                        <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {projects.map((p) => (<SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>
            </ReportFilterPanel>

            {rows.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "Total Revenue", value: fmt(totals.grandTotal) },
                        { label: "Collected", value: fmt(totals.paidAmount), green: true },
                        { label: "Outstanding", value: fmt(totals.unpaidAmount), amber: true },
                        { label: "VAT Collected", value: fmt(totals.vatAmount) },
                    ].map((s) => (
                        <Card key={s.label} className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50">
                            <CardContent className="pt-4 pb-3">
                                <p className="text-xs text-muted-foreground">{s.label}</p>
                                <p className={`text-xl font-bold mt-1 ${s.green ? "text-green-600" : s.amber ? "text-amber-600" : ""}`}>
                                    <CurrencySymbol symbol={currencySymbol} />
                                    {s.value}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
                <CardContent className="p-0">
                    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                                <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                                    <TableHead className="h-10">Month</TableHead>
                                    <TableHead className="h-10 text-center">Invoices</TableHead>
                                    <TableHead className="h-10 text-right">Subtotal</TableHead>
                                    <TableHead className="h-10 text-right">VAT</TableHead>
                                    <TableHead className="h-10 text-right">Grand Total</TableHead>
                                    <TableHead className="h-10 text-right">Paid</TableHead>
                                    <TableHead className="h-10 text-right">Outstanding</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={7} className="h-24 text-center">Loading...</TableCell></TableRow>
                                ) : rows.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="h-24 text-center">No invoices found for {year}.</TableCell></TableRow>
                                ) : (
                                    <>
                                        {rows.map((row, idx) => (
                                            <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60">
                                                <TableCell className="font-medium">{row.monthLabel}</TableCell>
                                                <TableCell className="text-center">{row.invoiceCount}</TableCell>
                                                <TableCell className="text-right text-muted-foreground">
                                                    <span className="inline-flex items-center gap-0.5"><CurrencySymbol symbol={currencySymbol} />{fmt(row.subtotal)}</span>
                                                </TableCell>
                                                <TableCell className="text-right text-muted-foreground">
                                                    <span className="inline-flex items-center gap-0.5"><CurrencySymbol symbol={currencySymbol} />{fmt(row.vatAmount)}</span>
                                                </TableCell>
                                                <TableCell className="text-right font-bold">
                                                    <span className="inline-flex items-center gap-0.5"><CurrencySymbol symbol={currencySymbol} />{fmt(row.grandTotal)}</span>
                                                </TableCell>
                                                <TableCell className="text-right text-green-600 font-medium">
                                                    <span className="inline-flex items-center gap-0.5"><CurrencySymbol symbol={currencySymbol} />{fmt(row.paidAmount)}</span>
                                                </TableCell>
                                                <TableCell className="text-right text-amber-600 font-medium">
                                                    <span className="inline-flex items-center gap-0.5"><CurrencySymbol symbol={currencySymbol} />{fmt(row.unpaidAmount)}</span>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="bg-slate-100/80 dark:bg-slate-800/80 font-semibold border-t-2">
                                            <TableCell>Total ({year})</TableCell>
                                            <TableCell className="text-center">{totals.invoiceCount}</TableCell>
                                            <TableCell className="text-right text-muted-foreground">
                                                <span className="inline-flex items-center gap-0.5"><CurrencySymbol symbol={currencySymbol} />{fmt(totals.subtotal)}</span>
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">
                                                <span className="inline-flex items-center gap-0.5"><CurrencySymbol symbol={currencySymbol} />{fmt(totals.vatAmount)}</span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className="inline-flex items-center gap-0.5"><CurrencySymbol symbol={currencySymbol} />{fmt(totals.grandTotal)}</span>
                                            </TableCell>
                                            <TableCell className="text-right text-green-600">
                                                <span className="inline-flex items-center gap-0.5"><CurrencySymbol symbol={currencySymbol} />{fmt(totals.paidAmount)}</span>
                                            </TableCell>
                                            <TableCell className="text-right text-amber-600">
                                                <span className="inline-flex items-center gap-0.5"><CurrencySymbol symbol={currencySymbol} />{fmt(totals.unpaidAmount)}</span>
                                            </TableCell>
                                        </TableRow>
                                    </>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
