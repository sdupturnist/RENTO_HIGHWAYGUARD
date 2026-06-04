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
import { Card, CardContent } from "@/app/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { Badge } from "@/app/Components/ui/badge";
import { Loader2 } from "lucide-react";
import { generateReportPDF, generateReportExcel, formatDataForExport } from "@/app/lib/export-utils";
export default function MaintenanceReportPage() {
    const [dateFrom, setDateFrom] = useState(undefined);
    const [dateTo, setDateTo] = useState(undefined);
    const [status, setStatus] = useState("all");
    const [typeId, setTypeId] = useState("all");
    const [vehicleId, setVehicleId] = useState("all");

    const filteredParams = useMemo(() => {
        const p = new URLSearchParams();
        p.append("perPage", "500");
        if (dateFrom) p.append("dateFrom", dateFrom.toISOString());
        if (dateTo) p.append("dateTo", dateTo.toISOString());
        if (status !== "all") p.append("status", status);
        if (typeId !== "all") p.append("maintenanceTypeId", typeId);
        if (vehicleId !== "all") p.append("vehicleId", vehicleId);
        return p.toString();
    }, [dateFrom, dateTo, status, typeId, vehicleId]);

    const { data: rows = [], isLoading: loading } = useQuery({
        queryKey: ["report-maintenance", filteredParams],
        queryFn: async () => {
            const res = await fetch(`/api/maintenance?${filteredParams}`);
            if (!res.ok) throw new Error("Failed to load");
            const json = await res.json();
            return (json.maintenances || []).map((m) => ({
                ...m,
                amount: m.amount !== null && m.amount !== undefined ? Number(m.amount) : null,
            }));
        },
    });

    const { data: types = [] } = useQuery({
        queryKey: ["maintenance-types"],
        queryFn: async () => {
            const res = await fetch("/api/master-config/maintenance-types");
            return res.json();
        },
    });

    const { data: vehicles = [] } = useQuery({
        queryKey: ["vehicles-all"],
        queryFn: async () => {
            const res = await fetch("/api/vehicles");
            const data = await res.json();
            return Array.isArray(data) ? data : [];
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
            SCHEDULED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
            IN_PROGRESS: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
            COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        };
        return <Badge className={variants[val] || "bg-slate-100 text-slate-800"}>{val.replace("_", " ")}</Badge>;
    };
    const handleExport = (formatType) => {
        try {
            const { headers, rows: dataRows } = formatDataForExport(rows, [
                { key: "maintenanceCode", header: "Code" },
                { key: "vehicle", header: "Vehicle", format: (v) => v?.vehicleCode || "-" },
                { key: "maintenanceType", header: "Type", format: (v) => v?.name || "-" },
                { key: "startDate", header: "Start", format: (v) => format(new Date(v), "dd MMM yyyy") },
                { key: "endDate", header: "End", format: (v) => (v ? format(new Date(v), "dd MMM yyyy") : "-") },
                { key: "status", header: "Status" },
                { key: "amount", header: "Amount", format: (v) => (v !== null && v !== undefined ? Number(v).toFixed(2) : "0.00") },
            ]);
            const filename = `maintenance-${format(new Date(), "yyyy-MM-dd")}`;
            if (formatType === "pdf") {
                generateReportPDF("Maintenance Report", headers, dataRows, filename);
            }
            else {
                generateReportExcel("Maintenance Report", headers, dataRows, filename);
            }
            toast.success(`Exported ${formatType.toUpperCase()} successfully`);
        }
        catch (error) {
            console.error(error);
            toast.error("Failed to export");
        }
    };
    return (<div className="p-6 space-y-6">
            <ReportHeader title="Maintenance Report" description="Overview of maintenance tasks, status, and costs." backHref="/reports" onExportPDF={() => handleExport("pdf")} onExportExcel={() => handleExport("excel")}/>

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
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger><SelectValue placeholder="All"/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                            <SelectItem value="COMPLETED">Completed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Vehicle</Label>
                    <Select value={vehicleId} onValueChange={setVehicleId}>
                        <SelectTrigger><SelectValue placeholder="All"/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {vehicles.map((v) => (<SelectItem key={v.id} value={String(v.id)}>{v.vehicleCode || v.regNo || `Vehicle ${v.id}`}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Type</Label>
                    <Select value={typeId} onValueChange={setTypeId}>
                        <SelectTrigger><SelectValue placeholder="All"/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {types.map((t) => (<SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>))}
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
                                    <TableHead>Code</TableHead>
                                    <TableHead>Vehicle</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Start</TableHead>
                                    <TableHead>End</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (<TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin"/>
                                                Loading...
                                            </div>
                                        </TableCell>
                                    </TableRow>) : rows.length === 0 ? (<TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">No maintenance records found.</TableCell>
                                    </TableRow>) : (rows.map((m) => (<TableRow key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60">
                                            <TableCell className="font-medium">{m.maintenanceCode}</TableCell>
                                            <TableCell>{m.vehicle?.vehicleCode}</TableCell>
                                            <TableCell>{m.maintenanceType?.name}</TableCell>
                                            <TableCell>{format(new Date(m.startDate), "dd MMM yyyy")}</TableCell>
                                            <TableCell>{m.endDate ? format(new Date(m.endDate), "dd MMM yyyy") : "-"}</TableCell>
                                            <TableCell>{statusBadge(m.status)}</TableCell>
                                            <TableCell className="text-right">
                                                {m.amount !== null && m.amount !== undefined ? m.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : "-"}
                                            </TableCell>
                                        </TableRow>)))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>);
}
