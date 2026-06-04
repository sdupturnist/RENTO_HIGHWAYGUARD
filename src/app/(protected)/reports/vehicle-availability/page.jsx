"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ReportHeader } from "@/app/Components/reports/ReportHeader";
import { ReportFilterPanel } from "@/app/Components/reports/ReportFilterPanel";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { Label } from "@/app/Components/ui/label";
import { Button } from "@/app/Components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { Card, CardContent } from "@/app/Components/ui/card";
import { toast } from "sonner";
import { generateReportPDF, generateReportExcel, formatDataForExport } from "@/app/lib/export-utils";
export default function VehicleAvailabilityReportPage() {
    const [page, setPage] = useState(1);
    const perPage = 50;
    const [dateFrom, setDateFrom] = useState(new Date());
    const [dateTo, setDateTo] = useState(new Date());

    const { data: reportData, isLoading: loading } = useQuery({
        queryKey: ["report-vehicle-availability", page, dateFrom?.toISOString(), dateTo?.toISOString()],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append("page", page.toString());
            params.append("perPage", perPage.toString());
            if (dateFrom) params.append("dateFrom", dateFrom.toISOString());
            if (dateTo) params.append("dateTo", dateTo.toISOString());
            const res = await fetch(`/api/reports/vehicle-availability?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch report data");
            return res.json();
        },
    });

    const vehicles = reportData?.vehicles || [];
    const total = reportData?.total || 0;

    const clearFilters = () => {
        setDateFrom(new Date());
        setDateTo(new Date());
        setPage(1);
    };
    const handleExportPDF = async () => {
        try {
            const { headers, rows } = formatDataForExport(vehicles, [
                { key: "vehicleCode", header: "Vehicle Code" },
                { key: "vehicleType", header: "Type" },
                { key: "lastAssignmentEndDate", header: "Last Assignment End", format: (v) => v ? format(new Date(v), "dd MMM yyyy") : "Never" },
                { key: "availableFrom", header: "Available From", format: (v) => format(new Date(v), "dd MMM yyyy") },
                { key: "status", header: "Status" },
            ]);
            generateReportPDF("Vehicle Availability Report", headers, rows, `vehicle-availability-${format(new Date(), "yyyy-MM-dd")}`);
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
                { key: "lastAssignmentEndDate", header: "Last Assignment End", format: (v) => v ? format(new Date(v), "dd MMM yyyy") : "Never" },
                { key: "availableFrom", header: "Available From", format: (v) => format(new Date(v), "dd MMM yyyy") },
                { key: "status", header: "Status" },
            ]);
            generateReportExcel("Vehicle Availability Report", headers, rows, `vehicle-availability-${format(new Date(), "yyyy-MM-dd")}`);
            toast.success("Excel exported successfully");
        }
        catch (error) {
            console.error(error);
            toast.error("Failed to export Excel");
        }
    };
    return (<div className="p-6 space-y-6">
            <ReportHeader title="Vehicle Availability Report" description="Vehicles available for assignment within the selected period" backHref="/reports" onExportPDF={handleExportPDF} onExportExcel={handleExportExcel}/>

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
                                    <TableHead className="h-10">Vehicle Code</TableHead>
                                    <TableHead className="h-10">Type</TableHead>
                                    <TableHead className="h-10">Last Assignment End</TableHead>
                                    <TableHead className="h-10">Available From</TableHead>
                                    <TableHead className="h-10 text-center">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (<TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell>
                                    </TableRow>) : vehicles.length === 0 ? (<TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">No available vehicles found.</TableCell>
                                    </TableRow>) : (vehicles.map((vehicle, idx) => (<TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60">
                                            <TableCell className="font-medium">{vehicle.vehicleCode}</TableCell>
                                            <TableCell>{vehicle.vehicleType}</TableCell>
                                            <TableCell>
                                                {vehicle.lastAssignmentEndDate
                ? format(new Date(vehicle.lastAssignmentEndDate), "dd MMM yyyy")
                : "Never assigned"}
                                            </TableCell>
                                            <TableCell>{format(new Date(vehicle.availableFrom), "dd MMM yyyy")}</TableCell>
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
