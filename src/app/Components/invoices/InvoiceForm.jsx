"use client";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, addDays } from "date-fns";
import { FileText, Upload, Paperclip, X, FileCheck, ExternalLink, Loader2 } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/app/Components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/Components/ui/select";
import { Input } from "@/app/Components/ui/input";
import { Button } from "@/app/Components/ui/button";
import { Textarea } from "@/app/Components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/Components/ui/card";
import { Checkbox } from "@/app/Components/ui/checkbox";
import { Label } from "@/app/Components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Separator } from "@/app/Components/ui/separator";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { FormCard } from "@/app/Components/ui/form-card";
import { StickyFooter } from "@/app/Components/ui/sticky-footer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/app/Components/ui/alert-dialog";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";
import { useSettings } from "@/app/Components/providers/SettingsProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const invoiceSchema = z.object({
    timesheetId: z.string().min(1, "Timesheet is required"),
    date: z.date({ message: "Invoice date is required" }),
    dueDate: z.date().optional().nullable(),
    notes: z.string().optional(),
    lpoNumber: z.string().optional().nullable().or(z.literal("")),
    adjustmentAmount: z.coerce.number().optional().default(0),
    adjustmentNote: z.string().optional().nullable().or(z.literal("")),
});

export function InvoiceForm({ mode = "create", initialData = null, defaultTimesheetId = null }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const lpoFileInputRef = useRef(null);
    const attachmentFileInputRef = useRef(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [pendingValues, setPendingValues] = useState(null);
    const { currencySymbol } = useSettings();

    const [customerId, setCustomerId] = useState("");
    const [projectId, setProjectId] = useState("");

    // LPO file state
    const [lpoFile, setLpoFile] = useState(null);
    const [currentLpoPath, setCurrentLpoPath] = useState(null);
    const [currentLpoName, setCurrentLpoName] = useState(null);

    // Signed Timesheet file state
    const [attachmentFile, setAttachmentFile] = useState(null);
    const [currentAttachmentPath, setCurrentAttachmentPath] = useState(null);
    const [currentAttachmentName, setCurrentAttachmentName] = useState(null);
    const [isSignedTimesheet, setIsSignedTimesheet] = useState(false);
    const [signatureDate, setSignatureDate] = useState(null);

    // Items and loading state
    const [items, setItems] = useState([]);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);

    const form = useForm({
        resolver: zodResolver(invoiceSchema),
        defaultValues: {
            timesheetId: "",
            date: new Date(),
            dueDate: null,
            notes: "",
            lpoNumber: "",
            adjustmentAmount: 0,
            adjustmentNote: "",
        },
    });

    // Queries
    const { data: invoiceSettings } = useQuery({
        queryKey: ["invoice-settings"],
        queryFn: async () => {
            const res = await fetch("/api/settings/invoice");
            if (!res.ok) throw new Error("Failed to fetch invoice settings");
            return res.json();
        }
    });

    const { data: companySettings } = useQuery({
        queryKey: ["company-settings"],
        queryFn: async () => {
            const res = await fetch("/api/settings/company");
            if (!res.ok) throw new Error("Failed to fetch company settings");
            return res.json();
        }
    });

    const { data: timesheets = [], isLoading: isLoadingTimesheets } = useQuery({
        queryKey: ["timesheets", { uninvoiced: true }],
        queryFn: async () => {
            const res = await fetch("/api/timesheets?uninvoiced=true");
            if (!res.ok) throw new Error("Failed to fetch timesheets");
            return res.json();
        },
        enabled: mode === "create"
    });

    // Extract unique customers who have pending timesheets
    const uniqueCustomers = Array.from(
        new Map(
            timesheets
                .filter(t => t.customerId && t.customer)
                .map(t => [t.customerId, { id: t.customerId, companyName: t.customer.companyName }])
        ).values()
    );

    // Extract unique projects who have pending timesheets under the selected customer
    const filteredProjects = Array.from(
        new Map(
            timesheets
                .filter(t => t.customerId?.toString() === customerId && t.projectId && t.project)
                .map(t => [t.projectId, { id: t.projectId, name: t.project.name }])
        ).values()
    );

    // Filter timesheets by customer and project
    const filteredTimesheets = timesheets.filter(t => {
        const matchCustomer = t.customerId?.toString() === customerId;
        const matchProject = !projectId || projectId === "all" || t.projectId?.toString() === projectId;
        return matchCustomer && matchProject;
    });

    const handleCustomerChange = (val) => {
        setCustomerId(val);
        setProjectId("");
        form.setValue("timesheetId", "");
    };

    const handleProjectChange = (val) => {
        setProjectId(val);
        form.setValue("timesheetId", "");
    };

    // Side effect to set default due date when settings load
    useEffect(() => {
        if (invoiceSettings?.defaultDueDays && mode === "create") {
            form.setValue("dueDate", addDays(new Date(), invoiceSettings.defaultDueDays));
        }
    }, [invoiceSettings, form, mode]);

    const selectedTimesheetId = form.watch("timesheetId");
    const selectedTimesheet = mode === "edit" && initialData?.timesheet 
        ? initialData.timesheet
        : timesheets.find(t => t.id.toString() === selectedTimesheetId);

    // Fetch timesheet preview items (Create Mode)
    useEffect(() => {
        if (selectedTimesheetId && mode === "create") {
            setIsLoadingPreview(true);
            fetch(`/api/invoices/preview?timesheetId=${selectedTimesheetId}`)
                .then(res => res.json())
                .then(data => {
                    setItems(data.items || []);
                    if (data.lpoNumber) {
                        form.setValue("lpoNumber", data.lpoNumber);
                    }
                    if (data.lpoAttachmentPath) {
                        setCurrentLpoPath(data.lpoAttachmentPath);
                        setCurrentLpoName(data.lpoAttachmentName);
                    }
                })
                .catch(err => {
                    console.error("Failed to fetch invoice preview", err);
                    toast.error("Failed to fetch invoice preview");
                })
                .finally(() => {
                    setIsLoadingPreview(false);
                });
        } else if (mode === "create") {
            setItems([]);
        }
    }, [selectedTimesheetId, mode, form]);

    // Auto-select timesheet if defaultTimesheetId prop is provided (Create Mode)
    useEffect(() => {
        if (mode === "create" && defaultTimesheetId && timesheets.length > 0) {
            const found = timesheets.find(t => t.id.toString() === defaultTimesheetId.toString());
            if (found) {
                setCustomerId(String(found.customerId || ""));
                setProjectId(String(found.projectId || ""));
                form.setValue("timesheetId", String(found.id));
            }
        }
    }, [defaultTimesheetId, timesheets, mode, form]);

    // Initialize Edit Mode values
    useEffect(() => {
        if (mode === "edit" && initialData) {
            form.reset({
                timesheetId: String(initialData.timesheetId || ""),
                date: initialData.date ? new Date(initialData.date) : new Date(),
                dueDate: initialData.dueDate ? new Date(initialData.dueDate) : null,
                notes: initialData.notes || "",
                lpoNumber: initialData.lpoNumber || "",
                adjustmentAmount: initialData.adjustmentAmount || 0,
                adjustmentNote: initialData.adjustmentNote || "",
            });
            setCustomerId(String(initialData.customerId || ""));
            setProjectId(String(initialData.projectId || ""));
            setItems(initialData.items || []);

            setCurrentLpoPath(initialData.lpoAttachmentPath || null);
            setCurrentLpoName(initialData.lpoAttachmentName || null);

            setCurrentAttachmentPath(initialData.attachmentPath || null);
            setCurrentAttachmentName(initialData.attachmentName || null);
            setIsSignedTimesheet(!!initialData.isSignedTimesheet);
            setSignatureDate(initialData.signatureDate ? new Date(initialData.signatureDate) : null);
        }
    }, [mode, initialData, form]);

    // Dynamic Options lists supporting Edit mode override
    const displayCustomers = mode === "edit" && initialData?.customer
        ? [initialData.customer]
        : uniqueCustomers;

    const displayProjects = mode === "edit" && initialData?.project
        ? [initialData.project]
        : filteredProjects;

    const displayTimesheets = mode === "edit" && initialData?.timesheet
        ? [initialData.timesheet]
        : filteredTimesheets;

    const formatPeriod = (start, end) => {
        try {
            return `(${format(new Date(start), "MMM d")} - ${format(new Date(end), "MMM d")})`;
        } catch (e) {
            return "";
        }
    };

    const handleUnitPriceChange = (index, value) => {
        const newItems = [...items];
        const val = parseFloat(value) || 0;
        newItems[index].unitPrice = val;
        newItems[index].total = Number(newItems[index].quantity || 0) * val;
        setItems(newItems);
    };

    // Calculate live totals
    const subtotal = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const enableVat = mode === "edit" ? !!initialData?.vatEnabled : !!companySettings?.enableVat;
    const vatPercentage = mode === "edit" ? Number(initialData?.vatPercentage || 0) : Number(companySettings?.vatPercentage || 0);
    const vatAmount = enableVat ? (subtotal * vatPercentage) / 100 : 0;
    const adjustmentAmount = Number(form.watch("adjustmentAmount") || 0);
    const grandTotal = subtotal + vatAmount + adjustmentAmount;

    function onSubmit(values) {
        if (!customerId) {
            toast.error("Validation Error", { description: "Customer is required" });
            return;
        }
        if (!projectId || projectId === "all") {
            toast.error("Validation Error", { description: "Project is required" });
            return;
        }
        setPendingValues(values);
        setShowConfirmDialog(true);
    }

    const { mutate: saveInvoice, isPending: isSaving } = useMutation({
        mutationFn: async (values) => {
            let lpoPath = currentLpoPath;
            let lpoName = currentLpoName;
            let signedPath = currentAttachmentPath;
            let signedName = currentAttachmentName;

            // 1. Upload LPO file if present
            if (lpoFile) {
                const fd = new FormData();
                fd.append("file", lpoFile);
                fd.append("folder", `invoices/temp/lpo`);
                const upRes = await fetch("/api/upload", { method: "POST", body: fd });
                if (!upRes.ok) throw new Error("Failed to upload LPO document");
                const { url } = await upRes.json();
                lpoPath = url;
                lpoName = lpoFile.name;
            }

            // 2. Upload Signed Timesheet if present
            if (attachmentFile) {
                const fd = new FormData();
                fd.append("file", attachmentFile);
                fd.append("folder", `invoices/temp/signed`);
                const upRes = await fetch("/api/upload", { method: "POST", body: fd });
                if (!upRes.ok) throw new Error("Failed to upload signed timesheet file");
                const { url } = await upRes.json();
                signedPath = url;
                signedName = attachmentFile.name;
            }

            const bodyPayload = {
                timesheetId: parseInt(values.timesheetId),
                date: values.date,
                dueDate: values.dueDate,
                notes: values.notes,
                lpoNumber: values.lpoNumber || null,
                lpoAttachmentPath: lpoPath,
                lpoAttachmentName: lpoName,
                adjustmentAmount: Number(values.adjustmentAmount || 0),
                adjustmentNote: values.adjustmentNote || null,
                attachmentPath: signedPath,
                attachmentName: signedName,
                isSignedTimesheet: isSignedTimesheet ? 1 : 0,
                signatureDate: signatureDate ? signatureDate.toISOString() : null,
                items: items.map(item => ({
                    description: item.description,
                    quantity: Number(item.quantity || 0),
                    unitPrice: Number(item.unitPrice || 0),
                    regularHours: Number(item.regularHours || 0),
                    overtimeHours: Number(item.overtimeHours || 0),
                    holidayHours: Number(item.holidayHours || 0),
                    days: Number(item.days || 0),
                })),
            };

            const url = mode === "edit" ? `/api/invoices/${initialData.id}` : "/api/invoices";
            const method = mode === "edit" ? "PUT" : "POST";

            const response = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bodyPayload),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Failed to ${mode === "edit" ? "update" : "create"} invoice`);
            }

            return response.json();
        },
        onSuccess: async (data) => {
            toast.success(mode === "edit" ? "Invoice updated successfully" : "Invoice created successfully");
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: ["invoices"],
                    refetchType: "all",
                }),
                queryClient.invalidateQueries({
                    queryKey: ["timesheets"],
                    refetchType: "all",
                }),
                queryClient.invalidateQueries({
                    queryKey: ["uninvoiced-timesheets"],
                    refetchType: "all",
                })
            ]);
            router.refresh();
            router.push(`/invoices/${mode === "edit" ? initialData.id : data.invoiceId}`);
        },
        onError: (error) => {
            console.error(error);
            toast.error(error.message);
        },
        onSettled: () => {
            setShowConfirmDialog(false);
        }
    });

    async function handleConfirm() {
        if (!pendingValues) return;
        saveInvoice(pendingValues);
    }

    const dialogTitle = mode === "edit" ? "Save Invoice Changes?" : "Create Invoice?";
    const dialogDescription = mode === "edit"
        ? "This will update the invoice details, unit prices, adjustments, and attachments. Are you sure you want to continue?"
        : "This will CREATE an invoice and LOCK the selected timesheet. The timesheet items will be frozen and cannot be edited. Are you sure you want to continue?";

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-24">
                <div className="space-y-8">
                    {/* Invoice Details */}
                    <FormCard title="Invoice Details" description="Select customer, project, and timesheet to generate an invoice." icon={FileText}>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <FormLabel>Customer <span className="text-red-500">*</span></FormLabel>
                                <Select value={customerId} onValueChange={handleCustomerChange} disabled={mode === "edit" || isLoadingTimesheets}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={isLoadingTimesheets ? "Loading..." : "Select Customer"} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {displayCustomers.length === 0 ? (
                                            <SelectItem value="none" disabled>No pending customers found</SelectItem>
                                        ) : (
                                            displayCustomers.map((c) => (
                                                <SelectItem key={c.id} value={c.id.toString()}>
                                                    {c.companyName}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <FormLabel>Project <span className="text-red-500">*</span></FormLabel>
                                <Select value={projectId} onValueChange={handleProjectChange} disabled={mode === "edit" || !customerId}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder={!customerId ? "Select Customer First" : "Select Project"} />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {displayProjects.map((p) => (
                                            <SelectItem key={p.id} value={p.id.toString()}>
                                                {p.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <FormField control={form.control} name="timesheetId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Timesheet <span className="text-red-500">*</span></FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || ""} disabled={mode === "edit" || !customerId}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={!customerId ? "Select Customer First" : "Select Timesheet"}/>
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {displayTimesheets.length === 0 ? (
                                                <SelectItem value="none" disabled>No pending timesheets found</SelectItem>
                                            ) : (
                                                displayTimesheets.map((ts) => (
                                                    <SelectItem key={ts.id} value={ts.id.toString()}>
                                                        {ts.timesheetCode} {ts.periodStart ? formatPeriod(ts.periodStart, ts.periodEnd) : ""}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    {mode === "create" && (
                                        <FormDescription>
                                            Only approved timesheets that are not yet invoiced are shown.
                                        </FormDescription>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}/>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="date" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Invoice Date <span className="text-red-500">*</span></FormLabel>
                                        <FormControl>
                                            <FormattedDatePicker value={field.value} onChange={field.onChange} placeholder="Select invoice date" disabled={mode === "edit"}/>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>

                                <FormField control={form.control} name="dueDate" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Due Date</FormLabel>
                                        <FormControl>
                                            <FormattedDatePicker value={field.value} onChange={field.onChange} placeholder="Select due date"/>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                            </div>

                            <FormField control={form.control} name="notes" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Additional notes for the client..." className="resize-none font-sans" {...field}/>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                        </div>
                    </FormCard>

                    {/* Invoice Preview & Items */}
                    <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl">
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-base flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Invoice Preview & Items
                            </CardTitle>
                            <CardDescription>
                                {selectedTimesheet ? "Review and adjust unit prices." : "Select a timesheet to load preview."}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {isLoadingPreview ? (
                                <div className="h-60 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 rounded-md border-2 border-dashed">
                                    <Loader2 className="h-10 w-10 mb-2 animate-spin text-muted-foreground" />
                                    <p>Loading invoice items...</p>
                                </div>
                            ) : items.length > 0 ? (
                                <div className="space-y-6">
                                    {selectedTimesheet && (
                                        <div className="grid grid-cols-2 gap-4 text-sm bg-muted/20 p-4 rounded-xl border">
                                            <div className="space-y-1">
                                                <span className="text-muted-foreground block text-xs uppercase tracking-wider">Customer</span>
                                                <span className="font-semibold block">{selectedTimesheet.customer?.companyName || "N/A"}</span>
                                            </div>

                                            <div className="space-y-1">
                                                <span className="text-muted-foreground block text-xs uppercase tracking-wider">Project</span>
                                                <span className="font-semibold block">{selectedTimesheet.project?.name || "N/A"}</span>
                                            </div>

                                            <div className="space-y-1 col-span-2">
                                                <span className="text-muted-foreground block text-xs uppercase tracking-wider">Timesheet Period</span>
                                                <span className="font-semibold block">
                                                    {selectedTimesheet.periodStart ? `${format(new Date(selectedTimesheet.periodStart), "MMM d, yyyy")} - ${format(new Date(selectedTimesheet.periodEnd), "MMM d, yyyy")}` : "N/A"}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="rounded-xl border overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-muted/40">
                                                <TableRow>
                                                    <TableHead className="w-[35%] text-xs font-semibold">Description</TableHead>
                                                    <TableHead className="text-right w-[10%] text-xs font-semibold">Reg</TableHead>
                                                    <TableHead className="text-right w-[10%] text-xs font-semibold">OT</TableHead>
                                                    <TableHead className="text-right w-[10%] text-xs font-semibold">Hol</TableHead>
                                                    <TableHead className="text-right w-[10%] text-xs font-semibold">Qty</TableHead>
                                                    <TableHead className="text-right w-[10%] text-xs font-semibold">Day</TableHead>
                                                    <TableHead className="text-right w-[15%] text-xs font-semibold">Unit Price</TableHead>
                                                    <TableHead className="text-right w-[10%] text-xs font-semibold">Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {items.map((item, idx) => (
                                                    <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                                                        <TableCell className="font-medium text-xs break-words max-w-[200px] leading-relaxed">
                                                            {item.description}
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs text-muted-foreground">
                                                            {item.regularHours || 0}
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs text-muted-foreground">
                                                            {item.overtimeHours || 0}
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs text-muted-foreground">
                                                            {item.holidayHours || 0}
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs font-medium">
                                                            {Number(item.quantity || 0).toFixed(2)}
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs font-medium">
                                                            {item.days || 0}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <span className="text-xs text-muted-foreground">{currencySymbol}</span>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={item.unitPrice}
                                                                    onChange={(e) => handleUnitPriceChange(idx, e.target.value)}
                                                                    className="h-8 w-20 text-right text-xs px-1.5 border-slate-200 focus-visible:ring-amber-500 rounded-md"
                                                                />
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs font-semibold">
                                                            <span className="inline-flex justify-end items-center gap-1">
                                                                <CurrencySymbol symbol={currencySymbol} />
                                                                {Number(item.total || 0).toFixed(2)}
                                                            </span>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <div className="text-xs text-muted-foreground/70 italic mt-2">
                                        * Important: For Detour blocks with bundle billing disabled, vehicles & operators are billed at hourly rates, whereas materials & labours are billed at daily rates.
                                    </div>

                                    <div className="flex flex-col items-end gap-2 pt-4 border-t mt-4">
                                        <div className="flex justify-between w-64 text-sm">
                                            <span className="text-muted-foreground">Subtotal:</span>
                                            <span className="font-medium flex items-center gap-1">
                                                <CurrencySymbol symbol={currencySymbol} />
                                                {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        {enableVat && (
                                            <div className="flex justify-between w-64 text-sm">
                                                <span className="text-muted-foreground">VAT ({vatPercentage}%):</span>
                                                <span className="font-medium flex items-center gap-1">
                                                    <CurrencySymbol symbol={currencySymbol} />
                                                    {vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )}
                                        {adjustmentAmount !== 0 && (
                                            <div className="flex justify-between w-64 text-sm">
                                                <span className="text-muted-foreground">Adjustment:</span>
                                                <span className={`font-semibold flex items-center gap-1 ${adjustmentAmount < 0 ? 'text-green-600' : 'text-amber-600'}`}>
                                                    {adjustmentAmount < 0 ? "-" : "+"}
                                                    <CurrencySymbol symbol={currencySymbol} />
                                                    {Math.abs(adjustmentAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex justify-between w-64 text-base font-bold border-t pt-2 mt-1">
                                            <span>Total Due:</span>
                                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                                <CurrencySymbol symbol={currencySymbol} />
                                                {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>

                                    {mode === "create" && (
                                        <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-200 dark:border-amber-800/60 text-sm mt-6">
                                            <p className="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                                                Important
                                            </p>
                                            <ul className="list-disc list-inside mt-2 space-y-1 text-amber-700/80 dark:text-amber-300/80 ml-1">
                                                <li>Creating this invoice will <strong>LOCK</strong> the timesheet ({selectedTimesheet?.timesheetCode || "selected"}).</li>
                                                <li>To edit the timesheet later, you must delete this invoice.</li>
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-60 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 rounded-md border-2 border-dashed">
                                    <FileText className="h-10 w-10 mb-2 opacity-20" />
                                    <p>No timesheet selected or no items found</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* LPO Details */}
                    <FormCard title="LPO Details" description="Attach or modify the client's Local Purchase Order." icon={FileText}>
                        <div className="space-y-4">
                            <FormField control={form.control} name="lpoNumber" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>LPO Number</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="e.g. LPO-2025-001" value={field.value || ""} />
                                    </FormControl>
                                    <FormDescription>This carries over from the project/timesheet.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormItem>
                                <FormLabel>LPO Document</FormLabel>
                                <div className="flex flex-col gap-2">
                                    {(currentLpoPath || lpoFile) && (
                                        <div className="flex items-center gap-2 text-sm border rounded-md p-2 bg-muted/40">
                                            <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <span className="truncate flex-1 text-muted-foreground">
                                                {lpoFile ? lpoFile.name : currentLpoName || currentLpoPath?.split("/").pop()}
                                            </span>
                                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                                                onClick={() => { setCurrentLpoPath(null); setCurrentLpoName(null); setLpoFile(null); }}>
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    )}
                                    {!currentLpoPath && !lpoFile && (
                                        <Button type="button" variant="outline" className="w-full"
                                            onClick={() => lpoFileInputRef.current?.click()}>
                                            <Upload className="mr-2 h-4 w-4" /> Upload LPO Document
                                        </Button>
                                    )}
                                    {(currentLpoPath || lpoFile) && (
                                        <Button type="button" variant="outline" size="sm" className="w-fit"
                                            onClick={() => lpoFileInputRef.current?.click()}>
                                            <Upload className="mr-2 h-3 w-3" /> Replace File
                                        </Button>
                                    )}
                                    <input
                                        ref={lpoFileInputRef}
                                        type="file"
                                        className="hidden"
                                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                        onChange={(e) => { setLpoFile(e.target.files?.[0] || null); e.target.value = ""; }}
                                    />
                                </div>
                                <FormDescription>PDF or document, up to 10 MB.</FormDescription>
                            </FormItem>
                        </div>
                    </FormCard>

                    {/* Invoice Adjustment */}
                    <FormCard title="Invoice Adjustment" description="Add a positive or negative adjustment to the final total." icon={FileText}>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="adjustmentAmount" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Adjustment Amount ({currencySymbol})</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" {...field} placeholder="0.00" />
                                        </FormControl>
                                        <FormDescription>Use negative numbers (e.g. -500) for discounts.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="adjustmentNote" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Adjustment Note</FormLabel>
                                        <FormControl>
                                            <Textarea {...field} placeholder="e.g. Goodwill discount" className="resize-none font-sans" rows={2} value={field.value || ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>
                        </div>
                    </FormCard>

                    {/* Signed Timesheet */}
                    <FormCard title="Signed Timesheet" description="Attach a signed client timesheet for confirmation." icon={FileCheck}>
                        <div className="space-y-4">
                            <FormItem>
                                <FormLabel>Timesheet Document</FormLabel>
                                <div className="flex flex-col gap-2">
                                    {(currentAttachmentPath || attachmentFile) && (
                                        <div className="flex items-center gap-2 text-sm border rounded-md p-2 bg-muted/40">
                                            <Paperclip className="h-4 w-4 text-green-500 shrink-0" />
                                            <span className="truncate flex-1 text-muted-foreground">
                                                {attachmentFile ? attachmentFile.name : currentAttachmentName || currentAttachmentPath?.split("/").pop()}
                                            </span>
                                            {currentAttachmentPath && !attachmentFile && (
                                                <a href={currentAttachmentPath} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                                </a>
                                            )}
                                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                                                onClick={() => { setCurrentAttachmentPath(null); setCurrentAttachmentName(null); setAttachmentFile(null); }}>
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    )}
                                    {!currentAttachmentPath && !attachmentFile && (
                                        <Button type="button" variant="outline" className="w-full"
                                            onClick={() => attachmentFileInputRef.current?.click()}>
                                            <Upload className="mr-2 h-4 w-4" /> Upload Signed Timesheet
                                        </Button>
                                    )}
                                    {(currentAttachmentPath || attachmentFile) && (
                                        <Button type="button" variant="outline" size="sm" className="w-fit"
                                            onClick={() => attachmentFileInputRef.current?.click()}>
                                            <Upload className="mr-2 h-3 w-3" /> Replace File
                                        </Button>
                                    )}
                                    <input
                                        ref={attachmentFileInputRef}
                                        type="file"
                                        className="hidden"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={(e) => { setAttachmentFile(e.target.files?.[0] || null); e.target.value = ""; }}
                                    />
                                </div>
                                <FormDescription>Upload signed document, up to 10 MB.</FormDescription>
                            </FormItem>

                            <div className="flex items-center gap-4 flex-wrap pt-2">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="isSignedTimesheet"
                                        checked={isSignedTimesheet}
                                        onCheckedChange={setIsSignedTimesheet}
                                    />
                                    <Label htmlFor="isSignedTimesheet" className="text-sm font-normal cursor-pointer select-none">
                                        This is a signed timesheet
                                    </Label>
                                </div>

                                {isSignedTimesheet && (
                                    <div className="flex items-center gap-2">
                                        <Label className="text-sm text-muted-foreground whitespace-nowrap">Signature Date</Label>
                                        <FormattedDatePicker
                                            value={signatureDate}
                                            onChange={setSignatureDate}
                                            placeholder="Select date"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </FormCard>
                </div>

                <StickyFooter isSaving={isSaving} cancelLink="/invoices" saveLabel={mode === "edit" ? "Save Changes" : "Create Invoice"} />
            </form>

            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {dialogDescription}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => {
                            e.preventDefault();
                            handleConfirm();
                        }} className="bg-emerald-600 hover:bg-emerald-700">
                            Continue
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Form>
    );
}