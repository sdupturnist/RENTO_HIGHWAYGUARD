"use client";
import { truncateString } from "@/app/lib/utils";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Eye, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from "@/app/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/app/Components/ui/table";
import { Badge } from "@/app/Components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/app/Components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/app/Components/ui/alert-dialog";
import { toast } from "sonner";
import Link from "next/link";
import { PaginationControls } from "@/app/Components/common/PaginationControls";
import { StatusBadge } from "@/app/Components/common/StatusBadge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function AssignmentList({ onEdit, canEdit = true, canDelete = true }) {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [deleteId, setDeleteId] = useState(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const { data: assignments = [], isLoading: loading } = useQuery({
        queryKey: ["assignments", statusFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (statusFilter !== "ALL") params.append("status", statusFilter);
            const res = await fetch(`/api/assignments?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch assignments");
            const data = await res.json();
            return data.assignments || [];
        },
        staleTime: 30 * 1000,
    });

    const { mutate: deleteAssignment, isLoading: isDeleting } = useMutation({
        mutationFn: async (id) => {
            const res = await fetch(`/api/assignments/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to delete assignment");
            return data;
        },
        onSuccess: () => {
            toast.success("Assignment deleted successfully");
            queryClient.invalidateQueries({ queryKey: ["assignments"] });
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
        deleteAssignment(deleteId);
    };
    const filteredAssignments = assignments.filter((assignment) => {
        const searchLower = searchTerm.toLowerCase();
        const customerName = assignment.customer?.companyName ?? "Internal";
        return (customerName.toLowerCase().includes(searchLower) ||
            assignment.project?.name?.toLowerCase().includes(searchLower) ||
            assignment.assignmentCode?.toLowerCase().includes(searchLower) ||
            assignment.id.toString().includes(searchLower));
    });
    const total = filteredAssignments.length;
    const start = (page - 1) * pageSize;
    const paginated = filteredAssignments.slice(start, start + pageSize);
    return (<Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
        <CardHeader>
            <CardTitle>All Assignments</CardTitle>
            <CardDescription>
                A list of all assignments and their status.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input placeholder="Search by customer, project, or ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-800/50 focus:bg-white dark:focus:bg-slate-900 rounded-xl transition-all" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All Status</SelectItem>
                        <SelectItem value="DRAFT">Draft</SelectItem>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="COMPLETED">Completed</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50/70 dark:hover:bg-slate-900/70">
                        <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                            <TableHead className="h-10">Assignment Code</TableHead>
                            <TableHead className="h-10">Customer</TableHead>
                            <TableHead className="h-10">Project</TableHead>
                            <TableHead className="h-10">Start Date</TableHead>
                            <TableHead className="h-10">End Date</TableHead>
                            <TableHead className="h-10">Billing Cycle</TableHead>
                            <TableHead className="h-10">Total Vehicles</TableHead>
                            <TableHead className="h-10">Status</TableHead>
                            <TableHead className="h-10 text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (<TableRow><TableCell colSpan={9} className="h-24 text-center">Loading...</TableCell></TableRow>) : filteredAssignments.length === 0 ? (<TableRow><TableCell colSpan={9} className="h-24 text-center">No assignments found.</TableCell></TableRow>) : (paginated.map((assignment) => (<TableRow key={assignment.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60 transition-colors">
                            <TableCell>
                                <span className="font-mono text-xs bg-muted px-2 py-1 rounded-md">
                                    {assignment.assignmentCode || "-"}
                                </span>
                            </TableCell>
                            <TableCell className="font-medium">
                                {assignment.customer ? (
                                    <span title={assignment.customer.companyName}>
                                        {truncateString(assignment.customer.companyName, 20)}
                                    </span>
                                ) : (
                                    <span className="text-muted-foreground italic text-xs">Internal</span>
                                )}
                            </TableCell>
                            <TableCell>
                                {assignment.project ? (<Link href={`/projects/${assignment.project.id}`} className="text-primary hover:underline" title={assignment.project.name}>
                                    {truncateString(assignment.project.name, 20)}
                                </Link>) : (<span className="text-muted-foreground">-</span>)}
                            </TableCell>
                            <TableCell>{format(new Date(assignment.startDate), "dd MMM yyyy")}</TableCell>
                            <TableCell>{format(new Date(assignment.endDate), "dd MMM yyyy")}</TableCell>
                            <TableCell>
                                <Badge variant="outline">{assignment.billingCycle}</Badge>
                            </TableCell>
                            <TableCell className="text-center">{assignment.totalVehicles}</TableCell>
                            <TableCell>
                                <StatusBadge status={assignment.status} />
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    <Link href={`/assignments/${assignment.id}`}>
                                        <Button variant="ghost" size="icon">
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                    {canEdit && (
                                        <Button variant="ghost" size="icon" onClick={() => onEdit(assignment)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {canDelete && (
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(assignment.id)}>
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>)))}
                    </TableBody>
                </Table>
            </div>

            <PaginationControls page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the assignment and its data from the server.
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
