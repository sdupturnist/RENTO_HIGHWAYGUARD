"use client";
import { truncateString } from "@/app/lib/utils";
import { useState } from "react";
import { Edit, Trash2, Search, Filter, Eye } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from "@/app/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/app/Components/ui/table";
import { toast } from "sonner";
import { Badge } from "@/app/Components/ui/badge";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { PaginationControls } from "@/app/Components/common/PaginationControls";
import { StatusBadge } from "@/app/Components/common/StatusBadge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/app/Components/ui/alert-dialog";
import Link from "next/link";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function OperatorList({ currencySymbol = "$" }) {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const { can, loading: permsLoading } = usePermissions();
    const canView = can("Operators", "View");
    const canEdit = can("Operators", "Edit");
    const canDelete = can("Operators", "Delete");

    // Queries
    const { data: operators = [], isLoading: loading } = useQuery({
        queryKey: ["operators"],
        queryFn: async () => {
            const res = await fetch("/api/operators");
            if (!res.ok) throw new Error("Failed to load operators");
            return res.json();
        },
        enabled: !permsLoading && canView,
        staleTime: 30 * 1000,
    });

    // Mutations
    const [operatorToDelete, setOperatorToDelete] = useState(null);
    
    const { mutate: deleteOperator } = useMutation({
        mutationFn: async (id) => {
            const res = await fetch(`/api/operators/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Error deleting operator");
            }
            return res.json();
        },
        onSuccess: (data) => {
            toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: ["operators"] });
        },
        onError: (error) => {
            toast.error(error.message);
        },
        onSettled: () => {
            setOperatorToDelete(null);
        }
    });

    const confirmDelete = () => {
        if (!operatorToDelete) return;
        deleteOperator(operatorToDelete);
    };
    if (permsLoading) {
        return (<Card className="border-slate-200/60 dark:border-slate-800/60">
            <CardHeader><CardTitle>Loading permissions...</CardTitle></CardHeader>
        </Card>);
    }
    if (!canView) {
        return <div className="p-6 text-center text-muted-foreground">You do not have permission to view operators.</div>;
    }

    const filteredOperators = operators.filter((operator) => {
        const term = search.trim().toLowerCase();
        if (!term) return true;

        return [
            operator.operatorCode,
            operator.name,
            operator.phoneNumber,
            operator.licenseType?.name,
            operator.status,
            operator.email,
        ].some((value) => String(value || "").toLowerCase().includes(term));
    });

    const total = filteredOperators.length;
    const start = (page - 1) * pageSize;
    const paginated = filteredOperators.slice(start, start + pageSize);
    return (<Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
        <CardHeader>
            <CardTitle>All Operators</CardTitle>
            <CardDescription>
                A list of all registered operators in your fleet.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex items-center space-x-2 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search operators..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="pl-9 bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-800/50 focus:bg-white dark:focus:bg-slate-900 rounded-xl transition-all"
                    />
                </div>
                <Button
                    variant="outline"
                    className="rounded-xl bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-800/50 hover:bg-white dark:hover:bg-slate-800"
                    onClick={() => {
                        setSearch("");
                        setPage(1);
                    }}
                >
                    <Filter className="h-4 w-4" />
                    Clear
                </Button>
            </div>

            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50/70 dark:hover:bg-slate-900/70">
                        <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                            <TableHead className="h-10">Code</TableHead>
                            <TableHead className="h-10">Name</TableHead>
                            <TableHead className="h-10">Phone</TableHead>
                            <TableHead className="h-10">License Type</TableHead>
                            <TableHead className="h-10">Hourly Rate</TableHead>
                            <TableHead className="h-10">Status</TableHead>
                            <TableHead className="h-10 text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (<TableRow><TableCell colSpan={7} className="text-center py-4">Loading...</TableCell></TableRow>) : filteredOperators.length === 0 ? (<TableRow><TableCell colSpan={7} className="text-center py-4 text-muted-foreground">No operators found.</TableCell></TableRow>) : (paginated.map((op) => (<TableRow key={op.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60 transition-colors">
                            <TableCell className="font-medium text-xs text-muted-foreground">{op.operatorCode}</TableCell>
                            <TableCell className="font-medium">
                                <Link href={`/operators/${op.id}`} className="hover:underline text-primary" title={op.name}>
                                    {truncateString(op.name, 20)}
                                </Link>
                            </TableCell>
                            <TableCell>{op.phoneNumber || "-"}</TableCell>
                            <TableCell title={op.licenseType?.name}>{truncateString(op.licenseType?.name, 20) || "N/A"}</TableCell>
                            <TableCell><CurrencySymbol symbol={currencySymbol} /> {Number(op.hourlyRate).toFixed(2)}</TableCell>
                            <TableCell>
                                <StatusBadge status={op.status} />
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    {canView && (<Button variant="ghost" size="icon" asChild>
                                        <Link href={`/operators/${op.id}`}>
                                            <Eye className="h-4 w-4" />
                                        </Link>
                                    </Button>)}
                                    {canEdit && (<Button variant="ghost" size="icon" asChild>
                                        <Link href={`/operators/${op.id}/edit`}>
                                            <Edit className="h-4 w-4" />
                                        </Link>
                                    </Button>)}
                                    {canDelete && (<Button variant="ghost" size="icon" onClick={() => setOperatorToDelete(op.id)}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>)}
                                </div>
                            </TableCell>
                        </TableRow>)))}
                    </TableBody>
                </Table>
            </div>
            <PaginationControls page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </CardContent>
        <AlertDialog open={!!operatorToDelete} onOpenChange={(open) => !open && setOperatorToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the operator and related data.
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
    </Card>);
}
