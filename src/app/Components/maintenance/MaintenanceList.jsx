"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
    Edit,
    Trash2,
    Eye,
    CheckCircle,
    Loader2
} from "lucide-react";

import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/app/Components/ui/card";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/app/Components/ui/table";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/app/Components/ui/select";

import { toast } from "sonner";
import { Badge } from "@/app/Components/ui/badge";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { PaginationControls } from "@/app/Components/common/PaginationControls";
import { StatusBadge } from "@/app/Components/common/StatusBadge";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/app/Components/ui/alert-dialog";

import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";
import { useSettings } from "@/app/Components/providers/SettingsProvider";

import {
    useQuery,
    useMutation,
    useQueryClient
} from "@tanstack/react-query";

export function MaintenanceList() {

    const queryClient = useQueryClient();

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const { currencySymbol } = useSettings();

    const { can, loading: permsLoading } = usePermissions();

    const canView = can("Maintenance", "View");
    const canEdit = can("Maintenance", "Edit");
    const canDelete = can("Maintenance", "Delete");

    // Filters
    const [statusFilter, setStatusFilter] = useState("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    const [recordToDelete, setRecordToDelete] = useState(null);
    const [updatingId, setUpdatingId] = useState(null);

    // Refetch when tab regains focus
    useEffect(() => {

        const handleFocus = async () => {
            await queryClient.refetchQueries({
                queryKey: ["maintenance"],
                exact: false,
            });
        };

        window.addEventListener("focus", handleFocus);

        return () => {
            window.removeEventListener("focus", handleFocus);
        };

    }, [queryClient]);

    const {
        data,
        isLoading: loading
    } = useQuery({

        queryKey: [
            "maintenance",
            page,
            pageSize,
            statusFilter,
            dateFrom,
            dateTo
        ],

        queryFn: async () => {

            const params = new URLSearchParams();

            params.append("page", page.toString());
            params.append("perPage", pageSize.toString());

            if (statusFilter !== "all") {
                params.append("status", statusFilter);
            }

            if (dateFrom) {
                params.append("dateFrom", dateFrom);
            }

            if (dateTo) {
                params.append("dateTo", dateTo);
            }

            const res = await fetch(
                `/api/maintenance?${params.toString()}`
            );

            if (!res.ok) {
                throw new Error("Failed to fetch");
            }

            return res.json();
        },

        enabled: !permsLoading && canView,

        staleTime: 0,
        gcTime: 0,

        refetchOnMount: true,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
    });

    const maintenances = data?.maintenances || [];
    const total = data?.total || 0;

    // DELETE
    const {
        mutate: deleteRecord,
        isPending: deleting
    } = useMutation({

        mutationFn: async (id) => {

            const res = await fetch(
                `/api/maintenance/${id}`,
                {
                    method: "DELETE"
                }
            );

            if (!res.ok) {

                const data = await res.json();

                throw new Error(
                    data.message || "Error deleting record"
                );
            }

            return res.json();
        },

        onSuccess: async () => {

            toast.success("Maintenance record deleted");

            await Promise.all([
                queryClient.refetchQueries({
                    queryKey: ["maintenance"],
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: ["vehicles"],
                    refetchType: "all",
                }),
            ]);
        },

        onError: (error) => {
            toast.error(error.message);
        },

        onSettled: () => {
            setRecordToDelete(null);
        }
    });

    // STATUS UPDATE
    const {
        mutate: updateStatus
    } = useMutation({

        mutationFn: async ({ id, status }) => {

            const res = await fetch(
                `/api/maintenance/${id}/status`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ status })
                }
            );

            if (!res.ok) {

                const data = await res.json();

                throw new Error(
                    data.message || "Error updating record"
                );
            }

            return res.json();
        },

        onMutate: ({ id }) => {
            setUpdatingId(id);
        },

        onSuccess: async () => {

            toast.success("Maintenance marked as completed");

            await Promise.all([
                queryClient.refetchQueries({
                    queryKey: ["maintenance"],
                    exact: false,
                }),
                queryClient.invalidateQueries({
                    queryKey: ["vehicles"],
                    refetchType: "all",
                }),
            ]);
        },

        onError: (error) => {
            toast.error(error.message);
        },

        onSettled: () => {
            setUpdatingId(null);
        }
    });

    const confirmDelete = () => {

        if (!recordToDelete) return;

        deleteRecord(recordToDelete);
    };

    const handleComplete = (id) => {
        updateStatus({
            id,
            status: "COMPLETED"
        });
    };


    if (permsLoading) {
        return (
            <Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardHeader>
                    <CardTitle>Loading permissions...</CardTitle>
                </CardHeader>
            </Card>
        );
    }

    if (!canView) {
        return (
            <div className="p-6 text-center text-muted-foreground">
                You do not have permission to view maintenance.
            </div>
        );
    }

    return (

        <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">

            <CardHeader>
                <CardTitle>Maintenance Records</CardTitle>

                <CardDescription>
                    Manage vehicle maintenance history,
                    schedules, and costs.
                </CardDescription>
            </CardHeader>

            <CardContent>

                {/* FILTERS */}

                <div className="flex flex-col md:flex-row gap-4 mb-6">

                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">

                        <div className="space-y-1">

                            <span className="text-xs text-muted-foreground">
                                Status
                            </span>

                            <Select
                                value={statusFilter}
                                onValueChange={setStatusFilter}
                            >

                                <SelectTrigger className="w-full bg-white/50 dark:bg-slate-900/50">
                                    <SelectValue placeholder="All Status" />
                                </SelectTrigger>

                                <SelectContent>
                                    <SelectItem value="all">
                                        All Status
                                    </SelectItem>

                                    <SelectItem value="SCHEDULED">
                                        Scheduled
                                    </SelectItem>

                                    <SelectItem value="IN_PROGRESS">
                                        In Progress
                                    </SelectItem>

                                    <SelectItem value="COMPLETED">
                                        Completed
                                    </SelectItem>
                                </SelectContent>

                            </Select>

                        </div>

                        <div className="space-y-1">

                            <span className="text-xs text-muted-foreground">
                                From Date
                            </span>

                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) =>
                                    setDateFrom(e.target.value)
                                }
                                className="bg-white/50 dark:bg-slate-900/50"
                            />

                        </div>

                        <div className="space-y-1">

                            <span className="text-xs text-muted-foreground">
                                To Date
                            </span>

                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) =>
                                    setDateTo(e.target.value)
                                }
                                className="bg-white/50 dark:bg-slate-900/50"
                            />

                        </div>

                        <div className="flex items-end">

                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => {
                                    setStatusFilter("all");
                                    setDateFrom("");
                                    setDateTo("");
                                }}
                            >
                                Clear Filters
                            </Button>

                        </div>

                    </div>

                </div>

                {/* TABLE */}

                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">

                    <Table>

                        <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">

                            <TableRow>

                                <TableHead>Code</TableHead>
                                <TableHead>Vehicle</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Start Date</TableHead>
                                <TableHead>End Date</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">
                                    Actions
                                </TableHead>

                            </TableRow>

                        </TableHeader>

                        <TableBody>

                            {loading ? (

                                <TableRow>
                                    <TableCell
                                        colSpan={8}
                                        className="h-24 text-center"
                                    >
                                        Loading...
                                    </TableCell>
                                </TableRow>

                            ) : maintenances.length === 0 ? (

                                <TableRow>
                                    <TableCell
                                        colSpan={8}
                                        className="h-24 text-center"
                                    >
                                        No maintenance records found.
                                    </TableCell>
                                </TableRow>

                            ) : (

                                maintenances.map((record) => (

                                    <TableRow
                                        key={record.id}
                                        className="group"
                                    >

                                        <TableCell className="font-medium text-xs text-muted-foreground">
                                            {record.maintenanceCode}
                                        </TableCell>

                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">
                                                    {record.vehicle.vehicleCode}
                                                </span>

                                                <span className="text-xs text-muted-foreground">
                                                    {record.vehicle.vehicleType.name}
                                                </span>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            {record.maintenanceType.name}
                                        </TableCell>

                                        <TableCell>
                                            {format(
                                                new Date(record.startDate),
                                                "dd/MM/yyyy"
                                            )}
                                        </TableCell>

                                        <TableCell>
                                            {record.endDate
                                                ? format(
                                                    new Date(record.endDate),
                                                    "dd/MM/yyyy"
                                                )
                                                : "-"}
                                        </TableCell>

                                        <TableCell>

                                            {record.amount ? (

                                                <span className="inline-flex items-center gap-1">
                                                    <CurrencySymbol symbol={currencySymbol} />

                                                    {Number(record.amount).toFixed(2)}
                                                </span>

                                            ) : "-"}

                                        </TableCell>

                                        <TableCell>

                                            <StatusBadge status={record.status} />

                                        </TableCell>

                                        <TableCell className="text-right">

                                            <div className="flex justify-end gap-2">

                                                {record.status !== "COMPLETED" && canEdit && (

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Mark Completed"
                                                        onClick={() =>
                                                            handleComplete(record.id)
                                                        }
                                                        disabled={updatingId === record.id}
                                                    >

                                                        {updatingId === record.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                                        )}

                                                    </Button>

                                                )}

                                                <Link href={`/maintenance/${record.id}`}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="View Details"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </Link>

                                                {canEdit && (
                                                    <Link href={`/maintenance/${record.id}/edit`}>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            title="Edit"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                )}

                                                {canDelete && (

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            setRecordToDelete(record.id)
                                                        }
                                                    >
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
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setPage(1);
                    }}
                />

            </CardContent>

            {/* DELETE DIALOG */}

            <AlertDialog
                open={!!recordToDelete}
                onOpenChange={(open) =>
                    !open && setRecordToDelete(null)
                }
            >

                <AlertDialogContent>

                    <AlertDialogHeader>

                        <AlertDialogTitle>
                            Are you absolutely sure?
                        </AlertDialogTitle>

                        <AlertDialogDescription>
                            This action cannot be undone.
                            This will permanently delete
                            the maintenance record.
                        </AlertDialogDescription>

                    </AlertDialogHeader>

                    <AlertDialogFooter>

                        <AlertDialogCancel>
                            Cancel
                        </AlertDialogCancel>

                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={deleting}
                        >

                            {deleting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                "Delete Permanently"
                            )}

                        </AlertDialogAction>

                    </AlertDialogFooter>

                </AlertDialogContent>

            </AlertDialog>

        </Card>
    );
}