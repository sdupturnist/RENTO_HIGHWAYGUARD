"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, } from "@/app/Components/ui/form";
import { Input } from "@/app/Components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/app/Components/ui/select";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
const settingsSchema = z.object({
    prefix: z.string().min(1, "Prefix is required"),
    startingNumber: z.coerce.number().min(1),
    padding: z.coerce.number().min(1).max(10),
    defaultBilling: z.enum(["HOURLY", "DAILY"]),
});
export function ProjectSettings({ onDirtyStateChange }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const form = useForm({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            prefix: "PRJ",
            startingNumber: 1001,
            padding: 4,
            defaultBilling: "DAILY",
        },
    });
    useEffect(() => {
        fetch("/api/config/project-code-rules")
            .then(res => res.json())
            .then(data => {
            if (data && data.prefix) { // Check if data is valid
                form.reset({
                    prefix: data.prefix,
                    startingNumber: data.startingNumber,
                    padding: data.padding,
                    defaultBilling: data.defaultBilling,
                });
            }
        })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [form]);
    // Handle dirty state
    const { isDirty } = form.formState;
    useEffect(() => {
        onDirtyStateChange?.(isDirty);
    }, [isDirty, onDirtyStateChange]);
    const onSubmit = async (data) => {
        setSaving(true);
        try {
            const res = await fetch("/api/config/project-code-rules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                toast.success("Settings saved successfully");
                form.reset(data); // Reset dirty state
            }
            else {
                toast.error("Failed to save settings");
            }
        }
        catch (error) {
            toast.error("An error occurred");
        }
        finally {
            setSaving(false);
        }
    };
    if (loading)
        return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin"/></div>;
    return (<Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Project Code Rules</CardTitle>
                        <CardDescription>Configure how project codes are generated.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField control={form.control} name="prefix" render={({ field }) => (<FormItem>
                                    <FormLabel>Prefix</FormLabel>
                                    <FormControl><Input {...field}/></FormControl>
                                    <FormDescription>e.g., PRJ</FormDescription>
                                    <FormMessage />
                                </FormItem>)}/>
                            <FormField control={form.control} name="startingNumber" render={({ field }) => (<FormItem>
                                    <FormLabel>Starting Number</FormLabel>
                                    <FormControl>
                                        <Input type="number" value={field.value} onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}/>
                                    </FormControl>
                                    <FormDescription>e.g., 1001</FormDescription>
                                    <FormMessage />
                                </FormItem>)}/>
                            <FormField control={form.control} name="padding" render={({ field }) => (<FormItem>
                                    <FormLabel>Padding</FormLabel>
                                    <FormControl>
                                        <Input type="number" value={field.value} onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}/>
                                    </FormControl>
                                    <FormDescription>Digits (e.g., 4 for 0001)</FormDescription>
                                    <FormMessage />
                                </FormItem>)}/>
                        </div>
                        <div className="bg-muted p-4 rounded-md">
                            <p className="text-sm text-muted-foreground">Preview: <span className="font-mono font-medium text-foreground">{form.watch("prefix")}-{String(form.watch("startingNumber")).padStart(Number(form.watch("padding")), '0')}</span></p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Billing Configuration</CardTitle>
                        <CardDescription>Default settings for project billing.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <FormField control={form.control} name="defaultBilling" render={({ field }) => (<FormItem>
                                <FormLabel>Default Billing Cycle</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Cycle"/>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="HOURLY">Hourly Billing</SelectItem>
                                        <SelectItem value="DAILY">Daily Billing</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormDescription>This will be the default selected for new projects.</FormDescription>
                                <FormMessage />
                            </FormItem>)}/>
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button type="submit" disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        {saving ? "Saving..." : isDirty ? "Save Changes" : "Saved"}
                    </Button>
                </div>
            </form>
        </Form>);
}
