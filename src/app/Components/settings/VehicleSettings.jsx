"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/app/Components/ui/form";
import { Input } from "@/app/Components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/Components/ui/select";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";

const ruleSchema = z.object({
    prefix: z.string().min(1, "Prefix is required"),
    startingNumber: z.coerce.number().min(1),
    padding: z.coerce.number().min(1).max(10),
});

const billingSchema = z.object({
    defaultRentCycle: z.enum(["HOURLY", "DAILY"]).optional(),
});

function PrefixRuleRow({ rule, onSaved, onDeleted, canDelete }) {
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const form = useForm({
        resolver: zodResolver(ruleSchema),
        defaultValues: {
            prefix: rule.prefix,
            startingNumber: rule.startingNumber,
            padding: rule.padding,
        },
    });

    const preview = (() => {
        const p = form.watch("prefix") || "";
        const n = form.watch("startingNumber") || 1;
        const pad = form.watch("padding") || 4;
        return `${p}-${String(n).padStart(Number(pad), "0")}`;
    })();

    const onSubmit = async (data) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/config/vehicle-code-rules/${rule.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                const updated = await res.json();
                toast.success("Prefix rule saved");
                form.reset({ prefix: updated.prefix, startingNumber: updated.startingNumber, padding: updated.padding });
                onSaved?.(updated);
            } else {
                toast.error("Failed to save prefix rule");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const res = await fetch(`/api/config/vehicle-code-rules/${rule.id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Prefix rule deleted");
                onDeleted?.(rule.id);
            } else {
                const err = await res.json();
                toast.error(err.message || "Failed to delete");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="border rounded-lg p-4 space-y-3 bg-background">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="prefix" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Prefix</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="startingNumber" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Starting Number</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormDescription>Next number to assign</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="padding" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Padding</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormDescription>Digits (e.g. 4 → 0001)</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Preview: <span className="font-mono font-medium text-foreground">{preview}</span></p>
                    <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={saving || !form.formState.isDirty}>
                            {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                            {saving ? "Saving..." : form.formState.isDirty ? "Save" : "Saved"}
                        </Button>
                        {canDelete && (
                            <Button type="button" variant="ghost" size="icon" onClick={handleDelete} disabled={deleting} className="hover:bg-red-100 hover:text-red-600">
                                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                        )}
                    </div>
                </div>
            </form>
        </Form>
    );
}

function AddPrefixForm({ onAdded, onCancel }) {
    const [saving, setSaving] = useState(false);
    const form = useForm({
        resolver: zodResolver(ruleSchema),
        defaultValues: { prefix: "", startingNumber: 100, padding: 3 },
    });

    const preview = (() => {
        const p = form.watch("prefix") || "";
        const n = form.watch("startingNumber") || 1;
        const pad = form.watch("padding") || 3;
        return `${p}-${String(n).padStart(Number(pad), "0")}`;
    })();

    const onSubmit = async (data) => {
        setSaving(true);
        try {
            const res = await fetch("/api/config/vehicle-code-rules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                const created = await res.json();
                toast.success("Prefix rule added");
                onAdded?.(created);
            } else {
                toast.error("Failed to add prefix rule");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="border rounded-lg p-4 space-y-3 bg-muted/30 border-dashed">
                <p className="text-sm font-medium text-muted-foreground">New Prefix Rule</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="prefix" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Prefix</FormLabel>
                            <FormControl><Input {...field} placeholder="e.g. VEH-NEW" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="startingNumber" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Starting Number</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="padding" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Padding</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                            <FormDescription>Digits (e.g. 3 → 001)</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Preview: <span className="font-mono font-medium text-foreground">{preview}</span></p>
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
                        <Button type="submit" size="sm" disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                            Add Prefix
                        </Button>
                    </div>
                </div>
            </form>
        </Form>
    );
}

export function VehicleSettings({ onDirtyStateChange }) {
    const [loading, setLoading] = useState(true);
    const [rules, setRules] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [saving, setSaving] = useState(false);

    const billingForm = useForm({
        resolver: zodResolver(billingSchema),
        defaultValues: { defaultRentCycle: "DAILY" },
    });

    useEffect(() => {
        Promise.all([
            fetch("/api/config/vehicle-code-rules").then(r => r.json()),
        ])
            .then(([rulesData]) => {
                if (Array.isArray(rulesData) && rulesData.length > 0) {
                    setRules(rulesData);
                    const first = rulesData[0];
                    billingForm.reset({
                        defaultRentCycle: first.defaultRentCycle || "DAILY",
                    });
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [billingForm]);

    const { isDirty } = billingForm.formState;
    useEffect(() => {
        onDirtyStateChange?.(isDirty);
    }, [isDirty, onDirtyStateChange]);

    const onBillingSubmit = async (data) => {
        setSaving(true);
        try {
            if (rules.length === 0) { toast.error("No prefix rules found"); return; }
            const res = await fetch(`/api/config/vehicle-code-rules/${rules[0].id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...rules[0], ...data }),
            });
            if (res.ok) {
                toast.success("Billing settings saved");
                billingForm.reset(data);
            } else {
                toast.error("Failed to save billing settings");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Vehicle ID Prefixes</CardTitle>
                        <CardDescription>Configure one or more prefix rules. Users pick a prefix when adding a vehicle.</CardDescription>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowAddForm(true)} disabled={showAddForm}>
                        <Plus className="h-4 w-4 mr-1" /> Add Prefix
                    </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                    {rules.map(rule => (
                        <PrefixRuleRow
                            key={rule.id}
                            rule={rule}
                            canDelete={rules.length > 1}
                            onSaved={(updated) => setRules(prev => prev.map(r => r.id === updated.id ? updated : r))}
                            onDeleted={(id) => setRules(prev => prev.filter(r => r.id !== id))}
                        />
                    ))}
                    {showAddForm && (
                        <AddPrefixForm
                            onAdded={(created) => { setRules(prev => [...prev, created]); setShowAddForm(false); }}
                            onCancel={() => setShowAddForm(false)}
                        />
                    )}
                    {rules.length === 0 && !showAddForm && (
                        <p className="text-sm text-muted-foreground py-4 text-center">No prefix rules configured. Add one above.</p>
                    )}
                </CardContent>
            </Card>

            <Form {...billingForm}>
                <form onSubmit={billingForm.handleSubmit(onBillingSubmit)} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Billing Configuration</CardTitle>
                            <CardDescription>Default billing cycle for new vehicles.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FormField control={billingForm.control} name="defaultRentCycle" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Default Billing Cycle</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select cycle" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="HOURLY">Hourly</SelectItem>
                                            <SelectItem value="DAILY">Daily</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>Default billing cycle applied when adding a new vehicle.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                    </Card>
                    <div className="flex justify-end">
                        <Button type="submit" disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {saving ? "Saving..." : isDirty ? "Save Changes" : "Saved"}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}
