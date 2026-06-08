"use client";
import { Card, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { FileText, Calendar, Clock, FileSpreadsheet, Receipt, Truck, TruckIcon, Users, Wrench, Banknote, Lock, Package, HardHat, Construction, BarChart3, FolderOpen } from "lucide-react";
import Link from "next/link";
import { cn } from "@/app/lib/utils";

const reports = [
    // Operations
    {
        title: "Daily Time Log Report",
        description: "View all daily time logs with filters",
        icon: FileText,
        href: "/reports/daily-time-logs",
        category: "operations",
    },
    {
        title: "Assignment Report",
        description: "Overview of all assignments",
        icon: Calendar,
        href: "/reports/assignments",
        category: "operations",
    },
    {
        title: "Project Report",
        description: "Full project breakdown — assignments, timesheets, invoices and expenses",
        icon: FolderOpen,
        href: "/reports/project",
        category: "operations",
    },
    {
        title: "Maintenance Report",
        description: "Planned vs completed maintenance and costs",
        icon: Wrench,
        href: "/reports/maintenance",
        category: "operations",
    },
    // Time & Billing
    {
        title: "Timesheet Report",
        description: "Timesheet summary and details",
        icon: Clock,
        href: "/reports/timesheets",
        category: "time-billing",
    },
    {
        title: "Invoice Report",
        description: "Invoice listing and analysis",
        icon: FileSpreadsheet,
        href: "/reports/invoices",
        category: "time-billing",
    },
    {
        title: "VAT Summary Report",
        description: "VAT breakdown by invoice",
        icon: Receipt,
        href: "/reports/vat-summary",
        category: "time-billing",
        requiredFeature: "Tax",
    },
    // Assets
    {
        title: "Vehicle Utilization Report",
        description: "Vehicle usage and utilization metrics",
        icon: Truck,
        href: "/reports/vehicle-utilization",
        category: "assets",
    },
    {
        title: "Vehicle Availability Report",
        description: "Idle and available vehicles",
        icon: TruckIcon,
        href: "/reports/vehicle-availability",
        category: "assets",
    },
    // People
    {
        title: "Operator Utilization Report",
        description: "Operator assignment and utilization",
        icon: Users,
        href: "/reports/operator-utilization",
        category: "people",
    },
    {
        title: "Operator Overtime Summary",
        description: "Overtime hours by operator",
        icon: Clock,
        href: "/reports/operator-overtime",
        category: "people",
    },
    // Finance
    {
        title: "Expense Report",
        description: "Operational and miscellaneous expenses",
        icon: Banknote,
        href: "/reports/expenses",
        category: "operations",
    },
    // Resources
    {
        title: "Material Deployment Report",
        description: "Material usage by customer, project, and period",
        icon: Package,
        href: "/reports/material",
        category: "resources",
    },
    {
        title: "Labour Deployment Report",
        description: "Labour type usage by customer, project, and period",
        icon: HardHat,
        href: "/reports/labour",
        category: "resources",
    },
    {
        title: "Detour Service Report",
        description: "Detour deployments grouped by service template and customer",
        icon: Construction,
        href: "/reports/detour",
        category: "resources",
    },
    {
        title: "Monthly Summary Report",
        description: "Month-by-month hours, resources, and deployment totals",
        icon: BarChart3,
        href: "/reports/monthly-summary",
        category: "operations",
    },
];
const categoryColors = {
    operations: "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800",
    "time-billing": "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800",
    assets: "bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800",
    people: "bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800",
    finance: "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800",
    resources: "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800",
};
const categoryTitles = {
    operations: "Operations",
    "time-billing": "Time & Billing",
    assets: "Assets",
    people: "People",
    finance: "Finance",
    resources: "Resources",
};
export default function ReportsPage() {
    const categories = ["operations", "time-billing", "assets", "people", "finance", "resources"];
    return (<div className="p-6 space-y-8">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
            <p className="text-muted-foreground mt-2">
                Select a report to view operational, time, billing, and asset insights
            </p>
        </div>

        {categories.map((category) => {
            const categoryReports = reports.filter((r) => r.category === category);
            if (categoryReports.length === 0)
                return null;
            return (<div key={category}>
                <h2 className="text-xl font-semibold mb-4">{categoryTitles[category]}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryReports.map((report) => {
                        const Icon = report.icon;
                        
                        const cardContent = (
                            <Card className={cn("h-full transition-all hover:shadow-md border-2 cursor-pointer", categoryColors[category])}>
                                <CardHeader>
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm">
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1">
                                            <CardTitle className="text-base">
                                                {report.title}
                                            </CardTitle>
                                            <CardDescription className="mt-1.5 flex flex-col gap-1">
                                                <span>{report.description}</span>
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                            </Card>
                        );

                        return (<Link key={report.href} href={report.href}>
                            {cardContent}
                        </Link>);
                    })}
                </div>
            </div>);
        })}
    </div>);
}
