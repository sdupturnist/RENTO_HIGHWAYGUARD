"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ReportHeader } from "@/app/Components/reports/ReportHeader";
import { ReportFilterPanel } from "@/app/Components/reports/ReportFilterPanel";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { Label } from "@/app/Components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/Components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { Card, CardContent } from "@/app/Components/ui/card";
import { Badge } from "@/app/Components/ui/badge";
import { toast } from "sonner";
import { generateReportPDF, generateReportExcel, formatDataForExport } from "@/app/lib/export-utils";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";
import { useSettings } from "@/app/Components/providers/SettingsProvider";

export default function ProfitabilityReportPage() {
    const [dateFrom, setDateFrom] = useState(startOfMonth(new Date()));
    const [dateTo, setDateTo] = useState(endOfMonth(new Date()));
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
        queryKey: ["report-profitability", dateFrom?.toISOString(), dateTo?.toISOString(), customerId, projectId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (dateFrom) params.append("dateFrom", dateFrom.toISOString());
            if (dateTo) params.append("dateTo", dateTo.toISOString());
            if (customerId !== "all") params.append("customerId", customerId);
            if (projectId !== "all") params.append("projectId", projectId);
            const res = await fetch(`/api/reports/profitability?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch report data");
            return res.json();
        },
    });

    const rows = reportData?.rows || [];

    const totals = rows.reduce((acc, r) => ({
        billed: acc.billed + r.totalBilled,
        cost: acc.cost + r.estimatedCost,
        profit: acc.profit + r.profit,
    }), { billed: 0, cost: 0, profit: 0 });

    const overallMargin = totals.billed > 0 ? (totals.profit / totals.billed) * 100 : 0;

    const clearFilters = () => {
        setDateFrom(startOfMonth(new Date()));
        setDateTo(endOfMonth(new Date()));
        setCustomerId("all");
        setProjectId("all");
    };

    const fmt = (v) => new Intl.NumberFormat("en-AE", { minimumFractionDigits: 2 }).format(v);

    const exportColumns = [
        { key: "timesheetCode", header: "Timesheet" },
        { key: "companyName", header: "Customer", format: (v) => v || "-" },
        { key: "projectName", header: "Project", format: (v) => v || "-" },
        { key: "periodStart", header: "Period Start", format: (v) => v ? format(new Date(v), "dd MMM yyyy") : "-" },
        { key: "periodEnd", header: "Period End", format: (v) => v ? format(new Date(v), "dd MMM yyyy") : "-" },
        { key: "totalBilled", header: "Billed", format: (v) => fmt(v) },
        { key: "estimatedCost", header: "Est. Cost", format: (v) => fmt(v) },
        { key: "profit", header: "Profit", format: (v) => fmt(v) },
        { key: "marginPercent", header: "Margin %", format: (v) => `${v}%` },
        { key: "status", header: "Status" },
    ];

    const handleExportPDF = async () => {
        try {
            const { headers, rows: exportedRows } = formatDataForExport(rows, exportColumns);
            generateReportPDF("Profitability Report", headers, exportedRows, `profitability-${format(new Date(), "yyyy-MM-dd")}`);
            toast.success("PDF exported successfully");
        } catch (error) {
            console.error(error);
            toast.error("Failed to export PDF");
        }
    };

    const handleExportExcel = async () => {
        try {
            const { headers, rows: exportedRows } = formatDataForExport(rows, exportColumns);
            generateReportExcel("Profitability Report", headers, exportedRows, `profitability-${format(new Date(), "yyyy-MM-dd")}`);
            toast.success("Excel exported successfully");
        } catch (error) {
            console.error(error);
            toast.error("Failed to export Excel");
        }
    };

    const marginColor = (pct) => {
        if (pct >= 30) return "text-green-600";
        if (pct >= 10) return "text-yellow-600";
        return "text-red-600";
    };

    return (
        <div className="p-6 space-y-6">
            <ReportHeader
                title="Profitability Report"
                description="Billed amount vs estimated resource cost per timesheet"
                backHref="/reports"
                onExportPDF={handleExportPDF}
                onExportExcel={handleExportExcel}
            />

            <ReportFilterPanel onClear={clearFilters}>
                <div>
                    <Label>From Date</Label>
                    <FormattedDatePicker value={dateFrom} onChange={setDateFrom} placeholder="Select start date" />
                </div>
                <div>
                    <Label>To Date</Label>
                    <FormattedDatePicker value={dateTo} onChange={setDateTo} placeholder="Select end date" />
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
                        { label: "Total Billed", value: fmt(totals.billed) },
                        { label: "Est. Cost", value: fmt(totals.cost) },
                        { label: "Gross Profit", value: fmt(totals.profit) },
                        { label: "Overall Margin", value: `${overallMargin.toFixed(1)}%` },
                    ].map((s) => (
                        <Card key={s.label} className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50">
                            <CardContent className="pt-4 pb-3">
                                <p className="text-xs text-muted-foreground">{s.label}</p>
                                <p className="text-xl font-bold mt-1">
                                    {s.label !== "Overall Margin" && <CurrencySymbol symbol={currencySymbol} />}
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
                                    <TableHead className="h-10">Timesheet</TableHead>
                                    <TableHead className="h-10">Customer</TableHead>
                                    <TableHead className="h-10">Project</TableHead>
                                    <TableHead className="h-10">Period</TableHead>
                                    <TableHead className="h-10 text-right">Billed</TableHead>
                                    <TableHead className="h-10 text-right">Est. Cost</TableHead>
                                    <TableHead className="h-10 text-right">Profit</TableHead>
                                    <TableHead className="h-10 text-right">Margin</TableHead>
                                    <TableHead className="h-10">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={9} className="h-24 text-center">Loading...</TableCell></TableRow>
                                ) : rows.length === 0 ? (
                                    <TableRow><TableCell colSpan={9} className="h-24 text-center">No timesheets found for this period.</TableCell></TableRow>
                                ) : rows.map((row) => (
                                    <TableRow key={row.timesheetId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60">
                                        <TableCell className="font-mono text-xs font-medium">{row.timesheetCode}</TableCell>
                                        <TableCell>{row.companyName || "—"}</TableCell>
                                        <TableCell>{row.projectName || "-"}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {row.periodStart ? format(new Date(row.periodStart), "dd MMM") : "—"}
                                            {" – "}
                                            {row.periodEnd ? format(new Date(row.periodEnd), "dd MMM yyyy") : "—"}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            <span className="inline-flex items-center gap-0.5">
                                                <CurrencySymbol symbol={currencySymbol} />
                                                {fmt(row.totalBilled)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            <span className="inline-flex items-center gap-0.5">
                                                <CurrencySymbol symbol={currencySymbol} />
                                                {fmt(row.estimatedCost)}
                                            </span>
                                        </TableCell>
                                        <TableCell className={`text-right font-medium ${row.profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                                            <span className="inline-flex items-center gap-0.5">
                                                <CurrencySymbol symbol={currencySymbol} />
                                                {fmt(row.profit)}
                                            </span>
                                        </TableCell>
                                        <TableCell className={`text-right font-bold ${marginColor(row.marginPercent)}`}>
                                            {row.marginPercent}%
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="text-xs">{row.status}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="px-4 py-3 text-sm text-muted-foreground">
                        {rows.length} timesheet{rows.length !== 1 ? "s" : ""} found
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
