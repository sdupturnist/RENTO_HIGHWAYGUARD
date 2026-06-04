"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/app/Components/ui/table";
import { Button } from "@/app/Components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { PaginationControls } from "@/app/Components/common/PaginationControls";
export function ReportView({ type }) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    const { data = [], isLoading: loading } = useQuery({
        queryKey: ["report-view", type],
        queryFn: async () => {
            const res = await fetch(`/api/reports?type=${type}`);
            if (!res.ok) throw new Error("Failed to fetch report");
            return res.json();
        },
    });

    const handleExport = () => {
        // Basic CSV export
        const headers = Object.keys(data[0] || {}).join(",");
        const rows = data.map(row => Object.values(row).join(","));
        const csv = [headers, ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${type}-report.csv`;
        a.click();
    };
    if (loading)
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin"/></div>;
    const total = data.length;
    const start = (page - 1) * pageSize;
    const paginated = data.slice(start, start + pageSize);
    return (<div className="space-y-4">
            <div className="flex justify-end">
                <Button variant="outline" onClick={handleExport} disabled={data.length === 0}>
                    <Download className="mr-2 h-4 w-4"/> Export CSV
                </Button>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {paginated.length > 0 && Object.keys(paginated[0]).map((key) => (<TableHead key={key} className="capitalize">{key}</TableHead>))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginated.length === 0 ? (<TableRow><TableCell colSpan={5} className="text-center">No data found</TableCell></TableRow>) : (paginated.map((row, i) => (<TableRow key={i}>
                                    {Object.values(row).map((val, j) => (<TableCell key={j}>
                                            {typeof val === 'string' && val.includes('T') && val.length > 10 && !val.includes(' ')
                    ? format(new Date(val), "PPP")
                    : val}
                                        </TableCell>))}
                                </TableRow>)))}
                    </TableBody>
                </Table>
            </div>
            <PaginationControls page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize}/>
        </div>);
}
