"use client";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Button } from "@/app/Components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/Components/ui/tabs";
import { VehicleTypesManager } from "@/app/Components/settings/VehicleTypesManager";
import { DocumentTypesManager } from "@/app/Components/settings/DocumentTypesManager";
import { CompanySettings } from "@/app/Components/settings/CompanySettings";
import { BrandingSettings } from "@/app/Components/settings/BrandingSettings";
import { LocalizationSettings } from "@/app/Components/settings/LocalizationSettings";
import { NotificationSettings } from "@/app/Components/settings/NotificationSettings";
import { SMTPSettings } from "@/app/Components/settings/SMTPSettings";
import { UnsavedChangesAlert } from "@/app/Components/ui/unsaved-changes-alert";
import { VehicleBrandsManager } from "@/app/Components/settings/VehicleBrandsManager";
import { VehicleModelsManager } from "@/app/Components/settings/VehicleModelsManager";
import { RegistrationAuthoritiesManager } from "@/app/Components/settings/RegistrationAuthoritiesManager";
import { VehicleSettings } from "@/app/Components/settings/VehicleSettings";
import { OperatorSettings } from "@/app/Components/settings/OperatorSettings";
import { OperatorMasterConfig } from "@/app/Components/settings/OperatorMasterConfig";
import { ProjectSettings } from "@/app/Components/settings/ProjectSettings";
import { CustomerSettings } from "@/app/Components/settings/CustomerSettings";
import { AssignmentSettings } from "@/app/Components/settings/AssignmentSettings";
import { TimeBillingSettings } from "@/app/Components/settings/TimeBillingSettings";
import { TimesheetSettings } from "@/app/Components/settings/TimesheetSettings";
import { InvoiceSettings } from "@/app/Components/settings/InvoiceSettings";
import { SecuritySettings } from "@/app/Components/settings/SecuritySettings";
import { MaintenanceSettings } from "@/app/Components/settings/MaintenanceSettings";
import { MaintenanceTypesManager } from "@/app/Components/settings/MaintenanceTypesManager";
import { ExpenseSettings } from "@/app/Components/settings/ExpenseSettings";
import { ExpenseMasterConfig } from "@/app/Components/settings/ExpenseMasterConfig";
import { MaterialSettings } from "@/app/Components/settings/MaterialSettings";
import { LabourSettings } from "@/app/Components/settings/LabourSettings";
import { DetourSettings } from "@/app/Components/settings/DetourSettings";
import DeveloperSettings from "@/app/Components/settings/DeveloperSettings";
import CronSettings from "@/app/Components/settings/CronSettings";
import { BackupSettings } from "@/app/Components/settings/BackupSettings";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { Forbidden } from "@/app/Components/common/Forbidden";

const NAV_GROUPS = [
    {
        label: "General",
        items: [
            { value: "company", label: "Company" },
            { value: "branding", label: "Branding" },
            { value: "localization", label: "Localization" },
            { value: "email", label: "Email / SMTP" },
            { value: "notifications", label: "Notifications" },
        ],
    },
    {
        label: "Modules",
        items: [
            { value: "vehicle", label: "Vehicle" },
            { value: "operator", label: "Operator" },
            { value: "customer", label: "Customer" },
            { value: "project", label: "Project" },
            { value: "material", label: "Material" },
            { value: "labour", label: "Labour" },
            { value: "detour", label: "Detour Services" },
            { value: "maintenance", label: "Maintenance" },
            { value: "expense", label: "Expense" },
        ],
    },
    {
        label: "Operations",
        items: [
            { value: "assignment", label: "Assignment" },
            { value: "time-billing", label: "Time & Billing" },
            { value: "timesheet", label: "Timesheet" },
            { value: "invoice", label: "Invoice" },
        ],
    },
    {
        label: "Master Data",
        items: [
            { value: "master", label: "Master Config" },
        ],
    },
    {
        label: "System",
        items: [
            { value: "security", label: "Security" },
            { value: "cron", label: "Cron Jobs" },
            { value: "backup", label: "Backup & Restore" },
        ],
    },
];

