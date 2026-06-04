"use client";
import { truncateString } from "@/app/lib/utils";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Eye, Pencil, Trash2, Search, X, Check, XCircle } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from "@/app/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/app/Components/ui/table";
import { Badge } from "@/app/Components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/app/Components/ui/alert-dialog";
import { toast } from "sonner";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import Link from "next/link";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { PaginationControls } from "@/app/Components/common/PaginationControls";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function TimeLogList() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(50);
    const [searchTerm, setSearchTerm] = useState("");
    const [dateFrom, setDateFrom] = useState(undefined);
    const [dateTo, setDateTo] = useState(undefined);
    const [deleteId, setDeleteId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState("");
    const inputRef = useRef(null);
    const { can, loading: permsLoading } = usePermissions();
    const canView = can("Daily Time Logs", "View");
    const canEdit = can("Daily Time Logs", "Edit");
    const canDelete = can("Daily Time Logs", "Delete");

    // Debounced search term for query key
    const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Refetch when the tab/window regains focus (catches navigating back from create page)
    useEffect(() => {
        const handleFocus = () => {
            queryClient.invalidateQueries({ queryKey: ["time-logs"], refetchType: "all" });
        };
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [queryClient]);

    const { data, isLoading: loading } = useQuery({
        queryKey: ["time-logs", page, perPage, debouncedSearch, dateFrom, dateTo],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append("page", page.toString());
            params.append("perPage", perPage.toString());
            if (debouncedSearch) params.append("search", debouncedSearch);
            if (dateFrom) params.append("from", dateFrom.toISOString());
            if (dateTo) params.append("to", dateTo.toISOString());
            const res = await fetch(`/api/time-logs?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch time logs");
            return res.json();
        },
        enabled: !permsLoading && canView,
        staleTime: 0,
        refetchOnWindowFocus: true,
    });

    const logs = data?.timeLogs || [];
    const total = data?.total || 0;

    const { mutate: deleteTimeLog, isPending: isDeleting } = useMutation({
        mutationFn: async (id) => {
            const res = await fetch(`/api/time-logs/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to delete time log");
            return data;
        },
        onSuccess: () => {
            toast.success("Time log deleted permanently");
            queryClient.invalidateQueries({ queryKey: ["time-logs"], refetchType: "all" });
        },
        onError: (error) => {
            toast.error(error.message);
        },
        onSettled: () => {
            setDeleteId(null);
        }
    });

    const { mutate: updateTimeLog, isPending: isSaving } = useMutation({
        mutationFn: async ({ id, hours, quantity }) => {
            const body = {};
            if (hours !== undefined) body.workedHours = hours;
            if (quantity !== undefined) body.quantity = quantity;
            const res = await fetch(`/api/time-logs/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to update time log");
            return data;
        },
        onSuccess: () => {
            toast.success("Time log updated successfully");
            setEditingId(null);
            queryClient.invalidateQueries({ queryKey: ["time-logs"], refetchType: "all" });
        },
        onError: (error) => {
            toast.error(error.message);
        }
    });

    useEffect(() => {
        if (editingId && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingId]);

    const handleDeleteClick = (id) => {
        setDeleteId(id);
    };

    const handleConfirmDelete = () => {
        if (!deleteId) return;
        deleteTimeLog(deleteId);
    };

    const clearFilters = () => {
        setSearchTerm("");
        setDateFrom(undefined);
        setDateTo(undefined);
        setPage(1);
    };
    // Inline Editing Handlers
    const startEditing = (log) => {
        setEditingId(log.id);
        const isQtyBased = log.blockType === "MATERIAL" || log.blockType === "LABOUR";
        setEditValue(isQtyBased ? (log.quantity || 0).toString() : log.workedHours.toString());
    };
    const cancelEditing = () => {
        setEditingId(null);
        setEditValue("");
    };
    const saveEditing = async (id) => {
        const val = parseFloat(editValue);
        const isQtyBased = logs.find(l => l.id === id)?.blockType === "MATERIAL" || logs.find(l => l.id === id)?.blockType === "LABOUR";
        if (isQtyBased) {
            if (isNaN(val) || val < 0) {
                toast.error("Please enter a valid quantity");
                return;
            }
            updateTimeLog({ id, quantity: val });
        } else {
            if (isNaN(val) || val < 0 || val > 24) {
                toast.error("Please enter a valid number between 0 and 24");
                return;
            }
            updateTimeLog({ id, hours: val });
        }
    };
    const handleKeyDown = (e, id) => {
        if (e.key === "Enter") {
            saveEditing(id);
        }
        else if (e.key === "Escape") {
            cancelEditing();
        }
    };
    if (permsLoading) {
        return (<Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardHeader><CardTitle>Loading permissions...</CardTitle></CardHeader>
            </Card>);
    }
    if (!canView) {
        return <div className="p-6 text-center text-muted-foreground">You do not have permission to view daily time logs.</div>;
    }
    return (<Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
            <CardHeader>
                <CardTitle>Daily Time Logs</CardTitle>
                <CardDescription>
                    Manage daily vehicle and operator time logs.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4"/>
                        <Input placeholder="Search code, customer, vehicle..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-800/50 focus:bg-white dark:focus:bg-slate-900 rounded-xl transition-all"/>
                    </div>
                    <div className="w-full md:w-auto min-w-[150px]">
                        <FormattedDatePicker value={dateFrom} onChange={setDateFrom} placeholder="From Date"/>
                    </div>
                    <div className="w-full md:w-auto min-w-[150px]">
                        <FormattedDatePicker value={dateTo} onChange={setDateTo} placeholder="To Date"/>
                    </div>
                    {(searchTerm || dateFrom || dateTo) && (<Button variant="ghost" onClick={clearFilters} className="px-3">
                            <X className="h-4 w-4 mr-2"/> Clear
                        </Button>)}
                </div>

                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50/70 dark:hover:bg-slate-900/70">
                            <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                                <TableHead className="h-10">Date</TableHead>
                                <TableHead className="h-10">Assignment</TableHead>
                                <TableHead className="h-10">Customer</TableHead>
                                <TableHead className="h-10">Resource</TableHead>
                                <TableHead className="h-10 text-center">Type</TableHead>
                                <TableHead className="h-10 text-center w-[120px]">Hours / Qty</TableHead>
                                <TableHead className="h-10 text-center">Flags</TableHead>
                                <TableHead className="h-10 text-center">Status</TableHead>
                                <TableHead className="h-10 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (<TableRow><TableCell colSpan={9} className="h-24 text-center">Loading...</TableCell></TableRow>) : logs.length === 0 ? (<TableRow><TableCell colSpan={9} className="h-24 text-center">No logs found.</TableCell></TableRow>) : (logs.map((log) => {
                                const isQtyBased = log.blockType === "MATERIAL" || log.blockType === "LABOUR";
                                const canEditThisLog = canEdit;
                                return (<TableRow key={log.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60 transition-colors">
                                        <TableCell className="w-[120px]">{format(new Date(log.date), "dd MMM yyyy")}</TableCell>
                                        <TableCell>
                                            <span className="font-mono text-xs bg-muted px-2 py-1 rounded-md">
                                                {log.assignment?.assignmentCode || "-"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="max-w-[150px] truncate">
                                            {log.customer ? (
                                                <span title={log.customer.companyName}>{truncateString(log.customer.companyName, 20)}</span>
                                            ) : (
                                                <span className="text-muted-foreground italic text-xs">Internal</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-[200px]">
                                            {log.blockType === "VEHICLE" && log.vehicle ? (
                                                <div className="flex flex-col">
                                                    <span className="font-medium truncate" title={`${log.vehicle.brand?.name} ${log.vehicle.model?.name}`}>
                                                        {truncateString(`${log.vehicle.brand?.name} ${log.vehicle.model?.name}`, 25)}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">{log.vehicle.regNo}</span>
                                                </div>
                                            ) : log.blockType === "OPERATOR" && log.operator ? (
                                                <span className="font-medium">{log.operator.name}</span>
                                            ) : log.blockType === "MATERIAL" && log.material ? (
                                                <span className="font-medium">{log.material.name}</span>
                                            ) : log.blockType === "LABOUR" && log.labour ? (
                                                <span className="font-medium">{log.labour.labourType}</span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">{log.resourceNameSnapshot || "—"}</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="font-normal text-xs">
                                                {log.blockType || "VEHICLE"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center relative p-0 h-14">
                                            {editingId === log.id ? (
                                                <div className="absolute inset-0 flex items-center justify-center p-1 bg-white dark:bg-slate-900 z-10">
                                                    <div className="flex items-center gap-1 w-full max-w-[140px]">
                                                        {isQtyBased ? (
                                                            <Input ref={inputRef} type="number" step="1" min="0" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => handleKeyDown(e, log.id)} className="h-7 text-center px-1 text-sm bg-transparent border-slate-300 dark:border-slate-700 focus:ring-1 focus:ring-primary" disabled={isSaving}/>
                                                        ) : (
                                                            <Input ref={inputRef} type="number" step="0.5" min="0" max="24" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => handleKeyDown(e, log.id)} className="h-7 text-center px-1 text-sm bg-transparent border-slate-300 dark:border-slate-700 focus:ring-1 focus:ring-primary" disabled={isSaving}/>
                                                        )}
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 shrink-0" onClick={() => saveEditing(log.id)} disabled={isSaving}>
                                                            <Check className="h-4 w-4"/>
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0" onClick={cancelEditing} disabled={isSaving}>
                                                            <XCircle className="h-4 w-4"/>
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : isQtyBased ? (
                                                <div className={`w-full h-full flex items-center justify-center transition-colors ${canEditThisLog ? "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" : "cursor-default"}`} onClick={canEditThisLog ? () => startEditing(log) : undefined} title={canEditThisLog ? "Click to edit quantity" : undefined}>
                                                    <span className="font-medium text-muted-foreground">{log.quantity ?? "—"}</span>
                                                    {canEditThisLog && <Pencil className="h-3 w-3 ml-2 text-muted-foreground/40"/>}
                                                </div>
                                            ) : (
                                                <div className={`w-full h-full flex items-center justify-center transition-colors ${canEditThisLog ? "cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" : "cursor-default"}`} onClick={canEditThisLog ? () => startEditing(log) : undefined} title={canEditThisLog ? "Click to edit hours" : undefined}>
                                                    <span className="font-medium">{(log.workedHours || 0).toFixed(2)}</span>
                                                    {canEditThisLog && <Pencil className="h-3 w-3 ml-2 text-muted-foreground/40"/>}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex justify-center gap-1">
                                                {log.isWeekend ? <Badge variant="secondary" className="text-[10px] px-1 h-5">W</Badge> : null}
                                                {log.isHoliday ? <Badge variant="secondary" className="text-[10px] px-1 h-5 bg-blue-100 text-blue-700 hover:bg-blue-100">H</Badge> : null}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {log.autoGenerated ? (<Badge variant="secondary" className="text-xs">Auto</Badge>) : (<Badge variant="outline" className="text-xs">Manual</Badge>)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                {canView && (<Link href={`/time-logs/${log.id}`}>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-blue-600 hover:bg-blue-50">
                                                            <Eye className="h-4 w-4"/>
                                                        </Button>
                                                    </Link>)}
                                                {canEditThisLog && (<Link href={`/time-logs/${log.id}/edit`}>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <Pencil className="h-4 w-4"/>
                                                        </Button>
                                                    </Link>)}
                                                {canDelete && (<Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteClick(log.id)}>
                                                        <Trash2 className="h-4 w-4"/>
                                                    </Button>)}
                                            </div>
                                        </TableCell>
                                    </TableRow>);
                            }))}
                        </TableBody>
                    </Table>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                    <div>
                        Showing {logs.length} of {total} entries
                    </div>
                    <PaginationControls page={page} pageSize={perPage} total={total} onPageChange={setPage} onPageSizeChange={setPerPage}/>
                </div>

                <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Time Log?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will <strong>permanently delete</strong> this time log.
                                <br />If this was auto-generated, it will not be re-created unless the assignment is updated.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={(e) => {
            e.preventDefault();
            handleConfirmDelete();
        }} className="bg-red-600 hover:bg-red-700" disabled={isDeleting}>
                                {isDeleting ? "Deleting..." : "Delete Permanently"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>);
}