"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Label } from "@/app/Components/ui/label";
import { Input } from "@/app/Components/ui/input";
import { Button } from "@/app/Components/ui/button";
import { Switch } from "@/app/Components/ui/switch";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Separator } from "@/app/Components/ui/separator";
import { PermissionGate } from "@/app/Components/auth/PermissionGate";
import { PERMISSIONS } from "@/app/lib/permissions-constants";
export function InvoiceSettings({ onDirtyStateChange }) {
    const [originalSettings, setOriginalSettings] = useState(null);
    const [settings, setSettings] = useState({
        codePrefix: "INV",
        startingNumber: 1,
        numberPadding: 5,
        defaultDueDays: 30,
        showTimesheetReference: true,
        lockTimesheetOnCreate: true,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        fetchSettings();
    }, []);
    useEffect(() => {
        if (originalSettings) {
            const isDirty = JSON.stringify(settings) !== JSON.stringify(originalSettings);
            onDirtyStateChange?.(isDirty);
        }
    }, [settings, originalSettings, onDirtyStateChange]);
    const fetchSettings = async () => {
        try {
            const response = await fetch("/api/settings/invoice");
            if (response.ok) {
                const data = await response.json();
                setSettings(data);
                setOriginalSettings(data);
            }
        }
        catch (error) {
            console.error("Failed to load invoice settings", error);
            toast.error("Failed to load invoice settings");
        }
        finally {
            setLoading(false);
        }
    };
    const handleSave = async () => {
        setSaving(true);
        try {
            const response = await fetch("/api/settings/invoice", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });
            if (response.ok) {
                const updated = await response.json();
                setSettings(updated);
                setOriginalSettings(updated);
                toast.success("Invoice settings updated successfully");
            }
            else {
                throw new Error("Failed to update");
            }
        }
        catch (error) {
            console.error("Failed to save settings", error);
            toast.error("Failed to save invoice settings");
        }
        finally {
            setSaving(false);
        }
    };
    if (loading)
        return <div>Loading settings...</div>;
    const isDirty = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    return (<Card>
        <CardHeader>
            <CardTitle>Invoice Configuration</CardTitle>
            <CardDescription>
                Configure invoice generation, numbering, and rules.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="prefix">Prefix</Label>
                    <Input id="prefix" value={settings.codePrefix} onChange={(e) => setSettings({ ...settings, codePrefix: e.target.value })} placeholder="INV" />
                    <p className="text-xs text-muted-foreground">e.g., INV</p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="start">Starting Number</Label>
                    <Input id="start" type="number" min={1} value={settings.startingNumber} onChange={(e) => setSettings({ ...settings, startingNumber: parseInt(e.target.value) })} />
                    <p className="text-xs text-muted-foreground">e.g., 1</p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="padding">Padding</Label>
                    <Input id="padding" type="number" min={2} max={10} value={settings.numberPadding} onChange={(e) => setSettings({ ...settings, numberPadding: parseInt(e.target.value) })} />
                    <p className="text-xs text-muted-foreground">Digits (e.g., 5 for 00001)</p>
                </div>
            </div>
            <div className="bg-muted p-4 rounded-md">
                <p className="text-sm text-muted-foreground">Preview: <span className="font-mono font-medium text-foreground">{settings.codePrefix}-{String(settings.startingNumber).padStart(Number(settings.numberPadding), '0')}</span></p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="dueDays">Default Due Days</Label>
                    <Input id="dueDays" type="number" min={0} value={settings.defaultDueDays} onChange={(e) => setSettings({ ...settings, defaultDueDays: parseInt(e.target.value) })} />
                    <p className="text-xs text-muted-foreground">Default days until payment is due.</p>
                </div>
            </div>

            <Separator />

            <div className="space-y-4">
                <h3 className="text-lg font-medium">Rules & Display</h3>

                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label className="text-base">Show Timesheet Reference</Label>
                        <p className="text-sm text-muted-foreground">
                            Display the linked Timesheet ID on the invoice.
                        </p>
                    </div>
                    <Switch checked={settings.showTimesheetReference} onCheckedChange={(checked) => setSettings({ ...settings, showTimesheetReference: checked })} />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label className="text-base">Lock Timesheet on Creation</Label>
                        <p className="text-sm text-muted-foreground">
                            Automatically lock the timesheet when an invoice is created.
                        </p>
                    </div>
                    <Switch checked={settings.lockTimesheetOnCreate} onCheckedChange={(checked) => setSettings({ ...settings, lockTimesheetOnCreate: checked })} />
                </div>
            </div>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={!isDirty || saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {saving ? "Saving..." : isDirty ? "Save Changes" : "Saved"}
                </Button>
            </div>
        </CardContent>
    </Card>);
}
