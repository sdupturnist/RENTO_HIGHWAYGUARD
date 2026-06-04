"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ReportHeader } from "@/app/Components/reports/ReportHeader";
import { ReportFilterPanel } from "@/app/Components/reports/ReportFilterPanel";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { Label } from "@/app/Components/ui/label";
import { Button } from "@/app/Components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { Card, CardContent } from "@/app/Components/ui/card";
import { Badge } from "@/app/Components/ui/badge";
import { toast } from "sonner";
import { generateReportPDF, generateReportExcel, formatDataForExport } from "@/app/lib/export-utils";
import { startOfMonth, endOfMonth, format } from "date-fns";
export default function OperatorOvertimeReportPage() {
    const [page, setPage] = useState(1);
    const perPage = 50;
    const [dateFrom, setDateFrom] = useState(startOfMonth(new Date()));
    const [dateTo, setDateTo] = useState(endOfMonth(new Date()));

    const { data: reportData, isLoading: loading } = useQuery({
        queryKey: ["report-operator-overtime", page, dateFrom?.toISOString(), dateTo?.toISOString()],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append("page", page.toString());
            params.append("perPage", perPage.toString());
            if (dateFrom) params.append("dateFrom", dateFrom.toISOString());
            if (dateTo) params.append("dateTo", dateTo.toISOString());
            const res = await fetch(`/api/reports/operator-overtime?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch report data");
            return res.json();
        },
    });

    const operators = reportData?.operators || [];
    const total = reportData?.total || 0;

    const clearFilters = () => {
        setDateFrom(startOfMonth(new Date()));
        setDateTo(endOfMonth(new Date()));
        setPage(1);
    };
    const handleExportPDF = async () => {
        try {
            const { headers, rows } = formatDataForExport(operators, [
                { key: "operatorName", header: "Operator" },
                { key: "totalWorkedHours", header: "Total Hours" },
                { key: "overtimeHours", header: "Overtime Hours" },
                { key: "weekendDays", header: "Weekend Days" },
                { key: "holidayDays", header: "Holiday Days" },
            ]);
            generateReportPDF("Operator Overtime Summary", headers, rows, `operator-overtime-${format(new Date(), "yyyy-MM-dd")}`);
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
                { key: "totalWorkedHours", header: "Total Hours" },
                { key: "overtimeHours", header: "Overtime Hours" },
                { key: "weekendDays", header: "Weekend Days" },
                { key: "holidayDays", header: "Holiday Days" },
            ]);
            generateReportExcel("Operator Overtime Summary", headers, rows, `operator-overtime-${format(new Date(), "yyyy-MM-dd")}`);
            toast.success("Excel exported successfully");
        }
        catch (error) {
            console.error(error);
            toast.error("Failed to export Excel");
        }
    };
    return (<div className="p-6 space-y-6">
            <ReportHeader title="Operator Overtime Summary" description="Detailed breakdown of operator overtime and special hours" backHref="/reports" onExportPDF={handleExportPDF} onExportExcel={handleExportExcel}/>

            <ReportFilterPanel onClear={clearFilters}>
                <div>
                    <Label>From Date</Label>
                    <FormattedDatePicker value={dateFrom} onChange={setDateFrom} placeholder="Select start date"/>
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
                                    <TableHead className="h-10">Operator Name</TableHead>
                                    <TableHead className="h-10 text-center">Total Hours</TableHead>
                                    <TableHead className="h-10 text-center">Overtime Hours</TableHead>
                                    <TableHead className="h-10 text-center">Weekend Days</TableHead>
                                    <TableHead className="h-10 text-center">Holiday Days</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (<TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell>
                                    </TableRow>) : operators.length === 0 ? (<TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">No operators found.</TableCell>
                                    </TableRow>) : (operators.map((operator, idx) => (<TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60">
                                            <TableCell className="font-medium">{operator.operatorName}</TableCell>
                                            <TableCell className="text-center">{operator.totalWorkedHours}</TableCell>
                                            <TableCell className="text-center">
                                                <span className={`font-medium ${parseFloat(operator.overtimeHours) > 0 ? "text-orange-600" : ""}`}>
                                                    {operator.overtimeHours}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {operator.weekendDays > 0 ? (<Badge variant="secondary">{operator.weekendDays}</Badge>) : (<span className="text-muted-foreground">0</span>)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {operator.holidayDays > 0 ? (<Badge variant="secondary" className="bg-blue-100 text-blue-700">{operator.holidayDays}</Badge>) : (<span className="text-muted-foreground">0</span>)}
                                            </TableCell>
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
