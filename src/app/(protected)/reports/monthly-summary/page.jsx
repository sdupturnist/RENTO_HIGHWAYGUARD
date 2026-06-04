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
import { format } from "date-fns";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => String(CURRENT_YEAR - i));

export default function MonthlySummaryReportPage() {
    const [year, setYear] = useState(String(CURRENT_YEAR));
    const [customerId, setCustomerId] = useState("all");
    const [projectId, setProjectId] = useState("all");
    const [isInternal, setIsInternal] = useState("all");

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
        queryKey: ["report-monthly-summary", year, customerId, projectId, isInternal],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (year) params.append("year", year);
            if (customerId !== "all") params.append("customerId", customerId);
            if (projectId !== "all") params.append("projectId", projectId);
            if (isInternal !== "all") params.append("isInternal", isInternal);
            const res = await fetch(`/api/reports/monthly-summary?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch report data");
            return res.json();
        },
    });

    const rows = reportData?.rows || [];

    const totals = rows.reduce((acc, r) => ({
        regularHours: acc.regularHours + r.regularHours,
        overtimeHours: acc.overtimeHours + r.overtimeHours,
        holidayHours: acc.holidayHours + r.holidayHours,
        totalHours: acc.totalHours + r.totalHours,
    }), { regularHours: 0, overtimeHours: 0, holidayHours: 0, totalHours: 0 });

    const clearFilters = () => {
        setYear(String(CURRENT_YEAR));
        setCustomerId("all");
        setProjectId("all");
        setIsInternal("all");
    };

    const prepareExportData = () => rows.map(r => ({
        _month: r.monthLabel,
        _total: r.totalHours.toFixed(2),
        _regular: r.regularHours.toFixed(2),
        _ot: r.overtimeHours.toFixed(2),
        _holiday: r.holidayHours.toFixed(2),
        _vehicles: String(r.vehicleCount || 0),
        _operators: String(r.operatorCount || 0),
        _matQty: String(r.materialQty || 0),
        _labQty: String(r.labourQty || 0),
        _assignments: String(r.assignmentCount || 0),
        _customers: String(r.customerCount || 0),
    }));

    const exportColumns = [
        { key: "_month", header: "Month" },
        { key: "_total", header: "Total Hours" },
        { key: "_regular", header: "Regular" },
        { key: "_ot", header: "Overtime" },
        { key: "_holiday", header: "Holiday" },
        { key: "_vehicles", header: "Vehicles" },
        { key: "_operators", header: "Operators" },
        { key: "_matQty", header: "Material Qty" },
        { key: "_labQty", header: "Labour Qty" },
        { key: "_assignments", header: "Assignments" },
        { key: "_customers", header: "Customers" },
    ];

    const handleExportPDF = async () => {
        try {
            const { headers, rows: exportedRows } = formatDataForExport(prepareExportData(), exportColumns);
            generateReportPDF(`Monthly Summary ${year}`, headers, exportedRows, `monthly-summary-${year}`);
            toast.success("PDF exported successfully");
        } catch (e) { console.error(e); toast.error("Failed to export PDF"); }
    };

    const handleExportExcel = async () => {
        try {
            const { headers, rows: exportedRows } = formatDataForExport(prepareExportData(), exportColumns);
            generateReportExcel(`Monthly Summary ${year}`, headers, exportedRows, `monthly-summary-${year}`);
            toast.success("Excel exported successfully");
        } catch (e) { console.error(e); toast.error("Failed to export Excel"); }
    };

    return (
        <div className="p-6 space-y-6">
            <ReportHeader
                title="Monthly Summary Report"
                description="Month-by-month breakdown of hours, resources, and deployments"
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
                    <Label>Scope</Label>
                    <Select value={isInternal} onValueChange={setIsInternal}>
                        <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="false">Customer Only</SelectItem>
                            <SelectItem value="true">Internal Only</SelectItem>
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

            <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
                <CardContent className="p-0">
                    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                                <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                                    <TableHead className="h-10">Month</TableHead>
                                    <TableHead className="h-10 text-right">Total Hrs</TableHead>
                                    <TableHead className="h-10 text-right">Regular</TableHead>
                                    <TableHead className="h-10 text-right">Overtime</TableHead>
                                    <TableHead className="h-10 text-right">Holiday</TableHead>
                                    <TableHead className="h-10 text-center">Vehicles</TableHead>
                                    <TableHead className="h-10 text-center">Operators</TableHead>
                                    <TableHead className="h-10 text-center">Mat Qty</TableHead>
                                    <TableHead className="h-10 text-center">Lab Qty</TableHead>
                                    <TableHead className="h-10 text-center">Assignments</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={10} className="h-24 text-center">Loading...</TableCell></TableRow>
                                ) : rows.length === 0 ? (
                                    <TableRow><TableCell colSpan={10} className="h-24 text-center">No data found for {year}.</TableCell></TableRow>
                                ) : (
                                    <>
                                        {rows.map((row, idx) => (
                                            <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60">
                                                <TableCell className="font-medium">{row.monthLabel}</TableCell>
                                                <TableCell className="text-right font-bold">{row.totalHours.toFixed(2)}</TableCell>
                                                <TableCell className="text-right text-muted-foreground">{row.regularHours.toFixed(2)}</TableCell>
                                                <TableCell className="text-right text-amber-600">{row.overtimeHours.toFixed(2)}</TableCell>
                                                <TableCell className="text-right text-blue-600">{row.holidayHours.toFixed(2)}</TableCell>
                                                <TableCell className="text-center">{row.vehicleCount}</TableCell>
                                                <TableCell className="text-center">{row.operatorCount}</TableCell>
                                                <TableCell className="text-center">{row.materialQty}</TableCell>
                                                <TableCell className="text-center">{row.labourQty}</TableCell>
                                                <TableCell className="text-center">{row.assignmentCount}</TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="bg-slate-100/80 dark:bg-slate-800/80 font-semibold border-t-2">
                                            <TableCell>Total</TableCell>
                                            <TableCell className="text-right">{totals.totalHours.toFixed(2)}</TableCell>
                                            <TableCell className="text-right text-muted-foreground">{totals.regularHours.toFixed(2)}</TableCell>
                                            <TableCell className="text-right text-amber-600">{totals.overtimeHours.toFixed(2)}</TableCell>
                                            <TableCell className="text-right text-blue-600">{totals.holidayHours.toFixed(2)}</TableCell>
                                            <TableCell colSpan={5} />
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
