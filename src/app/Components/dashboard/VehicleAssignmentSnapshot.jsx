"use client";
import { truncateString } from "@/app/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { Badge } from "@/app/Components/ui/badge";
import { Button } from "@/app/Components/ui/button";
import Link from "next/link";
export function VehicleAssignmentSnapshot({ data }) {
    return (<Card className="animate-slide-up-fade backdrop-blur-sm bg-white/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/50 shadow-sm w-full overflow-hidden" style={{ animationDelay: "300ms" }}>
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-700/50 pb-4">
            <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">Vehicle Assignment Snapshot</CardTitle>
            <Button variant="outline" size="sm" asChild className="rounded-lg hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/20 border-slate-200 dark:border-slate-700">
                <Link href="/assignments">View All</Link>
            </Button>
        </CardHeader>
        <CardContent className="p-0">
            <Table>
                <TableHeader className="bg-slate-50/50 dark:bg-slate-900/20">
                    <TableRow className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-transparent">
                        <TableHead className="font-semibold text-slate-500 dark:text-slate-400">Vehicle</TableHead>
                        <TableHead className="font-semibold text-slate-500 dark:text-slate-400">Type</TableHead>
                        <TableHead className="font-semibold text-slate-500 dark:text-slate-400">Status</TableHead>
                        <TableHead className="font-semibold text-slate-500 dark:text-slate-400">Assigned To</TableHead>
                        <TableHead className="font-semibold text-slate-500 dark:text-slate-400">Period</TableHead>
                        <TableHead className="text-right font-semibold text-slate-500 dark:text-slate-400">Remaining</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.length === 0 && (<TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-400">No active vehicles found.</TableCell>
                    </TableRow>)}
                    {data.map((item) => (<TableRow key={item.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <TableCell className="font-semibold text-slate-700 dark:text-slate-200">{item.vehicleCode}</TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">{item.type}</TableCell>
                        <TableCell>
                            <Badge variant={item.status === 'ACTIVE' ? 'default' : 'secondary'} className={item.status === 'ACTIVE' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200 border-0" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}>
                                {item.status}
                            </Badge>
                        </TableCell>
                        <TableCell>
                            {item.assignment ? (
                                item.assignment.isInternal ? (
                                    <span className="font-semibold text-sm text-indigo-600 dark:text-indigo-400 italic">Internal Assignment</span>
                                ) : (
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm text-slate-900 dark:text-slate-200" title={item.assignment.customerName}>{truncateString(item.assignment.customerName, 20) || "-"}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400" title={item.assignment.projectName}>{truncateString(item.assignment.projectName, 20) || "-"}</span>
                                    </div>
                                )
                            ) : (<span className="text-slate-400 italic">Unassigned</span>)}
                        </TableCell>
                        <TableCell>
                            {item.assignment ? (<span className="text-sm text-slate-600 dark:text-slate-400">
                                {new Date(item.assignment.startDate).toLocaleDateString()} &rarr; {new Date(item.assignment.endDate).toLocaleDateString()}
                            </span>) : ("-")}
                        </TableCell>
                        <TableCell className="text-right">
                            {item.daysRemaining !== undefined && item.daysRemaining > 0 ? (<Badge variant="outline" className={item.daysRemaining < 5 ? "text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-900/50" : "text-slate-600 border-slate-200"}>
                                {item.daysRemaining} days
                            </Badge>) : ("-")}
                        </TableCell>
                    </TableRow>))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>);
}
