"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { Button } from "@/app/Components/ui/button";
import { Badge } from "@/app/Components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";
import { FileSpreadsheet, Plus, ArrowRight } from "lucide-react";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";

export function ApprovedUninvoicedTimesheets() {
    const { can } = usePermissions();
    const canViewTimesheets = can("Timesheet", "View");
    const canCreateInvoice = can("Invoices", "Add");

    const { data: timesheets = [], isLoading } = useQuery({
        queryKey: ["uninvoiced-timesheets"],
        queryFn: async () => {
            const res = await fetch("/api/timesheets?uninvoiced=true");
            if (!res.ok) throw new Error("Failed to fetch pending timesheets");
            return res.json();
        },
        enabled: canViewTimesheets,
        staleTime: 0,
    });

    if (!canViewTimesheets) return null;

    return (
        <Card className="animate-slide-up-fade backdrop-blur-sm bg-white/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/50 shadow-sm w-full overflow-hidden" style={{ animationDelay: "200ms" }}>
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-700/50 pb-4">
                <div className="space-y-1">
                    <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-indigo-500" />
                        Approved Timesheets (Pending Invoicing)
                    </CardTitle>
                </div>
                <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-0">
                    {timesheets.length} Pending
                </Badge>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-slate-50/50 dark:bg-slate-900/20">
                        <TableRow className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-transparent">
                            <TableHead className="font-semibold text-slate-500 dark:text-slate-400">Timesheet Code</TableHead>
                            <TableHead className="font-semibold text-slate-500 dark:text-slate-400">Customer</TableHead>
                            <TableHead className="font-semibold text-slate-500 dark:text-slate-400">Project</TableHead>
                            <TableHead className="font-semibold text-slate-500 dark:text-slate-400">Period</TableHead>
                            <TableHead className="font-semibold text-slate-500 dark:text-slate-400 text-right">Total Hours</TableHead>
                            <TableHead className="font-semibold text-slate-500 dark:text-slate-400 text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                                    Loading timesheets...
                                </TableCell>
                            </TableRow>
                        ) : timesheets.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-slate-400 italic">
                                    No approved timesheets are currently pending invoicing.
                                </TableCell>
                            </TableRow>
                        ) : (
                            timesheets.map((ts) => (
                                <TableRow key={ts.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                                    <TableCell className="font-semibold text-slate-700 dark:text-slate-200">
                                        <Link href={`/timesheets/${ts.timesheetCode}`} className="text-primary hover:underline">
                                            {ts.timesheetCode}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-slate-700 dark:text-slate-300">
                                        {ts.customer?.companyName || "—"}
                                    </TableCell>
                                    <TableCell className="text-slate-600 dark:text-slate-400">
                                        {ts.project?.name || "—"}
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                                        {format(new Date(ts.periodStart), "dd MMM yyyy")} &rarr; {format(new Date(ts.periodEnd), "dd MMM yyyy")}
                                    </TableCell>
                                    <TableCell className="text-right text-slate-700 dark:text-slate-200 font-medium">
                                        {ts.totalHours?.toFixed(1) || "0.0"} hrs
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {canCreateInvoice && (
                                                <Button size="xs" variant="outline" asChild className="h-7 text-xs px-2.5 rounded-lg border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-900/50 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400">
                                                    <Link href={`/invoices/new?timesheetId=${ts.id}`} className="flex items-center gap-1">
                                                        <Plus className="h-3 w-3" />
                                                        Create Invoice
                                                    </Link>
                                                </Button>
                                            )}
                                            <Button size="xs" variant="ghost" asChild className="h-7 text-xs px-2 rounded-lg text-slate-500 hover:text-slate-800">
                                                <Link href={`/timesheets/${ts.timesheetCode}`} className="flex items-center gap-0.5">
                                                    View
                                                    <ArrowRight className="h-3 w-3" />
                                                </Link>
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
