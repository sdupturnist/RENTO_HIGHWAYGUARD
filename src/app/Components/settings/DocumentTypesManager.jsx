"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/app/Components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, } from "@/app/Components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/app/Components/ui/alert-dialog";
import { toast } from "sonner";
export function DocumentTypesManager({ category }) {
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [open, setOpen] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    const fetchTypes = async () => {
        try {
            const res = await fetch("/api/config/doc-types");
            const data = await res.json();
            // Filter by the current category
            const filtered = data.filter((t) => t.category === category);
            setTypes(filtered);
        }
        catch (error) {
            toast.error("Failed to load document types");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchTypes();
    }, [category]); // Re-fetch if category changes
    const handleCreate = async () => {
        if (!newName.trim())
            return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/config/doc-types", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName, category: category }), // Use prop category
            });
            if (res.ok) {
                toast.success("Document type created");
                setNewName("");
                setOpen(false);
                fetchTypes();
            }
            else {
                toast.error("Failed to create type");
            }
        }
        catch (error) {
            toast.error("Error creating type");
        }
        finally {
            setSubmitting(false);
        }
    };
    const handleDelete = async (id) => {
        try {
            const res = await fetch(`/api/config/doc-types/${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                toast.success("Document type deleted");
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
    return (<div className="space-y-4">
        <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">{category === "VEHICLE" ? "Vehicle" : "Operator"} Document Types</h3>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Type</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add {category === "VEHICLE" ? "Vehicle" : "Operator"} Document Type</DialogTitle>
                        <DialogDescription>
                            Define a required document type for {category.toLowerCase()}s.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Input placeholder="Document Name (e.g. Insurance)" value={newName} onChange={(e) => setNewName(e.target.value)} />
                        </div>
                        <Button onClick={handleCreate} disabled={submitting} className="w-full">
                            {submitting ? "Creating..." : "Create"}
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
                        <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (<TableRow>
                        <TableCell colSpan={2} className="text-center py-4">Loading...</TableCell>
                    </TableRow>) : types.length === 0 ? (<TableRow>
                        <TableCell colSpan={2} className="text-center py-4 text-slate-500">No types found</TableCell>
                    </TableRow>) : (types.map((type) => (<TableRow key={type.id}>
                        <TableCell className="font-medium">{type.name}</TableCell>
                        <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(type.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </TableCell>
                    </TableRow>)))}
                </TableBody>
            </Table>
        </div>

        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Document Type?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently remove this document type. This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(deleteId)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>);
}

