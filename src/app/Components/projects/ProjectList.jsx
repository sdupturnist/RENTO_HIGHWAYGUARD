"use client";
import { truncateString } from "@/app/lib/utils";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Edit, Trash2, Search, Eye } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from "@/app/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/app/Components/ui/table";
import { toast } from "sonner";
import { Badge } from "@/app/Components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/app/Components/ui/alert-dialog";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { PaginationControls } from "@/app/Components/common/PaginationControls";
import { StatusBadge } from "@/app/Components/common/StatusBadge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function ProjectList({ onEdit }) {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [deleteId, setDeleteId] = useState(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const { can, loading: permsLoading } = usePermissions();
    const canView = can("Projects", "View");
    const canEdit = can("Projects", "Edit");
    const canDelete = can("Projects", "Delete");

    const { data: projects = [], isLoading: loading } = useQuery({
        queryKey: ["projects"],
        queryFn: async () => {
            const res = await fetch("/api/projects");
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || "Failed to load projects");
            return Array.isArray(data) ? data : [];
        },
        enabled: !permsLoading && canView,
        staleTime: 30 * 1000,
    });

    const { mutate: deleteProject, isLoading: isDeleting } = useMutation({
        mutationFn: async (id) => {
            const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Error deleting project");
            return { ...data, id };
        },
        onSuccess: (data, deletedId) => {
            queryClient.setQueryData(["projects"], (current = []) =>
                Array.isArray(current) ? current.filter((project) => project.id !== deletedId) : []
            );
            toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: ["projects"] });
        },
        onError: (error) => {
            toast.error(error.message);
        },
        onSettled: () => {
            setDeleteId(null);
        }
    });

    const handleDeleteClick = (id) => {
        setDeleteId(id);
    };

    const handleConfirmDelete = () => {
        if (!deleteId) return;
        deleteProject(deleteId);
    };
    const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.projectCode?.toLowerCase().includes(search.toLowerCase()) ||
        p.customer?.companyName.toLowerCase().includes(search.toLowerCase()));
    const total = filteredProjects.length;
    const start = (page - 1) * pageSize;
    const paginated = filteredProjects.slice(start, start + pageSize);
    if (permsLoading) {
        return (<Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardHeader><CardTitle>Loading permissions...</CardTitle></CardHeader>
            </Card>);
    }
    if (!canView) {
        return <div className="p-6 text-center text-muted-foreground">You do not have permission to view projects.</div>;
    }
    return (<Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
            <CardHeader>
                <CardTitle>All Projects</CardTitle>
                <CardDescription>
                    A list of all projects and their status.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center space-x-2 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/>
                        <Input placeholder="Search projects..." className="pl-9 bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-800/50 focus:bg-white dark:focus:bg-slate-900 rounded-xl transition-all" value={search} onChange={(e) => setSearch(e.target.value)}/>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50/70 dark:hover:bg-slate-900/70">
                            <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                                <TableHead className="h-10">Project Code</TableHead>
                                <TableHead className="h-10">Project Name</TableHead>
                                <TableHead className="h-10">Client</TableHead>
                                <TableHead className="h-10">Location</TableHead>
                                <TableHead className="h-10">Billing Cycle</TableHead>
                                <TableHead className="h-10">Status</TableHead>
                                <TableHead className="h-10 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (<TableRow><TableCell colSpan={7} className="h-24 text-center">Loading...</TableCell></TableRow>) : filteredProjects.length === 0 ? (<TableRow><TableCell colSpan={7} className="h-24 text-center">No projects found.</TableCell></TableRow>) : (paginated.map((proj) => (<TableRow key={proj.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60 transition-colors">
                                        <TableCell>
                                            <span className="font-mono text-xs bg-muted px-2 py-1 rounded-md">
                                                {proj.projectCode || "-"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <Link href={`/projects/${proj.id}`} className="hover:underline text-primary" title={proj.name}>
                                                {truncateString(proj.name, 20)}
                                            </Link>
                                        </TableCell>
                                        <TableCell title={proj.customer?.companyName}>{truncateString(proj.customer?.companyName, 20) || "Unknown"}</TableCell>
                                        <TableCell title={proj.location}>{truncateString(proj.location, 20) || "-"}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{proj.billingCycle}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge status={proj.status} />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                {canView && (<Link href={`/projects/${proj.id}`}>
                                                        <Button variant="ghost" size="icon">
                                                            <Eye className="h-4 w-4"/>
                                                        </Button>
                                                    </Link>)}
                                                {canEdit && (<Button variant="ghost" size="icon" onClick={() => onEdit(proj)}>
                                                        <Edit className="h-4 w-4"/>
                                                    </Button>)}
                                                {canDelete && (<Button variant="ghost" size="icon" onClick={() => handleDeleteClick(proj.id)}>
                                                        <Trash2 className="h-4 w-4 text-red-500"/>
                                                    </Button>)}
                                            </div>
                                        </TableCell>
                                    </TableRow>)))}
                        </TableBody>
                    </Table>
                </div>

                <PaginationControls page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize}/>

                <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the project and its data from the server.
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
