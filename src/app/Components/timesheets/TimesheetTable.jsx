"use client";
import { truncateString } from "@/app/lib/utils";
import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { Badge } from "@/app/Components/ui/badge";
import { Button } from "@/app/Components/ui/button";
import { MoreHorizontal, FileText, Trash2, Eye } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/app/Components/ui/dropdown-menu";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/app/Components/ui/alert-dialog";
import { generateTimesheetPDF } from "@/app/lib/timesheet-pdf";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { PaginationControls } from "@/app/Components/common/PaginationControls";
export function TimesheetTable({ data }) {
    const router = useRouter();
    const [deleteId, setDeleteId] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const { can, loading: permsLoading } = usePermissions();
    const canView = can("Timesheet", "View");
    const canEdit = can("Timesheet", "Edit");
    const canDelete = can("Timesheet", "Delete");
    const handleDelete = async () => {
        if (!deleteId)
            return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/timesheets/${deleteId}`, {
                method: "DELETE"
            });
            if (res.ok) {
                toast.success("Timesheet deleted successfully.");
                router.refresh();
            }
            else {
                const err = await res.json();
                toast.error(err.error || "Failed to delete");
            }
        }
        catch (error) {
            console.error(error);
            toast.error("Failed to delete");
        }
        finally {
            setDeleting(false);
            setDeleteId(null);
        }
    };
    if (permsLoading) {
        return <div>Loading permissions...</div>;
    }
    if (!canView) {
        return <div className="p-4 text-center text-muted-foreground">You do not have permission to view timesheets.</div>;
    }
    const getStatusBadge = (status) => {
        switch (status) {
            case "DRAFT": return <Badge variant="secondary">Draft</Badge>;
            case "EXPORTED": return <Badge variant="default" className="bg-blue-600">Exported</Badge>;
            case "INVOICED": return <Badge variant="default" className="bg-green-600">Invoiced</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };
    const total = data.length;
    const start = (page - 1) * pageSize;
    const paginated = data.slice(start, start + pageSize);
    return (<>
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Timesheet ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-center">Vehicles</TableHead>
                        <TableHead className="text-center">Operators</TableHead>
                        <TableHead className="text-right">Total Hours</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Generated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.length === 0 ? (<TableRow>
                        <TableCell colSpan={10} className="h-24 text-center">
                            No timesheets found.
                        </TableCell>
                    </TableRow>) : (paginated.map((item) => (<TableRow key={item.id}>
                        <TableCell className="font-medium">
                            <Link href={`/timesheets/${item.id}`} className="hover:underline">
                                {item.timesheetCode}
                            </Link>
                        </TableCell>
                        <TableCell title={item.customer?.companyName ?? "Internal"}>
                            {item.isInternal
                                ? <span className="text-muted-foreground italic text-xs">Internal</span>
                                : truncateString(item.customer?.companyName, 20) || "—"
                            }
                        </TableCell>
                        <TableCell title={item.project?.name}>{truncateString(item.project?.name, 20) || "-"}</TableCell>
                        <TableCell>
                            <div className="text-xs">
                                {format(new Date(item.periodStart), "dd MMM yyyy")}
                                <br />
                                <span className="text-muted-foreground">to</span>{" "}
                                {format(new Date(item.periodEnd), "dd MMM yyyy")}
                            </div>
                        </TableCell>
                        <TableCell className="text-center">{item.totalVehicles}</TableCell>
                        <TableCell className="text-center">{item.totalOperators}</TableCell>
                        <TableCell className="text-right font-medium">{item.totalHours.toFixed(1)}</TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(item.generatedAt), "MMM dd, HH:mm")}
                        </TableCell>
                        <TableCell className="text-right">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                        <span className="sr-only">Open menu</span>
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => router.push(`/timesheets/${item.id}`)}>
                                        <Eye className="mr-2 h-4 w-4" /> View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={async () => {
                                        const loadingToast = toast.loading("Generating PDF...");
                                        try {
                                            const res = await fetch(`/api/timesheets/${item.id}`);
                                            if (!res.ok) throw new Error("Failed to fetch timesheet details");
                                            const fullTimesheet = await res.json();

                                            await generateTimesheetPDF(fullTimesheet);

                                            if (item.status === "DRAFT") {
                                                await fetch(`/api/timesheets/${item.id}`, {
                                                    method: "PATCH",
                                                    body: JSON.stringify({ status: "EXPORTED" })
                                                });
                                                router.refresh();
                                            }
                                            toast.dismiss(loadingToast);
                                            toast.success("PDF Downloaded");
                                        } catch (error) {
                                            console.error(error);
                                            toast.dismiss(loadingToast);
                                            toast.error("Failed to generate PDF");
                                        }
                                    }}>
                                        <FileText className="mr-2 h-4 w-4" /> Export PDF
                                    </DropdownMenuItem>
                                    {canDelete && item.status !== "INVOICED" && (<DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleteId(item.id)}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </DropdownMenuItem>)}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>)))}
                </TableBody>
            </Table>
        </div>
        <div className="mt-3">
            <PaginationControls page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </div>

        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the timesheet and its calculated lines.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                        {deleting ? "Deleting..." : "Delete Timesheet"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>);
}
