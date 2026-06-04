"use client";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/app/Components/ui/form";
import { Switch } from "@/app/Components/ui/switch";
import { Button } from "@/app/Components/ui/button";
import { CodePrefixSettings } from "./CodePrefixSettings";

const schema = z.object({
    defaultBundleBilling: z.boolean(),
});

function BundleBillingDefault() {
    const [loading, setLoading] = useState(true);
    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: { defaultBundleBilling: false },
    });

    useEffect(() => {
        fetch("/api/settings/master/detour-settings")
            .then((r) => r.json())
            .then((d) => form.reset({ defaultBundleBilling: !!d.defaultBundleBilling }))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const onSubmit = async (values) => {
        try {
            const res = await fetch("/api/settings/master/detour-settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Error saving");
            toast.success("Detour settings saved.");
            form.reset({ defaultBundleBilling: !!data.defaultBundleBilling });
        } catch (err) {
            toast.error(err.message);
        }
    };

    if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="defaultBundleBilling" render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <FormLabel className="text-base">Default Bundle Billing</FormLabel>
                            <FormDescription>
                                When enabled, new detour service blocks default to bundle billing mode.
                                Users can still override this per-block.
                            </FormDescription>
                        </div>
                        <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                    </FormItem>
                )} />
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

export function DetourSettings() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Detour Service Settings</h3>
                <p className="text-sm text-muted-foreground">
                    Configure code format and default billing mode for detour service templates.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Detour Template Code Format</CardTitle>
                    <CardDescription>
                        Each template is assigned a sequential code (e.g., DET1001).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <CodePrefixSettings apiEndpoint="/api/settings/master/detour-settings" label="Detour code" />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Billing Defaults</CardTitle>
                    <CardDescription>
                        Configure the default invoice presentation for detour service blocks.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <BundleBillingDefault />
                </CardContent>
            </Card>
        </div>
    );
}
