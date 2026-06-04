"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Switch } from "@/app/Components/ui/switch";
import { Badge } from "@/app/Components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/app/Components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/app/Components/ui/alert-dialog";
import { Label } from "@/app/Components/ui/label";
import { toast } from "sonner";

export function OperatorWorkTypesManager() {
    const [types, setTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editingType, setEditingType] = useState(null);
    const [name, setName] = useState("");
    const [isBillable, setIsBillable] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [deleteId, setDeleteId] = useState(null);

    const fetch = async () => {
        setLoading(true);
        try {
            const res = await window.fetch("/api/settings/master/operator-work-types");
            const data = await res.json();
            setTypes(data);
        } catch {
            toast.error("Failed to load work types");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetch(); }, []);

    const openCreate = () => {
        setEditingType(null);
        setName("");
        setIsBillable(true);
        setOpen(true);
    };

    const openEdit = (t) => {
        setEditingType(t);
        setName(t.name);
        setIsBillable(!!t.isBillable);
        setOpen(true);
    };

    const handleSubmit = async () => {
        if (!name.trim()) return;
        setSubmitting(true);
        try {
            const url = editingType
                ? `/api/settings/master/operator-work-types/${editingType.id}`
                : "/api/settings/master/operator-work-types";
            const method = editingType ? "PUT" : "POST";
            const res = await window.fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), isBillable }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Error saving work type");
            toast.success(editingType ? "Work type updated." : "Work type created.");
            setOpen(false);
            fetch();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            const res = await window.fetch(`/api/settings/master/operator-work-types/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Error deleting");
            toast.success(data.message);
            fetch();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setDeleteId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Operator Work Types</h3>
                <Button size="sm" onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" /> Add Work Type
                </Button>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Billable</TableHead>
                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={3} className="text-center py-4">Loading...</TableCell></TableRow>
                        ) : types.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center py-4 text-slate-500">No work types found.</TableCell></TableRow>
                        ) : types.map((t) => (
                            <TableRow key={t.id}>
                                <TableCell className="font-medium">{t.name}</TableCell>
                                <TableCell>
                                    {t.isBillable
                                        ? <Badge className="bg-green-600 hover:bg-green-700">Billable</Badge>
                                        : <Badge variant="secondary">Non-Billable</Badge>}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteId(t.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingType(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingType ? "Edit Work Type" : "Add Work Type"}</DialogTitle>
                        <DialogDescription>
                            Non-billable work types are tracked operationally but excluded from customer timesheets and invoices.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>Work Type Name</Label>
                            <Input
                                placeholder="e.g. Traffic Control"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-medium">Billable</Label>
                                <p className="text-xs text-muted-foreground">
                                    Billable work appears in customer timesheets and invoices.
                                </p>
                            </div>
                            <Switch checked={isBillable} onCheckedChange={setIsBillable} />
                        </div>
                        <Button onClick={handleSubmit} disabled={submitting || !name.trim()}>
                            {submitting ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Work Type?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This work type will be permanently removed. It cannot be deleted if it is used in any assignment block.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => handleDelete(deleteId)}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
