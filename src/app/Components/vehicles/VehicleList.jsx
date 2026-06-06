"use client";
import { truncateString } from "@/app/lib/utils";
import { useState } from "react";
import { format } from "date-fns";
import { Edit, Trash2, Eye, Search, Filter } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from "@/app/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/app/Components/ui/table";
import { toast } from "sonner";
import { Badge } from "@/app/Components/ui/badge";
import Link from "next/link";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/app/Components/ui/alert-dialog";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { PaginationControls } from "@/app/Components/common/PaginationControls";
import { StatusBadge } from "@/app/Components/common/StatusBadge";
import { useQuery } from "@tanstack/react-query";

export function VehicleList({ onEdit }) {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const { can, loading: permsLoading } = usePermissions();
    const canView = can("Vehicles", "View");
    const canEdit = can("Vehicles", "Edit");
    const canDelete = can("Vehicles", "Delete");

    const { data: vehicles = [], isLoading: loading, refetch: fetchVehicles } = useQuery({
        queryKey: ["vehicles"],
        queryFn: async () => {
            const res = await fetch("/api/vehicles");
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        },
        enabled: !permsLoading && canView,
        staleTime: 30 * 1000, // 30 seconds
    });
    const [vehicleToDelete, setVehicleToDelete] = useState(null);
    const confirmDelete = async () => {
        if (!vehicleToDelete)
            return;
        try {
            const res = await fetch(`/api/vehicles/${vehicleToDelete}`, { method: "DELETE" });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                fetchVehicles();
            }
            else {
                toast.error(data.message);
            }
        }
        catch (error) {
            toast.error("Error deleting vehicle");
        }
        finally {
            setVehicleToDelete(null);
        }
    };
    if (permsLoading) {
        return (<Card className="border-slate-200/60 dark:border-slate-800/60">
            <CardHeader>
                <CardTitle>Loading permissions...</CardTitle>
            </CardHeader>
        </Card>);
    }
    if (!canView) {
        return <div className="p-6 text-center text-muted-foreground">You do not have permission to view vehicles.</div>;
    }

    const filteredVehicles = vehicles.filter((vehicle) => {
        const term = search.trim().toLowerCase();
        if (!term) return true;

        return [
            vehicle.vehicleCode,
            vehicle.regNo,
            vehicle.vehicleType?.name,
            vehicle.brand?.name,
            vehicle.model?.name,
            vehicle.ownership,
            vehicle.status,
        ].some((value) => String(value || "").toLowerCase().includes(term));
    });

    const total = filteredVehicles.length;
    const start = (page - 1) * pageSize;
    const paginated = filteredVehicles.slice(start, start + pageSize);
    return (<Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
        <CardHeader>
            <CardTitle>All Vehicles</CardTitle>
            <CardDescription>
                A list of all registered vehicles in your fleet.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex items-center space-x-2 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search vehicles..."
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
                            <TableHead className="h-10">ID</TableHead>
                            <TableHead className="h-10">Type</TableHead>
                            <TableHead className="h-10">Expiry Date</TableHead>
                            <TableHead className="h-10">Ownership</TableHead>
                            <TableHead className="h-10">Status</TableHead>
                            <TableHead className="h-10 text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (<TableRow><TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell></TableRow>) : filteredVehicles.length === 0 ? (<TableRow><TableCell colSpan={6} className="h-24 text-center">No vehicles found.</TableCell></TableRow>) : (Array.isArray(paginated) && paginated.map((vehicle) => (<TableRow key={vehicle.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60 transition-colors">
                            <TableCell className="font-medium">
                                <div className="flex flex-col">
                                    <Link href={`/vehicles/${vehicle.id}`} className="hover:underline text-primary font-semibold">
                                        {vehicle.vehicleCode || `VEH-${vehicle.id}`}
                                    </Link>
                                    <span className="text-xs text-muted-foreground mt-0.5">
                                        {vehicle.brand?.name || "No Brand"}{vehicle.model?.name ? ` ${vehicle.model.name}` : ""} · {vehicle.regNo || "No Reg"}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell title={vehicle.vehicleType?.name}>{truncateString(vehicle.vehicleType?.name, 20) || "-"}</TableCell>
                            <TableCell>
                                {vehicle.registrationExpiry
                                    ? format(new Date(vehicle.registrationExpiry), "dd/MM/yyyy")
                                    : "-"}
                            </TableCell>
                            <TableCell>
                                <Badge variant={vehicle.ownership === "OWN" ? "default" : "secondary"}>
                                    {vehicle.ownership}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <StatusBadge status={vehicle.status} />
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    {canView && (<Link href={`/vehicles/${vehicle.id}`}>
                                        <Button variant="ghost" size="icon">
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </Link>)}
                                    {canEdit && (<Button variant="ghost" size="icon" asChild>
                                        <Link href={`/vehicles/${vehicle.id}/edit`}>
                                            <Edit className="h-4 w-4" />
                                        </Link>
                                    </Button>)}
                                    {canDelete && (<Button variant="ghost" size="icon" onClick={() => setVehicleToDelete(vehicle.id)}>
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

        <AlertDialog open={!!vehicleToDelete} onOpenChange={(open) => !open && setVehicleToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the vehicle and its data from the server.
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
