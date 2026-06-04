"use client";

import { useEffect, useState } from "react";
import { Loader2, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Input } from "@/app/Components/ui/input";
import { Label } from "@/app/Components/ui/label";
import { Switch } from "@/app/Components/ui/switch";
import { Button } from "@/app/Components/ui/button";
import { toast } from "sonner";

const defaultSettings = {
    minPasswordLength: 8,
    requireUppercase: true,
    requireLowercase: false,
    requireNumber: true,
    requireSpecialCharacter: false,
    maxFailedLoginAttempts: 5,
    lockoutDurationMinutes: 30,
};

export function SecuritySettings({ onDirtyStateChange }) {
    const [settings, setSettings] = useState(defaultSettings);
    const [originalSettings, setOriginalSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    useEffect(() => {
        if (!originalSettings) return;
        const isDirty = JSON.stringify(settings) !== JSON.stringify(originalSettings);
        onDirtyStateChange?.(isDirty);
    }, [settings, originalSettings, onDirtyStateChange]);

    async function fetchSettings() {
        try {
            const response = await fetch("/api/settings/security");
            if (!response.ok) throw new Error("Failed");
            const data = await response.json();
            setSettings(data);
            setOriginalSettings(data);
        } catch (error) {
            toast.error("Failed to load security settings");
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        setSaving(true);
        try {
            const response = await fetch("/api/settings/security", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });
            if (!response.ok) throw new Error("Failed");
            const data = await response.json();
            setSettings(data);
            setOriginalSettings(data);
            toast.success("Security settings updated successfully");
        } catch {
            toast.error("Failed to save security settings");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div>Loading security settings...</div>;
    }

    const isDirty = JSON.stringify(settings) !== JSON.stringify(originalSettings);

    return (
        <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Security Policy
                </CardTitle>
                <CardDescription>
                    Configure password complexity and automatic account lockout for this client.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="minPasswordLength">Minimum Password Length</Label>
                        <Input
                            id="minPasswordLength"
                            type="number"
                            min={6}
                            max={128}
                            value={settings.minPasswordLength}
                            onChange={(e) => setSettings({ ...settings, minPasswordLength: parseInt(e.target.value || "8", 10) })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="maxFailedLoginAttempts">Failed Login Attempts Before Lock</Label>
                        <Input
                            id="maxFailedLoginAttempts"
                            type="number"
                            min={1}
                            max={20}
                            value={settings.maxFailedLoginAttempts}
                            onChange={(e) => setSettings({ ...settings, maxFailedLoginAttempts: parseInt(e.target.value || "5", 10) })}
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="lockoutDurationMinutes">Lockout Duration (Minutes)</Label>
                        <Input
                            id="lockoutDurationMinutes"
                            type="number"
                            min={1}
                            max={1440}
                            value={settings.lockoutDurationMinutes}
                            onChange={(e) => setSettings({ ...settings, lockoutDurationMinutes: parseInt(e.target.value || "30", 10) })}
                        />
                        <p className="text-xs text-muted-foreground">
                            Locked users are automatically released after this time unless an authorized user unlocks them sooner.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label className="text-base">Require Uppercase Letter</Label>
                            <p className="text-sm text-muted-foreground">Example: A-Z</p>
                        </div>
                        <Switch checked={settings.requireUppercase} onCheckedChange={(checked) => setSettings({ ...settings, requireUppercase: checked })} />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label className="text-base">Require Lowercase Letter</Label>
                            <p className="text-sm text-muted-foreground">Example: a-z</p>
                        </div>
                        <Switch checked={settings.requireLowercase} onCheckedChange={(checked) => setSettings({ ...settings, requireLowercase: checked })} />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label className="text-base">Require Number</Label>
                            <p className="text-sm text-muted-foreground">Example: 0-9</p>
                        </div>
                        <Switch checked={settings.requireNumber} onCheckedChange={(checked) => setSettings({ ...settings, requireNumber: checked })} />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label className="text-base">Require Special Character</Label>
                            <p className="text-sm text-muted-foreground">Example: ! @ # $ %</p>
                        </div>
                        <Switch checked={settings.requireSpecialCharacter} onCheckedChange={(checked) => setSettings({ ...settings, requireSpecialCharacter: checked })} />
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {saving ? "Saving..." : isDirty ? "Save Changes" : "Saved"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
