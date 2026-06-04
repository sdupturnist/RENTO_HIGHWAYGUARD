"use client";
import { useState } from "react";
import { Edit, Trash2, Search, Filter, Plus, Eye } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { Badge } from "@/app/Components/ui/badge";
import { toast } from "sonner";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { PaginationControls } from "@/app/Components/common/PaginationControls";
import { StatusBadge } from "@/app/Components/common/StatusBadge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/app/Components/ui/alert-dialog";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MaterialForm } from "./MaterialForm";

export function MaterialList({ currencySymbol = "AED" }) {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [formOpen, setFormOpen] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState(null);
    const [materialToDelete, setMaterialToDelete] = useState(null);

    const { can, loading: permsLoading } = usePermissions();
    const canView = can("Materials", "View");
    const canAdd = can("Materials", "Add");
    const canEdit = can("Materials", "Edit");
    const canDelete = can("Materials", "Delete");

    const { data: materials = [], isLoading } = useQuery({
        queryKey: ["materials"],
        queryFn: async () => {
            const res = await fetch("/api/materials");
            if (!res.ok) throw new Error("Failed to load materials");
            return res.json();
        },
        enabled: !permsLoading && canView,
        staleTime: 30 * 1000,
    });

    const { mutate: deleteMaterial } = useMutation({
        mutationFn: async (id) => {
            const res = await fetch(`/api/materials/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Error deleting material");
            return data;
        },
        onSuccess: (data) => {
            toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: ["materials"] });
        },
        onError: (error) => toast.error(error.message),
        onSettled: () => setMaterialToDelete(null),
    });

    if (permsLoading) {
        return <Card className="border-slate-200/60 dark:border-slate-800/60"><CardHeader><CardTitle>Loading...</CardTitle></CardHeader></Card>;
    }
    if (!canView) {
        return <div className="p-6 text-center text-muted-foreground">You do not have permission to view materials.</div>;
    }

    const filtered = materials.filter((m) => {
        const term = search.trim().toLowerCase();
        if (!term) return true;
        return [m.materialCode, m.name, m.status].some((v) => String(v || "").toLowerCase().includes(term));
    });

    const total = filtered.length;
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    const openEdit = (material) => {
        setEditingMaterial(material);
        setFormOpen(true);
    };

    const openCreate = () => {
        setEditingMaterial(null);
        setFormOpen(true);
    };

    return (
        <>
            <div className="flex justify-end mb-4">
                {canAdd && (
                    <Button onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" /> Add Material
                    </Button>
                )}
            </div>

            <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
                <CardHeader>
                    <CardTitle>All Materials</CardTitle>
                    <CardDescription>Quantity-based deployable resources such as cones, signboards, and barricades.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search materials..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                className="pl-9 bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-800/50 rounded-xl"
                            />
                        </div>
                        <Button variant="outline" className="rounded-xl" onClick={() => { setSearch(""); setPage(1); }}>
                            <Filter className="h-4 w-4 mr-1" /> Clear
                        </Button>
                    </div>

                    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                                <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                                    <TableHead className="h-10">Code</TableHead>
                                    <TableHead className="h-10">Name</TableHead>
                                    <TableHead className="h-10 text-right">Total Qty</TableHead>
                                    <TableHead className="h-10 text-right">Allocated</TableHead>
                                    <TableHead className="h-10 text-right">Available</TableHead>
                                    <TableHead className="h-10 text-right">Cost/Day</TableHead>
                                    <TableHead className="h-10">Status</TableHead>
                                    <TableHead className="h-10 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={8} className="text-center py-4">Loading...</TableCell></TableRow>
                                ) : paginated.length === 0 ? (
                                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No materials found.</TableCell></TableRow>
                                ) : paginated.map((m) => (
                                    <TableRow key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60">
                                        <TableCell className="font-medium text-xs text-muted-foreground">{m.materialCode}</TableCell>
                                        <TableCell className="font-medium">{m.name}</TableCell>
                                        <TableCell className="text-right">{Number(m.totalQuantity).toFixed(0)}</TableCell>
                                        <TableCell className="text-right text-amber-600 dark:text-amber-400">{Number(m.allocatedQty).toFixed(0)}</TableCell>
                                        <TableCell className="text-right font-medium text-green-600 dark:text-green-400">{Number(m.availableQty).toFixed(0)}</TableCell>
                                        <TableCell className="text-right">
                                            <CurrencySymbol symbol={currencySymbol} /> {Number(m.costPerDay).toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge status={m.status} />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" asChild>
                                                    <Link href={`/materials/${m.id}`}><Eye className="h-4 w-4" /></Link>
                                                </Button>
                                                {canEdit && (
                                                    <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                {canDelete && (
                                                    <Button variant="ghost" size="icon" onClick={() => setMaterialToDelete(m.id)}>
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <PaginationControls page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
                </CardContent>
            </Card>

            <MaterialForm
                open={formOpen}
                onOpenChange={setFormOpen}
                material={editingMaterial}
                currencySymbol={currencySymbol}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["materials"] });
                    setFormOpen(false);
                }}
            />

            <AlertDialog open={!!materialToDelete} onOpenChange={(open) => !open && setMaterialToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Material</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. The material will be permanently deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMaterial(materialToDelete)}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
