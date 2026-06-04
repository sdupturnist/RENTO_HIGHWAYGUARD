"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Banknote, FileText, Link as LinkIcon, Upload, Paperclip, X } from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, } from "@/app/Components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/app/Components/ui/select";
import { Input } from "@/app/Components/ui/input";
import { Button } from "@/app/Components/ui/button";
import { Textarea } from "@/app/Components/ui/textarea";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { toast } from "sonner";
import { FormCard } from "@/app/Components/ui/form-card";
import { StickyFooter } from "@/app/Components/ui/sticky-footer";

const expenseSchema = z.object({
    expenseTypeId: z.string().min(1, "Expense type is required"),
    date: z.date({
        required_error: "Date is required",
    }),
    amount: z.string().min(1, "Amount is required"),
    status: z.enum(["DRAFT", "CONFIRMED"]).optional(),

    // Associations
    vehicleId: z.string().optional(),
    operatorId: z.string().optional(),
    projectId: z.string().optional(),
    assignmentId: z.string().optional(),

    // Additional Details
    description: z.string().optional(),
});

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function ExpenseForm({ initialData, isEdit = false }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const fileInputRef = useRef(null);
    const [pendingFile, setPendingFile] = useState(null);
    const [currentAttachmentUrl, setCurrentAttachmentUrl] = useState(initialData?.attachmentUrl || null);

    // Form instance
    const form = useForm({
        resolver: zodResolver(expenseSchema),
        defaultValues: {
            expenseTypeId: initialData?.expenseTypeId?.toString() || "",
            date: initialData?.date ? new Date(initialData.date) : new Date(),
            amount: initialData?.amount?.toString() || "",
            status: initialData?.status || "DRAFT",
            vehicleId: initialData?.vehicleId?.toString() || "",
            operatorId: initialData?.operatorId?.toString() || "",
            projectId: initialData?.projectId?.toString() || "",
            assignmentId: initialData?.assignmentId?.toString() || "",
            description: initialData?.description || "",
        },
    });

    const selectedProjectId = form.watch("projectId");

    // Queries
    const { data: expenseTypes = [] } = useQuery({
        queryKey: ["config", "expense-types"],
        queryFn: () => fetch('/api/settings/master/expense').then(res => res.json()),
        staleTime: 5 * 60 * 1000,
    });

    const { data: vehiclesData } = useQuery({
        queryKey: ["vehicles"],
        queryFn: () => fetch('/api/vehicles').then(res => res.json()),
        staleTime: 30 * 1000,
    });
    const vehicles = vehiclesData?.vehicles || vehiclesData?.items || (Array.isArray(vehiclesData) ? vehiclesData : []);

    const { data: operatorsData } = useQuery({
        queryKey: ["operators"],
        queryFn: () => fetch('/api/operators').then(res => res.json()),
        staleTime: 30 * 1000,
    });
    const operators = operatorsData?.operators || operatorsData?.items || (Array.isArray(operatorsData) ? operatorsData : []);

    const { data: projectsData } = useQuery({
        queryKey: ["projects"],
        queryFn: () => fetch('/api/projects').then(res => res.json()),
        staleTime: 30 * 1000,
    });
    const projects = projectsData?.projects || projectsData?.items || (Array.isArray(projectsData) ? projectsData : []);

    const { data: assignmentsData } = useQuery({
        queryKey: ["assignments", "active", selectedProjectId],
        queryFn: async () => {
            const url = selectedProjectId && selectedProjectId !== "NONE" 
                ? `/api/assignments?projectId=${selectedProjectId}&status=ACTIVE` 
                : `/api/assignments?status=ACTIVE`;
            const res = await fetch(url);
            return res.json();
        },
        staleTime: 30 * 1000,
    });
    const assignments = assignmentsData?.assignments || (Array.isArray(assignmentsData) ? assignmentsData : []);

    const { mutate: saveExpense, isPending: loading } = useMutation({
        mutationFn: async (data) => {
            const buildPayload = (attachmentUrl) => ({
                expenseTypeId: parseInt(data.expenseTypeId),
                date: data.date.toISOString(),
                amount: parseFloat(data.amount),
                status: data.status,
                vehicleId: data.vehicleId && data.vehicleId !== "NONE" ? parseInt(data.vehicleId) : null,
                operatorId: data.operatorId && data.operatorId !== "NONE" ? parseInt(data.operatorId) : null,
                projectId: data.projectId && data.projectId !== "NONE" ? parseInt(data.projectId) : null,
                assignmentId: data.assignmentId && data.assignmentId !== "NONE" ? parseInt(data.assignmentId) : null,
                description: data.description,
                attachmentUrl: attachmentUrl || null,
            });

            // For edit with new file: upload first (ID already known)
            let finalAttachmentUrl = currentAttachmentUrl;
            if (isEdit && pendingFile) {
                const fd = new FormData();
                fd.append("file", pendingFile);
                fd.append("folder", `expenses/${initialData.id}/attachments`);
                const upRes = await fetch("/api/upload", { method: "POST", body: fd });
                if (upRes.ok) finalAttachmentUrl = (await upRes.json()).url;
            }

            const url = isEdit ? `/api/expenses/${initialData.id}` : "/api/expenses";
            const method = isEdit ? "PUT" : "POST";
            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildPayload(finalAttachmentUrl)),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || "Something went wrong");
            }
            const expense = await response.json();

            // For create with new file: upload after getting the ID
            if (!isEdit && pendingFile) {
                const fd = new FormData();
                fd.append("file", pendingFile);
                fd.append("folder", `expenses/${expense.id}/attachments`);
                const upRes = await fetch("/api/upload", { method: "POST", body: fd });
                if (upRes.ok) {
                    const { url: uploadedUrl } = await upRes.json();
                    await fetch(`/api/expenses/${expense.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(buildPayload(uploadedUrl)),
                    });
                }
            }
            return expense;
        },
        onSuccess: async () => {
            toast.success(isEdit ? "Expense updated successfully" : "Expense recorded successfully");
            await queryClient.invalidateQueries({ queryKey: ["expenses"], refetchType: "all" });
            router.refresh();
            router.push("/expenses");
        },
        onError: (error) => {
            toast.error(error.message);
        }
    });

    const onSubmit = (data) => {
        saveExpense(data);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-24">
                <div className="grid gap-6 md:grid-cols-2">

                    {/* Section 1: Basic Details */}
                    <FormCard title="Basic Details" description="Core expense information" icon={Banknote}>
                        <div className="grid gap-6">
                            <FormField control={form.control} name="expenseTypeId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Expense Type <span className="text-red-500">*</span></FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {expenseTypes.filter(t => t.isActive).map((type) => (
                                                <SelectItem key={type.id} value={type.id.toString()}>{type.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <div className="grid grid-cols-2 gap-6">
                                <FormField control={form.control} name="date" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Date <span className="text-red-500">*</span></FormLabel>
                                        <FormControl>
                                            <FormattedDatePicker value={field.value} onChange={field.onChange} placeholder="Pick a date" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="amount" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Amount (AED) <span className="text-red-500">*</span></FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

                            <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="DRAFT">Draft</SelectItem>
                                            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                    </FormCard>

                    {/* Section 2: Associations */}
                    <FormCard title="Associations" description="Link this expense to specific entities" icon={LinkIcon}>
                        <div className="grid gap-6">
                            <FormField control={form.control} name="vehicleId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Vehicle (Optional)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select vehicle" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="NONE">None</SelectItem>
                                            {vehicles.map((v) => (
                                                <SelectItem key={v.id} value={v.id.toString()}>{v.vehicleCode}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="operatorId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Operator (Optional)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select operator" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="NONE">None</SelectItem>
                                            {operators.map((o) => (
                                                <SelectItem key={o.id} value={o.id.toString()}>{o.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="projectId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Project (Optional)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select project" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="NONE">None</SelectItem>
                                            {projects.map((p) => (
                                                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="assignmentId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Assignment (Optional)</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select assignment" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="NONE">None</SelectItem>
                                            {assignments.map((a) => (
                                                <SelectItem key={a.id} value={a.id.toString()}>{a.assignmentCode}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>Filter by project above to narrow down.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                    </FormCard>
                </div>

                {/* Section 3: Additional Details */}
                <FormCard title="Additional Information" description="Provide descriptions or attachments" icon={FileText}>
                    <div className="grid gap-6 md:grid-cols-2">
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Description / Remarks</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Enter details..." className="resize-none h-32" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormItem>
                            <FormLabel>Receipt / Attachment (Optional)</FormLabel>
                            <div className="flex flex-col gap-2">
                                {currentAttachmentUrl && !pendingFile && (
                                    <div className="flex items-center gap-2 text-sm border rounded-md p-2 bg-muted/40">
                                        <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <span className="truncate flex-1 text-muted-foreground">
                                            {currentAttachmentUrl.split("/").pop()}
                                        </span>
                                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setCurrentAttachmentUrl(null)}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )}
                                {pendingFile && (
                                    <div className="flex items-center gap-2 text-sm border border-blue-200 rounded-md p-2 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
                                        <Paperclip className="h-4 w-4 text-blue-500 shrink-0" />
                                        <span className="truncate flex-1 text-blue-700 dark:text-blue-300">{pendingFile.name}</span>
                                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setPendingFile(null)}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )}
                                {!currentAttachmentUrl && !pendingFile && (
                                    <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                                        <Upload className="mr-2 h-4 w-4" /> Upload Receipt
                                    </Button>
                                )}
                                {(currentAttachmentUrl || pendingFile) && (
                                    <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => fileInputRef.current?.click()}>
                                        <Upload className="mr-2 h-3 w-3" /> Replace File
                                    </Button>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                    onChange={(e) => { setPendingFile(e.target.files?.[0] || null); e.target.value = ""; }}
                                />
                            </div>
                            <FormDescription>PDF, image, or document up to 10 MB.</FormDescription>
                        </FormItem>
                    </div>
                </FormCard>

                <StickyFooter
                    isSaving={loading}
                    onCancel={() => router.back()}
                    saveLabel={isEdit ? "Update Expense" : "Record Expense"}
                />
            </form>
        </Form>
    );
}
