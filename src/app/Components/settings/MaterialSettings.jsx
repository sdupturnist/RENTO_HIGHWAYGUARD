"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { CodePrefixSettings } from "./CodePrefixSettings";

export function MaterialSettings() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Material Settings</h3>
                <p className="text-sm text-muted-foreground">
                    Configure the auto-generated code format for material records.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Material Code Format</CardTitle>
                    <CardDescription>
                        Each material is assigned a sequential code (e.g., MAT-1001). Configure the prefix and numbering here.
                        Changing the prefix only affects new materials — existing codes are unchanged.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <CodePrefixSettings apiEndpoint="/api/settings/master/material-settings" label="Material code" />
                </CardContent>
            </Card>
        </div>
    );
}