function SettingsContent() {
    const { can, loading } = usePermissions();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const currentTab = searchParams.get("tab") || "company";
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [alertOpen, setAlertOpen] = useState(false);
    const [pendingTab, setPendingTab] = useState(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const developerEnabled = true;

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading settings...</div>;
    }

    if (!can("Settings", "View")) {
        return <Forbidden module="Settings" action="view" />;
    }

    const allGroups = [
        ...NAV_GROUPS,
        ...(developerEnabled ? [{ label: "Developer", items: [{ value: "developer", label: "Developer / API" }] }] : []),
    ];

    const allValues = allGroups.flatMap(g => g.items.map(i => i.value));
    const activeTab = allValues.includes(currentTab) ? currentTab : "company";

    const handleNavClick = (value) => {
        if (hasUnsavedChanges && value !== activeTab) {
            setPendingTab(value);
            setAlertOpen(true);
            return;
        }
        updateTab(value);
    };

    const updateTab = (value) => {
        const params = new URLSearchParams(searchParams);
        params.set("tab", value);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
        setIsMobileMenuOpen(false); // Proactively close mobile menu on tab switch
    };

    const handleDiscard = () => {
        if (pendingTab) {
            updateTab(pendingTab);
            setHasUnsavedChanges(false);
            setPendingTab(null);
        }
        setAlertOpen(false);
    };

    const handleKeepEditing = () => {
        setAlertOpen(false);
        setPendingTab(null);
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground">
                    Manage your company profile, appearance, and system configurations.
                </p>
            </div>

            {/* Mobile / Tablet Collapsible Menu Card */}
            <div className="lg:hidden w-full">
                <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm">
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="w-full flex items-center justify-between text-left font-semibold text-slate-800 dark:text-slate-200 transition-all focus:outline-none"
                    >
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                                Active Settings Section
                            </span>
                            <span className="text-base flex items-center gap-2 mt-1">
                                ⚙️ {allGroups.flatMap(g => g.items).find(i => i.value === activeTab)?.label || "Company"}
                            </span>
                        </div>
                        <span className={`text-xl transition-transform duration-200 ${isMobileMenuOpen ? "rotate-180" : ""}`}>
                            ▾
                        </span>
                    </button>

                    {isMobileMenuOpen && (
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-4 max-h-[60vh] overflow-y-auto">
                            {allGroups.map((group) => (
                                <div key={group.label} className="space-y-1.5">
                                    <p className="px-2 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/50">
                                        {group.label}
                                    </p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                        {group.items.map((item) => (
                                            <button
                                                key={item.value}
                                                onClick={() => {
                                                    handleNavClick(item.value);
                                                }}
                                                className={`relative text-left pl-5 pr-3 py-2.5 rounded-xl text-xs font-semibold transition-all truncate border ${
                                                    activeTab === item.value
                                                        ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 shadow-sm"
                                                        : "text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100 border-transparent"
                                                }`}
                                            >
                                                {activeTab === item.value && (
                                                    <span className="absolute left-0.5 top-2.5 bottom-2.5 w-1 rounded-r-full bg-primary" />
                                                )}
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-start">
                {/* Sidebar nav (Visible only on Desktop screens) */}
                <aside className="hidden lg:block w-64 shrink-0 sticky top-6 max-h-[calc(100vh-8rem)] overflow-y-auto">
                    <nav className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-3 space-y-4 shadow-sm">
                        {allGroups.map((group) => (
                            <div key={group.label}>
                                <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50">
                                    {group.label}
                                </p>
                                <div className="space-y-0.5">
                                    {group.items.map((item) => (
                                        <button
                                            key={item.value}
                                            onClick={() => handleNavClick(item.value)}
                                            className={`relative w-full text-left pl-4 pr-3 py-2 rounded-xl text-sm font-medium transition-all ${
                                                activeTab === item.value
                                                    ? "bg-slate-100/80 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 font-semibold shadow-sm"
                                                    : "text-muted-foreground hover:bg-slate-50/50 dark:hover:bg-slate-800/30 hover:text-slate-900 dark:hover:text-slate-100"
                                            }`}
                                        >
                                            {activeTab === item.value && (
                                                <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary animate-pulse" />
                                            )}
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </nav>
                </aside>

                {/* Content panel */}
                <div className="flex-1 min-w-0 w-full">
                    {activeTab === "company" && <CompanySettings onDirtyStateChange={setHasUnsavedChanges} />}
                    {activeTab === "branding" && <BrandingSettings onDirtyStateChange={setHasUnsavedChanges} />}
                    {activeTab === "localization" && <LocalizationSettings onDirtyStateChange={setHasUnsavedChanges} />}
                    {activeTab === "email" && <SMTPSettings onDirtyStateChange={setHasUnsavedChanges} />}
                    {activeTab === "notifications" && <NotificationSettings onDirtyStateChange={setHasUnsavedChanges} />}
                    {activeTab === "vehicle" && <VehicleSettings onDirtyStateChange={setHasUnsavedChanges} />}
                    {activeTab === "operator" && <OperatorSettings onDirtyStateChange={setHasUnsavedChanges} />}
                    {activeTab === "customer" && <CustomerSettings onDirtyStateChange={setHasUnsavedChanges} />}
                    {activeTab === "project" && <ProjectSettings onDirtyStateChange={setHasUnsavedChanges} />}
                    {activeTab === "maintenance" && <MaintenanceSettings onDirtyStateChange={setHasUnsavedChanges} />}
                    {activeTab === "expense" && <ExpenseSettings onDirtyStateChange={setHasUnsavedChanges} />}
                    {activeTab === "assignment" && <AssignmentSettings onDirtyStateChange={setHasUnsavedChanges} />}
                    {activeTab === "time-billing" && <TimeBillingSettings onDirtyStateChange={setHasUnsavedChanges} />}
                    {activeTab === "timesheet" && <TimesheetSettings onDirtyStateChange={setHasUnsavedChanges} />}
                    {activeTab === "invoice" && <InvoiceSettings onDirtyStateChange={setHasUnsavedChanges} />}
                    {activeTab === "material" && <MaterialSettings />}
                    {activeTab === "labour" && <LabourSettings />}
                    {activeTab === "detour" && <DetourSettings />}
                    {activeTab === "security" && <SecuritySettings onDirtyStateChange={setHasUnsavedChanges} />}
                    {activeTab === "cron" && <CronSettings />}
                    {activeTab === "backup" && <BackupSettings onDirtyStateChange={setHasUnsavedChanges} />}
                    {developerEnabled && activeTab === "developer" && <DeveloperSettings onDirtyStateChange={setHasUnsavedChanges} />}

                    {activeTab === "master" && (
                        <div className="space-y-4">
                            <Tabs defaultValue="vehicle" className="w-full">
                                <TabsList className="grid grid-cols-4 w-full">
                                    <TabsTrigger value="vehicle">Vehicle</TabsTrigger>
                                    <TabsTrigger value="operator">Operator</TabsTrigger>
                                    <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
                                    <TabsTrigger value="expense">Expense</TabsTrigger>
                                </TabsList>

                                <TabsContent value="vehicle" className="space-y-6 mt-4">
                                    <div>
                                        <h3 className="text-lg font-medium">Vehicle Master Configuration</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Manage master data for vehicles including types, brands, models, registration authorities, and document types.
                                        </p>
                                    </div>
                                    <Tabs defaultValue="types" className="w-full">
                                        <TabsList className="grid grid-cols-5 w-full mb-4">
                                            <TabsTrigger value="types">Vehicle Types</TabsTrigger>
                                            <TabsTrigger value="brands">Brands</TabsTrigger>
                                            <TabsTrigger value="models">Models</TabsTrigger>
                                            <TabsTrigger value="registration">Registration</TabsTrigger>
                                            <TabsTrigger value="documents">Documents</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="types" className="mt-0 space-y-4">
                                            <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
                                                <CardHeader>
                                                    <CardTitle>Vehicle Types</CardTitle>
                                                    <CardDescription>Define the types of vehicles available (e.g., Sedan, SUV, Excavator).</CardDescription>
                                                </CardHeader>
                                                <CardContent><VehicleTypesManager /></CardContent>
                                            </Card>
                                        </TabsContent>

                                        <TabsContent value="brands" className="mt-0 space-y-4">
                                            <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
                                                <CardHeader>
                                                    <CardTitle>Vehicle Brands</CardTitle>
                                                    <CardDescription>Manage vehicle manufacturers.</CardDescription>
                                                </CardHeader>
                                                <CardContent><VehicleBrandsManager /></CardContent>
                                            </Card>
                                        </TabsContent>

                                        <TabsContent value="models" className="mt-0 space-y-4">
                                            <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
                                                <CardHeader>
                                                    <CardTitle>Vehicle Models</CardTitle>
                                                    <CardDescription>Manage vehicle models.</CardDescription>
                                                </CardHeader>
                                                <CardContent><VehicleModelsManager /></CardContent>
                                            </Card>
                                        </TabsContent>

                                        <TabsContent value="registration" className="mt-0 space-y-4">
                                            <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
                                                <CardHeader>
                                                    <CardTitle>Registration Authorities</CardTitle>
                                                    <CardDescription>Manage vehicle registration authorities.</CardDescription>
                                                </CardHeader>
                                                <CardContent><RegistrationAuthoritiesManager /></CardContent>
                                            </Card>
                                        </TabsContent>

                                        <TabsContent value="documents" className="mt-0 space-y-4">
                                            <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
                                                <CardHeader>
                                                    <CardTitle>Document Types</CardTitle>
                                                    <CardDescription>Define required document categories for vehicles.</CardDescription>
                                                </CardHeader>
                                                <CardContent><DocumentTypesManager category="VEHICLE" /></CardContent>
                                            </Card>
                                        </TabsContent>
                                    </Tabs>
                                </TabsContent>

                                <TabsContent value="operator" className="mt-4">
                                    <OperatorMasterConfig />
                                </TabsContent>

                                <TabsContent value="maintenance" className="mt-4">
                                    <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
                                        <CardHeader>
                                            <CardTitle>Maintenance Types</CardTitle>
                                            <CardDescription>Define the types of maintenance activities (e.g., Service, Repair, Inspection).</CardDescription>
                                        </CardHeader>
                                        <CardContent><MaintenanceTypesManager /></CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="expense" className="mt-4">
                                    <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
                                        <CardHeader>
                                            <CardTitle>Expense Types</CardTitle>
                                            <CardDescription>Define the types of operational expenses (e.g., Fuel, Tolls, Misc).</CardDescription>
                                        </CardHeader>
                                        <CardContent><ExpenseMasterConfig /></CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                </div>
            </div>

            <UnsavedChangesAlert
                open={alertOpen}
                onOpenChange={setAlertOpen}
                onConfirm={handleDiscard}
                onDiscard={handleKeepEditing}
                title="Unsaved Changes"
                description="You have unsaved changes in this section. If you leave now, your changes will be lost."
            />
        </div>
    );
}

export default function SettingsPage() {
    return (
        <Suspense fallback={<div>Loading settings...</div>}>
            <SettingsContent />
        </Suspense>
    );
}
