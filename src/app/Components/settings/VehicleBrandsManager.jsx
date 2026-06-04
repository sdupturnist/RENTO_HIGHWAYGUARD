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
export function VehicleBrandsManager() {
    const [brands, setBrands] = useState([]);
    const [types, setTypes] = useState([]); // For type selection
    const [loading, setLoading] = useState(true);
    const [newBrand, setNewBrand] = useState("");
    const [selectedType, setSelectedType] = useState("");
    // Filter
    const [filterType, setFilterType] = useState("ALL");
    const [open, setOpen] = useState(false);
    const [editingBrand, setEditingBrand] = useState(null);
    // Delete State
    const [deleteId, setDeleteId] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const fetchTypes = async () => {
        const res = await fetch("/api/config/vehicle-types");
        if (res.ok)
            setTypes(await res.json());
    };
    const fetchBrands = async () => {
        setLoading(true);
        try {
            const url = filterType && filterType !== "ALL" ? `/api/config/brands?typeId=${filterType}` : "/api/config/brands";
            const res = await fetch(url);
            if (res.ok)
                setBrands(await res.json());
        }
        catch (error) {
            toast.error("Failed to load brands");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchTypes();
        fetchBrands();
    }, [filterType]);
    const handleSubmit = async () => {
        if (!newBrand || !selectedType) {
            toast.error("Name and Type are required");
            return;
        }
        setSubmitting(true);
        try {
            const url = editingBrand
                ? `/api/config/brands/${editingBrand.id}`
                : "/api/config/brands";
            const method = editingBrand ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newBrand, typeId: selectedType }),
            });
            if (res.ok) {
                toast.success(editingBrand ? "Brand updated" : "Brand added");
                setNewBrand("");
                setSelectedType("");
                setEditingBrand(null);
                setOpen(false);
                fetchBrands();
            }
            else {
                toast.error("Failed to save brand");
            }
        }
        catch (error) {
            toast.error("Error saving brand");
        }
        finally {
            setSubmitting(false);
        }
    };
    const confirmDelete = async () => {
        if (!deleteId)
            return;
        try {
            const res = await fetch(`/api/config/brands/${deleteId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                toast.success("Brand deleted");
                fetchBrands();
            }
            else {
                const data = await res.json();
                toast.error(data.message || "Failed to delete brand");
            }
        }
        catch (error) {
            toast.error("Error deleting brand");
        }
        finally {
            setDeleteId(null);
        }
    };
    const openEdit = (brand) => {
        setEditingBrand(brand);
        setNewBrand(brand.name);
        // Assuming brand.typeId or brand.type.id exists. The table uses brand.type.name
        // I need to be sure about brand structure. Usually fetching brands includes type relation.
        // Let's assume brand.typeId or verify from API response in previous step?
        // The table uses `brand.type?.name`.
        // If the API returns `typeId` at root of object, good. If not, I might need to rely on `brand.type?.id`.
        setSelectedType(String(brand.typeId || brand.type?.id || ""));
        setOpen(true);
    };
    return (<div className="space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-medium">Brands</h3>
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by Type"/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Types</SelectItem>
                            {types.map(t => (<SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>

                <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (val)
                fetchTypes();
            if (!val) {
                setEditingBrand(null);
                setNewBrand("");
                setSelectedType("");
            }
        }}>
                    <DialogTrigger asChild>
                        <Button size="sm"><Plus className="h-4 w-4 mr-2"/> Add Brand</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>{editingBrand ? "Edit Vehicle Brand" : "Add Vehicle Brand"}</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Vehicle Type</Label>
                                <Select value={selectedType} onValueChange={setSelectedType}>
                                    <SelectTrigger><SelectValue placeholder="Select Type"/></SelectTrigger>
                                    <SelectContent>
                                        {types.map(t => (<SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Brand Name</Label>
                                <Input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="e.g. Toyota"/>
                            </div>
                            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                                {submitting ? "Saving..." : "Save Brand"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md max-h-[400px] overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Models Count</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (<TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>) : brands.length === 0 ? (<TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">No brands found.</TableCell></TableRow>) : (brands.map((brand) => (<TableRow key={brand.id}>
                                    <TableCell title={brand.name}>{truncateString(brand.name, 20)}</TableCell>
                                    <TableCell>{brand.type?.name || "-"}</TableCell>
                                    <TableCell>{brand._count?.models || 0}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => openEdit(brand)}>
                                                <Edit2 className="h-4 w-4"/>
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteId(brand.id)}>
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
                            This action cannot be undone. This will permanently delete the vehicle brand.
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
