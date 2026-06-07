"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2, X, AlertTriangle, Calendar, Truck, Paperclip, Lock, Package, HardHat, Triangle, User, ChevronDown } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/app/Components/ui/form";
import { Input } from "@/app/Components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/Components/ui/select";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { Checkbox } from "@/app/Components/ui/checkbox";
import { Switch } from "@/app/Components/ui/switch";
import { Textarea } from "@/app/Components/ui/textarea";
import { Badge } from "@/app/Components/ui/badge";
import { toast } from "sonner";
import { FormCard } from "@/app/Components/ui/form-card";
import { StickyFooter } from "@/app/Components/ui/sticky-footer";
import { useRouter } from "next/navigation";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/app/Components/ui/dropdown-menu";

const attachmentSchema = z.object({
    name: z.string().min(1, "Attachment name required"),
    url: z.string().min(1, "File required"),
    remarks: z.string().optional().nullable(),
});

const blockSchema = z.object({
    id: z.coerce.number().optional(),
    blockType: z.enum(["VEHICLE", "OPERATOR", "MATERIAL", "LABOUR", "DETOUR"]).default("VEHICLE"),
    vehicleId: z.coerce.number().nullable().optional(),
    operatorId: z.coerce.number().nullable().optional(),
    withOperator: z.coerce.boolean().default(false),
    workType: z.string().nullable().optional(),
    materialId: z.coerce.number().nullable().optional(),
    labourTypeId: z.coerce.number().nullable().optional(),
    quantity: z.coerce.number().nullable().optional(),
    detourTemplateId: z.coerce.number().nullable().optional(),
    defaultHours: z.coerce.number().nullable().optional(),
    bundleBilling: z.coerce.boolean().default(false),
    detourChildren: z.array(z.object({
        id: z.coerce.number().optional(),
        blockType: z.enum(["VEHICLE", "OPERATOR", "MATERIAL", "LABOUR"]),
        vehicleId: z.coerce.number().nullable().optional(),
        operatorId: z.coerce.number().nullable().optional(),
        withOperator: z.coerce.boolean().default(false),
        workType: z.string().nullable().optional(),
        materialId: z.coerce.number().nullable().optional(),
        labourTypeId: z.coerce.number().nullable().optional(),
        quantity: z.coerce.number().nullable().optional(),
        billingCycle: z.enum(["HOURLY", "DAILY"]).nullable().optional(),
        enableAutoTimeLogs: z.coerce.boolean().default(true),
        plannedOvertimeHours: z.coerce.number().default(0),
        includeWeekendsForAutoLogs: z.coerce.boolean().default(false),
    })).optional().default([]),
    startDate: z.coerce.date({ message: "Start date required" }),
    endDate: z.coerce.date({ message: "End date required" }),
    billingCycle: z.enum(["HOURLY", "DAILY"]).nullable().optional(),
    enableAutoTimeLogs: z.coerce.boolean().default(true),
    plannedOvertimeHours: z.coerce.number().min(0).max(24).default(0),
    includeWeekendsForAutoLogs: z.coerce.boolean().default(false),
    hasTimeLogs: z.boolean().optional(),
});

const assignmentSchema = z.object({
    customerId: z.coerce.number().nullable().optional(),
    projectId: z.coerce.number().nullable().optional(),
    isInternal: z.coerce.boolean().default(false),
    startDate: z.coerce.date({ message: "Start date required" }),
    endDate: z.coerce.date({ message: "End date required" }),
    billingCycle: z.enum(["HOURLY", "DAILY"]).default("HOURLY"),
    status: z.enum(["DRAFT", "ACTIVE", "COMPLETED"]).default("ACTIVE"),
    enableAutoTimeLogs: z.coerce.boolean().default(true),
    blocks: z.array(blockSchema).min(1, "At least one block required"),
    attachments: z.array(attachmentSchema).optional().nullable(),
}).refine(d => d.isInternal || (d.customerId != null && d.customerId > 0), {
    message: "Customer is required for non-internal assignments",
    path: ["customerId"],
}).refine(d => d.isInternal || (d.projectId != null && d.projectId > 0), {
    message: "Project is required for non-internal assignments",
    path: ["projectId"],
});

const parseDate = (val) => {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
    const dmyMatch = String(val).match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (dmyMatch) {
        const date = new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]), 12, 0, 0);
        if (!isNaN(date.getTime())) return date;
    }
    return null;
};

const normalizeAttachmentRows = (attachments) => {
    if (!Array.isArray(attachments)) return undefined;
    return attachments
        .map(a => ({ ...a, name: a?.name ?? "", url: a?.url ?? "", remarks: a?.remarks ?? "" }))
        .filter(a => a.name.trim() || a.url.trim());
};

const normalizeFormValues = (values) => {
    const parentStart = parseDate(values.startDate);
    const parentEnd = parseDate(values.endDate);
    return {
        ...values,
        startDate: parentStart || values.startDate,
        endDate: parentEnd || values.endDate,
        attachments: normalizeAttachmentRows(values.attachments),
        blocks: Array.isArray(values.blocks)
            ? values.blocks.map((block) => ({
                ...block,
                startDate: parseDate(block.startDate) || parentStart || block.startDate,
                endDate: parseDate(block.endDate) || parentEnd || block.endDate,
                withOperator: Boolean(block.withOperator),
                enableAutoTimeLogs: Boolean(block.enableAutoTimeLogs),
                includeWeekendsForAutoLogs: Boolean(block.includeWeekendsForAutoLogs),
                detourChildren: (block.detourChildren || []).map(c => ({
                    ...c,
                    withOperator: Boolean(c.withOperator),
                    enableAutoTimeLogs: Boolean(c.enableAutoTimeLogs),
                    includeWeekendsForAutoLogs: Boolean(c.includeWeekendsForAutoLogs),
                })),
            }))
            : values.blocks,
    };
};

const BLOCK_TYPE_META = {
    VEHICLE: { label: "Vehicle Block", icon: Truck, color: "blue" },
    OPERATOR: { label: "Operator Block", icon: User, color: "purple" },
    MATERIAL: { label: "Material Block", icon: Package, color: "amber" },
    LABOUR: { label: "Labour Block", icon: HardHat, color: "green" },
    DETOUR: { label: "Detour Service", icon: Triangle, color: "orange" },
};

function defaultBlockForType(type, settings, watchStartDate) {
    const base = {
        blockType: type,
        startDate: watchStartDate || undefined,
        endDate: watchStartDate || undefined,
        enableAutoTimeLogs: settings?.defaultEnableAutoTimeLogs ?? true,
        plannedOvertimeHours: 0,
        includeWeekendsForAutoLogs: settings?.includeWeekendsForAutoLogs ?? false,
        hasTimeLogs: false,
        detourChildren: [],
    };
    if (type === "VEHICLE") return { ...base, withOperator: settings?.defaultWithOperator ?? false, billingCycle: null };
    if (type === "OPERATOR") return { ...base, billingCycle: null };
    if (type === "MATERIAL") return { ...base, quantity: 1, enableAutoTimeLogs: true };
    if (type === "LABOUR") return { ...base, quantity: 1, enableAutoTimeLogs: true };
    if (type === "DETOUR") return { ...base, defaultHours: 8, bundleBilling: false, billingCycle: null };
    return base;
}

