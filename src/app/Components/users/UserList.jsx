"use client";
import { truncateString } from "@/app/lib/utils";
import { useState, useEffect } from "react";
import { Edit, Trash2, LockOpen, ShieldCheck } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/app/Components/ui/table";
import { toast } from "sonner";
import { Badge } from "@/app/Components/ui/badge";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { PaginationControls } from "@/app/Components/common/PaginationControls";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/app/Components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

export function UserList({ onEdit }) {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [unlockingUserId, setUnlockingUserId] = useState(null);
    const { can, loading: permsLoading } = usePermissions();
    const canView = can("Users & Roles", "View");
    const canEdit = can("Users & Roles", "Edit");
    const canDelete = can("Users & Roles", "Delete");

    const { data: users = [], isLoading: loading } = useQuery({
        queryKey: ["users"],
        queryFn: async () => {
            const res = await fetch(`/api/users`);
            if (!res.ok) throw new Error("Failed to fetch users");
            return res.json();
        },
        enabled: !permsLoading && canView,
        staleTime: 30 * 1000,
    });

    const [userToDelete, setUserToDelete] = useState(null);

    const { mutate: deleteUser } = useMutation({
        mutationFn: async (id) => {
            const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Error deleting user");
            return data;
        },
        onSuccess: (data) => {
            toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: ["users"] });
        },
        onError: (error) => {
            toast.error(error.message);
        },
        onSettled: () => {
            setUserToDelete(null);
        }
    });

    const { mutate: unlockUserMutation } = useMutation({
        mutationFn: async (id) => {
            const res = await fetch(`/api/users/${id}/unlock`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to unlock user");
            return data;
        },
        onSuccess: (data) => {
            toast.success(data.message || "User unlocked");
            queryClient.invalidateQueries({ queryKey: ["users"] });
        },
        onError: (error) => {
            toast.error(error.message);
        },
        onSettled: () => {
            setUnlockingUserId(null);
        }
    });

    const confirmDelete = () => {
        if (!userToDelete) return;
        deleteUser(userToDelete);
    };

    const unlockUser = (user) => {
        setUnlockingUserId(user.id);
        unlockUserMutation(user.id);
    };
    if (permsLoading) {
        return <div className="p-4 text-muted-foreground">Loading permissions...</div>;
    }
    if (!canView) {
        return <div className="p-6 text-center text-muted-foreground">You do not have permission to view users.</div>;
    }
    const total = users.length;
    const start = (page - 1) * pageSize;
    const paginated = users.slice(start, start + pageSize);
    return (<div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
        <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50/70 dark:hover:bg-slate-900/70">
                <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                    <TableHead className="h-10">Name</TableHead>
                    <TableHead className="h-10">Email</TableHead>
                    <TableHead className="h-10">Phone</TableHead>
                    <TableHead className="h-10">Role</TableHead>
                    <TableHead className="h-10">Status</TableHead>
                    <TableHead className="h-10">Security</TableHead>
                    <TableHead className="h-10">Last Login</TableHead>
                    <TableHead className="h-10 text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading ? (<TableRow><TableCell colSpan={8} className="text-center py-4">Loading...</TableCell></TableRow>) : users.length === 0 ? (<TableRow><TableCell colSpan={8} className="text-center py-4 text-muted-foreground">No users found.</TableCell></TableRow>) : (paginated.map((user) => (<TableRow key={user.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60 transition-colors">
                    <TableCell className="font-medium">
                        <Link href={`/users/${user.id}/edit`} className="hover:underline text-primary" title={user.name}>
                            {truncateString(user.name, 20)}
                        </Link>
                    </TableCell>
                    <TableCell title={user.email}>{truncateString(user.email, 20)}</TableCell>
                    <TableCell>{user.phone || "-"}</TableCell>
                    <TableCell title={user.role?.name}>{truncateString(user.role?.name, 20) || "N/A"}</TableCell>
                    <TableCell>
                        <Badge variant={user.status === "ACTIVE" ? "default" : "secondary"} className={user.status === "ACTIVE" ? "bg-green-600 hover:bg-green-700" : ""}>
                            {user.status}
                        </Badge>
                    </TableCell>
                    <TableCell>
                        <div className="flex flex-wrap gap-2 justify-end md:justify-start">
                            {user.isSystem ? (
                                <Badge variant="default" className="bg-purple-600 hover:bg-purple-700 flex items-center gap-1">
                                    <ShieldCheck className="h-3 w-3" />
                                    Protected
                                </Badge>
                            ) : user.isLocked ? (
                                <Badge variant="destructive">Locked</Badge>
                            ) : user.mustChangePassword ? (
                                <Badge variant="outline">Password change required</Badge>
                            ) : (
                                <Badge variant="outline">Normal</Badge>
                            )}
                        </div>
                    </TableCell>
                    <TableCell>
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                            {canEdit && (<Button variant="ghost" size="icon" onClick={() => onEdit(user)}>
                                <Edit className="h-4 w-4" />
                            </Button>)}
                            {user.canUnlock && (
                                <Button variant="ghost" size="icon" onClick={() => unlockUser(user)} disabled={unlockingUserId === user.id} title="Unlock user">
                                    <LockOpen className="h-4 w-4 text-amber-600" />
                                </Button>
                            )}
                            {canDelete && !user.isSystem && !user.isPrimaryTenantUser && (<Button variant="ghost" size="icon" onClick={() => setUserToDelete(user.id)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>)}
                        </div>
                    </TableCell>
                </TableRow>)))}
            </TableBody>
        </Table>
        <div className="p-3">
            <PaginationControls page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </div>
        <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete User?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. The user will lose access immediately.
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
    </div>);
}
