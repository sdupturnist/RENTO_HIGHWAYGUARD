"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, } from "@/app/Components/ui/form";
import { Input } from "@/app/Components/ui/input";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
const settingsSchema = z.object({
    prefix: z.string().min(1, "Prefix is required"),
    startingNumber: z.coerce.number().min(1),
    padding: z.coerce.number().min(1).max(10),
});
export function OperatorSettings({ onDirtyStateChange }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const form = useForm({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            prefix: "OPR",
            startingNumber: 1,
            padding: 4,
        },
    });
    useEffect(() => {
        fetch("/api/config/operator-code-rules")
            .then(res => res.json())
            .then(data => {
            if (data) {
                form.reset({
                    prefix: data.prefix,
                    startingNumber: data.startingNumber,
                    padding: data.padding,
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
            const res = await fetch("/api/config/operator-code-rules", {
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
                        <CardTitle>Operator Code Rules</CardTitle>
                        <CardDescription>Configure how operator codes are generated.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField control={form.control} name="prefix" render={({ field }) => (<FormItem>
                                    <FormLabel>Prefix</FormLabel>
                                    <FormControl><Input {...field}/></FormControl>
                                    <FormDescription>e.g., OPR</FormDescription>
                                    <FormMessage />
                                </FormItem>)}/>
                            <FormField control={form.control} name="startingNumber" render={({ field }) => (<FormItem>
                                    <FormLabel>Starting Number</FormLabel>
                                    <FormControl>
                                        <Input type="number" value={field.value} onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}/>
                                    </FormControl>
                                    <FormDescription>e.g., 1</FormDescription>
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

                <div className="flex justify-end">
                    <Button type="submit" disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        {saving ? "Saving..." : isDirty ? "Save Changes" : "Saved"}
                    </Button>
                </div>
            </form>
        </Form>);
}
