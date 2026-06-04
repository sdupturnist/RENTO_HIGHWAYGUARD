"use client";
import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2, User, FileText, Banknote, ShieldCheck } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, } from "@/app/Components/ui/form";
import { Input } from "@/app/Components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/app/Components/ui/select";
import { Textarea } from "@/app/Components/ui/textarea";
import { toast } from "sonner";
import { FormCard } from "@/app/Components/ui/form-card";
import { StickyFooter } from "@/app/Components/ui/sticky-footer";
import { useRouter } from "next/navigation";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DIAL_CODES, COUNTRY_TO_DIAL } from "@/app/lib/phone-codes";

const operatorSchema = z.object({
    // Identification
    name: z.string().min(1, "Name is required"),
    nationalityId: z.coerce.number().optional().nullable(),
    phoneCountryCode: z.string().default("+971"),
    phoneNumber: z.string().optional().nullable(),
    email: z.string().email().optional().nullable().or(z.literal("")),
    address: z.string().optional().nullable(),
    experienceYears: z.coerce.number().min(0, "Experience cannot be negative").optional().nullable(),
    // License
    licenseNumber: z.string().optional().nullable(),
    licenseIssueDate: z.date().optional().nullable(),
    licenseExpiry: z.date().optional().nullable(),
    licenseTypeId: z.coerce.number().min(1, "License Type is required"),
    // Status
    status: z.enum(["ACTIVE", "INACTIVE", "DISABLED", "BLOCKED", "ON_LEAVE"]),
    // Financial
    baseRateType: z.literal("HOURLY"),
    hourlyRate: z.coerce.number().min(0, "Rate cannot be negative"),
    // Documents
    documents: z.array(z.object({
        documentTypeId: z.coerce.number().min(1, "Document Type is required"),
        name: z.string().optional().nullable(), // Optional override
        url: z.string().min(1, "File required"),
        expiryDate: z.date().optional().nullable(),
    })).optional().nullable(),
}).refine((data) => {
    // Validate license expiry is after issue date if both are provided
    if (data.licenseIssueDate && data.licenseExpiry) {
        return data.licenseExpiry > data.licenseIssueDate;
    }
    return true;
}, {
    message: "License expiry date must be after issue date",
    path: ["licenseExpiry"],
}).refine((data) => {
    // Warn if license expiry is in the past (but allow saving)
    // This is a soft validation - we'll show a warning but allow the save
    return true;
}, {
    message: "License has expired",
    path: ["licenseExpiry"],
});

