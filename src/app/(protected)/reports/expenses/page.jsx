"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { ReportHeader } from "@/app/Components/reports/ReportHeader";
import { ReportFilterPanel } from "@/app/Components/reports/ReportFilterPanel";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { Label } from "@/app/Components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/Components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { Badge } from "@/app/Components/ui/badge";
import { Loader2 } from "lucide-react";
import { generateReportPDF, generateReportExcel, formatDataForExport } from "@/app/lib/export-utils";
import { useSettings } from "@/app/Components/providers/SettingsProvider";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";

export default function ExpenseReportPage() {
    const { currencySymbol } = useSettings();

    const [dateFrom, setDateFrom] = useState(undefined);
    const [dateTo, setDateTo] = useState(undefined);
    const [status, setStatus] = useState("all");
    const [typeId, setTypeId] = useState("all");
    const [vehicleId, setVehicleId] = useState("all");

    const filteredParams = useMemo(() => {
        const p = new URLSearchParams();
        if (dateFrom) p.append("startDate", dateFrom.toISOString());
        if (dateTo) p.append("endDate", dateTo.toISOString());
        if (status !== "all") p.append("status", status);
        if (typeId !== "all") p.append("expenseTypeId", typeId);
        if (vehicleId !== "all") p.append("vehicleId", vehicleId);
        return p.toString();
    }, [dateFrom, dateTo, status, typeId, vehicleId]);

    const { data: reportData, isLoading: loading } = useQuery({
        queryKey: ["report-expenses", filteredParams],
        queryFn: async () => {
            const res = await fetch(`/api/reports/expenses?${filteredParams}`);
            if (!res.ok) throw new Error("Failed to load");
            const json = await res.json();
            const mapped = (json.data || []).map((m) => ({
                ...m,
                amount: m.amount !== null && m.amount !== undefined ? Number(m.amount) : null,
            }));
            return { rows: mapped, summary: json.summary || null };
        },
    });

    const rows = reportData?.rows || [];
    const summary = reportData?.summary || null;

    const { data: types = [] } = useQuery({
        queryKey: ["expense-types"],
        queryFn: async () => {
            const res = await fetch("/api/settings/master/expense");
            return res.json();
        },
    });

    const { data: vehicles = [] } = useQuery({
        queryKey: ["vehicles-active"],
        queryFn: async () => {
            const res = await fetch("/api/vehicles/active");
            const data = await res.json();
            return data.items || data.vehicles || (Array.isArray(data) ? data : []);
        },
    });

    const clearFilters = () => {
        setDateFrom(undefined);
        setDateTo(undefined);
        setStatus("all");
        setTypeId("all");
        setVehicleId("all");
    };

    const statusBadge = (val) => {
        const variants = {
            DRAFT: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
            CONFIRMED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        };
        return <Badge className={variants[val] || "bg-slate-100 text-slate-800"}>{val}</Badge>;
    };

    const handleExport = (formatType) => {
        try {
            const { headers, rows: dataRows } = formatDataForExport(rows, [
                { key: "expenseCode", header: "Record Code" },
                { key: "date", header: "Date", format: (v) => format(new Date(v), "dd MMM yyyy") },
                { key: "expenseType", header: "Expense Type", format: (v) => v?.name || "-" },
                { key: "vehicle", header: "Vehicle", format: (v) => v?.vehicleCode || "-" },
                { key: "project", header: "Project", format: (v) => v?.name || "-" },
                { key: "status", header: "Status" },
                { key: "amount", header: "Amount", format: (v) => (v !== null && v !== undefined ? Number(v).toFixed(2) : "0.00") },
            ]);

            const filename = `expense-report-${format(new Date(), "yyyy-MM-dd")}`;

            if (formatType === "pdf") {
                generateReportPDF("Expense Report", headers, dataRows, filename);
            } else {
                generateReportExcel("Expense Report", headers, dataRows, filename);
            }
            toast.success(`Exported ${formatType.toUpperCase()} successfully`);
        } catch (error) {
            console.error(error);
            toast.error("Failed to export");
        }
    };

    return (
        <div className="p-6 space-y-6">
            <ReportHeader
                title="Expense Report"
                description="Comprehensive view of operational and miscellaneous expenses."
                backHref="/reports"
                onExportPDF={() => handleExport("pdf")}
                onExportExcel={() => handleExport("excel")}
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
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="DRAFT">Draft</SelectItem>
                            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Vehicle</Label>
                    <Select value={vehicleId} onValueChange={setVehicleId}>
                        <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {vehicles.map((v) => (
                                <SelectItem key={v.id} value={String(v.id)}>{v.vehicleCode}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Type</Label>
                    <Select value={typeId} onValueChange={setTypeId}>
                        <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {types.map((t) => (
                                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </ReportFilterPanel>

            {/* Summary Row */}
            {summary && !loading && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm">
                        <CardHeader className="py-4">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold"><CurrencySymbol symbol={currencySymbol} /> {Number(summary.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        </CardContent>
                    </Card>
                    <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm md:col-span-2">
                        <CardHeader className="py-4">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Top Categories</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-4">
                                {summary.byType.slice(0, 4).map((cat, idx) => (
                                    <div key={idx} className="flex flex-col">
                                        <span className="text-xs text-muted-foreground">{cat.name}</span>
                                        <span className="font-semibold text-sm"><CurrencySymbol symbol={currencySymbol} /> {Number(cat.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                ))}
                                {summary.byType.length === 0 && <span className="text-sm text-muted-foreground">No data available</span>}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
                <CardContent className="p-0">
                    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                                <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                                    <TableHead>Code</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Vehicle</TableHead>
                                    <TableHead>Project</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Loading...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">No expense records found.</TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((m) => (
                                        <TableRow key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60">
                                            <TableCell className="font-medium text-xs text-muted-foreground">{m.expenseCode}</TableCell>
                                            <TableCell>{format(new Date(m.date), "dd MMM yyyy")}</TableCell>
                                            <TableCell>{m.expenseType?.name || "-"}</TableCell>
                                            <TableCell>{m.vehicle?.vehicleCode || "-"}</TableCell>
                                            <TableCell>{m.project?.name || "-"}</TableCell>
                                            <TableCell>{statusBadge(m.status)}</TableCell>
                                            <TableCell className="text-right font-medium">
                                                {m.amount !== null && m.amount !== undefined
                                                    ? <span className="inline-flex items-center gap-1"><CurrencySymbol symbol={currencySymbol} /> {m.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                    : "-"}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
