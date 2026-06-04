"use client";
import { useState, useEffect } from "react";
import { ReportHeader } from "@/app/Components/reports/ReportHeader";
import { ReportFilterPanel } from "@/app/Components/reports/ReportFilterPanel";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { Label } from "@/app/Components/ui/label";
import { Button } from "@/app/Components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { Card, CardContent } from "@/app/Components/ui/card";
import { toast } from "sonner";
import { generateReportPDF, generateReportExcel, formatDataForExport } from "@/app/lib/export-utils";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/Components/ui/select";
import { useQuery } from "@tanstack/react-query";

export default function OperatorUtilizationReportPage() {
    const [page, setPage] = useState(1);
    const perPage = 50;
    const [dateFrom, setDateFrom] = useState(startOfMonth(new Date()));
    const [dateTo, setDateTo] = useState(endOfMonth(new Date()));
    const [operatorId, setOperatorId] = useState("all");

    // Query for operator options
    const { data: operatorOptions = [] } = useQuery({
        queryKey: ["operators"],
        queryFn: () => fetch("/api/operators").then(res => res.json()),
        staleTime: 30 * 1000,
    });

    // Query for utilization report data
    const { data, isLoading: loading } = useQuery({
        queryKey: ["report", "operator-utilization", page, dateFrom, dateTo, operatorId],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append("page", page.toString());
            params.append("perPage", perPage.toString());
            if (dateFrom) params.append("dateFrom", dateFrom.toISOString());
            if (dateTo) params.append("dateTo", dateTo.toISOString());
            if (operatorId !== "all") params.append("operatorId", operatorId);
            const res = await fetch(`/api/reports/operator-utilization?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch report data");
            return res.json();
        },
        staleTime: 60 * 1000,
    });

    const operators = data?.operators || [];
    const total = data?.total || 0;

    const clearFilters = () => {
        setDateFrom(startOfMonth(new Date()));
        setDateTo(endOfMonth(new Date()));
        setOperatorId("all");
        setPage(1);
    };
    const handleExportPDF = async () => {
        try {
            const { headers, rows } = formatDataForExport(operators, [
                { key: "operatorName", header: "Operator" },
                { key: "assignedDays", header: "Assigned Days" },
                { key: "utilizationPercent", header: "Utilization %", format: (v) => `${v}%` },
            ]);
            generateReportPDF("Operator Utilization Report", headers, rows, `operator-utilization-${format(new Date(), "yyyy-MM-dd")}`);
            toast.success("PDF exported successfully");
        }
        catch (error) {
            console.error(error);
            toast.error("Failed to export PDF");
        }
    };
    const handleExportExcel = async () => {
        try {
            const { headers, rows } = formatDataForExport(operators, [
                { key: "operatorName", header: "Operator" },
                { key: "assignedDays", header: "Assigned Days" },
                { key: "utilizationPercent", header: "Utilization %" },
            ]);
            generateReportExcel("Operator Utilization Report", headers, rows, `operator-utilization-${format(new Date(), "yyyy-MM-dd")}`);
            toast.success("Excel exported successfully");
        }
        catch (error) {
            console.error(error);
            toast.error("Failed to export Excel");
        }
    };
    return (<div className="p-6 space-y-6">
            <ReportHeader title="Operator Utilization Report" description="Operator assignment metrics and utilization percentages" backHref="/reports" onExportPDF={handleExportPDF} onExportExcel={handleExportExcel}/>

            <ReportFilterPanel onClear={clearFilters}>
                <div>
                    <Label>From Date</Label>
                    <FormattedDatePicker value={dateFrom} onChange={setDateFrom} placeholder="Select start date"/>
                </div>
                <div>
                    <Label>To Date</Label>
                    <FormattedDatePicker value={dateTo} onChange={setDateTo} placeholder="Select end date"/>
                </div>
                <div>
                    <Label>Operator</Label>
                    <Select value={operatorId} onValueChange={setOperatorId}>
                        <SelectTrigger>
                            <SelectValue placeholder="All"/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {operatorOptions.map((o) => (<SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>))}
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
                                    <TableHead className="h-10">Operator Name</TableHead>
                                    <TableHead className="h-10 text-center">Assigned Days</TableHead>
                                    <TableHead className="h-10 text-center">Worked Hours</TableHead>
                                    <TableHead className="h-10 text-center">Utilization %</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (<TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">Loading...</TableCell>
                                    </TableRow>) : operators.length === 0 ? (<TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">No operators found.</TableCell>
                                    </TableRow>) : (operators.map((operator, idx) => (<TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60">
                                            <TableCell className="font-medium">{operator.operatorName}</TableCell>
                                            <TableCell className="text-center">{operator.assignedDays}</TableCell>
                                            <TableCell className="text-center">{operator.workedHours.toFixed(2)}</TableCell>
                                            <TableCell className="text-center font-medium">{operator.utilizationPercent}%</TableCell>
                                        </TableRow>)))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="mt-4 px-4 pb-4 flex items-center justify-between text-sm text-muted-foreground">
                        <div>Showing {operators.length} of {total} entries</div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                            <Button variant="outline" size="sm" disabled={operators.length < perPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>);
}