export function AssignmentForm({ initialData, canSplit = false }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const formId = initialData ? `assignment-form-${initialData.id}` : "assignment-form-new";

    const [customers, setCustomers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [operators, setOperators] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [labours, setLabours] = useState([]);
    const [workTypes, setWorkTypes] = useState([]);

    const { data: detourTemplates = [] } = useQuery({
        queryKey: ["detour-templates"],
        queryFn: async () => {
            const res = await fetch("/api/detour-templates", { cache: "no-store" });
            if (!res.ok) return [];
            const data = await res.json();
            return data.filter(t => t.status === "ACTIVE");
        },
        staleTime: 0,
        refetchOnMount: "always",
    });
    const [uploading, setUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState(null);
    const [conflicts, setConflicts] = useState({});
    const [busyVehicleIds, setBusyVehicleIds] = useState(new Set());
    const [busyOperatorIds, setBusyOperatorIds] = useState(new Set());

    const form = useForm({
        resolver: zodResolver(assignmentSchema),
        defaultValues: initialData ? {
            customerId: initialData.customerId ?? undefined,
            projectId: initialData.projectId ?? undefined,
            isInternal: initialData.isInternal ?? false,
            startDate: new Date(initialData.startDate),
            endDate: new Date(initialData.endDate),
            billingCycle: initialData.billingCycle,
            status: initialData.status,
            enableAutoTimeLogs: initialData.enableAutoTimeLogs ?? true,
            blocks: (initialData.blocks || []).map(b => ({
                id: b.id,
                blockType: b.blockType ?? "VEHICLE",
                vehicleId: b.vehicleId ?? undefined,
                operatorId: b.operatorId ?? undefined,
                withOperator: !!b.withOperator,
                workType: b.workType ?? undefined,
                materialId: b.materialId ?? undefined,
                labourTypeId: b.labourTypeId ?? undefined,
                quantity: b.quantity ?? undefined,
                detourTemplateId: b.detourTemplateId ?? undefined,
                defaultHours: b.defaultHours ?? 8,
                bundleBilling: b.bundleBilling ?? false,
                detourChildren: (b.detourChildren || []).map(c => ({
                    id: c.id,
                    blockType: c.blockType ?? "VEHICLE",
                    vehicleId: c.vehicleId ?? undefined,
                    operatorId: c.operatorId ?? undefined,
                    withOperator: !!c.withOperator,
                    workType: c.workType ?? undefined,
                    materialId: c.materialId ?? undefined,
                    labourTypeId: c.labourTypeId ?? undefined,
                    quantity: c.quantity ?? undefined,
                    billingCycle: c.billingCycle ?? undefined,
                    enableAutoTimeLogs: c.enableAutoTimeLogs ?? true,
                    plannedOvertimeHours: c.plannedOvertimeHours ?? 0,
                    includeWeekendsForAutoLogs: c.includeWeekendsForAutoLogs ?? false,
                })),
                startDate: new Date(b.startDate),
                endDate: new Date(b.endDate),
                billingCycle: b.billingCycle ?? undefined,
                enableAutoTimeLogs: b.enableAutoTimeLogs ?? true,
                plannedOvertimeHours: b.plannedOvertimeHours ?? 0,
                includeWeekendsForAutoLogs: b.includeWeekendsForAutoLogs ?? false,
                hasTimeLogs: b.hasTimeLogs ?? false,
            })),
            attachments: initialData.attachments || [],
        } : {
            isInternal: false,
            billingCycle: "HOURLY",
            status: "ACTIVE",
            enableAutoTimeLogs: true,
            blocks: [],
            attachments: [],
        },
    });

    const { fields: blockFields, append: appendBlock, remove: removeBlock } = useFieldArray({
        control: form.control,
        name: "blocks",
        keyName: "_key",
    });

    const blockRefs = useRef([]);
    const prevBlockLengthRef = useRef(null);
    useEffect(() => {
        if (prevBlockLengthRef.current !== null && blockFields.length > prevBlockLengthRef.current) {
            const newEl = blockRefs.current[blockFields.length - 1];
            if (newEl) newEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        prevBlockLengthRef.current = blockFields.length;
    }, [blockFields.length]);
    const { fields: attachmentFields, append: appendAttachment, remove: removeAttachment } = useFieldArray({
        control: form.control,
        name: "attachments",
        keyName: "_key",
    });

    const watchCustomerId = form.watch("customerId");
    const watchIsInternal = form.watch("isInternal");
    const watchProjectId = form.watch("projectId");
    const watchStartDate = form.watch("startDate");
    const watchEndDate = form.watch("endDate");
    const watchBillingCycle = form.watch("billingCycle");

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [cRes, vRes, oRes, sRes, mRes, lRes, wtRes] = await Promise.all([
                    fetch("/api/clients"),
                    fetch("/api/vehicles"),
                    fetch("/api/operators"),
                    fetch("/api/settings/assignment"),
                    fetch("/api/materials"),
                    fetch("/api/labours"),
                    fetch("/api/settings/master/operator-work-types"),
                ]);
                if (cRes.ok) setCustomers(await cRes.json());
                if (vRes.ok) setVehicles((await vRes.json()).filter(v => v.status === "ACTIVE"));
                if (oRes.ok) setOperators((await oRes.json()).filter(o => o.status === "ACTIVE"));
                if (sRes.ok) {
                    const sd = await sRes.json();
                    setSettings(sd);
                    if (!initialData && sd.defaultBillingCycle) form.setValue("billingCycle", sd.defaultBillingCycle);
                }
                if (mRes.ok) setMaterials((await mRes.json()).filter(m => m.status === "ACTIVE"));
                if (lRes.ok) setLabours((await lRes.json()).filter(l => l.status === "ACTIVE"));
                if (wtRes.ok) setWorkTypes(await wtRes.json());
            } catch (error) {
                console.error("Error loading form data:", error);
                toast.error("Failed to load form data");
            }
        };
        fetchData();
    }, [initialData, form]);

    useEffect(() => {
        const loadProjects = async () => {
            if (watchCustomerId) {
                const res = await fetch(`/api/projects?customerId=${watchCustomerId}`);
                const data = await res.json();
                setProjects(data.filter(p => p.status === "ACTIVE"));
            } else {
                setProjects([]);
                form.setValue("projectId", undefined);
            }
        };
        loadProjects();
    }, [watchCustomerId, form]);

    useEffect(() => {
        if (!initialData && watchProjectId) {
            const selectedProj = projects.find(p => p.id === watchProjectId);
            if (selectedProj?.billingCycle) {
                form.setValue("billingCycle", selectedProj.billingCycle);
            }
        }
    }, [watchProjectId, projects, form, initialData]);

    useEffect(() => {
        if (!initialData && watchIsInternal) {
            if (settings?.defaultBillingCycle) {
                form.setValue("billingCycle", settings.defaultBillingCycle);
            }
        }
    }, [watchIsInternal, settings, form, initialData]);

    useEffect(() => {
        if (!watchStartDate || !watchEndDate) return;
        const fetchBusy = async () => {
            try {
                const params = new URLSearchParams({
                    startDate: watchStartDate.toISOString(),
                    endDate: watchEndDate.toISOString(),
                });
                if (initialData?.id) params.set("excludeAssignmentId", initialData.id);
                const res = await fetch(`/api/assignments/available-resources?${params}`);
                if (res.ok) {
                    const data = await res.json();
                    setBusyVehicleIds(new Set(data.busyVehicleIds || []));
                    setBusyOperatorIds(new Set(data.busyOperatorIds || []));
                }
            } catch {
                // non-critical, ignore
            }
        };
        fetchBusy();
    }, [watchStartDate, watchEndDate, initialData]);

    const checkAvailability = useCallback(async (blockIndex) => {
        const block = form.getValues(`blocks.${blockIndex}`);
        if (!block.startDate || !block.endDate) return;
        if (!block.vehicleId && !block.operatorId) return;
        try {
            const res = await fetch("/api/assignments/check-availability", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    vehicleId: block.vehicleId,
                    operatorId: block.operatorId,
                    startDate: block.startDate,
                    endDate: block.endDate,
                    includeWeekends: block.includeWeekendsForAutoLogs,
                    excludeAssignmentId: initialData?.id,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setConflicts(prev => ({ ...prev, [blockIndex]: data }));
            }
        } catch (e) {
            console.error("Availability check failed:", e);
        }
    }, [form, initialData]);

    const handleFileUpload = async (file) => {
        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        const folder = initialData?.id ? `assignment/${initialData.id}/attachments` : "assignment/new/attachments";
        formData.append("folder", folder);
        try {
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            if (res.ok) return (await res.json()).url;
            toast.error("File upload failed");
            return null;
        } catch {
            toast.error("Error uploading file");
            return null;
        } finally {
            setUploading(false);
        }
    };

    const onSubmit = async (data) => {
        setIsSaving(true);
        try {
            const url = initialData ? `/api/assignments/${initialData.id}` : "/api/assignments";
            const method = initialData ? "PUT" : "POST";
            const payload = {
                ...data,
                startDate: data.startDate.toISOString(),
                endDate: data.endDate.toISOString(),
                blocks: data.blocks.map(block => {
                    const { hasTimeLogs, ...apiBlock } = block;
                    return {
                        ...apiBlock,
                        startDate: block.startDate.toISOString(),
                        endDate: block.endDate.toISOString(),
                    };
                }),
            };
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                await queryClient.invalidateQueries({ queryKey: ["assignments"], refetchType: "all" });
                await queryClient.invalidateQueries({ queryKey: ["assignments-active"], refetchType: "all" });
                toast.success(initialData ? "Assignment updated" : "Assignment created");
                router.refresh();
                router.push("/assignments");
            } else {
                const error = await res.json();
                toast.error(error.message || "Failed to save assignment");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        const values = normalizeFormValues(form.getValues());
        const parsed = assignmentSchema.safeParse(values);
        if (!parsed.success) {
            const issues = Array.from(new Set(parsed.error.issues.map(i => i.message))).join(", ");
            toast.error(issues || "Please fix the highlighted errors before saving.");
            return;
        }

        // Frontend validation for duplicate/missing resources in same form submission
        try {
            const blocks = parsed.data.blocks || [];
            const allocations = [];

            for (let i = 0; i < blocks.length; i++) {
                const b = blocks[i];
                const blockType = b.blockType || "VEHICLE";

                if (blockType === "DETOUR") {
                    const children = b.detourChildren || [];
                    if (children.length === 0) {
                        throw new Error(`Detour Service #${i + 1} must have at least one resource slot.`);
                    }
                    for (let j = 0; j < children.length; j++) {
                        const child = children[j];
                        const childType = child.blockType;
                        if (childType === "VEHICLE") {
                            if (!child.vehicleId) {
                                throw new Error(`Resource selection is required: Detour Service #${i + 1} slot #${j + 1} (Vehicle) has no vehicle selected.`);
                            }
                            allocations.push({ type: "VEHICLE", id: child.vehicleId, source: `Detour Service #${i + 1} -> Vehicle Slot #${j + 1}` });
                            if (child.withOperator) {
                                if (!child.operatorId) {
                                    throw new Error(`Resource selection is required: Detour Service #${i + 1} slot #${j + 1} (Vehicle with Operator) has no operator selected.`);
                                }
                                allocations.push({ type: "OPERATOR", id: child.operatorId, source: `Detour Service #${i + 1} -> Operator in Vehicle Slot #${j + 1}` });
                            }
                        } else if (childType === "OPERATOR") {
                            if (!child.operatorId) {
                                throw new Error(`Resource selection is required: Detour Service #${i + 1} slot #${j + 1} (Operator) has no operator selected.`);
                            }
                            allocations.push({ type: "OPERATOR", id: child.operatorId, source: `Detour Service #${i + 1} -> Operator Slot #${j + 1}` });
                        } else if (childType === "MATERIAL" && !child.materialId) {
                            throw new Error(`Resource selection is required: Detour Service #${i + 1} slot #${j + 1} (Material) has no material selected.`);
                        } else if (childType === "LABOUR" && !child.labourTypeId) {
                            throw new Error(`Resource selection is required: Detour Service #${i + 1} slot #${j + 1} (Labour) has no labour type selected.`);
                        }
                    }
                } else if (blockType === "VEHICLE") {
                    if (!b.vehicleId) {
                        throw new Error(`Resource selection is required: Vehicle Block #${i + 1} has no vehicle selected.`);
                    }
                    allocations.push({ type: "VEHICLE", id: b.vehicleId, source: `Vehicle Block #${i + 1}` });
                    if (b.withOperator) {
                        if (!b.operatorId) {
                            throw new Error(`Resource selection is required: Vehicle Block #${i + 1} (With Operator) has no operator selected.`);
                        }
                        allocations.push({ type: "OPERATOR", id: b.operatorId, source: `Operator in Vehicle Block #${i + 1}` });
                    }
                } else if (blockType === "OPERATOR") {
                    if (!b.operatorId) {
                        throw new Error(`Resource selection is required: Operator Block #${i + 1} has no operator selected.`);
                    }
                    allocations.push({ type: "OPERATOR", id: b.operatorId, source: `Operator Block #${i + 1}` });
                } else if (blockType === "MATERIAL" && !b.materialId) {
                    throw new Error(`Resource selection is required: Material Block #${i + 1} has no material selected.`);
                } else if (blockType === "LABOUR" && !b.labourTypeId) {
                    throw new Error(`Resource selection is required: Labour Block #${i + 1} has no labour type selected.`);
                }
            }

            // Check duplicate resources inside this submission
            for (let i = 0; i < allocations.length; i++) {
                for (let j = i + 1; j < allocations.length; j++) {
                    if (allocations[i].type === allocations[j].type && allocations[i].id === allocations[j].id) {
                        throw new Error(`Double Booking: Same ${allocations[i].type.toLowerCase()} is assigned to both "${allocations[i].source}" and "${allocations[j].source}". Please resolve before saving.`);
                    }
                }
            }

        } catch (err) {
            toast.error(err.message);
            return;
        }

        await onSubmit(parsed.data);
    };

    return (
        <Form {...form}>
            <form id={formId} onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-8 pb-24">
                {/* Assignment Header */}
                <FormCard title="Assignment Details" description="Set customer, project, dates, and billing" icon={Calendar}>
                    <div className="space-y-4">
                        {/* Internal toggle */}
                        <FormField control={form.control} name="isInternal" render={({ field }) => (
                            <FormItem className="flex items-center gap-3 rounded-lg border p-3">
                                <FormControl>
                                    <Switch checked={field.value} onCheckedChange={val => {
                                        field.onChange(val);
                                        if (val) {
                                            form.setValue("customerId", undefined);
                                            form.setValue("projectId", undefined);
                                            setProjects([]);
                                        }
                                    }} />
                                </FormControl>
                                <div>
                                    <FormLabel className="text-base">Internal Assignment</FormLabel>
                                    <p className="text-xs text-muted-foreground">No customer required — used for yard work, training, depot moves, etc.</p>
                                </div>
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {!watchIsInternal && (
                                <FormField control={form.control} name="customerId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Customer <span className="text-red-500">*</span></FormLabel>
                                        <div className="flex gap-2">
                                            <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value?.toString()}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {customers.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.companyName}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            {field.value && (
                                                <Button type="button" variant="outline" size="icon" onClick={() => {
                                                    form.setValue("customerId", undefined);
                                                    form.setValue("projectId", undefined);
                                                    setProjects([]);
                                                }}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            )}

                            {!watchIsInternal && (
                                <FormField control={form.control} name="projectId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Project <span className="text-red-500">*</span></FormLabel>
                                        <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value?.toString()} disabled={!projects.length}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {projects.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            )}

                            <FormField control={form.control} name="startDate" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Start Date <span className="text-red-500">*</span></FormLabel>
                                    <FormControl>
                                        <FormattedDatePicker value={field.value} onChange={field.onChange} placeholder="Pick start date" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="endDate" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>End Date <span className="text-red-500">*</span></FormLabel>
                                    <FormControl>
                                        <FormattedDatePicker value={field.value} onChange={field.onChange} placeholder="Pick end date" minDate={watchStartDate} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="billingCycle" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Billing Cycle</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="HOURLY">Hourly</SelectItem>
                                            <SelectItem value="DAILY">Daily</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="DRAFT">Draft</SelectItem>
                                            <SelectItem value="ACTIVE">Active</SelectItem>
                                            {initialData && <SelectItem value="COMPLETED">Completed</SelectItem>}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                    </div>
                </FormCard>

                {/* Deployment Blocks */}
                <FormCard title="Deployment Blocks" description="Add vehicles, operators, materials, labour, or detour services" icon={Truck}>
                    <div className="space-y-4">
                        {blockFields.map((field, blockIndex) => (
                            <div key={field._key} ref={el => { blockRefs.current[blockIndex] = el; }}>
                                <BlockSection
                                    blockIndex={blockIndex}
                                    form={form}
                                    vehicles={vehicles}
                                    operators={operators}
                                    materials={materials}
                                    labours={labours}
                                    detourTemplates={detourTemplates}
                                    workTypes={workTypes}
                                    watchStartDate={watchStartDate}
                                    watchEndDate={watchEndDate}
                                    watchBillingCycle={watchBillingCycle}
                                    conflict={conflicts[blockIndex]}
                                    onCheckAvailability={() => checkAvailability(blockIndex)}
                                    onRemove={() => removeBlock(blockIndex)}
                                    settings={settings}
                                    canSplit={canSplit}
                                    busyVehicleIds={busyVehicleIds}
                                    busyOperatorIds={busyOperatorIds}
                                />
                            </div>
                        ))}

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button type="button" variant="outline">
                                    <Plus className="mr-2 h-4 w-4" /> Add Block <ChevronDown className="ml-2 h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                {Object.entries(BLOCK_TYPE_META).map(([type, meta]) => {
                                    const Icon = meta.icon;
                                    return (
                                        <DropdownMenuItem key={type} onClick={() => appendBlock(defaultBlockForType(type, settings, watchStartDate))}>
                                            <Icon className="mr-2 h-4 w-4" /> {meta.label}
                                        </DropdownMenuItem>
                                    );
                                })}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </FormCard>

                {/* Attachments */}
                <FormCard title="Assignment Attachments" description="Upload documents related to this assignment" icon={Paperclip}>
                    <div className="space-y-4">
                        {attachmentFields.map((field, index) => (
                            <AttachmentRow key={field._key} index={index} form={form} fieldPrefix="attachments" onRemove={() => removeAttachment(index)} onFileUpload={handleFileUpload} uploading={uploading} />
                        ))}
                        <Button type="button" variant="outline" onClick={() => appendAttachment({ name: "", url: "", remarks: "" })}>
                            <Plus className="mr-2 h-4 w-4" /> Add Attachment
                        </Button>
                    </div>
                </FormCard>

                <StickyFooter formId={formId} onSave={handleSave} isSaving={isSaving} cancelLink="/assignments" saveLabel={initialData ? "Update Assignment" : "Create Assignment"} />
            </form>
        </Form>
    );
}

