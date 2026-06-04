"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/app/Components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, } from "@/app/Components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/app/Components/ui/alert-dialog";
import { toast } from "sonner";
export function NationalitiesManager() {
    const [nationalities, setNationalities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [open, setOpen] = useState(false);
    const [editingNationality, setEditingNationality] = useState(null);
    const [deleteId, setDeleteId] = useState(null);
    // Form state: newName
    const fetchNationalities = async () => {
        try {
            const res = await fetch("/api/config/nationalities");
            const data = await res.json();
            setNationalities(data);
        }
        catch (error) {
            toast.error("Failed to load nationalities");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchNationalities();
    }, []);
    const handleSubmit = async () => {
        if (!newName.trim())
            return;
        setSubmitting(true);
        try {
            const url = editingNationality
                ? `/api/config/nationalities/${editingNationality.id}`
                : "/api/config/nationalities";
            const method = editingNationality ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName }),
            });
            if (res.ok) {
                toast.success(editingNationality ? "Nationality updated" : "Nationality added");
                setNewName("");
                setEditingNationality(null);
                setOpen(false);
                fetchNationalities();
            }
            else {
                toast.error("Failed to save nationality");
            }
        }
        catch (error) {
            toast.error("Error saving nationality");
        }
        finally {
            setSubmitting(false);
        }
    };
    const handleDelete = async (id) => {
        try {
            const res = await fetch(`/api/config/nationalities/${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                toast.success("Nationality deleted");
                fetchNationalities();
            }
            else {
                const data = await res.json();
                toast.error(data.message || "Failed to delete");
            }
        }
        catch (error) {
            toast.error("Error deleting nationality");
        }
        finally {
            setDeleteId(null);
        }
    };
    const openEdit = (nationality) => {
        setEditingNationality(nationality);
        setNewName(nationality.name);
        setOpen(true);
    };
    return (<div className="space-y-4">
        <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Nationalities</h3>
            <Dialog open={open} onOpenChange={(val) => {
                setOpen(val);
                if (!val) {
                    setEditingNationality(null);
                    setNewName("");
                }
            }}>
                <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Nationality</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingNationality ? "Edit Nationality" : "Add Nationality"}</DialogTitle>
                        <DialogDescription>
                            {editingNationality ? "Update the nationality name." : "Add a new nationality to the system."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Input placeholder="Nationality Name (e.g. Indian, Filipino)" value={newName} onChange={(e) => setNewName(e.target.value)} />
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
                        <TableHead className="w-[100px] text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (<TableRow>
                        <TableCell colSpan={2} className="text-center py-4">Loading...</TableCell>
                    </TableRow>) : nationalities.length === 0 ? (<TableRow>
                        <TableCell colSpan={2} className="text-center py-4 text-slate-500">No nationalities found</TableCell>
                    </TableRow>) : (nationalities.map((nat) => (<TableRow key={nat.id}>
                        <TableCell className="font-medium">{nat.name}</TableCell>
                        <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => openEdit(nat)}>
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setDeleteId(nat.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                    <Trash2 className="h-4 w-4" />
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
                    <AlertDialogTitle>Delete Nationality?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently remove this nationality. This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(deleteId)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>);
}

