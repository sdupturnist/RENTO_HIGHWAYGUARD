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
export function TimesheetSettings({ onDirtyStateChange }) {
    const [originalSettings, setOriginalSettings] = useState(null);
    const [settings, setSettings] = useState({
        codePrefix: "TS",
        startingNumber: 1,
        numberPadding: 5,
        allowRegenerationBeforeInvoice: true,
        lockTimesheetAfterInvoice: true,
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
            const response = await fetch("/api/settings/timesheet");
            if (response.ok) {
                const data = await response.json();
                setSettings(data);
                setOriginalSettings(data);
            }
        }
        catch (error) {
            console.error("Failed to load timesheet settings", error);
            toast.error("Failed to load timesheet settings");
        }
        finally {
            setLoading(false);
        }
    };
    const handleSave = async () => {
        setSaving(true);
        try {
            const response = await fetch("/api/settings/timesheet", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });
            if (response.ok) {
                const updated = await response.json();
                setSettings(updated);
                setOriginalSettings(updated);
                toast.success("Timesheet settings updated successfully");
            }
            else {
                throw new Error("Failed to update");
            }
        }
        catch (error) {
            console.error("Failed to save settings", error);
            toast.error("Failed to save timesheet settings");
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
            <CardTitle>Timesheet Configuration</CardTitle>
            <CardDescription>
                Configure how timesheets are generated and managed.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="prefix">Prefix</Label>
                    <Input id="prefix" value={settings.codePrefix} onChange={(e) => setSettings({ ...settings, codePrefix: e.target.value })} placeholder="TS" />
                    <p className="text-xs text-muted-foreground">e.g., TS</p>
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

            <Separator />

            <div className="space-y-4">
                <h3 className="text-lg font-medium">Rules & Restrictions</h3>

                <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                        <Label className="text-base">Allow Regeneration</Label>
                        <p className="text-sm text-muted-foreground">
                            Allow regenerating timesheets if they haven't been invoiced yet.
                        </p>
                    </div>
                    <Switch checked={settings.allowRegenerationBeforeInvoice} onCheckedChange={(checked) => setSettings({ ...settings, allowRegenerationBeforeInvoice: checked })} />
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