// ─── Block dispatcher ─────────────────────────────────────────────────────────

function BlockSection({ blockIndex, form, ...props }) {
    const blockType = form.watch(`blocks.${blockIndex}.blockType`);
    const meta = BLOCK_TYPE_META[blockType] || BLOCK_TYPE_META.VEHICLE;
    const Icon = meta.icon;

    return (
        <div className="border rounded-lg overflow-hidden">
            <div className={`flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b`}>
                <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{meta.label} #{blockIndex + 1}</span>
                    <Badge variant="outline" className="text-xs">{blockType}</Badge>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={props.onRemove}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>

            <div className="p-4">
                {blockType === "VEHICLE" && <VehicleBlockFields blockIndex={blockIndex} form={form} {...props} />}
                {blockType === "OPERATOR" && <OperatorBlockFields blockIndex={blockIndex} form={form} {...props} />}
                {blockType === "MATERIAL" && <MaterialBlockFields blockIndex={blockIndex} form={form} {...props} />}
                {blockType === "LABOUR" && <LabourBlockFields blockIndex={blockIndex} form={form} {...props} />}
                {blockType === "DETOUR" && <DetourBlockFields blockIndex={blockIndex} form={form} {...props} />}
            </div>
        </div>
    );
}

// ─── VEHICLE block fields ────────────────────────────────────────────────────

