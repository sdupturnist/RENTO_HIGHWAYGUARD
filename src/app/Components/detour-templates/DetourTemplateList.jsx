"use client";
import { useState } from "react";
import { Edit, Trash2, Search, Filter, Plus, ChevronDown, ChevronRight, Eye } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { Badge } from "@/app/Components/ui/badge";
import { toast } from "sonner";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { PaginationControls } from "@/app/Components/common/PaginationControls";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/app/Components/ui/alert-dialog";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function DetourTemplateList({ currencySymbol = "AED" }) {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [templateToDelete, setTemplateToDelete] = useState(null);
    const [expandedRow, setExpandedRow] = useState(null);

    const { can, loading: permsLoading } = usePermissions();
    const canView = can("Detour Services", "View");
    const canAdd = can("Detour Services", "Add");
    const canEdit = can("Detour Services", "Edit");
    const canDelete = can("Detour Services", "Delete");

    const { data: templates = [], isLoading } = useQuery({
        queryKey: ["detour-templates"],
        queryFn: async () => {
            const res = await fetch("/api/detour-templates");
            if (!res.ok) throw new Error("Failed to load detour templates");
            return res.json();
        },
        enabled: !permsLoading && canView,
        staleTime: 30 * 1000,
    });

    const { mutate: deleteTemplate } = useMutation({
        mutationFn: async (id) => {
            const res = await fetch(`/api/detour-templates/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Error deleting template");
            return data;
        },
        onSuccess: (data) => {
            toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: ["detour-templates"] });
        },
        onError: (error) => toast.error(error.message),
        onSettled: () => setTemplateToDelete(null),
    });

    if (permsLoading) {
        return <Card className="border-slate-200/60 dark:border-slate-800/60"><CardHeader><CardTitle>Loading...</CardTitle></CardHeader></Card>;
    }
    if (!canView) {
        return <div className="p-6 text-center text-muted-foreground">You do not have permission to view detour templates.</div>;
    }

    const filtered = templates.filter((t) => {
        const term = search.trim().toLowerCase();
        if (!term) return true;
        return [t.templateCode, t.name, t.status].some((v) => String(v || "").toLowerCase().includes(term));
    });

    const total = filtered.length;
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    return (
        <>
            <div className="flex justify-end mb-4">
                {canAdd && (
                    <Button asChild>
                        <Link href="/detour-services/new"><Plus className="mr-2 h-4 w-4" /> Add Template</Link>
                    </Button>
                )}
            </div>

            <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
                <CardHeader>
                    <CardTitle>Detour Service Templates</CardTitle>
                    <CardDescription>Template definitions for detour service deployments. Not linked to specific vehicle types.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search templates..."
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
                                    <TableHead className="h-10 w-8"></TableHead>
                                    <TableHead className="h-10">Code</TableHead>
                                    <TableHead className="h-10">Template Name</TableHead>
                                    <TableHead className="h-10 text-right">Vehicles</TableHead>
                                    <TableHead className="h-10 text-right">Operators</TableHead>
                                    <TableHead className="h-10">Bundle Billing</TableHead>
                                    <TableHead className="h-10 text-right">Bundle Cost/Day</TableHead>
                                    <TableHead className="h-10">Status</TableHead>
                                    <TableHead className="h-10 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={9} className="text-center py-4">Loading...</TableCell></TableRow>
                                ) : paginated.length === 0 ? (
                                    <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No templates found.</TableCell></TableRow>
                                ) : paginated.map((t) => (
                                    <>
                                        <TableRow
                                            key={t.id}
                                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60 cursor-pointer"
                                            onClick={() => setExpandedRow(expandedRow === t.id ? null : t.id)}
                                        >
                                            <TableCell className="pl-4">
                                                {t.requirements?.length > 0
                                                    ? expandedRow === t.id
                                                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                                    : null}
                                            </TableCell>
                                            <TableCell className="font-medium text-xs text-muted-foreground">{t.templateCode}</TableCell>
                                            <TableCell className="font-medium">{t.name}</TableCell>
                                            <TableCell className="text-right">{t.vehicleCount}</TableCell>
                                            <TableCell className="text-right">{t.operatorCount}</TableCell>
                                            <TableCell>
                                                {t.bundleCostEnabled
                                                    ? <Badge className="bg-blue-600 hover:bg-blue-700">Enabled</Badge>
                                                    : <Badge variant="secondary">Disabled</Badge>}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {t.bundleCostEnabled
                                                    ? <><CurrencySymbol symbol={currencySymbol} /> {Number(t.bundleCostPerDay).toFixed(2)}</>
                                                    : "—"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={t.status === "ACTIVE" ? "default" : "secondary"}
                                                    className={t.status === "ACTIVE" ? "bg-green-600 hover:bg-green-700" : ""}>
                                                    {t.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <Link href={`/detour-services/${t.id}`}><Eye className="h-4 w-4" /></Link>
                                                    </Button>
                                                    {canEdit && (
                                                        <Button variant="ghost" size="icon" asChild>
                                                            <Link href={`/detour-services/${t.id}/edit`}><Edit className="h-4 w-4" /></Link>
                                                        </Button>
                                                    )}
                                                    {canDelete && (
                                                        <Button variant="ghost" size="icon" onClick={() => setTemplateToDelete(t.id)}>
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                        {expandedRow === t.id && t.requirements?.length > 0 && (
                                            <TableRow key={`${t.id}-reqs`} className="bg-slate-50/30 dark:bg-slate-900/30">
                                                <TableCell colSpan={9} className="py-3 px-6">
                                                    <div className="text-xs font-medium text-muted-foreground mb-2">Resource Requirements</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {t.requirements.map((r, i) => (
                                                            <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs">
                                                                <Badge variant="outline" className="text-xs py-0 px-1">{r.resourceType}</Badge>
                                                                {r.resourceName || `ID:${r.resourceId}`}
                                                                <span className="text-muted-foreground">× {Number(r.quantity).toFixed(0)}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <PaginationControls page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
                </CardContent>
            </Card>

            <AlertDialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Detour Template</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. The template and its resource requirements will be permanently deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteTemplate(templateToDelete)}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
