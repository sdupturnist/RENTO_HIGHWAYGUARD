"use client";
import { truncateString } from "@/app/lib/utils";
import { useState } from "react";
import Link from "next/link";
import { Eye, Edit, Trash2, Search, Filter } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, } from "@/app/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/app/Components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/app/Components/ui/alert-dialog";
import { toast } from "sonner";
import { Badge } from "@/app/Components/ui/badge";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { PaginationControls } from "@/app/Components/common/PaginationControls";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function ClientList({ onEdit }) {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [clientToDelete, setClientToDelete] = useState(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const { can, loading: permsLoading } = usePermissions();
    const canView = can("Customers", "View");
    const canEdit = can("Customers", "Edit");
    const canDelete = can("Customers", "Delete");

    const { data: clients = [], isLoading: loading } = useQuery({
        queryKey: ["clients"],
        queryFn: async () => {
            const res = await fetch("/api/clients");
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || "Failed to load customers");
            return Array.isArray(data) ? data : [];
        },
        enabled: !permsLoading && canView,
        staleTime: 30 * 1000,
    });

    const { mutate: deleteClient } = useMutation({
        mutationFn: async (id) => {
            const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to delete customer");
            return { ...data, id };
        },
        onSuccess: (data, deletedId) => {
            queryClient.setQueryData(["clients"], (current = []) =>
                Array.isArray(current) ? current.filter((client) => client.id !== deletedId) : []
            );
            toast.success(data.message || "Customer deleted successfully");
            queryClient.invalidateQueries({ queryKey: ["clients"] });
        },
        onError: (error) => {
            toast.error(error.message);
        },
        onSettled: () => {
            setClientToDelete(null);
        }
    });

    const confirmDelete = () => {
        if (!clientToDelete) return;
        deleteClient(clientToDelete);
    };
    if (permsLoading) {
        return (<Card className="border-slate-200/60 dark:border-slate-800/60">
                <CardHeader><CardTitle>Loading permissions...</CardTitle></CardHeader>
            </Card>);
    }
    if (!canView) {
        return <div className="p-6 text-center text-muted-foreground">You do not have permission to view customers.</div>;
    }

    const filteredClients = clients.filter((client) => {
        const term = search.trim().toLowerCase();
        if (!term) return true;

        return [
            client.customerCode,
            client.companyName,
            client.email,
            client.phone,
            client.status,
            client.contacts?.[0]?.name,
        ].some((value) => String(value || "").toLowerCase().includes(term));
    });

    const total = filteredClients.length;
    const start = (page - 1) * pageSize;
    const paginated = filteredClients.slice(start, start + pageSize);
    return (<>
            <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
                <CardHeader>
                    <CardTitle>All Customers</CardTitle>
                    <CardDescription>
                        A list of all registered customers in your system.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center space-x-2 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/>
                            <Input
                                placeholder="Search customers..."
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
                            <Filter className="h-4 w-4"/>
                            Clear
                        </Button>
                    </div>

                    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50/70 dark:hover:bg-slate-900/70">
                                <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                                    <TableHead className="h-10">Customer Code</TableHead>
                                    <TableHead className="h-10">Company Name</TableHead>
                                    <TableHead className="h-10">Email</TableHead>
                                    <TableHead className="h-10">Phone</TableHead>
                                    <TableHead className="h-10">Contacts</TableHead>
                                    <TableHead className="h-10">Projects</TableHead>
                                    <TableHead className="h-10">Status</TableHead>
                                    <TableHead className="h-10 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (<TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">
                                            Loading...
                                        </TableCell>
                                    </TableRow>) : filteredClients.length === 0 ? (<TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">
                                            No customers found.
                                        </TableCell>
                                    </TableRow>) : (paginated.map((client) => (<TableRow key={client.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60 transition-colors">
                                            <TableCell className="font-medium text-xs text-muted-foreground">{client.customerCode}</TableCell>
                                            <TableCell className="font-medium">
                                                <Link href={`/customers/${client.id}`} className="hover:underline text-primary" title={client.companyName}>
                                                    {truncateString(client.companyName, 20)}
                                                </Link>
                                            </TableCell>
                                            <TableCell title={client.email}>{truncateString(client.email, 20) || "-"}</TableCell>
                                            <TableCell>{client.phone || "-"}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {client.contacts.length > 0 ? client.contacts[0].name : "No contacts"}
                                                {client.contacts.length > 1 && ` +${client.contacts.length - 1} more`}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{client._count.projects}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={client.status === "ACTIVE" ? "default" : "destructive"} className={client.status === "ACTIVE" ? "bg-green-600 hover:bg-green-700" : ""}>
                                                    {client.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {canView && (<Link href={`/customers/${client.id}`}>
                                                            <Button variant="ghost" size="icon">
                                                                <Eye className="h-4 w-4"/>
                                                            </Button>
                                                        </Link>)}
                                                    {canEdit && (<Button variant="ghost" size="icon" onClick={() => onEdit(client)}>
                                                            <Edit className="h-4 w-4"/>
                                                        </Button>)}
                                                    {canDelete && (<Button variant="ghost" size="icon" onClick={() => setClientToDelete(client.id)}>
                                                            <Trash2 className="h-4 w-4 text-red-500"/>
                                                        </Button>)}
                                                </div>
                                            </TableCell>
                                        </TableRow>)))}
                            </TableBody>
                        </Table>
                    </div>
                    <PaginationControls page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize}/>
                </CardContent>
            </Card>

            <AlertDialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the customer and their data from the server.
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
        </>);
}
