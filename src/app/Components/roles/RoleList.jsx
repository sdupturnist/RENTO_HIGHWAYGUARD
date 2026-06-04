"use client";
import { truncateString } from "@/app/lib/utils";
import { useState } from "react";
import { Edit, Trash2, Shield, Users } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/app/Components/ui/table";
import { toast } from "sonner";
import { Badge } from "@/app/Components/ui/badge";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/app/Components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

export function RoleList({ onEdit }) {
    const queryClient = useQueryClient();
    const { can, loading: permsLoading } = usePermissions();
    const canView = can("Users & Roles", "View");
    const canEdit = can("Users & Roles", "Edit");
    const canDelete = can("Users & Roles", "Delete");

    const { data: roles = [], isLoading: loading } = useQuery({
        queryKey: ["roles"],
        queryFn: async () => {
            const res = await fetch("/api/roles");
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to fetch roles");
            return Array.isArray(data) ? data : [];
        },
        enabled: !permsLoading && canView,
    });

    const [roleToDelete, setRoleToDelete] = useState(null);

    const { mutate: deleteRole, isPending: isDeleting } = useMutation({
        mutationFn: async (role) => {
            const res = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Error deleting role");
            return data;
        },
        onSuccess: (data) => {
            toast.success(data.message || "Role deleted");
            queryClient.invalidateQueries({ queryKey: ["roles"] });
        },
        onError: (error) => {
            toast.error(error.message);
        },
        onSettled: () => {
            setRoleToDelete(null);
        },
    });

    const confirmDelete = () => {
        if (!roleToDelete || roleToDelete.isSystem || roleToDelete.name === 'Super Admin') {
            setRoleToDelete(null);
            return;
        }
        deleteRole(roleToDelete);
    };

    if (permsLoading) {
        return <div className="p-4 text-muted-foreground">Loading permissions...</div>;
    }
    if (!canView) {
        return <div className="p-6 text-center text-muted-foreground">You do not have permission to view roles.</div>;
    }
    return (<div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
        <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50/70 dark:hover:bg-slate-900/70">
                <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                    <TableHead className="h-10">Role Name</TableHead>
                    <TableHead className="h-10">Description</TableHead>
                    <TableHead className="h-10">Users</TableHead>
                    <TableHead className="h-10">Permissions</TableHead>
                    <TableHead className="h-10">Type</TableHead>
                    <TableHead className="h-10 text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading ? (<TableRow><TableCell colSpan={6} className="text-center py-4">Loading...</TableCell></TableRow>) : roles.length === 0 ? (<TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">No roles found.</TableCell></TableRow>) : (roles.map((role) => (<TableRow key={role.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60 transition-colors">
                    <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <Link href={`/users/roles/${role.id}/edit`} className="hover:underline text-primary" title={role.name}>
                                {truncateString(role.name, 20)}
                            </Link>
                        </div>
                    </TableCell>
                    <TableCell title={role.description}>{truncateString(role.description, 20) || "-"}</TableCell>
                    <TableCell>
                        <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            {role.userCount}
                        </div>
                    </TableCell>
                    <TableCell>
                        <Badge variant="secondary">
                            {role.permissionCount} Permissions
                        </Badge>
                    </TableCell>
                    <TableCell>
                        {role.isSystem ? (<Badge variant="default" className="bg-blue-600">System</Badge>) : (<Badge variant="outline">Custom</Badge>)}
                    </TableCell>
                    <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                            {canEdit && (<Button variant="ghost" size="icon" onClick={() => onEdit(role)}>
                                <Edit className="h-4 w-4" />
                            </Button>)}
                            {canDelete && !role.isSystem && role.name !== "Super Admin" && (<Button variant="ghost" size="icon" onClick={() => setRoleToDelete(role)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>)}
                        </div>
                    </TableCell>
                </TableRow>)))}
            </TableBody>
        </Table>
        <AlertDialog open={!!roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Role?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. System roles cannot be deleted. Users assigned to this role will be detached.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700" disabled={isDeleting || (!!roleToDelete && roleToDelete.isSystem)}>
                        {isDeleting ? "Deleting..." : "Delete Permanently"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>);
}
