"use client";
import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/app/Components/ui/table";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, } from "@/app/Components/ui/dialog";
import { Label } from "@/app/Components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/app/Components/ui/alert-dialog";

export function RegistrationAuthoritiesManager() {
    const [authorities, setAuthorities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [open, setOpen] = useState(false);
    const [editingAuthority, setEditingAuthority] = useState(null);
    const [deleteId, setDeleteId] = useState(null);

    const fetchAuthorities = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/config/authorities");
            if (res.ok)
                setAuthorities(await res.json());
        }
        catch (error) {
            toast.error("Failed to load authorities");
        }
        finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAuthorities(); }, []);

    const handleSubmit = async () => {
        if (!newName.trim())
            return;
        setSubmitting(true);
        try {
            const url = editingAuthority
                ? `/api/config/authorities/${editingAuthority.id}`
                : "/api/config/authorities";
            const method = editingAuthority ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName.trim() }),
            });
            if (res.ok) {
                toast.success(editingAuthority ? "Registration authority updated" : "Registration authority added");
                setNewName("");
                setEditingAuthority(null);
                setOpen(false);
                fetchAuthorities();
            }
            else {
                const data = await res.json();
                toast.error(data.message || "Failed to save authority");
            }
        }
        catch (error) {
            toast.error("Error saving authority");
        }
        finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            const res = await fetch(`/api/config/authorities/${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                toast.success("Registration authority deleted");
                fetchAuthorities();
            }
            else {
                const data = await res.json();
                toast.error(data.message || "Failed to delete authority");
            }
        }
        catch (error) {
            toast.error("Error deleting authority");
        }
        finally {
            setDeleteId(null);
        }
    };

    const openEdit = (authority) => {
        setEditingAuthority(authority);
        setNewName(authority.name);
        setOpen(true);
    };

    return (<div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Registration Authorities</h3>
                <Dialog open={open} onOpenChange={(val) => {
                    setOpen(val);
                    if (!val) {
                        setEditingAuthority(null);
                        setNewName("");
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button size="sm"><Plus className="h-4 w-4 mr-2"/> Add Authority</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingAuthority ? "Edit Registration Authority" : "Add Registration Authority"}</DialogTitle>
                            <DialogDescription>
                                {editingAuthority ? "Update the name of the registration authority." : "Create a new registration authority (e.g., RTA, Abu Dhabi Police)."}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Authority Name</Label>
                                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. RTA"/>
                            </div>
                            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                                {submitting ? "Saving..." : "Save Authority"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center h-24">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto"/>
                                </TableCell>
                            </TableRow>
                        ) : authorities.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center h-24 text-muted-foreground">
                                    No authorities found.
                                </TableCell>
                            </TableRow>
                        ) : (authorities.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(item.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )))}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Registration Authority?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently remove this registration authority. This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(deleteId)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>);
}
