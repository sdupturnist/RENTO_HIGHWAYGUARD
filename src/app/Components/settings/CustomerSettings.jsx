"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription, } from "@/app/Components/ui/form";
import { Input } from "@/app/Components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { toast } from "sonner";
const customerRuleSchema = z.object({
    prefix: z.string().min(1, "Prefix is required"),
    startingNumber: z.coerce.number().min(1, "Must be at least 1"),
    padding: z.coerce.number().min(1).max(10),
});
export function CustomerSettings({ onDirtyStateChange }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const form = useForm({
        resolver: zodResolver(customerRuleSchema),
        defaultValues: {
            prefix: "CST",
            startingNumber: 1001,
            padding: 4,
        },
    });
    // Notify parent about dirty state
    useEffect(() => {
        const subscription = form.watch(() => {
            if (onDirtyStateChange) {
                onDirtyStateChange(form.formState.isDirty);
            }
        });
        return () => subscription.unsubscribe();
    }, [form.watch, form.formState.isDirty, onDirtyStateChange]);
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch("/api/settings/customer-rules");
                if (res.ok) {
                    const data = await res.json();
                    if (data) {
                        form.reset({
                            prefix: data.prefix,
                            startingNumber: data.startingNumber,
                            padding: data.padding,
                        });
                    }
                }
            }
            catch (error) {
                console.error("Failed to load customer settings:", error);
                toast.error("Failed to load settings");
            }
            finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [form]);
    const onSubmit = async (data) => {
        setSaving(true);
        try {
            const res = await fetch("/api/settings/customer-rules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                toast.success("Customer settings saved");
                form.reset(data); // Reset dirty state with new values
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
        return <div>Loading settings...</div>;
    const previewCode = `${form.watch("prefix")}-${String(form.watch("startingNumber")).padStart(form.watch("padding"), "0")}`;
    return (<div className="space-y-6">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Customer Code Rules</CardTitle>
                            <CardDescription>
                                Configure how customer codes are generated.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <FormField control={form.control} name="prefix" render={({ field }) => (<FormItem>
                                            <FormLabel>Prefix</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="CST"/>
                                            </FormControl>
                                            <FormDescription>e.g., CST</FormDescription>
                                            <FormMessage />
                                        </FormItem>)}/>
                                <FormField control={form.control} name="startingNumber" render={({ field }) => (<FormItem>
                                            <FormLabel>Starting Number</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field}/>
                                            </FormControl>
                                            <FormDescription>e.g., 1001</FormDescription>
                                            <FormMessage />
                                        </FormItem>)}/>
                                <FormField control={form.control} name="padding" render={({ field }) => (<FormItem>
                                            <FormLabel>Padding</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field}/>
                                            </FormControl>
                                            <FormDescription>Digits (e.g., 4 for 0001)</FormDescription>
                                            <FormMessage />
                                        </FormItem>)}/>
                            </div>

                            <div className="bg-muted p-4 rounded-md">
                                <p className="text-sm text-muted-foreground">Preview: <span className="font-mono font-medium text-foreground">{previewCode}</span></p>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                        <Button type="submit" disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            {saving ? "Saving..." : form.formState.isDirty ? "Save Changes" : "Saved"}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>);
}
