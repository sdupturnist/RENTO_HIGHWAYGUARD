"use client";
import { truncateString } from "@/app/lib/utils";
import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/app/Components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/app/Components/ui/select";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/app/Components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, } from "@/app/Components/ui/dialog";
import { Label } from "@/app/Components/ui/label";
// ... existing imports
export function VehicleModelsManager() {
    const [brands, setBrands] = useState([]);
    const [models, setModels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingModel, setEditingModel] = useState(null);
    // Create State
    const [newModel, setNewModel] = useState("");
    const [selectedBrand, setSelectedBrand] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [open, setOpen] = useState(false);
    // Filter State
    const [filterBrand, setFilterBrand] = useState("ALL");
    // Delete State
    const [deleteId, setDeleteId] = useState(null);
    const fetchBrands = async () => {
        const res = await fetch("/api/config/brands");
        if (res.ok)
            setBrands(await res.json());
    };
    const fetchModels = async () => {
        setLoading(true);
        try {
            const url = filterBrand && filterBrand !== "ALL" ? `/api/config/models?brandId=${filterBrand}` : "/api/config/models";
            const res = await fetch(url);
            if (res.ok)
                setModels(await res.json());
        }
        catch (error) {
            toast.error("Failed to load models");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => { fetchBrands(); }, []);
    useEffect(() => { fetchModels(); }, [filterBrand]);
    const handleSubmit = async () => {
        if (!newModel || !selectedBrand) {
            toast.error("Name and Brand are required");
            return;
        }
        setSubmitting(true);
        try {
            const url = editingModel
                ? `/api/config/models/${editingModel.id}`
                : "/api/config/models";
            const method = editingModel ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newModel, brandId: selectedBrand }),
            });
            if (res.ok) {
                toast.success(editingModel ? "Model updated" : "Model added");
                setNewModel("");
                setEditingModel(null);
                // setSelectedBrand(""); // Keep selected brand for easier bulk entry? or clear? Let's clear to be safe.
                setSelectedBrand("");
                setOpen(false);
                fetchModels();
            }
            else {
                toast.error("Failed to save model");
            }
        }
        catch (error) {
            toast.error("Error saving model");
        }
        finally {
            setSubmitting(false);
        }
    };
    const confirmDelete = async () => {
        if (!deleteId)
            return;
        try {
            const res = await fetch(`/api/config/models/${deleteId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                toast.success("Model deleted");
                fetchModels();
            }
            else {
                const data = await res.json();
                toast.error(data.message || "Failed to delete model");
            }
        }
        catch (error) {
            toast.error("Error deleting model");
        }
        finally {
            setDeleteId(null);
        }
    };
    const openEdit = (model) => {
        setEditingModel(model);
        setNewModel(model.name);
        setSelectedBrand(String(model.brandId || model.brand?.id || ""));
        setOpen(true);
    };
    return (<div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-medium">Models</h3>
                    <Select value={filterBrand} onValueChange={setFilterBrand}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by Brand"/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Brands</SelectItem>
                            {brands.map(b => (<SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>

                <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (val)
                fetchBrands();
            if (!val) {
                setEditingModel(null);
                setNewModel("");
                setSelectedBrand("");
            }
        }}>
                    <DialogTrigger asChild>
                        <Button size="sm"><Plus className="h-4 w-4 mr-2"/> Add Model</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>{editingModel ? "Edit Vehicle Model" : "Add Vehicle Model"}</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Brand</Label>
                                <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                                    <SelectTrigger><SelectValue placeholder="Select Brand"/></SelectTrigger>
                                    <SelectContent>
                                        {brands.map(b => (<SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Model Name</Label>
                                <Input value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="e.g. Camry"/>
                            </div>
                            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                                {submitting ? "Saving..." : "Save Model"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md max-h-[400px] overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Model Name</TableHead>
                            <TableHead>Brand</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (<TableRow><TableCell colSpan={3} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>) : models.length === 0 ? (<TableRow><TableCell colSpan={3} className="text-center h-24 text-muted-foreground">No models found.</TableCell></TableRow>) : (models.map((model) => (<TableRow key={model.id}>
                                    <TableCell title={model.name}>{truncateString(model.name, 20)}</TableCell>
                                    <TableCell title={model.brand?.name}>{truncateString(model.brand?.name, 20)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => openEdit(model)}>
                                                <Edit2 className="h-4 w-4"/>
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteId(model.id)}>
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
                            This action cannot be undone. This will permanently delete the vehicle model.
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
