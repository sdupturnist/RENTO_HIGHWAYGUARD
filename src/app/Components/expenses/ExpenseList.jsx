"use client";
import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Edit, Trash2, Eye, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from "@/app/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/app/Components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/app/Components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/app/Components/ui/badge";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { PaginationControls } from "@/app/Components/common/PaginationControls";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/app/Components/ui/alert-dialog";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";
import { useSettings } from "@/app/Components/providers/SettingsProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function ExpenseList() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const { currencySymbol } = useSettings();
    const { can, loading: permsLoading } = usePermissions();
    const canView = can("Expenses", "View") || can("Maintenance", "View");
    const canEdit = can("Expenses", "Edit") || can("Maintenance", "Edit");
    const canDelete = can("Expenses", "Delete") || can("Maintenance", "Delete");

    // Filters
    const [statusFilter, setStatusFilter] = useState("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    const { data, isLoading: loading } = useQuery({
        queryKey: ["expenses", page, pageSize, statusFilter, dateFrom, dateTo],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append("page", page.toString());
            params.append("perPage", pageSize.toString());
            if (statusFilter !== "all") params.append("status", statusFilter);
            if (dateFrom) params.append("dateFrom", dateFrom);
            if (dateTo) params.append("dateTo", dateTo);
            const res = await fetch(`/api/expenses?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch expenses");
            return res.json();
        },
        enabled: !permsLoading && canView,
        refetchOnWindowFocus: true,
    });

    const expenses = data?.expenses || [];
    const totalPages = data?.totalPages || 1;
    const total = data?.total || 0;

    // Delete handling
    const [recordToDelete, setRecordToDelete] = useState(null);
    const [updatingId, setUpdatingId] = useState(null);

    const { mutate: confirmExpenseMutation } = useMutation({
        mutationFn: async (id) => {
            const res = await fetch(`/api/expenses/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "CONFIRMED" })
            });
            if (!res.ok) throw new Error("Failed to confirm expense");
            return res.json();
        },
        onMutate: (id) => setUpdatingId(id),
    onSuccess: async () => {
    toast.success("Expense confirmed");

    await queryClient.refetchQueries({
        queryKey: ["expenses"],
        exact: false,
    });
},
        onError: () => toast.error("Failed to confirm expense"),
        onSettled: () => setUpdatingId(null),
    });

    const confirmExpense = (id) => confirmExpenseMutation(id);

    const { mutate: deleteExpenseMutation, isPending: isDeleting } = useMutation({
        mutationFn: async (id) => {
            const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Error deleting record");
            return data;
        },
      onSuccess: async () => {
    toast.success("Expense record deleted");

    await queryClient.refetchQueries({
        queryKey: ["expenses"],
        exact: false,
    });
},  
        onError: (error) => toast.error(error.message),
        onSettled: () => setRecordToDelete(null),
    });

    const confirmDelete = () => {
        if (!recordToDelete) return;
        deleteExpenseMutation(recordToDelete);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case "DRAFT": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
            case "CONFIRMED": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
            default: return "bg-slate-100 text-slate-800";
        }
    };

    if (permsLoading) {
        return <Card className="border-slate-200/60 dark:border-slate-800/60"><CardHeader><CardTitle>Loading permissions...</CardTitle></CardHeader></Card>;
    }

    if (!canView) {
        return <div className="p-6 text-center text-muted-foreground">You do not have permission to view expenses.</div>;
    }

    return (
        <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
            <CardHeader>
                <CardTitle>Expense Records</CardTitle>
                <CardDescription>
                    Manage operational expenses and miscellaneous costs.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">Status</span>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full bg-white/50 dark:bg-slate-900/50">
                                    <SelectValue placeholder="All Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="DRAFT">Draft</SelectItem>
                                    <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">From Date</span>
                            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-white/50 dark:bg-slate-900/50" />
                        </div>
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground">To Date</span>
                            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-white/50 dark:bg-slate-900/50" />
                        </div>
                        <div className="flex items-end">
                            <Button variant="outline" onClick={() => {
                                setStatusFilter("all");
                                setDateFrom("");
                                setDateTo("");
                            }} className="w-full">
                                Clear Filters
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50/70 dark:hover:bg-slate-900/70">
                            <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                                <TableHead>Code</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Project</TableHead>
                                <TableHead>Vehicle</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={8} className="h-24 text-center">Loading...</TableCell></TableRow>
                            ) : expenses.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="h-24 text-center">No expense records found.</TableCell></TableRow>
                            ) : (
                                expenses.map((record) => (
                                    <TableRow key={record.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60 transition-colors">
                                        <TableCell className="font-medium text-xs text-muted-foreground">
                                            {record.expenseCode}
                                        </TableCell>
                                        <TableCell>{format(new Date(record.date), "dd/MM/yyyy")}</TableCell>
                                        <TableCell>{record.expenseType?.name || "-"}</TableCell>
                                        <TableCell>{record.project?.name || "-"}</TableCell>
                                        <TableCell>{record.vehicle?.vehicleCode || "-"}</TableCell>
                                        <TableCell>
                                            {record.amount ? (
                                                <span className="inline-flex items-center gap-1">
                                                    <CurrencySymbol symbol={currencySymbol} />
                                                    {Number(record.amount).toFixed(2)}
                                                </span>
                                            ) : "-"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={getStatusColor(record.status)} variant="outline">
                                                {record.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                {canEdit && record.status === "DRAFT" && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Confirm Expense"
                                                        onClick={() => confirmExpense(record.id)}
                                                        disabled={updatingId === record.id}
                                                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                                    >
                                                        {updatingId === record.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                                    </Button>
                                                )}
                                                <Link href={`/expenses/${record.id}`}>
                                                    <Button variant="ghost" size="icon" title="View Details">
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                                <Link href={`/expenses/edit/${record.id}`}>
                                                    {canEdit && (
                                                        <Button variant="ghost" size="icon" title="Edit">
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </Link>
                                                {canDelete && (
                                                    <Button variant="ghost" size="icon" onClick={() => setRecordToDelete(record.id)}>
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <PaginationControls
                    page={page}
                    pageSize={pageSize}
                    total={total}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                />
            </CardContent>

            <AlertDialog open={!!recordToDelete} onOpenChange={(open) => !open && setRecordToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the expense record.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                            Delete Permanently
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
