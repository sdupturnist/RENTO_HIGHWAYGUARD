"use client";
import { useRef, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Receipt, FolderKanban, FileText, Upload, Paperclip, X } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription, } from "@/app/Components/ui/form";
import { Input } from "@/app/Components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/app/Components/ui/select";
import { Button } from "@/app/Components/ui/button";
import { toast } from "sonner";
import { FormCard } from "@/app/Components/ui/form-card";
import { StickyFooter } from "@/app/Components/ui/sticky-footer";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

const projectSchema = z.object({
    name: z.string().min(1, "Project Name is required"),
    location: z.string().optional().nullable().or(z.literal("")),
    billingCycle: z.enum(["HOURLY", "DAILY"]),
    customerId: z.string().min(1, "Client is required"),
    status: z.enum(["ACTIVE", "INACTIVE", "COMPLETED"]).optional(),
    lpoNumber: z.string().optional().nullable().or(z.literal("")),
    fullDayHours: z.string().optional().nullable().or(z.literal("")),
    overtimeStartsAfter: z.string().optional().nullable().or(z.literal("")),
});

export function ProjectForm({ initialData }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const lpoFileInputRef = useRef(null);
    const [clients, setClients] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [lpoFile, setLpoFile] = useState(null);
    const [currentLpoPath, setCurrentLpoPath] = useState(initialData?.lpoAttachmentPath || null);
    const [currentLpoName, setCurrentLpoName] = useState(initialData?.lpoAttachmentName || null);

    const form = useForm({
        resolver: zodResolver(projectSchema),
        defaultValues: initialData ? {
            ...initialData,
            customerId: String(initialData.customerId),
            status: initialData.status || "ACTIVE",
            location: initialData.location || "",
            lpoNumber: initialData.lpoNumber || "",
            fullDayHours: initialData.fullDayHours !== null && initialData.fullDayHours !== undefined ? String(initialData.fullDayHours) : "",
            overtimeStartsAfter: initialData.overtimeStartsAfter !== null && initialData.overtimeStartsAfter !== undefined ? String(initialData.overtimeStartsAfter) : "",
        } : {
            name: "",
            location: "",
            billingCycle: "HOURLY",
            customerId: "",
            status: "ACTIVE",
            lpoNumber: "",
            fullDayHours: "",
            overtimeStartsAfter: "",
        },
    });

    useEffect(() => {
        const loadData = async () => {
            try {
                const [clientsRes, rulesRes] = await Promise.all([
                    fetch("/api/clients?status=ACTIVE"),
                    fetch("/api/config/project-code-rules")
                ]);
                if (clientsRes.ok) {
                    const clientsData = await clientsRes.json();
                    setClients(clientsData);
                }
                if (!initialData && rulesRes.ok) {
                    const rulesData = await rulesRes.json();
                    if (rulesData?.defaultBilling) {
                        form.setValue("billingCycle", rulesData.defaultBilling);
                    }
                }
            } catch (error) {
                console.error("Failed to load dependency data", error);
            }
        };
        loadData();
    }, [initialData, form]);

    const onSubmit = async (data) => {
        setIsSaving(true);
        try {
            const url = initialData ? `/api/projects/${initialData.id}` : "/api/projects";
            const method = initialData ? "PUT" : "POST";

            // For edit + new LPO file: upload first (ID known)
            let lpoAttachmentPath = currentLpoPath;
            let lpoAttachmentName = currentLpoName;
            if (initialData && lpoFile) {
                const fd = new FormData();
                fd.append("file", lpoFile);
                fd.append("folder", `projects/${initialData.id}/lpo`);
                const upRes = await fetch("/api/upload", { method: "POST", body: fd });
                if (upRes.ok) {
                    const { url: uploadedUrl } = await upRes.json();
                    lpoAttachmentPath = uploadedUrl;
                    lpoAttachmentName = lpoFile.name;
                }
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...data,
                    customerId: parseInt(data.customerId),
                    lpoNumber: data.lpoNumber || null,
                    lpoAttachmentPath,
                    lpoAttachmentName,
                    fullDayHours: data.fullDayHours && data.fullDayHours.trim() !== "" ? Number(data.fullDayHours) : null,
                    overtimeStartsAfter: data.overtimeStartsAfter && data.overtimeStartsAfter.trim() !== "" ? Number(data.overtimeStartsAfter) : null,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                toast.error(err.message || "Failed to save");
                return;
            }

            const project = await res.json();

            // For create + new LPO file: upload after getting project ID
            if (!initialData && lpoFile) {
                const fd = new FormData();
                fd.append("file", lpoFile);
                fd.append("folder", `projects/${project.id}/lpo`);
                const upRes = await fetch("/api/upload", { method: "POST", body: fd });
                if (upRes.ok) {
                    const { url: uploadedUrl } = await upRes.json();
                    await fetch(`/api/projects/${project.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            lpoAttachmentPath: uploadedUrl,
                            lpoAttachmentName: lpoFile.name,
                        }),
                    });
                }
            }

            await queryClient.invalidateQueries({ queryKey: ["projects"], refetchType: "all" });
            toast.success(initialData ? "Project updated" : "Project created");
            router.push(initialData ? `/projects/${initialData.id}` : "/projects");
            router.refresh();
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-24">
                <FormCard title="Project Details" description="Core information about the project." icon={FolderKanban}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="customerId" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Client <span className="text-red-500">*</span></FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!initialData}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select Client" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {clients.map(c => (<SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                                <FormDescription>Project must be linked to a client.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Project Name <span className="text-red-500">*</span></FormLabel>
                                <FormControl><Input {...field} placeholder="e.g. Downtown Expansion" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="location" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Location</FormLabel>
                                <FormControl><Input {...field} placeholder="Project Site Location" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                </FormCard>

                <FormCard title="Configuration" description="Set status and billing details." icon={Receipt}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="status" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="ACTIVE">Active</SelectItem>
                                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                                        <SelectItem value="COMPLETED">Completed</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="billingCycle" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Billing Cycle</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="HOURLY">Hourly Billing</SelectItem>
                                        <SelectItem value="DAILY">Daily Billing</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormDescription>Determines default invoice generation cycle.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="fullDayHours" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Standard Full Day Override (Hours)</FormLabel>
                                <FormControl>
                                    <Input {...field} type="number" step="0.5" placeholder="e.g. 8 (Leave empty for default)" />
                                </FormControl>
                                <FormDescription>Overrides the company default working hours per day.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="overtimeStartsAfter" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Overtime Starts After Override (Hours)</FormLabel>
                                <FormControl>
                                    <Input {...field} type="number" step="0.5" placeholder="e.g. 10 (Leave empty for default)" />
                                </FormControl>
                                <FormDescription>Overrides the hours after which operator overtime rates apply.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                </FormCard>

                <FormCard title="LPO Details" description="Attach the Letter of Purchase Order (optional)." icon={FileText}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="lpoNumber" render={({ field }) => (
                            <FormItem>
                                <FormLabel>LPO Number</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="e.g. LPO-2025-001" />
                                </FormControl>
                                <FormDescription>This will carry over to timesheets and invoices.</FormDescription>
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

                <StickyFooter isSaving={isSaving} cancelLink="/projects" />
            </form>
        </Form>
    );
}
