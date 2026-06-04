"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/app/Components/ui/table";
import { Input } from "@/app/Components/ui/input";
import { Button } from "@/app/Components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from "@/app/Components/ui/card";
import { PaginationControls } from "@/app/Components/common/PaginationControls";
import { Search, RefreshCw } from "lucide-react";
import { Badge } from "@/app/Components/ui/badge";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { Forbidden } from "@/app/Components/common/Forbidden";
export default function AuditLogsPage() {
    const { loading: permsLoading, can } = usePermissions();
    const canView = can("Audit Logs", "View");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [searchTimeout, setSearchTimeout] = useState(null);

    const { data: queryData, isLoading: loading, refetch } = useQuery({
        queryKey: ["audit-logs", page, pageSize, debouncedSearch],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                pageSize: pageSize.toString(),
                search: debouncedSearch,
            });
            const response = await fetch(`/api/audit-logs?${params}`);
            if (!response.ok) throw new Error("Failed to fetch logs");
            return response.json();
        },
        enabled: !permsLoading && canView,
    });

    const logs = queryData?.data || [];
    const meta = queryData?.meta || { total: 0, page: 1, pageSize: 10, totalPages: 0 };

    if (permsLoading)
        return null;
    if (!canView)
        return <Forbidden module="audit logs" action="view" />;
    const handleSearch = (e) => {
        const value = e.target.value;
        setSearch(value);
        setPage(1);
        if (searchTimeout) clearTimeout(searchTimeout);
        const timeout = setTimeout(() => {
            setDebouncedSearch(value);
        }, 500);
        setSearchTimeout(timeout);
    };
    const getActionColor = (action) => {
        const lower = action.toLowerCase();
        if (lower.includes("create"))
            return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
        if (lower.includes("sent"))
            return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300";
        if (lower.includes("update") || lower.includes("edit"))
            return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
        if (lower.includes("delete") || lower.includes("failed"))
            return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    };
    return (<div className="space-y-6">
        <div className="flex items-center justify-between">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Audit Logs</h2>
                <p className="text-muted-foreground">
                    Track all system events, user actions, and data changes.
                </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
            </Button>
        </div>

        <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
            <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle>System Activity</CardTitle>
                        <CardDescription>
                            Complete history of actions performed by users.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search logs..." className="pl-8 bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-800/50 focus:bg-white dark:focus:bg-slate-900 rounded-xl transition-all w-full" value={search} onChange={handleSearch} />
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50/70 dark:hover:bg-slate-900/70">
                            <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                                <TableHead className="h-10">Time</TableHead>
                                <TableHead className="h-10">User</TableHead>
                                <TableHead className="h-10">Action</TableHead>
                                <TableHead className="h-10">Record</TableHead>
                                <TableHead className="h-10">What Happened</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && logs.length === 0 ? (<TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    Loading logs...
                                </TableCell>
                            </TableRow>) : logs.length === 0 ? (<TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No logs found.
                                </TableCell>
                            </TableRow>) : (logs.map((log) => (<TableRow key={log.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60 transition-colors">
                                <TableCell className="whitespace-nowrap font-medium text-muted-foreground">
                                    {format(new Date(log.createdAt), "MMM d, yyyy HH:mm:ss")}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{log.user?.name || "System"}</span>
                                        <span className="text-xs text-muted-foreground">{log.user?.email || "-"}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className={`${getActionColor(log.displayAction || log.action)} hover:bg-opacity-80`}>
                                        {log.displayAction || log.action}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <span className="font-medium text-sm">{log.displayEntity || log.entityType}</span>
                                </TableCell>
                                <TableCell className="max-w-md truncate" title={log.displayDescription || log.description || ""}>
                                    {log.displayDescription || log.description || "-"}
                                </TableCell>
                            </TableRow>)))}
                        </TableBody>
                    </Table>
                </div>

                <PaginationControls page={page} pageSize={pageSize} total={meta.total} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
            </CardContent>
        </Card>
    </div>);
}
