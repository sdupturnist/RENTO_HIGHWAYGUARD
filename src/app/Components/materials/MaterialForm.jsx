"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/Components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/app/Components/ui/form";
import { Input } from "@/app/Components/ui/input";
import { Button } from "@/app/Components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/Components/ui/select";
import { Textarea } from "@/app/Components/ui/textarea";

const schema = z.object({
    name: z.string().min(1, "Name is required"),
    totalQuantity: z.coerce.number().min(0, "Must be 0 or more"),
    costPerDay: z.coerce.number().min(0, "Must be 0 or more"),
    status: z.enum(["ACTIVE", "INACTIVE"]),
    remarks: z.string().optional().nullable(),
});

export function MaterialForm({ open, onOpenChange, material, currencySymbol = "AED", onSuccess }) {
    const isEdit = !!material;

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            name: "",
            totalQuantity: 0,
            costPerDay: 0,
            status: "ACTIVE",
            remarks: "",
        },
    });

    useEffect(() => {
        if (open) {
            form.reset(isEdit ? {
                name: material.name,
                totalQuantity: Number(material.totalQuantity),
                costPerDay: Number(material.costPerDay),
                status: material.status,
                remarks: material.remarks ?? "",
            } : {
                name: "",
                totalQuantity: 0,
                costPerDay: 0,
                status: "ACTIVE",
                remarks: "",
            });
        }
    }, [open, material]);

    const onSubmit = async (values) => {
        try {
            const url = isEdit ? `/api/materials/${material.id}` : "/api/materials";
            const method = isEdit ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Error saving material");
            toast.success(isEdit ? "Material updated." : "Material created.");
            onSuccess?.();
        } catch (error) {
            toast.error(error.message);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Material" : "Add Material"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Material Name <span className="text-red-500">*</span></FormLabel>
                                <FormControl><Input placeholder="e.g. Traffic Cones" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="totalQuantity" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Total Quantity</FormLabel>
                                    <FormControl><Input type="number" min="0" step="1" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="costPerDay" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cost / Day ({currencySymbol})</FormLabel>
                                    <FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <FormField control={form.control} name="status" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="ACTIVE">Active</SelectItem>
                                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="remarks" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Remarks</FormLabel>
                                <FormControl><Textarea placeholder="Optional notes..." rows={2} {...field} value={field.value ?? ""} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? "Saving..." : isEdit ? "Update" : "Create"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
