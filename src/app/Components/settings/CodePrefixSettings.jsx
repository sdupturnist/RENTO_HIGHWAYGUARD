"use client";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/app/Components/ui/form";
import { Input } from "@/app/Components/ui/input";
import { Button } from "@/app/Components/ui/button";

const schema = z.object({
    codePrefix: z.string().min(1, "Prefix is required").max(20),
    startingNumber: z.coerce.number().int().min(1, "Must be at least 1"),
    numberPadding: z.coerce.number().int().min(1).max(10),
});

export function CodePrefixSettings({ apiEndpoint, label = "Code" }) {
    const [loading, setLoading] = useState(true);

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: { codePrefix: "", startingNumber: 1001, numberPadding: 4 },
    });

    const prefix = form.watch("codePrefix") || "";
    const number = form.watch("startingNumber") || 1;
    const padding = form.watch("numberPadding") || 4;
    const preview = `${prefix}-${String(number).padStart(Number(padding), "0")}`;

    useEffect(() => {
        fetch(apiEndpoint)
            .then((r) => r.json())
            .then((data) => {
                form.reset({
                    codePrefix: data.codePrefix || "",
                    startingNumber: data.startingNumber || 1001,
                    numberPadding: data.numberPadding || 4,
                });
            })
            .catch(() => toast.error(`Failed to load ${label} settings`))
            .finally(() => setLoading(false));
    }, [apiEndpoint]);

    const onSubmit = async (values) => {
        try {
            const res = await fetch(apiEndpoint, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Error saving settings");
            toast.success(`${label} settings saved.`);
            form.reset({
                codePrefix: data.codePrefix,
                startingNumber: data.startingNumber,
                numberPadding: data.numberPadding,
            });
        } catch (err) {
            toast.error(err.message);
        }
    };

    if (loading) return <p className="text-sm text-muted-foreground py-4">Loading...</p>;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="codePrefix" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Prefix</FormLabel>
                            <FormControl><Input placeholder="e.g. MAT" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="startingNumber" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Starting Number</FormLabel>
                            <FormControl><Input type="number" min="1" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="numberPadding" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Padding Digits</FormLabel>
                            <FormControl><Input type="number" min="1" max="10" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>

                <div className="bg-muted p-4 rounded-md">
                    <p className="text-sm text-muted-foreground">Preview: <span className="font-mono font-medium text-foreground">{preview}</span></p>
                </div>

                <div className="flex justify-end">
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {form.formState.isSubmitting ? "Saving..." : form.formState.isDirty ? "Save Changes" : "Saved"}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
