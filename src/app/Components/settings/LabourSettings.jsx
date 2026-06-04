"use client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Badge } from "@/app/Components/ui/badge";
import { CodePrefixSettings } from "./CodePrefixSettings";

export function LabourSettings() {
    const [mode, setMode] = useState("QUANTITY");

    useEffect(() => {
        fetch("/api/settings/master/labour-settings")
            .then((r) => r.json())
            .then((d) => setMode(d.labourMode || "QUANTITY"))
            .catch(() => {});
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Labour Settings</h3>
                <p className="text-sm text-muted-foreground">
                    Configure the auto-generated code format for labour types.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Labour Code Format</CardTitle>
                    <CardDescription>
                        Each labour type is assigned a sequential code (e.g., LAB-1001).
                        Configure the prefix and numbering here.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <CodePrefixSettings apiEndpoint="/api/settings/master/labour-settings" label="Labour code" />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Labour Mode</CardTitle>
                    <CardDescription>
                        Controls how labour deployment is tracked across the system.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <div className="flex-1 rounded-lg border p-4 bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium">Quantity Mode</span>
                                <Badge className="bg-green-600">Active</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Labour is deployed as a quantity (e.g., 8 General Labourers/day). No individual tracking, no OT.
                                Daily time logs record qty only.
                            </p>
                        </div>
                        <div className="flex-1 rounded-lg border p-4 bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 opacity-60">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium">Person Mode</span>
                                <Badge variant="secondary">Future</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Individual named workers, attendance tracking, OT calculation, and payroll integration.
                                Not available in current release.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