function VehicleBlockFields({ blockIndex, form, vehicles, operators, workTypes, watchStartDate: propStart, watchEndDate: propEnd, watchBillingCycle, conflict, onCheckAvailability, settings, canSplit, busyVehicleIds, busyOperatorIds }) {
    const watchStart = form.watch("startDate") || propStart;
    const watchEnd = form.watch("endDate") || propEnd;
    const withOperator = form.watch(`blocks.${blockIndex}.withOperator`);
    const enableAuto = form.watch(`blocks.${blockIndex}.enableAutoTimeLogs`);
    const hasTimeLogs = form.watch(`blocks.${blockIndex}.hasTimeLogs`);
    const blockStart = form.watch(`blocks.${blockIndex}.startDate`);
    const blockEnd = form.watch(`blocks.${blockIndex}.endDate`);

    useEffect(() => {
        constrainBlockDates(form, blockIndex, watchStart, watchEnd, blockStart, blockEnd);
    }, [watchStart, watchEnd, blockStart, blockEnd, blockIndex, form]);

    return (
        <div className="space-y-4">
            {canSplit && hasTimeLogs && <TimeLogsWarning />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name={`blocks.${blockIndex}.vehicleId`} render={({ field }) => (
                    <FormItem>
                        <FormLabel>Vehicle</FormLabel>
                        <Select disabled={canSplit && hasTimeLogs} onValueChange={v => { field.onChange(parseInt(v)); onCheckAvailability(); }} value={field.value?.toString()}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger></FormControl>
                            <SelectContent>{vehicles.map(v => {
                                    const busy = busyVehicleIds?.has(v.id);
                                    return <SelectItem key={v.id} value={v.id.toString()} className={busy ? "text-orange-600 dark:text-orange-400" : ""}>{busy ? "⚠ " : ""}{v.vehicleCode} ({v.regNo || "No Reg"}) — {v.model?.name ?? ""}{busy ? " (Busy)" : ""}</SelectItem>;
                                })}</SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField control={form.control} name={`blocks.${blockIndex}.withOperator`} render={({ field }) => (
                    <FormItem className="flex items-start space-x-3 space-y-0 pt-8">
                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel>With Operator</FormLabel>
                    </FormItem>
                )} />

                {!!withOperator && (
                    <FormField control={form.control} name={`blocks.${blockIndex}.operatorId`} render={({ field }) => (
                        <FormItem>
                            <FormLabel>Operator</FormLabel>
                            <Select disabled={canSplit && hasTimeLogs} onValueChange={v => { field.onChange(parseInt(v)); onCheckAvailability(); }} value={field.value?.toString()}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select operator" /></SelectTrigger></FormControl>
                                <SelectContent>{operators.map(o => {
                                        const busy = busyOperatorIds?.has(o.id);
                                        return <SelectItem key={o.id} value={o.id.toString()} className={busy ? "text-orange-600 dark:text-orange-400" : ""}>{busy ? "⚠ " : ""}{o.name} ({o.operatorCode}){busy ? " (Busy)" : ""}</SelectItem>;
                                    })}</SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                )}

                {!!withOperator && workTypes.length > 0 && (
                    <FormField control={form.control} name={`blocks.${blockIndex}.workType`} render={({ field }) => (
                        <FormItem>
                            <FormLabel>Work Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select work type" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {workTypes.map(wt => <SelectItem key={wt.id} value={wt.name}>{wt.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                )}

                <BlockDateFields blockIndex={blockIndex} form={form} watchStart={watchStart} watchEnd={watchEnd} onCheckAvailability={onCheckAvailability} />
                <BillingCycleField blockIndex={blockIndex} form={form} watchBillingCycle={watchBillingCycle} />
                <AutoLogsField blockIndex={blockIndex} form={form} />
                {enableAuto && <OvertimeField blockIndex={blockIndex} form={form} />}
                {enableAuto && <WeekendsField blockIndex={blockIndex} form={form} settings={settings} />}
            </div>

            {conflict && (conflict.vehicleAvailable === false || conflict.operatorAvailable === false) && <ConflictWarning conflict={conflict} />}
        </div>
    );
}

// ─── OPERATOR block fields ────────────────────────────────────────────────────

function OperatorBlockFields({ blockIndex, form, operators, workTypes, watchStartDate: propStart, watchEndDate: propEnd, watchBillingCycle, conflict, onCheckAvailability, settings, busyOperatorIds }) {
    const watchStart = form.watch("startDate") || propStart;
    const watchEnd = form.watch("endDate") || propEnd;
    const enableAuto = form.watch(`blocks.${blockIndex}.enableAutoTimeLogs`);
    const blockStart = form.watch(`blocks.${blockIndex}.startDate`);
    const blockEnd = form.watch(`blocks.${blockIndex}.endDate`);

    useEffect(() => {
        constrainBlockDates(form, blockIndex, watchStart, watchEnd, blockStart, blockEnd);
    }, [watchStart, watchEnd, blockStart, blockEnd, blockIndex, form]);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name={`blocks.${blockIndex}.operatorId`} render={({ field }) => (
                    <FormItem>
                        <FormLabel>Operator <span className="text-red-500">*</span></FormLabel>
                        <Select onValueChange={v => { field.onChange(parseInt(v)); onCheckAvailability(); }} value={field.value?.toString()}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select operator" /></SelectTrigger></FormControl>
                            <SelectContent>{operators.map(o => {
                                    const busy = busyOperatorIds?.has(o.id);
                                    return <SelectItem key={o.id} value={o.id.toString()} className={busy ? "text-orange-600 dark:text-orange-400" : ""}>{busy ? "⚠ " : ""}{o.name} ({o.operatorCode}){busy ? " (Busy)" : ""}</SelectItem>;
                                })}</SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />

                {workTypes.length > 0 && (
                    <FormField control={form.control} name={`blocks.${blockIndex}.workType`} render={({ field }) => (
                        <FormItem>
                            <FormLabel>Work Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select work type" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {workTypes.map(wt => <SelectItem key={wt.id} value={wt.name}>{wt.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                )}

                <BlockDateFields blockIndex={blockIndex} form={form} watchStart={watchStart} watchEnd={watchEnd} onCheckAvailability={onCheckAvailability} />
                <BillingCycleField blockIndex={blockIndex} form={form} watchBillingCycle={watchBillingCycle} />
                <AutoLogsField blockIndex={blockIndex} form={form} />
                {enableAuto && <OvertimeField blockIndex={blockIndex} form={form} />}
                {enableAuto && <WeekendsField blockIndex={blockIndex} form={form} settings={settings} />}
            </div>
            {conflict && conflict.operatorAvailable === false && <ConflictWarning conflict={conflict} />}
        </div>
    );
}

// ─── MATERIAL block fields ────────────────────────────────────────────────────

function MaterialBlockFields({ blockIndex, form, materials, watchStartDate: propStart, watchEndDate: propEnd }) {
    const watchStart = form.watch("startDate") || propStart;
    const watchEnd = form.watch("endDate") || propEnd;
    const blockStart = form.watch(`blocks.${blockIndex}.startDate`);
    const blockEnd = form.watch(`blocks.${blockIndex}.endDate`);
    const materialId = form.watch(`blocks.${blockIndex}.materialId`);

    const selectedMaterial = materials.find(m => m.id === materialId);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name={`blocks.${blockIndex}.materialId`} render={({ field }) => (
                    <FormItem>
                        <FormLabel>Material <span className="text-red-500">*</span></FormLabel>
                        <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value?.toString()}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select material" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {materials.map(m => (
                                    <SelectItem key={m.id} value={m.id.toString()}>
                                        {m.name} (avail: {m.availableQty ?? "?"})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField control={form.control} name={`blocks.${blockIndex}.quantity`} render={({ field }) => (
                    <FormItem>
                        <FormLabel>Quantity <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                            <Input type="number" min="1" step="1" placeholder="0" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                        </FormControl>
                        {selectedMaterial && (
                            <FormDescription>Total: {selectedMaterial.totalQuantity} | Available: {selectedMaterial.availableQty}</FormDescription>
                        )}
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField control={form.control} name={`blocks.${blockIndex}.startDate`} render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Start Date <span className="text-red-500">*</span></FormLabel>
                        <FormControl><FormattedDatePicker value={field.value} onChange={field.onChange} placeholder="Start date" minDate={watchStart} maxDate={watchEnd} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField control={form.control} name={`blocks.${blockIndex}.endDate`} render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>End Date <span className="text-red-500">*</span></FormLabel>
                        <FormControl><FormattedDatePicker value={field.value} onChange={field.onChange} placeholder="End date" minDate={blockStart || watchStart} maxDate={watchEnd} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>
            <p className="text-xs text-muted-foreground">Material time logs are auto-generated (quantity-based, no hours tracking).</p>
        </div>
    );
}

// ─── LABOUR block fields ────────────────────────────────────────────────────

function LabourBlockFields({ blockIndex, form, labours, watchStartDate: propStart, watchEndDate: propEnd }) {
    const watchStart = form.watch("startDate") || propStart;
    const watchEnd = form.watch("endDate") || propEnd;
    const blockStart = form.watch(`blocks.${blockIndex}.startDate`);
    const labourTypeId = form.watch(`blocks.${blockIndex}.labourTypeId`);

    const selectedLabour = labours.find(l => l.id === labourTypeId);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name={`blocks.${blockIndex}.labourTypeId`} render={({ field }) => (
                    <FormItem>
                        <FormLabel>Labour Type <span className="text-red-500">*</span></FormLabel>
                        <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value?.toString()}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select labour type" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {labours.map(l => (
                                    <SelectItem key={l.id} value={l.id.toString()}>
                                        {l.labourType} (avail: {l.availableQty ?? "?"})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField control={form.control} name={`blocks.${blockIndex}.quantity`} render={({ field }) => (
                    <FormItem>
                        <FormLabel>Quantity <span className="text-red-500">*</span></FormLabel>
                        <FormControl>
                            <Input type="number" min="1" step="1" placeholder="0" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                        </FormControl>
                        {selectedLabour && (
                            <FormDescription>Total: {selectedLabour.totalQuantity} | Available: {selectedLabour.availableQty}</FormDescription>
                        )}
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField control={form.control} name={`blocks.${blockIndex}.startDate`} render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Start Date <span className="text-red-500">*</span></FormLabel>
                        <FormControl><FormattedDatePicker value={field.value} onChange={field.onChange} placeholder="Start date" minDate={watchStart} maxDate={watchEnd} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField control={form.control} name={`blocks.${blockIndex}.endDate`} render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>End Date <span className="text-red-500">*</span></FormLabel>
                        <FormControl><FormattedDatePicker value={field.value} onChange={field.onChange} placeholder="End date" minDate={blockStart || watchStart} maxDate={watchEnd} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>
            <p className="text-xs text-muted-foreground">Labour time logs are auto-generated (quantity-based, no hours tracking).</p>
        </div>
    );
}

// ─── DETOUR block fields ─────────────────────────────────────────────────────

function DetourBlockFields({ blockIndex, form, detourTemplates, vehicles, operators, materials, labours, workTypes, watchStartDate: propStart, watchEndDate: propEnd, watchBillingCycle, settings, busyVehicleIds, busyOperatorIds }) {
    const watchStart = form.watch("startDate") || propStart;
    const watchEnd = form.watch("endDate") || propEnd;
    const templateId = form.watch(`blocks.${blockIndex}.detourTemplateId`);
    const bundleBilling = form.watch(`blocks.${blockIndex}.bundleBilling`);
    const enableAuto = form.watch(`blocks.${blockIndex}.enableAutoTimeLogs`);
    const { fields: childFields, append: appendChild, remove: removeChild, replace: replaceChildren } = useFieldArray({
        control: form.control,
        name: `blocks.${blockIndex}.detourChildren`,
        keyName: "_key",
    });

    // Auto-populate children when template is selected
    useEffect(() => {
        if (!templateId) return;
        const template = detourTemplates.find(t => t.id === templateId);
        if (!template) return;

        const newChildren = [];
        // Add vehicle slots (count from template)
        for (let i = 0; i < (template.vehicleCount ?? 0); i++) {
            newChildren.push({ blockType: "VEHICLE", withOperator: false, enableAutoTimeLogs: true, plannedOvertimeHours: 0, includeWeekendsForAutoLogs: settings?.includeWeekendsForAutoLogs ?? false });
        }
        // Add operator slots (count from template)
        for (let i = 0; i < (template.operatorCount ?? 0); i++) {
            newChildren.push({ blockType: "OPERATOR", enableAutoTimeLogs: true, plannedOvertimeHours: 0, includeWeekendsForAutoLogs: settings?.includeWeekendsForAutoLogs ?? false });
        }
        // Auto-fill material requirements
        for (const req of template.requirements?.filter(r => r.resourceType === "MATERIAL") ?? []) {
            newChildren.push({ blockType: "MATERIAL", materialId: req.resourceId, quantity: req.quantity, enableAutoTimeLogs: true });
        }
        // Auto-fill labour requirements
        for (const req of template.requirements?.filter(r => r.resourceType === "LABOUR") ?? []) {
            newChildren.push({ blockType: "LABOUR", labourTypeId: req.resourceId, quantity: req.quantity, enableAutoTimeLogs: true });
        }

        // Set bundleBilling from template default and children
        form.setValue(`blocks.${blockIndex}.bundleBilling`, !!template.bundleCostEnabled);
        replaceChildren(newChildren);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [templateId]);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name={`blocks.${blockIndex}.detourTemplateId`} render={({ field }) => (
                    <FormItem className="col-span-2">
                        <FormLabel>Detour Template <span className="text-red-500">*</span></FormLabel>
                        <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value?.toString()}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {detourTemplates.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.templateCode} — {t.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField control={form.control} name={`blocks.${blockIndex}.startDate`} render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Start Date <span className="text-red-500">*</span></FormLabel>
                        <FormControl><FormattedDatePicker value={field.value} onChange={field.onChange} placeholder="Start date" minDate={watchStart} maxDate={watchEnd} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <FormField control={form.control} name={`blocks.${blockIndex}.endDate`} render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>End Date <span className="text-red-500">*</span></FormLabel>
                        <FormControl><FormattedDatePicker value={field.value} onChange={field.onChange} placeholder="End date" minDate={form.watch(`blocks.${blockIndex}.startDate`) || watchStart} maxDate={watchEnd} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />

                <BillingCycleField blockIndex={blockIndex} form={form} watchBillingCycle={watchBillingCycle} />

                <FormField control={form.control} name={`blocks.${blockIndex}.bundleBilling`} render={({ field }) => {
                    const selectedTemplate = detourTemplates.find(t => t.id === templateId);
                    const isBundleCostEnabled = !!selectedTemplate?.bundleCostEnabled;
                    return (
                        <FormItem className="flex items-start space-x-3 space-y-0 pt-8">
                            <FormControl>
                                <Checkbox 
                                    checked={field.value} 
                                    onCheckedChange={field.onChange} 
                                    disabled={!isBundleCostEnabled}
                                />
                            </FormControl>
                            <div>
                                <FormLabel className={!isBundleCostEnabled ? "text-muted-foreground" : ""}>Bundle Billing</FormLabel>
                                <FormDescription className="text-xs">
                                    {!isBundleCostEnabled ? "Not enabled on template" : "Invoice as one bundled line item"}
                                </FormDescription>
                            </div>
                        </FormItem>
                    );
                }} />

                <AutoLogsField blockIndex={blockIndex} form={form} />
                {enableAuto && <OvertimeField blockIndex={blockIndex} form={form} />}
                {enableAuto && <WeekendsField blockIndex={blockIndex} form={form} settings={settings} />}
            </div>

            {/* Detour child slots */}
            {childFields.length > 0 && (
                <div className="space-y-2 border rounded-lg p-3 bg-orange-50/30 dark:bg-orange-900/10">
                    <h5 className="text-sm font-medium text-orange-800 dark:text-orange-300">Resource Slots</h5>
                    {childFields.map((child, childIndex) => (
                        <DetourChildSlot
                            key={child._key}
                            blockIndex={blockIndex}
                            childIndex={childIndex}
                            form={form}
                            vehicles={vehicles}
                            operators={operators}
                            materials={materials}
                            labours={labours}
                            workTypes={workTypes}
                            templateLocked={!!templateId}
                            onRemove={() => removeChild(childIndex)}
                            busyVehicleIds={busyVehicleIds}
                            busyOperatorIds={busyOperatorIds}
                        />
                    ))}
                    {!templateId && (
                        <Button type="button" variant="outline" size="sm" onClick={() => appendChild({ blockType: "VEHICLE", withOperator: false, enableAutoTimeLogs: true, plannedOvertimeHours: 0, includeWeekendsForAutoLogs: false })}>
                            <Plus className="mr-1 h-3 w-3" /> Add Vehicle Slot
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

function DetourChildSlot({ blockIndex, childIndex, form, vehicles, operators, materials, labours, workTypes, templateLocked, onRemove, busyVehicleIds, busyOperatorIds }) {
    const childType = form.watch(`blocks.${blockIndex}.detourChildren.${childIndex}.blockType`);

    return (
        <div className="border rounded p-3 bg-white dark:bg-slate-900 space-y-3">
            <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">{childType}</Badge>
                {!templateLocked && (
                    <Button type="button" variant="ghost" size="sm" onClick={onRemove}><Trash2 className="h-3 w-3" /></Button>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {childType === "VEHICLE" && (
                    <FormField control={form.control} name={`blocks.${blockIndex}.detourChildren.${childIndex}.vehicleId`} render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs">Vehicle</FormLabel>
                            <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value?.toString()}>
                                <FormControl><SelectTrigger className="h-8"><SelectValue placeholder="Select vehicle" /></SelectTrigger></FormControl>
                                <SelectContent>{vehicles.map(v => {
                                    const busy = busyVehicleIds?.has(v.id);
                                    return <SelectItem key={v.id} value={v.id.toString()} className={busy ? "text-orange-600 dark:text-orange-400" : ""}>{busy ? "⚠ " : ""}{v.vehicleCode} ({v.regNo || "No Reg"}){busy ? " (Busy)" : ""}</SelectItem>;
                                })}</SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                )}
                {childType === "OPERATOR" && (
                    <>
                        <FormField control={form.control} name={`blocks.${blockIndex}.detourChildren.${childIndex}.operatorId`} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Operator</FormLabel>
                                <Select onValueChange={v => field.onChange(parseInt(v))} value={field.value?.toString()}>
                                    <FormControl><SelectTrigger className="h-8"><SelectValue placeholder="Select operator" /></SelectTrigger></FormControl>
                                    <SelectContent>{operators.map(o => {
                                        const busy = busyOperatorIds?.has(o.id);
                                        return <SelectItem key={o.id} value={o.id.toString()} className={busy ? "text-orange-600 dark:text-orange-400" : ""}>{busy ? "⚠ " : ""}{o.name}{busy ? " (Busy)" : ""}</SelectItem>;
                                    })}</SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        {workTypes.length > 0 && (
                            <FormField control={form.control} name={`blocks.${blockIndex}.detourChildren.${childIndex}.workType`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Work Type</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                        <FormControl><SelectTrigger className="h-8"><SelectValue placeholder="Work type" /></SelectTrigger></FormControl>
                                        <SelectContent>{workTypes.map(wt => <SelectItem key={wt.id} value={wt.name}>{wt.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        )}
                    </>
                )}
                {childType === "MATERIAL" && (
                    <>
                        <FormField control={form.control} name={`blocks.${blockIndex}.detourChildren.${childIndex}.materialId`} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Material</FormLabel>
                                <Select disabled={templateLocked} onValueChange={v => field.onChange(parseInt(v))} value={field.value?.toString()}>
                                    <FormControl><SelectTrigger className="h-8"><SelectValue placeholder="Select material" /></SelectTrigger></FormControl>
                                    <SelectContent>{materials.map(m => <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name={`blocks.${blockIndex}.detourChildren.${childIndex}.quantity`} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Quantity</FormLabel>
                                <FormControl><Input disabled={templateLocked} type="number" min="1" className="h-8" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                            </FormItem>
                        )} />
                    </>
                )}
                {childType === "LABOUR" && (
                    <>
                        <FormField control={form.control} name={`blocks.${blockIndex}.detourChildren.${childIndex}.labourTypeId`} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Labour Type</FormLabel>
                                <Select disabled={templateLocked} onValueChange={v => field.onChange(parseInt(v))} value={field.value?.toString()}>
                                    <FormControl><SelectTrigger className="h-8"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                                    <SelectContent>{labours.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.labourType}</SelectItem>)}</SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name={`blocks.${blockIndex}.detourChildren.${childIndex}.quantity`} render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Quantity</FormLabel>
                                <FormControl><Input disabled={templateLocked} type="number" min="1" className="h-8" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                            </FormItem>
                        )} />
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function BlockDateFields({ blockIndex, form, watchStart, watchEnd, onCheckAvailability }) {
    const blockStart = form.watch(`blocks.${blockIndex}.startDate`);

    return (
        <>
            <FormField control={form.control} name={`blocks.${blockIndex}.startDate`} render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Block Start Date <span className="text-red-500">*</span></FormLabel>
                    <FormControl><FormattedDatePicker value={field.value} onChange={d => { field.onChange(d); onCheckAvailability(); }} placeholder="Start date" minDate={watchStart} maxDate={watchEnd} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name={`blocks.${blockIndex}.endDate`} render={({ field }) => (
                <FormItem className="flex flex-col">
                    <FormLabel>Block End Date <span className="text-red-500">*</span></FormLabel>
                    <FormControl><FormattedDatePicker value={field.value} onChange={d => { field.onChange(d); onCheckAvailability(); }} placeholder="End date" minDate={blockStart || watchStart} maxDate={watchEnd} /></FormControl>
                    <FormMessage />
                </FormItem>
            )} />
        </>
    );
}

function BillingCycleField({ blockIndex, form, watchBillingCycle }) {
    return (
        <FormField control={form.control} name={`blocks.${blockIndex}.billingCycle`} render={({ field }) => (
            <FormItem>
                <FormLabel>Billing Cycle Override</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl><SelectTrigger><SelectValue placeholder={`Default (${watchBillingCycle})`} /></SelectTrigger></FormControl>
                    <SelectContent>
                        <SelectItem value="HOURLY">Hourly</SelectItem>
                        <SelectItem value="DAILY">Daily</SelectItem>
                    </SelectContent>
                </Select>
            </FormItem>
        )} />
    );
}

function AutoLogsField({ blockIndex, form }) {
    return (
        <FormField control={form.control} name={`blocks.${blockIndex}.enableAutoTimeLogs`} render={({ field }) => (
            <FormItem className="flex items-center space-x-3 space-y-0 pt-4 col-span-1 md:col-span-2">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <div>
                    <FormLabel className="flex items-center gap-2">Auto-generate Time Logs</FormLabel>
                </div>
            </FormItem>
        )} />
    );
}

function OvertimeField({ blockIndex, form }) {
    return (
        <FormField control={form.control} name={`blocks.${blockIndex}.plannedOvertimeHours`} render={({ field }) => (
            <FormItem>
                <FormLabel>Planned OT Hours/Day</FormLabel>
                <FormControl><Input type="number" step="0.5" min="0" max="24" placeholder="0" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                <FormMessage />
            </FormItem>
        )} />
    );
}

function WeekendsField({ blockIndex, form, settings }) {
    return (
        <FormField control={form.control} name={`blocks.${blockIndex}.includeWeekendsForAutoLogs`} render={({ field }) => (
            <FormItem className="flex items-center space-x-3 space-y-0 pt-4 col-span-1 md:col-span-2">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <div>
                    <FormLabel>Include Weekends</FormLabel>
                    <FormDescription className="text-xs">
                        Global default: {settings?.includeWeekendsForAutoLogs ? "ON" : "OFF"}
                    </FormDescription>
                </div>
            </FormItem>
        )} />
    );
}

function ConflictWarning({ conflict }) {
    return (
        <div className="bg-red-50 border border-red-200 rounded p-3">
            <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">
                    <p className="font-medium">Availability Conflict Detected</p>
                    {conflict.vehicleAvailable === false && <p>Vehicle is already assigned during this period</p>}
                    {conflict.operatorAvailable === false && <p>Operator is already assigned during this period</p>}
                </div>
            </div>
        </div>
    );
}

function TimeLogsWarning() {
    return (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-2">
            <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <p className="text-sm text-amber-800">Daily logs exist for this block. Use <strong>Replace Vehicle</strong> or <strong>Change Operator</strong> on the Assignment View page to change resources.</p>
            </div>
        </div>
    );
}

function AttachmentRow({ index, form, fieldPrefix, onRemove, onFileUpload, uploading }) {
    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = await onFileUpload(file, fieldPrefix);
        if (url) {
            form.setValue(`${fieldPrefix}.${index}.url`, url);
            if (!form.getValues(`${fieldPrefix}.${index}.name`)) {
                form.setValue(`${fieldPrefix}.${index}.name`, file.name);
            }
        }
    };

    const fileUrl = form.watch(`${fieldPrefix}.${index}.url`);

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end border p-4 rounded-lg bg-slate-50/50">
            <div className="md:col-span-4">
                <FormField control={form.control} name={`${fieldPrefix}.${index}.name`} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-xs">Document Name</FormLabel>
                        <FormControl>
                            <Input {...field} placeholder="e.g. Contract Agreement" className="h-9" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>
            <div className="md:col-span-3">
                <FormField control={form.control} name={`${fieldPrefix}.${index}.url`} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-xs">Upload File</FormLabel>
                        <FormControl>
                            <Input 
                                type="file" 
                                onChange={handleFileChange} 
                                disabled={uploading} 
                                className="text-xs h-9 cursor-pointer file:cursor-pointer file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:text-xs file:font-semibold file:h-full file:mr-3 file:px-4 file:text-slate-700 dark:file:text-slate-300 hover:file:bg-slate-200 dark:hover:file:bg-slate-700 file:transition-colors p-0 overflow-hidden" 
                            />
                        </FormControl>
                        {fileUrl && (
                            <p className="text-[10px] text-green-600 mt-1 truncate">
                                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                    Uploaded: {fileUrl.split("/").pop()}
                                </a>
                            </p>
                        )}
                        <FormMessage />
                    </FormItem>
                )} />
            </div>
            <div className="md:col-span-4">
                <FormField control={form.control} name={`${fieldPrefix}.${index}.remarks`} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-xs">Remarks (Optional)</FormLabel>
                        <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="Add comments..." className="h-9" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>
            <div className="md:col-span-1 flex justify-end">
                <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={onRemove} 
                    className="hover:bg-red-100 hover:text-red-600 h-9 w-9 text-destructive"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function constrainBlockDates(form, blockIndex, watchStart, watchEnd, blockStart, blockEnd) {
    const pStart = parseDate(watchStart);
    const pEnd = parseDate(watchEnd);
    const bStart = parseDate(blockStart);
    const bEnd = parseDate(blockEnd);

    if (!bStart && pStart) { form.setValue(`blocks.${blockIndex}.startDate`, pStart); return; }
    if (!bEnd && pEnd) { form.setValue(`blocks.${blockIndex}.endDate`, pEnd); return; }
    if (pStart && bStart && bStart < pStart) form.setValue(`blocks.${blockIndex}.startDate`, pStart);
    if (pEnd && bStart && bStart > pEnd) form.setValue(`blocks.${blockIndex}.startDate`, pEnd);
    if (pStart && bEnd && bEnd < pStart) form.setValue(`blocks.${blockIndex}.endDate`, pStart);
    if (pEnd && bEnd && bEnd > pEnd) form.setValue(`blocks.${blockIndex}.endDate`, pEnd);
    if (bStart && bEnd && bEnd < bStart) form.setValue(`blocks.${blockIndex}.endDate`, bStart);
}
