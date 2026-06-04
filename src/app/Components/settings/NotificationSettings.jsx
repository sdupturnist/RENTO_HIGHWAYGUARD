"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/app/Components/ui/form";
import { Switch } from "@/app/Components/ui/switch";
import { Checkbox } from "@/app/Components/ui/checkbox";
import { Button } from "@/app/Components/ui/button";
import { toast } from "sonner";
import { Loader2, Bell } from "lucide-react";
import { Input } from "@/app/Components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/Components/ui/select";

const EXPIRY_OPTIONS = [
    { label: "7 Days", value: 7 },
    { label: "14 Days", value: 14 },
    { label: "1 Month (30 Days)", value: 30 },
    { label: "2 Months (60 Days)", value: 60 },
    { label: "6 Months (180 Days)", value: 180 },
];

const notificationSettingsSchema = z.object({
    sendAssignmentToCustomer: z.coerce.boolean().optional(),
    sendAssignmentToOwner: z.coerce.boolean().optional(),
    sendAssignmentToThirdParty: z.coerce.boolean().optional(),
    sendTimesheetToCustomer: z.coerce.boolean().optional(),
    sendInvoiceToCustomer: z.coerce.boolean().optional(),
    attachTimesheetWithInvoice: z.coerce.boolean().optional(),
    enableExpiryNotifications: z.coerce.boolean().optional(),
    vehicleExpiryThresholds: z.array(z.coerce.number()).optional(),
    operatorExpiryThresholds: z.array(z.coerce.number()).optional(),
    enableExpiryEmailReminders: z.coerce.boolean().optional(),
    expiryReminderRecipients: z.array(z.string().email("Invalid email format").min(1, "Email cannot be empty")).optional(),
    expiryReminderFrequency: z.string().optional(),
    expiryReminderSendTime: z.string().optional(),
});
export function NotificationSettings({ onDirtyStateChange }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const isNotificationsLocked = false;
    const isExpiryTrackingLocked = false;
    const isExpiryEmailLocked = false;
    const form = useForm({
        resolver: zodResolver(notificationSettingsSchema),
        defaultValues: {
            sendAssignmentToCustomer: false,
            sendAssignmentToOwner: false,
            sendAssignmentToThirdParty: false,
            sendTimesheetToCustomer: false,
            sendInvoiceToCustomer: false,
            attachTimesheetWithInvoice: false,
            enableExpiryNotifications: true,
            vehicleExpiryThresholds: [7, 14, 30],
            operatorExpiryThresholds: [7, 14, 30],
            enableExpiryEmailReminders: false,
            expiryReminderRecipients: [],
            expiryReminderFrequency: "DAILY",
            expiryReminderSendTime: "08:00",
        },
    });
    const { isDirty } = form.formState;
    const enableExpiryNotifications = form.watch("enableExpiryNotifications");
    const enableExpiryEmailReminders = form.watch("enableExpiryEmailReminders");
    useEffect(() => {
        if (onDirtyStateChange)
            onDirtyStateChange(isDirty);
    }, [isDirty, onDirtyStateChange]);
    useEffect(() => {
        fetch("/api/settings/notifications")
            .then((res) => res.json())
            .then((data) => {
                const safeData = {
                    ...data,
                    vehicleExpiryThresholds: Array.isArray(data.vehicleExpiryThresholds) ? data.vehicleExpiryThresholds : [7, 14, 30],
                    operatorExpiryThresholds: Array.isArray(data.operatorExpiryThresholds) ? data.operatorExpiryThresholds : [7, 14, 30],
                    enableExpiryEmailReminders: data.enableExpiryEmailReminders || false,
                    expiryReminderRecipients: Array.isArray(data.expiryReminderRecipients) ? data.expiryReminderRecipients : [],
                    expiryReminderFrequency: data.expiryReminderFrequency || "DAILY",
                    expiryReminderSendTime: data.expiryReminderSendTime || "08:00",
                };
                form.reset(safeData);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                toast.error("Failed to load notification settings");
                setLoading(false);
            });
    }, [form]);
    async function onSubmit(values) {
        setSaving(true);
        try {
            const res = await fetch("/api/settings/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            if (!res.ok)
                throw new Error("Failed to save");
            const data = await res.json();
            form.reset(data);
            toast.success("Notification settings saved successfully");
        }
        catch (error) {
            console.error(error);
            toast.error("Failed to save settings");
        }
        finally {
            setSaving(false);
        }
    }
    if (loading) {
        return (<div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>);
    }
    return (<Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
            </CardTitle>
            <CardDescription>
                Control automated email notifications for system events.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <fieldset disabled={isNotificationsLocked} className="space-y-6">
                        <div className="space-y-4">
                        <FormField control={form.control} name="sendAssignmentToCustomer" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                    Send Assignment to Customer
                                </FormLabel>
                                <FormDescription>
                                    Automatically email customer when a vehicle is assigned.
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                        </FormItem>)} />
                        <FormField control={form.control} name="sendAssignmentToOwner" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                    Send Assignment to Owner
                                </FormLabel>
                                <FormDescription>
                                    Automatically email owner when their vehicle is assigned.
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                        </FormItem>)} />
                        <FormField control={form.control} name="sendAssignmentToThirdParty" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                    Send Assignment to Third Party
                                </FormLabel>
                                <FormDescription>
                                    Automatically email third party when their vehicle is assigned.
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                        </FormItem>)} />
                        <FormField control={form.control} name="sendTimesheetToCustomer" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                    Send Timesheet to Customer
                                </FormLabel>
                                <FormDescription>
                                    Automatically email customer timesheet on the 1st of every month.
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                        </FormItem>)} />
                        <FormField control={form.control} name="sendInvoiceToCustomer" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                    Send Invoice to Customer
                                </FormLabel>
                                <FormDescription>
                                    Automatically email invoice to customer when created.
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                        </FormItem>)} />
                        <FormField control={form.control} name="attachTimesheetWithInvoice" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">
                                    Attach Timesheet PDF with Invoice
                                </FormLabel>
                                <FormDescription>
                                    Include the generated Timesheet PDF alongside the Invoice email.
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                        </FormItem>)} />
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <div className="mb-4">
                            <h3 className="text-lg font-medium tracking-tight">Expiry Reminders</h3>
                            <p className="text-sm text-muted-foreground">Control dashboard alerts for upcoming document and validity expirations.</p>
                        </div>
                        <FormField control={form.control} name="enableExpiryNotifications" render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-slate-50/50 dark:bg-slate-900/10">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-base">Enable Smart Expiry Notifications</FormLabel>
                                    <FormDescription>Display a smart notification bell tracking upcoming expiries for Vehicles, Operators, and Documents.</FormDescription>
                                </div>
                                <FormControl>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                            </FormItem>
                        )} />

                        {(!isExpiryTrackingLocked && enableExpiryNotifications) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border rounded-lg bg-slate-50/30 dark:bg-slate-900/30 transition-all">
                                <FormField control={form.control} name="vehicleExpiryThresholds" render={() => (
                                    <FormItem>
                                        <div className="mb-4">
                                            <FormLabel className="text-base flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                Vehicle Horizons
                                            </FormLabel>
                                            <FormDescription>When to alert for Vehicle Registrations & Documents.</FormDescription>
                                        </div>
                                        {EXPIRY_OPTIONS.map((item) => (
                                            <FormField
                                                key={item.value}
                                                control={form.control}
                                                name="vehicleExpiryThresholds"
                                                render={({ field }) => {
                                                    return (
                                                        <FormItem key={item.value} className="flex flex-row items-start space-x-3 space-y-0 mb-3 ml-2">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value?.includes(item.value)}
                                                                    onCheckedChange={(checked) => {
                                                                        return checked
                                                                            ? field.onChange([...(field.value || []), item.value])
                                                                            : field.onChange(field.value?.filter((value) => value !== item.value))
                                                                    }}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="text-sm font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{item.label}</FormLabel>
                                                        </FormItem>
                                                    )
                                                }}
                                            />
                                        ))}
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="operatorExpiryThresholds" render={() => (
                                    <FormItem>
                                        <div className="mb-4">
                                            <FormLabel className="text-base flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                Operator Horizons
                                            </FormLabel>
                                            <FormDescription>When to alert for Operator Licenses & Documents.</FormDescription>
                                        </div>
                                        {EXPIRY_OPTIONS.map((item) => (
                                            <FormField
                                                key={item.value}
                                                control={form.control}
                                                name="operatorExpiryThresholds"
                                                render={({ field }) => {
                                                    return (
                                                        <FormItem key={item.value} className="flex flex-row items-start space-x-3 space-y-0 mb-3 ml-2">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value?.includes(item.value)}
                                                                    onCheckedChange={(checked) => {
                                                                        return checked
                                                                            ? field.onChange([...(field.value || []), item.value])
                                                                            : field.onChange(field.value?.filter((value) => value !== item.value))
                                                                    }}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="text-sm font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{item.label}</FormLabel>
                                                        </FormItem>
                                                    )
                                                }}
                                            />
                                        ))}
                                    </FormItem>
                                )} />
                            </div>
                        )}
                    </div>

                    <div className="space-y-4 pt-4 border-t mt-6">
                        <div className="mb-4">
                                <h3 className="text-lg font-medium tracking-tight">Automated Email Reminders</h3>
                                <p className="text-sm text-muted-foreground">Automatically send periodic emails summarizing upcoming expiries.</p>
                            </div>
                            <FormField control={form.control} name="enableExpiryEmailReminders" render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-slate-50/50 dark:bg-slate-900/10">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Enable Expiry Email Reminders</FormLabel>
                                        <FormDescription>Automatically email the configured recipients about upcoming and expired items.</FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                </FormItem>
                            )} />

                            {(!isExpiryEmailLocked && enableExpiryEmailReminders) && (
                                    <div className="grid gap-6 p-6 border rounded-lg bg-slate-50/30 dark:bg-slate-900/30 transition-all">
                                        <FormField control={form.control} name="expiryReminderRecipients" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Recipients (Comma separated)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="admin@example.com, manager@example.com"
                                                        value={Array.isArray(field.value) ? field.value.join(", ") : ""}
                                                        onChange={(e) => {
                                                            const arr = e.target.value.split(",").map(val => val.trim()).filter(Boolean);
                                                            field.onChange(arr);
                                                        }}
                                                    />
                                                </FormControl>
                                                <FormDescription>The email addresses that will receive the summary.</FormDescription>
                                            </FormItem>
                                        )} />

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <FormField control={form.control} name="expiryReminderFrequency" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Frequency</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select a frequency" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="DAILY">Daily</SelectItem>
                                                            <SelectItem value="WEEKLY">Weekly (Mondays)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormDescription>How often to send the reminder email.</FormDescription>
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="expiryReminderSendTime" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Send Time</FormLabel>
                                                    <FormControl>
                                                        <Input type="time" {...field} />
                                                    </FormControl>
                                                    <FormDescription>Local time when the email should be sent.</FormDescription>
                                                </FormItem>
                                            )} />
                                        </div>
                                    </div>
                                )}
                        </div>

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={saving || isNotificationsLocked} size="lg">
                            {saving ? (<>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>) : (isDirty ? "Save Changes" : "Saved")}
                        </Button>
                    </div>
                    </fieldset>
                </form>
            </Form>
        </CardContent>
    </Card>);
}
