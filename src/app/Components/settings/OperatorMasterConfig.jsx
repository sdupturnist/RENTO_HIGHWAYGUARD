"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/Components/ui/tabs";
import { LicenseTypesManager } from "./LicenseTypesManager";
import { NationalitiesManager } from "./NationalitiesManager";
import { OperatorDocumentTypesManager } from "./OperatorDocumentTypesManager";
import { OperatorWorkTypesManager } from "./OperatorWorkTypesManager";

export function OperatorMasterConfig() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Operator Master Configuration</h3>
                <p className="text-sm text-muted-foreground">
                    Manage master data for operators including work types, license types, nationalities, and document types.
                </p>
            </div>

            <Tabs defaultValue="work-types" className="w-full">
                <TabsList className="grid grid-cols-4 w-full mb-4">
                    <TabsTrigger value="work-types">Work Types</TabsTrigger>
                    <TabsTrigger value="licenses">License Types</TabsTrigger>
                    <TabsTrigger value="nationalities">Nationalities</TabsTrigger>
                    <TabsTrigger value="documents">Document Types</TabsTrigger>
                </TabsList>

                <TabsContent value="work-types" className="mt-0 space-y-4">
                    <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
                        <CardHeader>
                            <CardTitle>Work Types</CardTitle>
                            <CardDescription>
                                Define operator work types (e.g., Traffic Control, Standby, Internal).
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <OperatorWorkTypesManager />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="licenses" className="mt-0 space-y-4">
                    <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
                        <CardHeader>
                            <CardTitle>License Types</CardTitle>
                            <CardDescription>
                                Define the types of licenses operators can hold (e.g., Heavy Vehicle, Light Vehicle).
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <LicenseTypesManager />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="nationalities" className="mt-0 space-y-4">
                    <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
                        <CardHeader>
                            <CardTitle>Nationalities</CardTitle>
                            <CardDescription>
                                Manage nationalities available for operator profiles.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <NationalitiesManager />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="documents" className="mt-0 space-y-4">
                    <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
                        <CardHeader>
                            <CardTitle>Document Types</CardTitle>
                            <CardDescription>
                                Define required documents for operators (e.g., Visa, Passport).
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <OperatorDocumentTypesManager />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