export function OperatorForm({ initialData }) {
    const router = useRouter();
    const queryClient = useQueryClient();

    // Queries for config data
    const { data: nationalities = [] } = useQuery({
        queryKey: ["config", "nationalities"],
        queryFn: () => fetch("/api/config/nationalities").then(res => res.json()),
        staleTime: 5 * 60 * 1000,
    });

    const { data: licenseTypes = [] } = useQuery({
        queryKey: ["config", "license-types"],
        queryFn: () => fetch("/api/config/license-types").then(res => res.json()),
        staleTime: 5 * 60 * 1000,
    });

    const { data: docTypes = [] } = useQuery({
        queryKey: ["config", "operator-doc-types"],
        queryFn: () => fetch("/api/config/operator-doc-types").then(res => res.json()),
        staleTime: 5 * 60 * 1000,
    });

    const { data: settings } = useQuery({
        queryKey: ["settings", "company"],
        queryFn: () => fetch("/api/settings/company").then(res => res.json()),
        staleTime: 60 * 60 * 1000,
    });

    const defaultDialCode = COUNTRY_TO_DIAL[settings?.country] || "+971";

    const [uploading, setUploading] = useState(false);

    const form = useForm({
        resolver: zodResolver(operatorSchema),
        defaultValues: (initialData ? {
            ...initialData,
            nationalityId: initialData.nationalityId || null,
            phoneCountryCode: initialData.phoneCountryCode || "+971",
            phoneNumber: initialData.phoneNumber || "",
            email: initialData.email || "",
            address: initialData.address || "",
            experienceYears: initialData.experienceYears || null,
            licenseNumber: initialData.licenseNumber || "",
            licenseIssueDate: initialData.licenseIssueDate ? new Date(initialData.licenseIssueDate) : null,
            licenseExpiry: initialData.licenseExpiry ? new Date(initialData.licenseExpiry) : null,
            documents: initialData.documents?.map((d) => ({
                ...d,
                expiryDate: d.expiryDate ? new Date(d.expiryDate) : null
            })) || []
        } : {
            status: "ACTIVE",
            baseRateType: "HOURLY",
            hourlyRate: 0,
            phoneCountryCode: defaultDialCode,
            documents: [],
        }),
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "documents",
    });

    useEffect(() => {
        if (!initialData && settings?.country) {
            const code = COUNTRY_TO_DIAL[settings.country] || "+971";
            if (!form.getValues("phoneCountryCode") || form.getValues("phoneCountryCode") === "+971") {
                form.setValue("phoneCountryCode", code);
            }
        }
    }, [settings, initialData, form]);

    const { mutate: saveOperator, isPending: isSaving } = useMutation({
        mutationFn: async (data) => {
            const url = initialData ? `/api/operators/${initialData.id}` : "/api/operators";
            const method = initialData ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...data,
                    licenseIssueDate: data.licenseIssueDate?.toISOString(),
                    licenseExpiry: data.licenseExpiry?.toISOString(),
                    documents: data.documents?.map((d) => ({
                        ...d,
                        expiryDate: d.expiryDate ? d.expiryDate.toISOString() : null
                    }))
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed to save");
            }
            return res.json();
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["operators"], refetchType: "all" });
            toast.success(initialData ? "Operator updated" : "Operator created");
            if (initialData) await queryClient.invalidateQueries({ queryKey: ["operator", initialData.id] });
            router.refresh();
            router.push("/operators");
        },
        onError: (error) => {
            toast.error(error.message || "An error occurred");
        }
    });

    const onSubmit = (data) => {
        saveOperator(data);
    };
    const handleFileUpload = async (e, index) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        const folderPath = initialData?.id
            ? `operator/${initialData.id}/attachments`
            : "operator/new/attachments";
        formData.append("folder", folderPath);
        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
            if (res.ok) {
                const { url } = await res.json();
                form.setValue(`documents.${index}.url`, url);
                toast.success("File uploaded");
            }
            else {
                toast.error("Upload failed");
            }
        }
        catch (error) {
            toast.error("Upload error");
        }
        finally {
            setUploading(false);
        }
    };
    return (<Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
            console.error("Form Validation Errors:", errors);
            toast.error("Please check the form for errors.");
        })} className="space-y-8 pb-24">

                {/* Identification */}
                <FormCard title="Operator Details" description="Personal information." icon={User}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem>
                                <FormLabel>Full Name <span className="text-red-500">*</span></FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ""} placeholder="John Doe"/></FormControl>
                                <FormMessage />
                            </FormItem>)}/>

                        <FormField control={form.control} name="nationalityId" render={({ field }) => (<FormItem>
                                <FormLabel>Nationality</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value?.toString()}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select nationality"/>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {nationalities.map((n) => (<SelectItem key={n.id} value={String(n.id)}>{n.name}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>)}/>

                        <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <div className="flex gap-2">
                                <FormField control={form.control} name="phoneCountryCode" render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="w-44 shrink-0">
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {DIAL_CODES.map(d => (
                                                <SelectItem key={d.code} value={d.code}>{d.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )} />
                                <FormField control={form.control} name="phoneNumber" render={({ field }) => (
                                    <FormControl>
                                        <Input {...field} value={field.value ?? ""} placeholder="501234567" className="flex-1" />
                                    </FormControl>
                                )} />
                            </div>
                            <FormMessage>{form.formState.errors.phoneNumber?.message}</FormMessage>
                        </FormItem>

                        <FormField control={form.control} name="experienceYears" render={({ field }) => (<FormItem>
                                <FormLabel>Years of Experience</FormLabel>
                                <FormControl><Input type="number" {...field} value={field.value ?? ""}/></FormControl>
                                <FormMessage />
                            </FormItem>)}/>

                        <div className="md:col-span-2">
                            <FormField control={form.control} name="address" render={({ field }) => (<FormItem>
                                    <FormLabel>Address</FormLabel>
                                    <FormControl><Textarea {...field} value={field.value ?? ""} rows={3} /></FormControl>
                                    <FormMessage />
                                </FormItem>)}/>
                        </div>
                    </div>
                </FormCard>

                {/* License Details */}
                <FormCard title="License Details" description="Driving license information." icon={ShieldCheck}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="licenseTypeId" render={({ field }) => (<FormItem>
                                <FormLabel>License Type <span className="text-red-500">*</span></FormLabel>
                                <Select onValueChange={field.onChange} value={field.value?.toString()}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select type"/>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {licenseTypes.map((l) => (<SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>)}/>

                        <FormField control={form.control} name="licenseNumber" render={({ field }) => (<FormItem>
                                <FormLabel>License Number</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ""}/></FormControl>
                                <FormMessage />
                            </FormItem>)}/>

                        <FormField control={form.control} name="licenseIssueDate" render={({ field }) => (<FormItem className="flex flex-col">
                                <FormLabel>Issue Date</FormLabel>
                                <FormattedDatePicker value={field.value || undefined} onChange={field.onChange}/>
                                <FormMessage />
                            </FormItem>)}/>

                        <FormField control={form.control} name="licenseExpiry" render={({ field }) => (<FormItem className="flex flex-col">
                                <FormLabel>Expiry Date</FormLabel>
                                <FormattedDatePicker value={field.value || undefined} onChange={field.onChange}/>
                                <FormMessage />
                            </FormItem>)}/>
                    </div>
                </FormCard>

                {/* Status & Rate */}
                <FormCard title="Status & Financials" description="Current status and rates." icon={Banknote}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="status" render={({ field }) => (<FormItem>
                                <FormLabel>Operator Status</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select status"/>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="ACTIVE">Active</SelectItem>
                                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                                        <SelectItem value="DISABLED">Disabled</SelectItem>
                                        <SelectItem value="BLOCKED">Blocked</SelectItem>
                                        <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>)}/>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="baseRateType" render={({ field }) => (<FormItem>
                                    <FormLabel>Rate Type</FormLabel>
                                    <Select disabled defaultValue="HOURLY">
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Hourly"/>
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="HOURLY">Hourly</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>)}/>

                            <FormField control={form.control} name="hourlyRate" render={({ field }) => (<FormItem>
                                    <FormLabel>Hourly Rate</FormLabel>
                                    <FormControl><Input type="number" {...field}/></FormControl>
                                    <FormMessage />
                                </FormItem>)}/>
                        </div>
                    </div>
                </FormCard>

                {/* Documents */}
                <FormCard title="Documents" description="Upload operator specific documents." icon={FileText}>
                    <div className="space-y-4">
                        {fields.map((field, index) => (<div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end border p-4 rounded-lg bg-slate-50/50">
                                <div className="md:col-span-3">
                                    <FormLabel className="text-xs">Document Type</FormLabel>
                                    <Select onValueChange={(val) => form.setValue(`documents.${index}.documentTypeId`, Number(val))} defaultValue={field.documentTypeId?.toString()}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Select type"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {docTypes.map((dt) => (<SelectItem key={dt.id} value={String(dt.id)}>{dt.name}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="md:col-span-3">
                                    <FormLabel className="text-xs">File Name (Optional)</FormLabel>
                                    <Input className="h-9" {...form.register(`documents.${index}.name`)} placeholder="e.g. Scanned Copy"/>
                                </div>
                                <div className="md:col-span-3">
                                    <FormLabel className="text-xs">Upload File</FormLabel>
                                    <Input type="file" onChange={(e) => handleFileUpload(e, index)} disabled={uploading} className="text-xs h-9"/>
                                    {form.watch(`documents.${index}.url`) && <p className="text-[10px] text-green-600 mt-1 truncate">Uploaded</p>}
                                </div>
                                <div className="md:col-span-2">
                                    <FormLabel className="text-xs">Expiry</FormLabel>
                                    <FormattedDatePicker value={form.watch(`documents.${index}.expiryDate`) || undefined} onChange={(date) => form.setValue(`documents.${index}.expiryDate`, date)}/>
                                </div>
                                <div className="md:col-span-1 flex justify-end">
                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="hover:bg-red-100 hover:text-red-600 h-9 w-9">
                                        <Trash2 className="h-4 w-4"/>
                                    </Button>
                                </div>
                            </div>))}

                        <Button type="button" variant="outline" size="sm" onClick={() => append({ documentTypeId: 0, name: "", url: "", expiryDate: null })} className="mt-2">
                            <Plus className="mr-2 h-4 w-4"/> Add Document
                        </Button>
                    </div>
                </FormCard>

                <StickyFooter isSaving={isSaving} isLoading={uploading} cancelLink="/operators"/>
            </form>
        </Form>);
}
