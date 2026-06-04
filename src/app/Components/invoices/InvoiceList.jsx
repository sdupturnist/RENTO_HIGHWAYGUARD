"use client";
import { truncateString } from "@/app/lib/utils";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Eye, Trash2, Search } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, } from "@/app/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/app/Components/ui/table";
import { Badge } from "@/app/Components/ui/badge";
import Link from "next/link";
import { toast } from "sonner";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { PaginationControls } from "@/app/Components/common/PaginationControls";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/app/Components/ui/alert-dialog";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";
import { useSettings } from "@/app/Components/providers/SettingsProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function InvoiceList() {
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const { can, loading: permsLoading } = usePermissions();
    const { currencySymbol } = useSettings();
    const canView = can("Invoices", "View");
    const canDelete = can("Invoices", "Delete");

    // Refetch when tab regains focus (catches navigating back from create/detail pages)
    useEffect(() => {
        const handleFocus = () => {
            queryClient.invalidateQueries({ queryKey: ["invoices"], refetchType: "all" });
        };
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [queryClient]);

    const { data: invoices = [], isLoading: loading } = useQuery({
        queryKey: ["invoices"],
        queryFn: async () => {
            const response = await fetch("/api/invoices");
            if (!response.ok) throw new Error("Failed to load invoices");
            return response.json();
        },
        enabled: !permsLoading && canView,
        staleTime: 0,
        refetchOnWindowFocus: true,
    });

    const [invoiceToDelete, setInvoiceToDelete] = useState(null);

    const { mutate: deleteInvoice } = useMutation({
        mutationFn: async (id) => {
            const response = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to delete invoice");
            return data;
        },
        // second arg is the original `variables` (the id passed to mutate)
        onSuccess: (_, deletedId) => {
            queryClient.setQueryData(["invoices"], (current = []) =>
                Array.isArray(current) ? current.filter((invoice) => invoice.id !== deletedId) : []
            );
            toast.success("Invoice deleted successfully. Linked timesheet unlocked.");
            queryClient.invalidateQueries({ queryKey: ["invoices"], refetchType: "all" });
        },
        onError: (error) => {
            toast.error(error.message);
        },
        onSettled: () => {
            setInvoiceToDelete(null);
        }
    });

    const confirmDelete = () => {
        if (!invoiceToDelete) return;
        deleteInvoice(invoiceToDelete);
    };

    const filteredInvoices = invoices.filter(inv =>
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.customer?.companyName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.project?.name || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
    const total = filteredInvoices.length;
    const start = (page - 1) * pageSize;
    const paginated = filteredInvoices.slice(start, start + pageSize);

    const getStatusVariant = (status) => {
        switch (status) {
            case "PAID": return "success";
            case "SENT": return "default";
            case "DRAFT": return "secondary";
            case "CANCELLED": return "destructive";
            default: return "outline";
        }
    };

    if (permsLoading)
        return <div>Loading permissions...</div>;
    if (!canView)
        return <div className="p-6 text-center text-muted-foreground">You do not have permission to view invoices.</div>;
    if (loading)
        return <div>Loading invoices...</div>;

    return (<Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="space-y-1">
                    <CardTitle>Invoices</CardTitle>
                    <CardDescription>
                        Manage your billing documents.
                    </CardDescription>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/>
                        <Input placeholder="Search invoices..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-[250px] bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-800/50 focus:bg-white dark:focus:bg-slate-900 rounded-xl transition-all"/>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50/70 dark:hover:bg-slate-900/70">
                            <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                                <TableHead className="h-10">Invoice #</TableHead>
                                <TableHead className="h-10">Date</TableHead>
                                <TableHead className="h-10">Customer</TableHead>
                                <TableHead className="h-10">Project</TableHead>
                                <TableHead className="h-10">Timesheet</TableHead>
                                <TableHead className="h-10">Due Date</TableHead>
                                <TableHead className="h-10 text-right">Amount</TableHead>
                                <TableHead className="h-10">Status</TableHead>
                                <TableHead className="h-10 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredInvoices.length === 0 ? (<TableRow>
                                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                        No invoices found.
                                    </TableCell>
                                </TableRow>) : (paginated.map((invoice) => (<TableRow key={invoice.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60 transition-colors">
                                        <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                                        <TableCell>{format(new Date(invoice.date), "MMM d, yyyy")}</TableCell>
                                        <TableCell title={invoice.customer?.companyName}>{truncateString(invoice.customer?.companyName, 20) || "—"}</TableCell>
                                        <TableCell title={invoice.project?.name}>{truncateString(invoice.project?.name, 20) || "-"}</TableCell>
                                        <TableCell>
                                            {invoice.timesheet ? (<Link href={`/timesheets/${invoice.timesheet.timesheetCode}`} className="text-blue-600 hover:underline">
                                                    {invoice.timesheet.timesheetCode}
                                                </Link>) : "-"}
                                        </TableCell>
                                        <TableCell>
                                            {invoice.dueDate ? format(new Date(invoice.dueDate), "MMM d, yyyy") : "-"}
                                        </TableCell>
                                        <TableCell className="text-right font-bold">
                                            <span className="inline-flex items-center gap-0.5">
                                                <CurrencySymbol symbol={currencySymbol} />
                                                {new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2 }).format(invoice.totalAmount)}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={invoice.status === 'PAID' ? 'default' : invoice.status === 'CANCELLED' ? 'destructive' : 'secondary'}>
                                                {invoice.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                {canView && (<Button variant="ghost" size="icon" asChild>
                                                        <Link href={`/invoices/${invoice.id}`}>
                                                            <Eye className="h-4 w-4"/>
                                                        </Link>
                                                    </Button>)}
                                                {canDelete && (<Button variant="ghost" size="icon" onClick={() => setInvoiceToDelete(invoice.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                                        <Trash2 className="h-4 w-4"/>
                                                    </Button>)}
                                            </div>
                                        </TableCell>
                                    </TableRow>)))}
                        </TableBody>
                    </Table>
                </div>
                <PaginationControls page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize}/>
            </CardContent>
            <AlertDialog open={!!invoiceToDelete} onOpenChange={(open) => !open && setInvoiceToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the invoice and unlock the linked timesheet. This action cannot be undone.
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