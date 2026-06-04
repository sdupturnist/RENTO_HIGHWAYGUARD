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
import { toast } from "sonner";
import { generateReportPDF, generateReportExcel, formatDataForExport } from "@/app/lib/export-utils";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/Components/ui/select";
export default function VehicleUtilizationReportPage() {
    const [page, setPage] = useState(1);
    const perPage = 50;
    const [dateFrom, setDateFrom] = useState(startOfMonth(new Date()));
    const [dateTo, setDateTo] = useState(endOfMonth(new Date()));
    const [vehicleId, setVehicleId] = useState("all");

    const { data: vehicleOptions = [] } = useQuery({
        queryKey: ["vehicles-all"],
        queryFn: async () => {
            const res = await fetch("/api/vehicles");
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        },
    });

    const { data: reportData, isLoading: loading } = useQuery({
        queryKey: ["report-vehicle-utilization", page, dateFrom?.toISOString(), dateTo?.toISOString(), vehicleId],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append("page", page.toString());
            params.append("perPage", perPage.toString());
            if (dateFrom) params.append("dateFrom", dateFrom.toISOString());
            if (dateTo) params.append("dateTo", dateTo.toISOString());
            if (vehicleId !== "all") params.append("vehicleId", vehicleId);
            const res = await fetch(`/api/reports/vehicle-utilization?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch report data");
            return res.json();
        },
    });

    const vehicles = reportData?.vehicles || [];
    const total = reportData?.total || 0;

    const clearFilters = () => {
        setDateFrom(startOfMonth(new Date()));
        setDateTo(endOfMonth(new Date()));
        setVehicleId("all");
        setPage(1);
    };
    const handleExportPDF = async () => {
        try {
            const { headers, rows } = formatDataForExport(vehicles, [
                { key: "vehicleCode", header: "Vehicle Code" },
                { key: "vehicleType", header: "Type" },
                { key: "assignedDays", header: "Assigned Days" },
                { key: "utilizationPercent", header: "Utilization %", format: (v) => `${v}%` },
                { key: "status", header: "Status" },
            ]);
            generateReportPDF("Vehicle Utilization Report", headers, rows, `vehicle-utilization-${format(new Date(), "yyyy-MM-dd")}`);
            toast.success("PDF exported successfully");
        }
        catch (error) {
            console.error(error);
            toast.error("Failed to export PDF");
        }
    };
    const handleExportExcel = async () => {
        try {
            const { headers, rows } = formatDataForExport(vehicles, [
                { key: "vehicleCode", header: "Vehicle Code" },
                { key: "vehicleType", header: "Type" },
                { key: "assignedDays", header: "Assigned Days" },
                { key: "utilizationPercent", header: "Utilization %" },
                { key: "status", header: "Status" },
            ]);
            generateReportExcel("Vehicle Utilization Report", headers, rows, `vehicle-utilization-${format(new Date(), "yyyy-MM-dd")}`);
            toast.success("Excel exported successfully");
        }
        catch (error) {
            console.error(error);
            toast.error("Failed to export Excel");
        }
    };
    return (<div className="p-6 space-y-6">
            <ReportHeader title="Vehicle Utilization Report" description="Vehicle usage metrics and utilization percentages" backHref="/reports" onExportPDF={handleExportPDF} onExportExcel={handleExportExcel}/>

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
                    <Label>Vehicle</Label>
                    <Select value={vehicleId} onValueChange={setVehicleId}>
                        <SelectTrigger>
                            <SelectValue placeholder="All"/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            {vehicleOptions.map((v) => (<SelectItem key={v.id} value={String(v.id)}>{v.vehicleCode || v.regNo || `Vehicle ${v.id}`}</SelectItem>))}
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
                                    <TableHead className="h-10">Vehicle Code</TableHead>
                                    <TableHead className="h-10">Type</TableHead>
                                    <TableHead className="h-10 text-center">Assigned Days</TableHead>
                                    <TableHead className="h-10 text-center">Worked Hours</TableHead>
                                    <TableHead className="h-10 text-center">Utilization %</TableHead>
                                    <TableHead className="h-10 text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (<TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell>
                                    </TableRow>) : vehicles.length === 0 ? (<TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">No vehicles found.</TableCell>
                                    </TableRow>) : (vehicles.map((vehicle, idx) => (<TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60">
                                            <TableCell className="font-medium">{vehicle.vehicleCode}</TableCell>
                                            <TableCell>{vehicle.vehicleType}</TableCell>
                                            <TableCell className="text-center">{vehicle.assignedDays}</TableCell>
                                            <TableCell className="text-center">{vehicle.workedHours.toFixed(2)}</TableCell>
                                            <TableCell className="text-center font-medium">{vehicle.utilizationPercent}%</TableCell>
                                            <TableCell className="text-center">
                                                <span className={`px-2 py-1 rounded-md text-xs ${vehicle.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                                                    {vehicle.status}
                                                </span>
                                            </TableCell>
                                        </TableRow>)))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="mt-4 px-4 pb-4 flex items-center justify-between text-sm text-muted-foreground">
                        <div>Showing {vehicles.length} of {total} entries</div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                            <Button variant="outline" size="sm" disabled={vehicles.length < perPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>);
}
