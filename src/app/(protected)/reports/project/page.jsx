"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ReportHeader } from "@/app/Components/reports/ReportHeader";
import { ReportFilterPanel } from "@/app/Components/reports/ReportFilterPanel";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { Label } from "@/app/Components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { Badge } from "@/app/Components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/Components/ui/select";
import { toast } from "sonner";
import { generateReportPDF, generateReportExcel } from "@/app/lib/export-utils";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";
import { useSettings } from "@/app/Components/providers/SettingsProvider";
import { ChevronDown, ChevronRight, Truck, User, Package, HardHat, GitMerge, MapPin, Hash, FileText, Receipt, Banknote, ClipboardList } from "lucide-react";

const statusColors = {
    ACTIVE: "default",
    COMPLETED: "secondary",
    CANCELLED: "destructive",
    DRAFT: "outline",
    APPROVED: "secondary",
    INVOICED: "default",
    SENT: "secondary",
    PAID: "default",
};

function SectionCard({ title, icon: Icon, count, children }) {
    return (
        <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {title}
                    {count !== undefined && (
                        <span className="ml-auto text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {count}
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">{children}</CardContent>
        </Card>
    );
}

function AssignmentRow({ assignment, currencySymbol }) {
    const [expanded, setExpanded] = useState(false);
    const { resources } = assignment;
    const hasResources =
        resources.vehicles.length + resources.operators.length +
        resources.materials.length + resources.labours.length +
        resources.detours.length > 0;

    return (
        <>
            <TableRow
                className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60 ${hasResources ? "cursor-pointer" : ""}`}
                onClick={() => hasResources && setExpanded(e => !e)}
            >
                <TableCell className="w-8">
                    {hasResources ? (
                        expanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    ) : null}
                </TableCell>
                <TableCell>
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded-md">{assignment.assignmentCode || "-"}</span>
                </TableCell>
                <TableCell className="text-sm">{format(new Date(assignment.startDate), "dd MMM yyyy")}</TableCell>
                <TableCell className="text-sm">{format(new Date(assignment.endDate), "dd MMM yyyy")}</TableCell>
                <TableCell>
                    <Badge variant={statusColors[assignment.status] || "outline"}>{assignment.status}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground text-right">
                    {[
                        resources.vehicles.length > 0 && `${resources.vehicles.length} Vehicle${resources.vehicles.length > 1 ? "s" : ""}`,
                        resources.operators.length > 0 && `${resources.operators.length} Operator${resources.operators.length > 1 ? "s" : ""}`,
                        resources.materials.length > 0 && `${resources.materials.length} Material${resources.materials.length > 1 ? "s" : ""}`,
                        resources.labours.length > 0 && `${resources.labours.length} Labour${resources.labours.length > 1 ? "s" : ""}`,
                        resources.detours.length > 0 && `${resources.detours.length} Detour${resources.detours.length > 1 ? "s" : ""}`,
                    ].filter(Boolean).join(", ") || "No resources"}
                </TableCell>
            </TableRow>
            {expanded && (
                <TableRow className="bg-slate-50/30 dark:bg-slate-900/30">
                    <TableCell colSpan={6} className="p-0">
                        <div className="px-8 py-3 space-y-3">
                            {resources.vehicles.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <Truck className="h-3 w-3" /> Vehicles
                                    </p>
                                    <div className="space-y-1">
                                        {resources.vehicles.map((v, i) => (
                                            <div key={i} className="flex items-center gap-4 text-xs">
                                                <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{v.vehicleCode}</span>
                                                {v.billingCycle && <span className="text-muted-foreground">{v.billingCycle}</span>}
                                                {v.startDate && (
                                                    <span className="text-muted-foreground">
                                                        {format(new Date(v.startDate), "dd MMM")} → {format(new Date(v.endDate), "dd MMM")}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {resources.operators.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <User className="h-3 w-3" /> Operators
                                    </p>
                                    <div className="space-y-1">
                                        {resources.operators.map((op, i) => (
                                            <div key={i} className="flex items-center gap-4 text-xs">
                                                <span>{op.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {resources.materials.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <Package className="h-3 w-3" /> Materials
                                    </p>
                                    <div className="space-y-1">
                                        {resources.materials.map((mat, i) => (
                                            <div key={i} className="flex items-center gap-4 text-xs">
                                                <span>{mat.name}</span>
                                                {mat.quantity && <span className="text-muted-foreground">Qty: {mat.quantity}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {resources.labours.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <HardHat className="h-3 w-3" /> Labours
                                    </p>
                                    <div className="space-y-1">
                                        {resources.labours.map((lab, i) => (
                                            <div key={i} className="flex items-center gap-4 text-xs">
                                                <span>{lab.labourType}</span>
                                                {lab.quantity && <span className="text-muted-foreground">Qty: {lab.quantity}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {resources.detours.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <GitMerge className="h-3 w-3" /> Detour Services
                                    </p>
                                    <div className="space-y-1">
                                        {resources.detours.map((d, i) => (
                                            <div key={i} className="flex items-center gap-4 text-xs">
                                                <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{d.templateCode}</span>
                                                <span>{d.name}</span>
                                                {d.startDate && (
                                                    <span className="text-muted-foreground">
                                                        {format(new Date(d.startDate), "dd MMM")} → {format(new Date(d.endDate), "dd MMM")}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}

export default function ProjectReportPage() {
    const { currencySymbol } = useSettings();
    const [customerId, setCustomerId] = useState("all");
    const [projectId, setProjectId] = useState("");
    const [startDate, setStartDate] = useState(undefined);
    const [endDate, setEndDate] = useState(undefined);

    const { data: customers = [] } = useQuery({
        queryKey: ["clients"],
        queryFn: async () => {
            const res = await fetch("/api/clients");
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        },
    });

    const { data: projects = [] } = useQuery({
        queryKey: ["projects", customerId],
        queryFn: async () => {
            const url = customerId !== "all" ? `/api/projects?customerId=${customerId}` : "/api/projects";
            const res = await fetch(url);
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        },
    });

    const { data: reportData, isLoading, error: reportError } = useQuery({
        queryKey: ["report-project", projectId, startDate?.toISOString(), endDate?.toISOString()],
        queryFn: async () => {
            const params = new URLSearchParams({ projectId });
            if (startDate) params.append("startDate", startDate.toISOString());
            if (endDate) params.append("endDate", endDate.toISOString());
            const res = await fetch(`/api/reports/project?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch project report");
            return res.json();
        },
        enabled: !!projectId,
    });

    const clearFilters = () => {
        setCustomerId("all");
        setProjectId("");
        setStartDate(undefined);
        setEndDate(undefined);
    };

    const handleExportPDF = () => {
        if (!reportData) return;
        try {
            const { project, summary } = reportData;
            const headers = ["Metric", "Value"];
            const rows = [
                ["Project", project.name],
                ["Customer", project.customer?.companyName || "-"],
                ["Total Assignments", String(summary.totalAssignments)],
                ["Total Timesheets", String(summary.totalTimesheets)],
                ["Total Invoiced", `${currencySymbol} ${summary.totalInvoiced.toFixed(2)}`],
                ["Total Expenses", `${currencySymbol} ${summary.totalExpenses.toFixed(2)}`],
            ];
            generateReportPDF("Project Report", headers, rows, `project-${project.projectCode}-${format(new Date(), "yyyy-MM-dd")}`);
            toast.success("PDF exported successfully");
        } catch {
            toast.error("Failed to export PDF");
        }
    };

    const handleExportExcel = () => {
        if (!reportData) return;
        try {
            const { project, summary } = reportData;
            const headers = ["Metric", "Value"];
            const rows = [
                ["Project", project.name],
                ["Customer", project.customer?.companyName || "-"],
                ["Total Assignments", String(summary.totalAssignments)],
                ["Total Timesheets", String(summary.totalTimesheets)],
                ["Total Invoiced", summary.totalInvoiced.toFixed(2)],
                ["Total Expenses", summary.totalExpenses.toFixed(2)],
            ];
            generateReportExcel("Project Report", headers, rows, `project-${project.projectCode}-${format(new Date(), "yyyy-MM-dd")}`);
            toast.success("Excel exported successfully");
        } catch {
            toast.error("Failed to export Excel");
        }
    };

    const { project, assignments = [], timesheets = [], invoices = [], expenses = [], summary } = reportData || {};

    return (
        <div className="p-6 space-y-6">
            <ReportHeader
                title="Project Report"
                description="Full project overview — assignments, timesheets, invoices and expenses"
                backHref="/reports"
                onExportPDF={handleExportPDF}
                onExportExcel={handleExportExcel}
            />

            <ReportFilterPanel onClear={clearFilters}>
                <div>
                    <Label>Customer</Label>
                    <Select value={customerId} onValueChange={(val) => { setCustomerId(val); setProjectId(""); }}>
                        <SelectTrigger><SelectValue placeholder="All Customers" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Customers</SelectItem>
                            {customers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Project <span className="text-red-500">*</span></Label>
                    <Select value={projectId} onValueChange={setProjectId}>
                        <SelectTrigger><SelectValue placeholder="Select Project" /></SelectTrigger>
                        <SelectContent>
                            {projects.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>From Date</Label>
                    <FormattedDatePicker value={startDate} onChange={setStartDate} placeholder="Select start date" />
                </div>
                <div>
                    <Label>To Date</Label>
                    <FormattedDatePicker value={endDate} onChange={setEndDate} placeholder="Select end date" />
                </div>
            </ReportFilterPanel>

            {!projectId && (
                <div className="h-48 flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-2xl">
                    <p>Select a project to view its report</p>
                </div>
            )}

            {projectId && isLoading && (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                    <p>Loading report...</p>
                </div>
            )}

            {projectId && reportError && !isLoading && (
                <div className="h-48 flex items-center justify-center rounded-2xl border-2 border-dashed border-red-200 dark:border-red-900">
                    <div className="text-center space-y-1">
                        <p className="text-red-500 font-medium">Failed to load report</p>
                        <p className="text-xs text-muted-foreground">{reportError?.message || "Unknown error"}</p>
                    </div>
                </div>
            )}

            {reportData && (
                <div className="space-y-6">
                    {/* Project Overview */}
                    <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 shadow-sm rounded-2xl">
                        <CardContent className="p-5">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                                <div className="space-y-0.5">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Hash className="h-3 w-3" /> Project Code</p>
                                    <p className="font-mono font-semibold text-sm">{project.projectCode}</p>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><FileText className="h-3 w-3" /> Project Name</p>
                                    <p className="font-semibold text-sm">{project.name}</p>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><User className="h-3 w-3" /> Customer</p>
                                    <p className="font-semibold text-sm">{project.customer?.companyName || "-"}</p>
                                </div>
                                {project.location && (
                                    <div className="space-y-0.5">
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</p>
                                        <p className="font-semibold text-sm">{project.location}</p>
                                    </div>
                                )}
                                {project.lpoNumber && (
                                    <div className="space-y-0.5">
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider">LPO Number</p>
                                        <p className="font-semibold text-sm">{project.lpoNumber}</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Summary Totals */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Assignments", value: summary.totalAssignments, icon: ClipboardList, color: "text-blue-600 dark:text-blue-400" },
                            { label: "Timesheets", value: summary.totalTimesheets, icon: FileText, color: "text-purple-600 dark:text-purple-400" },
                            { label: "Total Invoiced", value: `${currencySymbol} ${summary.totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: Receipt, color: "text-emerald-600 dark:text-emerald-400" },
                            { label: "Total Expenses", value: `${currencySymbol} ${summary.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: Banknote, color: "text-amber-600 dark:text-amber-400" },
                        ].map(({ label, value, icon: Icon, color }) => (
                            <Card key={label} className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 shadow-sm rounded-2xl">
                                <CardContent className="p-4 flex items-center gap-3">
                                    <div className={`p-2 rounded-lg bg-muted/50 ${color}`}>
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">{label}</p>
                                        <p className={`font-bold text-sm ${color}`}>{value}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Assignments */}
                    <SectionCard title="Assignments" icon={ClipboardList} count={assignments.length}>
                        <Table>
                            <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                                <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                                    <TableHead className="w-8 h-10" />
                                    <TableHead className="h-10">Assignment</TableHead>
                                    <TableHead className="h-10">Start Date</TableHead>
                                    <TableHead className="h-10">End Date</TableHead>
                                    <TableHead className="h-10">Status</TableHead>
                                    <TableHead className="h-10 text-right">Resources</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {assignments.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="h-20 text-center text-muted-foreground">No assignments found.</TableCell></TableRow>
                                ) : (
                                    assignments.map(a => (
                                        <AssignmentRow key={a.id} assignment={a} currencySymbol={currencySymbol} />
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </SectionCard>

                    {/* Timesheets */}
                    <SectionCard title="Timesheets" icon={FileText} count={timesheets.length}>
                        <Table>
                            <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                                <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                                    <TableHead className="h-10">Code</TableHead>
                                    <TableHead className="h-10">Period Start</TableHead>
                                    <TableHead className="h-10">Period End</TableHead>
                                    <TableHead className="h-10">Status</TableHead>
                                    <TableHead className="h-10">Generated At</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {timesheets.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">No timesheets found.</TableCell></TableRow>
                                ) : (
                                    timesheets.map(ts => (
                                        <TableRow key={ts.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60">
                                            <TableCell><span className="font-mono text-xs bg-muted px-2 py-1 rounded-md">{ts.timesheetCode}</span></TableCell>
                                            <TableCell className="text-sm">{format(new Date(ts.periodStart), "dd MMM yyyy")}</TableCell>
                                            <TableCell className="text-sm">{format(new Date(ts.periodEnd), "dd MMM yyyy")}</TableCell>
                                            <TableCell><Badge variant={statusColors[ts.status] || "outline"}>{ts.status}</Badge></TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{ts.generatedAt ? format(new Date(ts.generatedAt), "dd MMM yyyy") : "-"}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </SectionCard>

                    {/* Invoices */}
                    <SectionCard title="Invoices" icon={Receipt} count={invoices.length}>
                        <Table>
                            <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                                <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                                    <TableHead className="h-10">Invoice #</TableHead>
                                    <TableHead className="h-10">Date</TableHead>
                                    <TableHead className="h-10">Due Date</TableHead>
                                    <TableHead className="h-10 text-right">Amount</TableHead>
                                    <TableHead className="h-10">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">No invoices found.</TableCell></TableRow>
                                ) : (
                                    invoices.map(inv => (
                                        <TableRow key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60">
                                            <TableCell><span className="font-mono text-xs bg-muted px-2 py-1 rounded-md">{inv.invoiceNumber || "-"}</span></TableCell>
                                            <TableCell className="text-sm">{inv.date ? format(new Date(inv.date), "dd MMM yyyy") : "-"}</TableCell>
                                            <TableCell className="text-sm">{inv.dueDate ? format(new Date(inv.dueDate), "dd MMM yyyy") : "-"}</TableCell>
                                            <TableCell className="text-right text-sm font-medium">
                                                <CurrencySymbol symbol={currencySymbol} />{inv.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell><Badge variant={statusColors[inv.status] || "outline"}>{inv.status}</Badge></TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </SectionCard>

                    {/* Expenses */}
                    <SectionCard title="Expenses" icon={Banknote} count={expenses.length}>
                        <Table>
                            <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                                <TableRow className="hover:bg-transparent border-slate-200/60 dark:border-slate-800/60">
                                    <TableHead className="h-10">Date</TableHead>
                                    <TableHead className="h-10">Code</TableHead>
                                    <TableHead className="h-10">Type</TableHead>
                                    <TableHead className="h-10">Description</TableHead>
                                    <TableHead className="h-10">Assignment</TableHead>
                                    <TableHead className="h-10">Status</TableHead>
                                    <TableHead className="h-10 text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {expenses.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="h-20 text-center text-muted-foreground">No expenses found.</TableCell></TableRow>
                                ) : (
                                    <>
                                        {expenses.map(e => (
                                            <TableRow key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-slate-200/60 dark:border-slate-800/60">
                                                <TableCell className="text-sm">{e.date ? format(new Date(e.date), "dd MMM yyyy") : "-"}</TableCell>
                                                <TableCell><span className="font-mono text-xs bg-muted px-2 py-1 rounded-md">{e.expenseCode || "-"}</span></TableCell>
                                                <TableCell className="text-sm">{e.expenseType?.name || "-"}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{e.description || "-"}</TableCell>
                                                <TableCell className="text-xs">
                                                    {e.assignment?.assignmentCode
                                                        ? <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{e.assignment.assignmentCode}</span>
                                                        : <span className="text-muted-foreground">Direct</span>}
                                                </TableCell>
                                                <TableCell><Badge variant={statusColors[e.status] || "outline"}>{e.status}</Badge></TableCell>
                                                <TableCell className="text-right text-sm font-medium">
                                                    <CurrencySymbol symbol={currencySymbol} />{e.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="bg-slate-50/80 dark:bg-slate-900/80 font-semibold">
                                            <TableCell colSpan={6} className="text-right text-sm">Total Expenses:</TableCell>
                                            <TableCell className="text-right text-sm text-amber-600 dark:text-amber-400">
                                                <CurrencySymbol symbol={currencySymbol} />{summary.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                        </TableRow>
                                    </>
                                )}
                            </TableBody>
                        </Table>
                    </SectionCard>
                </div>
            )}
        </div>
    );
}
