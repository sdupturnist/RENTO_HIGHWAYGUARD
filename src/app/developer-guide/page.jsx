"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Badge } from "@/app/Components/ui/badge";
import { Button } from "@/app/Components/ui/button";
import { ScrollArea } from "@/app/Components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/Components/ui/tabs";
import { Code, Terminal, FileJson, Lock, ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";

export default function DeveloperGuidePage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-16 items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/settings/developer">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">API Integration Guide</h1>
                            <p className="text-xs text-muted-foreground">Version 1.0.0</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={() => window.print()} className="gap-2">
                        <Printer className="h-4 w-4" />
                        Print Guide
                    </Button>
                </div>
            </header>

            <main className="container py-8 space-y-8 max-w-5xl">

                {/* Introduction */}
                <section className="space-y-4">
                    <h2 className="text-3xl font-bold tracking-tight">Introduction</h2>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        Welcome to the UPTURNIST API documentation. This API allows you to programmatically access and manage your fleet, assignments, and billing data from external applications such as SAP, Oracle, or custom ERP solutions.
                    </p>
                    <div className="flex gap-4">
                        <Card className="flex-1 bg-primary/5 border-primary/20">
                            <CardHeader>
                                <CardTitle className="text-primary flex items-center gap-2">
                                    <Lock className="h-5 w-5" />
                                    Secure Access
                                </CardTitle>
                                <CardDescription>
                                    All requests are authenticated via secure API Keys transmitted over HTTPS.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                        <Card className="flex-1 bg-blue-500/5 border-blue-500/20">
                            <CardHeader>
                                <CardTitle className="text-blue-600 flex items-center gap-2">
                                    <FileJson className="h-5 w-5" />
                                    JSON Standard
                                </CardTitle>
                                <CardDescription>
                                    Data is exchanged in standard JSON format for maximum compatibility.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </div>
                </section>

                <hr className="border-slate-200 dark:border-slate-800" />

                {/* Authentication */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Terminal className="h-6 w-6 text-primary" />
                        Authentication
                    </h2>
                    <p className="text-muted-foreground">
                        Authenticate your requests by including your API Key in the <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">x-api-key</code> header.
                    </p>

                    <Card className="overflow-hidden border-slate-200 dark:border-slate-800">
                        <div className="bg-slate-950 p-4 overflow-x-auto">
                            <pre className="text-sm font-mono text-slate-50">
                                {`curl -X GET https://your-domain.com/api/vehicles \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: sk_live_abc123..."`}
                            </pre>
                        </div>
                    </Card>

                    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200">
                        <Lock className="h-5 w-5 shrink-0" />
                        <div>
                            <span className="font-semibold block mb-1">Security Best Practice</span>
                            Never expose your API keys in client-side code (browsers). Only use them on your server-side backend.
                        </div>
                    </div>
                </section>

                {/* Data Synchronization */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Terminal className="h-6 w-6 text-primary" />
                        Data Synchronization
                    </h2>
                    <p className="text-muted-foreground">
                        To keep your external system in sync with RentERP, we recommend a <strong>Polling Strategy</strong>.
                    </p>
                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
                        <h3 className="font-semibold text-lg">Recommended Approach: Periodic Polling</h3>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                            <li>Set up a cron job or scheduled task in your system (e.g., every 15 minutes).</li>
                            <li>Call the relevant GET endpoints (e.g., <code className="text-xs bg-slate-200 dark:bg-slate-800 px-1 rounded">/api/invoices</code>).</li>
                            <li>Compare the returned list with your local database using unique IDs (e.g., <code className="text-xs bg-slate-200 dark:bg-slate-800 px-1 rounded">id</code> or <code className="text-xs bg-slate-200 dark:bg-slate-800 px-1 rounded">invoiceNumber</code>).</li>
                            <li>Import any new or updated records into your system.</li>
                        </ol>
                        <div className="text-sm bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 p-3 rounded border border-blue-100 dark:border-blue-800">
                            <strong>Note:</strong> The API currently returns the full dataset. For large datasets, we can enable incremental syncing (using "createdAfter" filters) upon request.
                        </div>
                    </div>
                </section>

                {/* Endpoints */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Code className="h-6 w-6 text-primary" />
                        Resources & Endpoints
                    </h2>

                    <Tabs defaultValue="vehicles" className="w-full">
                        <TabsList className="grid w-full grid-cols-7 lg:w-full overflow-x-auto">
                            <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
                            <TabsTrigger value="assignments">Assignments</TabsTrigger>
                            <TabsTrigger value="projects">Projects</TabsTrigger>
                            <TabsTrigger value="invoices">Invoices</TabsTrigger>
                            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
                            <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
                            <TabsTrigger value="customers">Customers</TabsTrigger>
                        </TabsList>

                        {/* VEHICLES TAB */}
                        <TabsContent value="vehicles" className="space-y-4 mt-4">
                            <EndpointCard
                                method="GET"
                                path="/api/vehicles"
                                description="Retrieve a list of all vehicles in the fleet."
                                response={`[
  {
    "id": 1,
    "vehicleCode": "VEH1001",
    "type": "Excavator",
    "brand": "Caterpillar",
    "status": "ACTIVE",
    "baseRentAmount": 500.00
  },
  ...
]`}
                            />
                            <EndpointCard
                                method="POST"
                                path="/api/vehicles"
                                description="Create a new vehicle."
                                body={`{
  "typeId": 1,
  "brandId": 2,
  "manufacturingYear": 2024,
  "status": "ACTIVE",
  "baseRentAmount": 1200
}`}
                            />
                        </TabsContent>

                        {/* ASSIGNMENTS TAB */}
                        <TabsContent value="assignments" className="space-y-4 mt-4">
                            <EndpointCard
                                method="GET"
                                path="/api/assignments"
                                description="List all active assignments."
                                response={`[
  {
    "id": 105,
    "vehicleCode": "VEH1001",
    "customer": "Acme Corp",
    "startDate": "2024-02-01T00:00:00Z",
    "status": "ACTIVE"
  }
]`}
                            />
                        </TabsContent>

                        {/* PROJECTS TAB */}
                        <TabsContent value="projects" className="space-y-4 mt-4">
                            <EndpointCard
                                method="GET"
                                path="/api/projects"
                                description="List all projects."
                                response={`[
  {
    "id": 12,
    "name": "Downtown Construction",
    "code": "PRJ1001",
    "status": "ACTIVE"
  }
]`}
                            />
                        </TabsContent>

                        {/* INVOICES TAB */}
                        <TabsContent value="invoices" className="space-y-4 mt-4">
                            <EndpointCard
                                method="GET"
                                path="/api/invoices"
                                description="Fetch generated invoices."
                                response={`[
  {
    "id": 505,
    "invoiceNumber": "INV-2024-001",
    "totalAmount": 15000.00,
    "status": "PAID"
  }
]`}
                            />
                        </TabsContent>

                        {/* MAINTENANCE TAB */}
                        <TabsContent value="maintenance" className="space-y-4 mt-4">
                            <EndpointCard
                                method="GET"
                                path="/api/maintenance"
                                description="List maintenance records for vehicles."
                                response={`[
  {
    "id": 1,
    "vehicleCode": "VEH1001",
    "maintenanceCode": "MNT-2024-001",
    "maintenanceType": "Regular Service",
    "description": "Oil Change",
    "startDate": "2024-03-01T09:00:00Z",
    "status": "COMPLETED",
    "amount": 250.00
  }
]`}
                            />
                        </TabsContent>

                        {/* TIMESHEETS TAB */}
                        <TabsContent value="timesheets" className="space-y-4 mt-4">
                            <EndpointCard
                                method="GET"
                                path="/api/timesheets"
                                description="Retrieve timesheet records."
                                response={`[
  {
    "id": 101,
    "customer": "Acme Corp",
    "project": "Downtown Construction",
    "month": "October 2024",
    "totalHours": 160,
    "status": "APPROVED"
  }
]`}
                            />
                        </TabsContent>

                        {/* CUSTOMERS TAB */}
                        <TabsContent value="customers" className="space-y-4 mt-4">
                            <EndpointCard
                                method="GET"
                                path="/api/clients"
                                description="List all customers/clients."
                                response={`[
  {
    "id": 5,
    "customerCode": "CST-1001",
    "companyName": "Acme Corp",
    "status": "ACTIVE",
    "email": "contact@acme.com"
  }
]`}
                            />
                        </TabsContent>
                    </Tabs>
                </section>
            </main>
        </div>
    );
}

function EndpointCard({ method, path, description, body, response }) {
    const color = {
        GET: "text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
        POST: "text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
        PUT: "text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800",
        DELETE: "text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
    }[method] || "text-slate-600";

    return (
        <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`font-mono border px-2 py-0.5 ${color}`}>
                        {method}
                    </Badge>
                    <code className="text-sm font-semibold">{path}</code>
                </div>
                <CardDescription className="pt-2">{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {body && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Request Body</h4>
                        <div className="bg-slate-950 p-3 rounded-lg overflow-x-auto">
                            <pre className="text-xs font-mono text-slate-50">{body}</pre>
                        </div>
                    </div>
                )}
                {response && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Example Response</h4>
                        <div className="bg-slate-950 p-3 rounded-lg overflow-x-auto">
                            <pre className="text-xs font-mono text-slate-50">{response}</pre>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
