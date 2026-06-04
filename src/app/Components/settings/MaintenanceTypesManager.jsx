"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/app/Components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/app/Components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, } from "@/app/Components/ui/dialog";
import { Badge } from "@/app/Components/ui/badge";
export function MaintenanceTypesManager() {
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editingType, setEditingType] = useState(null);
    // Form state
    const [name, setName] = useState("");
    const [submitting, setSubmitting] = useState(false);
    // Delete state
    const [deleteId, setDeleteId] = useState(null);
    const fetchTypes = async () => {
        try {
            const res = await fetch("/api/master-config/maintenance-types");
            const data = await res.json();
            setTypes(Array.isArray(data) ? data : []);
        }
        catch (error) {
            toast.error("Failed to load maintenance types");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchTypes();
    }, []);
    const handleSubmit = async () => {
        if (!name.trim())
            return;
        setSubmitting(true);
        try {
            const url = editingType
                ? `/api/master-config/maintenance-types/${editingType.id}`
                : "/api/master-config/maintenance-types";
            const method = editingType ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            if (res.ok) {
                toast.success(editingType ? "Type updated" : "Type created");
                setName("");
                setEditingType(null);
                setOpen(false);
                fetchTypes();
            }
            else {
                toast.error("Failed to save type");
            }
        }
        catch (error) {
            toast.error("Error saving type");
        }
        finally {
            setSubmitting(false);
        }
    };
    const confirmDelete = async () => {
        if (!deleteId)
            return;
        try {
            const res = await fetch(`/api/master-config/maintenance-types/${deleteId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                toast.success("Maintenance type deleted");
                fetchTypes();
            }
            else {
                const data = await res.json();
                toast.error(data.message || "Failed to delete");
            }
        }
        catch (error) {
            toast.error("Error deleting type");
        }
        finally {
            setDeleteId(null);
        }
    };
    const openEdit = (type) => {
        setEditingType(type);
        setName(type.name);
        setOpen(true);
    };
    return (<div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Maintenance Types</h3>
                <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) {
                setEditingType(null);
                setName("");
            }
        }}>
                    <DialogTrigger asChild>
                        <Button size="sm"><Plus className="mr-2 h-4 w-4"/> Add Type</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingType ? "Edit Type" : "Add Maintenance Type"}</DialogTitle>
                            <DialogDescription>
                                Create categories for maintenance tasks (e.g., Service, Repair, Inspection).
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <Input placeholder="Type Name" value={name} onChange={(e) => setName(e.target.value)}/>
                            <Button onClick={handleSubmit} disabled={submitting}>
                                {submitting ? "Saving..." : "Save"}
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
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (<TableRow>
                                <TableCell colSpan={3} className="text-center py-4">Loading...</TableCell>
                            </TableRow>) : types.length === 0 ? (<TableRow>
                                <TableCell colSpan={3} className="text-center py-4 text-slate-500">No types found</TableCell>
                            </TableRow>) : (types.map((type) => (<TableRow key={type.id}>
                                    <TableCell className="font-medium">{type.name}</TableCell>
                                    <TableCell>
                                        <Badge variant={type.isActive ? "default" : "secondary"}>
                                            {type.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => openEdit(type)}>
                                                <Edit2 className="h-4 w-4"/>
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(type.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                                <Trash2 className="h-4 w-4"/>
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>)))}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the maintenance type.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>);
}
