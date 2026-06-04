"use client";
import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/Components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/app/Components/ui/form";
import { Input } from "@/app/Components/ui/input";
import { Button } from "@/app/Components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/Components/ui/select";
import { Textarea } from "@/app/Components/ui/textarea";
import { Switch } from "@/app/Components/ui/switch";
import { useQuery } from "@tanstack/react-query";
import { Separator } from "@/app/Components/ui/separator";

const requirementSchema = z.object({
    resourceType: z.enum(["MATERIAL", "LABOUR"]),
    resourceId: z.coerce.number().int().positive("Select a resource"),
    quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
});

const schema = z.object({
    name: z.string().min(1, "Name is required"),
    vehicleCount: z.coerce.number().int().min(0),
    operatorCount: z.coerce.number().int().min(0),
    bundleCostEnabled: z.boolean(),
    bundleCostPerDay: z.coerce.number().min(0),
    status: z.enum(["ACTIVE", "INACTIVE"]),
    remarks: z.string().optional().nullable(),
    requirements: z.array(requirementSchema),
});

export function DetourTemplateForm({ open, onOpenChange, template, currencySymbol = "AED", onSuccess }) {
    const isEdit = !!template;

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            name: "",
            vehicleCount: 0,
            operatorCount: 0,
            bundleCostEnabled: false,
            bundleCostPerDay: 0,
            status: "ACTIVE",
            remarks: "",
            requirements: [],
        },
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: "requirements" });
    const bundleCostEnabled = form.watch("bundleCostEnabled");

    const { data: materials = [] } = useQuery({
        queryKey: ["materials"],
        queryFn: async () => {
            const res = await fetch("/api/materials");
            if (!res.ok) return [];
            return res.json();
        },
        enabled: open,
        staleTime: 60 * 1000,
    });

    const { data: labours = [] } = useQuery({
        queryKey: ["labours"],
        queryFn: async () => {
            const res = await fetch("/api/labours");
            if (!res.ok) return [];
            return res.json();
        },
        enabled: open,
        staleTime: 60 * 1000,
    });

    useEffect(() => {
        if (open) {
            form.reset(isEdit ? {
                name: template.name,
                vehicleCount: template.vehicleCount,
                operatorCount: template.operatorCount,
                bundleCostEnabled: !!template.bundleCostEnabled,
                bundleCostPerDay: Number(template.bundleCostPerDay),
                status: template.status,
                remarks: template.remarks ?? "",
                requirements: (template.requirements || []).map((r) => ({
                    resourceType: r.resourceType,
                    resourceId: r.resourceId,
                    quantity: Number(r.quantity),
                })),
            } : {
                name: "",
                vehicleCount: 0,
                operatorCount: 0,
                bundleCostEnabled: false,
                bundleCostPerDay: 0,
                status: "ACTIVE",
                remarks: "",
                requirements: [],
            });
        }
    }, [open, template]);

    const onSubmit = async (values) => {
        try {
            const url = isEdit ? `/api/detour-templates/${template.id}` : "/api/detour-templates";
            const method = isEdit ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Error saving template");
            toast.success(isEdit ? "Template updated." : "Template created.");
            onSuccess?.();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const getResourceOptions = (resourceType) => {
        if (resourceType === "MATERIAL") return materials.filter((m) => m.status === "ACTIVE");
        if (resourceType === "LABOUR") return labours.filter((l) => l.status === "ACTIVE");
        return [];
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Detour Template" : "Add Detour Template"}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Template Name</FormLabel>
                                <FormControl><Input placeholder="e.g. 2 Lane Detour" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="vehicleCount" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Vehicle Count</FormLabel>
                                    <FormControl><Input type="number" min="0" step="1" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="operatorCount" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Operator Count</FormLabel>
                                    <FormControl><Input type="number" min="0" step="1" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                            <FormField control={form.control} name="bundleCostEnabled" render={({ field }) => (
                                <FormItem className="flex items-center justify-between">
                                    <FormLabel className="text-sm font-medium">Bundle Billing</FormLabel>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )} />
                            {bundleCostEnabled && (
                                <FormField control={form.control} name="bundleCostPerDay" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Bundle Cost / Day ({currencySymbol})</FormLabel>
                                        <FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
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
                        </div>

                        <Separator />

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium">Material & Labour Requirements</p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({ resourceType: "MATERIAL", resourceId: 0, quantity: 1 })}
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Add Requirement
                                </Button>
                            </div>

                            {fields.length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                    No material or labour requirements defined.
                                </p>
                            )}

                            {fields.map((field, index) => {
                                const resourceType = form.watch(`requirements.${index}.resourceType`);
                                const options = getResourceOptions(resourceType);
                                return (
                                    <div key={field.id} className="grid grid-cols-[1fr_2fr_80px_36px] gap-2 items-end">
                                        <FormField control={form.control} name={`requirements.${index}.resourceType`} render={({ field }) => (
                                            <FormItem>
                                                {index === 0 && <FormLabel className="text-xs">Type</FormLabel>}
                                                <Select onValueChange={(v) => {
                                                    field.onChange(v);
                                                    form.setValue(`requirements.${index}.resourceId`, 0);
                                                }} value={field.value}>
                                                    <FormControl><SelectTrigger className="h-9"><SelectValue /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="MATERIAL">Material</SelectItem>
                                                        <SelectItem value="LABOUR">Labour</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name={`requirements.${index}.resourceId`} render={({ field }) => (
                                            <FormItem>
                                                {index === 0 && <FormLabel className="text-xs">Resource</FormLabel>}
                                                <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value ? String(field.value) : ""}>
                                                    <FormControl><SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        {options.map((o) => (
                                                            <SelectItem key={o.id} value={String(o.id)}>
                                                                {o.name || o.labourType}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={form.control} name={`requirements.${index}.quantity`} render={({ field }) => (
                                            <FormItem>
                                                {index === 0 && <FormLabel className="text-xs">Qty</FormLabel>}
                                                <FormControl><Input type="number" min="1" step="1" className="h-9" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <div className={index === 0 ? "pt-5" : ""}>
                                            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500" onClick={() => remove(index)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

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
