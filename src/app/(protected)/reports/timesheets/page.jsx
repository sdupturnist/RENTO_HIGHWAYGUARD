"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ReportHeader } from "@/app/Components/reports/ReportHeader";
import { ReportFilterPanel } from "@/app/Components/reports/ReportFilterPanel";
import { Label } from "@/app/Components/ui/label";
import { Button } from "@/app/Components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { Badge } from "@/app/Components/ui/badge";
import { Card, CardContent } from "@/app/Components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/Components/ui/select";
import { toast } from "sonner";
import { generateReportPDF, generateReportExcel, formatDataForExport } from "@/app/lib/export-utils";
export default function TimesheetsReportPage() {
    const [page, setPage] = useState(1);
    const perPage = 50;
    const [status, setStatus] = useState("all");
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
        queryKey: ["report-timesheets", page, status, customerId, projectId],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append("page", page.toString());
            params.append("perPage", perPage.toString());
            if (status && status !== "all") params.append("status", status);
            if (customerId !== "all") params.append("customerId", customerId);
            if (projectId !== "all") params.append("projectId", projectId);
            const res = await fetch(`/api/reports/timesheets?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch report data");
            return res.json();
        },
    });

    const timesheets = reportData?.timesheets || [];
    const total = reportData?.total || 0;

    const clearFilters = () => {
        setStatus("all");
        setCustomerId("all");
        setProjectId("all");
        setPage(1);
    };
    const handleExportPDF = async () => {
        try {
            const { headers, rows } = formatDataForExport(timesheets, [
                { key: "id", header: "ID", format: (v) => `#${v}` },
                { key: "customer", header: "Customer", format: (v) => v.companyName },
                { key: "project", header: "Project", format: (v) => v?.name || "-" },
                { key: "totalVehicles", header: "Vehicles" },
                { key: "totalOperators", header: "Operators" },
                { key: "totalWorkedHours", header: "Total Hours", format: (v) => v.toFixed(2) },
                { key: "status", header: "Status" },
                { key: "createdAt", header: "Created", format: (v) => format(new Date(v), "dd MMM yyyy") },
            ]);
            generateReportPDF("Timesheet Report", headers, rows, `timesheets-${format(new Date(), "yyyy-MM-dd")}`);
            toast.success("PDF exported successfully");
        }
        catch (error) {
            console.error(error);
            toast.error("Failed to export PDF");
        }
    };
    const handleExportExcel = async () => {
        try {
            const { headers, rows } = formatDataForExport(timesheets, [
                { key: "id", header: "ID", format: (v) => `#${v}` },
                { key: "customer", header: "Customer", format: (v) => v.companyName },
                { key: "project", header: "Project", format: (v) => v?.name || "-" },
                { key: "totalVehicles", header: "Vehicles" },
                { key: "totalOperators", header: "Operators" },
                { key: "totalWorkedHours", header: "Total Hours", format: (v) => v.toFixed(2) },
                { key: "status", header: "Status" },
                { key: "createdAt", header: "Created", format: (v) => format(new Date(v), "dd MMM yyyy") },
            ]);
            generateReportExcel("Timesheet Report", headers, rows, `timesheets-${format(new Date(), "yyyy-MM-dd")}`);
            toast.success("Excel exported successfully");
        }
        catch (error) {
            console.error(error);
            toast.error("Failed to export Excel");
        }
    };
    return (<div className="p-6 space-y-6">
            <ReportHeader title="Timesheet Report" description="Overview of all timesheets with summary metrics" backHref="/reports" onExportPDF={handleExportPDF} onExportExcel={handleExportExcel}/>

            <ReportFilterPanel onClear={clearFilters}>
                <div>
                    <Label>Customer</Label>
                    <Select value={customerId} onValueChange={(val) => { setCustomerId(val); setProjectId("all"); }}>
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
                    <Label>Project</Label>
                    <Select value={projectId} onValueChange={setProjectId}>
                        <SelectTrigger>
                            <SelectValue placeholder="All"/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {projects.map((p) => (<SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger>
                            <SelectValue placeholder="All"/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="DRAFT">Draft</SelectItem>
                            <SelectItem value="APPROVED">Approved</SelectItem>
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
                                    <TableHead className="h-10">ID</TableHead>
                                    <TableHead className="h-10">Customer</TableHead>
                                    <TableHead className="h-10">Project</TableHead>
                                    <TableHead className="h-10 text-center">Vehicles</TableHead>
                                    <TableHead className="h-10 text-center">Operators</TableHead>
                                    <TableHead className="h-10 text-center">Total Hours</TableHead>
                                    <TableHead className="h-10 text-center">Status</TableHead>
                                    <TableHead className="h-10">Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (<TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">Loading...</TableCell>
                                    </TableRow>) : timesheets.length === 0 ? (<TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">No timesheets found.</TableCell>
                                    </TableRow>) : (timesheets.map((ts) => (<TableRow key={ts.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60">
                                            <TableCell>#{ts.id}</TableCell>
                                            <TableCell className="max-w-[200px] truncate">{ts.customer.companyName}</TableCell>
                                            <TableCell className="max-w-[200px] truncate">{ts.project?.name || "-"}</TableCell>
                                            <TableCell className="text-center font-medium">{ts.totalVehicles}</TableCell>
                                            <TableCell className="text-center font-medium">{ts.totalOperators}</TableCell>
                                            <TableCell className="text-center font-medium">{ts.totalWorkedHours.toFixed(2)}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={ts.status === "APPROVED" ? "default" : "secondary"}>
                                                    {ts.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{format(new Date(ts.createdAt), "dd MMM yyyy")}</TableCell>
                                        </TableRow>)))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="mt-4 px-4 pb-4 flex items-center justify-between text-sm text-muted-foreground">
                        <div>Showing {timesheets.length} of {total} entries</div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                            <Button variant="outline" size="sm" disabled={timesheets.length < perPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>);
}
