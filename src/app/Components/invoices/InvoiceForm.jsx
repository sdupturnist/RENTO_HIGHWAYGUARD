"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, addDays } from "date-fns";
import { FileText } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription, } from "@/app/Components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/app/Components/ui/select";
import { Input } from "@/app/Components/ui/input";
import { Textarea } from "@/app/Components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/Components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Separator } from "@/app/Components/ui/separator";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { FormCard } from "@/app/Components/ui/form-card";
import { StickyFooter } from "@/app/Components/ui/sticky-footer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/app/Components/ui/alert-dialog";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";
import { useSettings } from "@/app/Components/providers/SettingsProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const invoiceSchema = z.object({
    timesheetId: z.string().min(1, "Timesheet is required"),
    date: z.date({ message: "Invoice date is required" }),
    dueDate: z.date({ message: "Due date is required" }),
    reference: z.string().optional(),
    notes: z.string().optional(),
});

export function InvoiceForm() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [pendingValues, setPendingValues] = useState(null);
    const { currencySymbol } = useSettings();

    const [customerId, setCustomerId] = useState("");
    const [projectId, setProjectId] = useState("");

    const form = useForm({
        resolver: zodResolver(invoiceSchema),
        defaultValues: {
            date: new Date(),
            reference: "",
            notes: "",
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
        }
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
        if (invoiceSettings?.defaultDueDays) {
            form.setValue("dueDate", addDays(new Date(), invoiceSettings.defaultDueDays));
        }
    }, [invoiceSettings, form]);

    const selectedTimesheetId = form.watch("timesheetId");
    const selectedTimesheet = timesheets.find(t => t.id.toString() === selectedTimesheetId);

    function onSubmit(values) {
        setPendingValues(values);
        setShowConfirmDialog(true);
    }

    const { mutate: createInvoice, isPending: isSaving } = useMutation({
        mutationFn: async (values) => {
            const response = await fetch("/api/invoices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    timesheetId: parseInt(values.timesheetId),
                    date: values.date,
                    dueDate: values.dueDate,
                    reference: values.reference,
                    notes: values.notes,
                }),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to create invoice");
            }
            return response.json();
        },
        onSuccess: async (data) => {
            toast.success("Invoice created successfully");
            // Invalidate and wait before navigating so the list has fresh data on arrival
            await queryClient.invalidateQueries({
                queryKey: ["invoices"],
                refetchType: "all",
            });
            router.refresh();
            router.push(`/invoices/${data.invoiceId}`);
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
        createInvoice(pendingValues);
    }

    return (<Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-24">
                <div className="grid gap-8 md:grid-cols-2">
                    {/* Left Column: Form Inputs */}
                    <div className="space-y-8">
                        <FormCard title="Invoice Details" description="Select customer, project, and timesheet to generate an invoice." icon={FileText}>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <FormLabel>Customer <span className="text-red-500">*</span></FormLabel>
                                    <Select value={customerId} onValueChange={handleCustomerChange}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={isLoadingTimesheets ? "Loading..." : "Select Customer"} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {uniqueCustomers.length === 0 ? (
                                                <SelectItem value="none" disabled>No pending customers found</SelectItem>
                                            ) : (
                                                uniqueCustomers.map((c) => (
                                                    <SelectItem key={c.id} value={c.id.toString()}>
                                                        {c.companyName}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <FormLabel>Project (Optional)</FormLabel>
                                    <Select value={projectId} onValueChange={handleProjectChange} disabled={!customerId}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={!customerId ? "Select Customer First" : "All Projects"} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="all">-- All Projects --</SelectItem>
                                            {filteredProjects.map((p) => (
                                                <SelectItem key={p.id} value={p.id.toString()}>
                                                    {p.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <FormField control={form.control} name="timesheetId" render={({ field }) => (<FormItem>
                                            <FormLabel>Timesheet <span className="text-red-500">*</span></FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || ""}>
                                                <FormControl>
                                                    <SelectTrigger disabled={!customerId}>
                                                        <SelectValue placeholder={!customerId ? "Select Customer First" : "Select Timesheet"}/>
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {filteredTimesheets.length === 0 ? (
                                                        <SelectItem value="none" disabled>No pending timesheets found</SelectItem>
                                                    ) : (
                                                        filteredTimesheets.map((ts) => (
                                                            <SelectItem key={ts.id} value={ts.id.toString()}>
                                                                {ts.timesheetCode} ({format(new Date(ts.periodStart), "MMM d")} - {format(new Date(ts.periodEnd), "MMM d")})
                                                            </SelectItem>
                                                        ))
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <FormDescription>
                                                Only approved timesheets that are not yet invoiced are shown.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>)}/>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="date" render={({ field }) => (<FormItem className="flex flex-col">
                                                <FormLabel>Invoice Date <span className="text-red-500">*</span></FormLabel>
                                                <FormControl>
                                                    <FormattedDatePicker value={field.value} onChange={field.onChange} placeholder="Select invoice date"/>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>)}/>

                                    <FormField control={form.control} name="dueDate" render={({ field }) => (<FormItem className="flex flex-col">
                                                <FormLabel>Due Date <span className="text-red-500">*</span></FormLabel>
                                                <FormControl>
                                                    <FormattedDatePicker value={field.value} onChange={field.onChange} placeholder="Select due date"/>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>)}/>
                                </div>

                                <FormField control={form.control} name="reference" render={({ field }) => (<FormItem>
                                            <FormLabel>Reference / PO #</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Optional client reference" {...field}/>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>)}/>

                                <FormField control={form.control} name="notes" render={({ field }) => (<FormItem>
                                            <FormLabel>Notes</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Additional notes for the client..." className="resize-none" {...field}/>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>)}/>
                            </div>
                        </FormCard>
                    </div>

                    {/* Right Column: Preview */}
                    <div>
                        <Card className="h-full border-dashed">
                            <CardHeader>
                                <CardTitle>Preview</CardTitle>
                                <CardDescription>
                                    {selectedTimesheet ? "Based on selected timesheet." : "Select a timesheet to preview."}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {selectedTimesheet ? (<div className="space-y-6">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="space-y-1">
                                                <span className="text-muted-foreground block text-xs uppercase tracking-wider">Customer</span>
                                                <span className="font-medium block">{selectedTimesheet.customer.companyName}</span>
                                            </div>

                                            <div className="space-y-1">
                                                <span className="text-muted-foreground block text-xs uppercase tracking-wider">Project</span>
                                                <span className="font-medium block">{selectedTimesheet.project?.name || "N/A"}</span>
                                            </div>

                                            <div className="space-y-1 col-span-2">
                                                <span className="text-muted-foreground block text-xs uppercase tracking-wider">Period</span>
                                                <span className="font-medium block">
                                                    {format(new Date(selectedTimesheet.periodStart), "MMM d, yyyy")} - {format(new Date(selectedTimesheet.periodEnd), "MMM d, yyyy")}
                                                </span>
                                            </div>
                                        </div>

                                        <Separator />

                                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-md border border-amber-200 dark:border-amber-800 text-sm">
                                            <p className="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                                                Important
                                            </p>
                                            <ul className="list-disc list-inside mt-2 space-y-1 text-amber-700 dark:text-amber-300 ml-1">
                                                <li>Creating this invoice will <strong>LOCK</strong> the timesheet ({selectedTimesheet.timesheetCode}).</li>
                                                <li>Values will be frozen and cannot be edited.</li>
                                                <li>To edit the timesheet later, you must delete this invoice.</li>
                                            </ul>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                            <div>
                                                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Total Hours</p>
                                                <p className="text-3xl font-bold">{selectedTimesheet.totalHours?.toFixed(1) || "0.0"}</p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Estimated Amount</p>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">Subtotal:</span>
                                                        <span className="flex items-center gap-1">
                                                            <CurrencySymbol symbol={currencySymbol} />
                                                            {selectedTimesheet.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                    {companySettings?.enableVat && (<div className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">VAT ({companySettings.vatPercentage}%):</span>
                                                            <span className="flex items-center gap-1">
                                                                <CurrencySymbol symbol={currencySymbol} />
                                                                {((selectedTimesheet.totalAmount || 0) * (companySettings.vatPercentage || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>)}
                                                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 pt-1 border-t flex items-center gap-1">
                                                        <CurrencySymbol symbol={currencySymbol} />
                                                        {((selectedTimesheet.totalAmount || 0) + (companySettings?.enableVat ? ((selectedTimesheet.totalAmount || 0) * (companySettings.vatPercentage || 0) / 100) : 0))
                                                            .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>) : (<div className="h-60 flex flex-col items-center justify-center text-muted-foreground bg-muted/30 rounded-md border-2 border-dashed">
                                        <FileText className="h-10 w-10 mb-2 opacity-20"/>
                                        <p>No timesheet selected</p>
                                    </div>)}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                <StickyFooter isSaving={isSaving} cancelLink="/invoices" saveLabel="Create Invoice"/>
            </form>

            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Create Invoice?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will <strong>CREATE</strong> an invoice and <strong>LOCK</strong> the selected timesheet.
                            <br /><br />
                            The timesheet items will be frozen and cannot be edited. Are you sure you want to continue?
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
        </Form>);
}