"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ReportHeader } from "@/app/Components/reports/ReportHeader";
import { ReportFilterPanel } from "@/app/Components/reports/ReportFilterPanel";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { Label } from "@/app/Components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/Components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { Card, CardContent } from "@/app/Components/ui/card";
import { toast } from "sonner";
import { generateReportPDF, generateReportExcel, formatDataForExport } from "@/app/lib/export-utils";

export default function LabourReportPage() {
    const [dateFrom, setDateFrom] = useState(undefined);
    const [dateTo, setDateTo] = useState(undefined);
    const [customerId, setCustomerId] = useState("all");
    const [projectId, setProjectId] = useState("all");

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
        queryKey: ["report-labour", dateFrom?.toISOString(), dateTo?.toISOString(), customerId, projectId],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (dateFrom) params.append("dateFrom", dateFrom.toISOString());
            if (dateTo) params.append("dateTo", dateTo.toISOString());
            if (customerId !== "all") params.append("customerId", customerId);
            if (projectId !== "all") params.append("projectId", projectId);
            const res = await fetch(`/api/reports/labour?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch report data");
            return res.json();
        },
    });

    const rows = reportData?.rows || [];

    const clearFilters = () => {
        setDateFrom(undefined);
        setDateTo(undefined);
        setCustomerId("all");
        setProjectId("all");
    };

    const exportColumns = [
        { key: "labourTypeName", header: "Labour Type" },
        { key: "companyName", header: "Customer", format: (v) => v || "Internal" },
        { key: "projectName", header: "Project", format: (v) => v || "-" },
        { key: "totalQuantity", header: "Total Qty", format: (v) => Number(v || 0).toFixed(0) },
        { key: "deployedDays", header: "Days Deployed" },
        { key: "firstDate", header: "First Date", format: (v) => v ? format(new Date(v), "dd MMM yyyy") : "-" },
        { key: "lastDate", header: "Last Date", format: (v) => v ? format(new Date(v), "dd MMM yyyy") : "-" },
    ];

    const handleExportPDF = async () => {
        try {
            const { headers, rows: exportedRows } = formatDataForExport(rows, exportColumns);
            generateReportPDF("Labour Deployment Report", headers, exportedRows, `labour-report-${format(new Date(), "yyyy-MM-dd")}`);
            toast.success("PDF exported successfully");
        } catch (error) {
            console.error(error);
            toast.error("Failed to export PDF");
        }
    };

    const handleExportExcel = async () => {
        try {
            const { headers, rows: exportedRows } = formatDataForExport(rows, exportColumns);
            generateReportExcel("Labour Deployment Report", headers, exportedRows, `labour-report-${format(new Date(), "yyyy-MM-dd")}`);
            toast.success("Excel exported successfully");
        } catch (error) {
            console.error(error);
            toast.error("Failed to export Excel");
        }
    };

    return (
        <div className="p-6 space-y-6">
            <ReportHeader
                title="Labour Deployment Report"
                description="Labour type usage by customer, project, and date range"
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

            <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
                <CardContent className="p-0">
                    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                                <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                                    <TableHead className="h-10">Labour Type</TableHead>
                                    <TableHead className="h-10">Customer</TableHead>
                                    <TableHead className="h-10">Project</TableHead>
                                    <TableHead className="h-10 text-center">Total Qty</TableHead>
                                    <TableHead className="h-10 text-center">Days Deployed</TableHead>
                                    <TableHead className="h-10">Period</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell></TableRow>
                                ) : rows.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="h-24 text-center">No labour deployments found.</TableCell></TableRow>
                                ) : rows.map((row, idx) => (
                                    <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60">
                                        <TableCell className="font-medium">{row.labourTypeName || "—"}</TableCell>
                                        <TableCell>{row.companyName || <span className="text-muted-foreground italic text-xs">Internal</span>}</TableCell>
                                        <TableCell>{row.projectName || "-"}</TableCell>
                                        <TableCell className="text-center font-medium">{Number(row.totalQuantity || 0).toFixed(0)}</TableCell>
                                        <TableCell className="text-center">{row.deployedDays}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {row.firstDate ? format(new Date(row.firstDate), "dd MMM yyyy") : "—"}
                                            {" – "}
                                            {row.lastDate ? format(new Date(row.lastDate), "dd MMM yyyy") : "—"}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="px-4 py-3 text-sm text-muted-foreground">
                        {rows.length} record{rows.length !== 1 ? "s" : ""} found
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
