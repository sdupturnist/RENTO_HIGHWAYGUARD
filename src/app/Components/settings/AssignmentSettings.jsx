"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormDescription, FormMessage, } from "@/app/Components/ui/form";
import { Input } from "@/app/Components/ui/input";
import { Checkbox } from "@/app/Components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/app/Components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { toast } from "sonner";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
const assignmentSettingsSchema = z.object({
    prefix: z.string().min(1, "Prefix is required"),
    startingNumber: z.coerce.number().min(1),
    padding: z.coerce.number().min(1).max(10),
    enforceStrictAvailabilityLock: z.coerce.boolean(),
    defaultEnableAutoTimeLogs: z.coerce.boolean(),
    includeWeekendsForAutoLogs: z.coerce.boolean(),
    defaultBillingCycle: z.enum(["HOURLY", "DAILY"]),
    defaultWithOperator: z.coerce.boolean(),
});
export function AssignmentSettings({ onDirtyStateChange }) {
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const form = useForm({
        resolver: zodResolver(assignmentSettingsSchema),
        defaultValues: {
            prefix: "ASG",
            startingNumber: 1001,
            padding: 4,
            enforceStrictAvailabilityLock: true,
            defaultEnableAutoTimeLogs: true,
            includeWeekendsForAutoLogs: false,
            defaultBillingCycle: "DAILY",
            defaultWithOperator: false,
        }
    });
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                // Fetch settings
                const settingsRes = await fetch("/api/settings/assignment");
                const settingsData = settingsRes.ok ? await settingsRes.json() : {};
                form.reset({
                    prefix: settingsData.codePrefix || "ASG",
                    startingNumber: settingsData.codeStartingNumber || 1001,
                    padding: settingsData.codePadding || 4,
                    enforceStrictAvailabilityLock: Boolean(settingsData.enforceStrictAvailabilityLock ?? true),
                    defaultEnableAutoTimeLogs: Boolean(settingsData.defaultEnableAutoTimeLogs ?? true),
                    includeWeekendsForAutoLogs: Boolean(settingsData.includeWeekendsForAutoLogs ?? false),
                    defaultBillingCycle: settingsData.defaultBillingCycle ?? "DAILY",
                    defaultWithOperator: Boolean(settingsData.defaultWithOperator ?? false),
                });
            }
            catch (error) {
                console.error("Error loading settings:", error);
            }
            finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, [form]);
    // Handle dirty state
    const { isDirty } = form.formState;
    useEffect(() => {
        onDirtyStateChange?.(isDirty);
    }, [isDirty, onDirtyStateChange]);
    const onSubmit = async (data) => {
        setIsSaving(true);
        try {
            // Save settings
            const settingsRes = await fetch("/api/settings/assignment", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    codePrefix: data.prefix,
                    codeStartingNumber: data.startingNumber,
                    codePadding: data.padding,
                    enforceStrictAvailabilityLock: data.enforceStrictAvailabilityLock,
                    defaultEnableAutoTimeLogs: data.defaultEnableAutoTimeLogs,
                    includeWeekendsForAutoLogs: data.includeWeekendsForAutoLogs,
                    defaultBillingCycle: data.defaultBillingCycle,
                    defaultWithOperator: data.defaultWithOperator,
                })
            });
            if (settingsRes.ok) {
                toast.success("Assignment settings saved");
                form.reset(data);
            }
            else {
                toast.error("Failed to save settings");
            }
        }
        catch (error) {
            toast.error("An error occurred");
        }
        finally {
            setIsSaving(false);
        }
    };
    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin"/></div>;
    }
    return (<Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Assignment Code Rules</CardTitle>
                        <CardDescription>Configure how assignment codes are generated.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField control={form.control} name="prefix" render={({ field }) => (<FormItem>
                                    <FormLabel>Prefix</FormLabel>
                                    <FormControl><Input {...field}/></FormControl>
                                    <FormDescription>e.g., ASG</FormDescription>
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
                        <CardDescription>Default settings for assignment billing.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <FormField control={form.control} name="enforceStrictAvailabilityLock" render={({ field }) => (<FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                        <Checkbox checked={field.value} onCheckedChange={field.onChange}/>
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>Enforce Strict Availability Lock</FormLabel>
                                        <FormDescription>
                                            Prevent creating assignments with conflicting vehicle or operator availability
                                        </FormDescription>
                                    </div>
                                </FormItem>)}/>

                        <FormField control={form.control} name="defaultEnableAutoTimeLogs" render={({ field }) => (<FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                    <div className="space-y-1 leading-none w-full">
                                        <FormLabel className="flex items-center gap-2">
                                            Default Auto-generate Time Logs
                                        </FormLabel>
                                        <FormDescription>
                                            Automatically enable time log generation for new vehicle blocks
                                        </FormDescription>
                                    </div>
                                </FormItem>)} />

                        <FormField control={form.control} name="includeWeekendsForAutoLogs" render={({ field }) => (<FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                    <div className="space-y-1 leading-none w-full">
                                        <FormLabel className="flex items-center gap-2">
                                            Include Weekends for Auto Daily Logs
                                        </FormLabel>
                                        <FormDescription>
                                            Global default: generate logs on weekends (can be overridden per assignment block)
                                        </FormDescription>
                                    </div>
                                </FormItem>)} />

                        <FormField control={form.control} name="defaultBillingCycle" render={({ field }) => (<FormItem>
                                <FormLabel>Default Billing Cycle</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select billing cycle"/>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="HOURLY">Hourly</SelectItem>
                                        <SelectItem value="DAILY">Daily</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormDescription>Default billing mode applied to new assignments.</FormDescription>
                                <FormMessage />
                            </FormItem>)}/>

                        <FormField control={form.control} name="defaultWithOperator" render={({ field }) => (<FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange}/>
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel>Default "With Operator" in Vehicle Block</FormLabel>
                                    <FormDescription>
                                        When enabled, new vehicle blocks will have "With Operator" pre-checked by default.
                                    </FormDescription>
                                </div>
                            </FormItem>)}/>
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button type="submit" disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        {isSaving ? "Saving..." : isDirty ? "Save Changes" : "Saved"}
                    </Button>
                </div>
            </form>
        </Form>);
}
