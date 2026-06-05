"use client";
import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2, Building2, Users, FileText } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, } from "@/app/Components/ui/form";
import { Input } from "@/app/Components/ui/input";
import { Textarea } from "@/app/Components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/app/Components/ui/select";
import { Checkbox } from "@/app/Components/ui/checkbox";
import { toast } from "sonner";
import { FormCard } from "@/app/Components/ui/form-card";
import { StickyFooter } from "@/app/Components/ui/sticky-footer";
import { useRouter } from "next/navigation";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DIAL_CODES, COUNTRY_TO_DIAL } from "@/app/lib/phone-codes";

const emptyToUndefined = (value) => {
    if (!Array.isArray(value)) return value;
    return value.filter((item) => {
        if (!item || typeof item !== "object") return false;

        if ("url" in item) {
            return Boolean(item.name?.trim() || item.url?.trim() || item.expiryDate);
        }

        return Boolean(item.name?.trim() || item.designation?.trim() || item.email?.trim() || item.phone?.trim());
    });
};

const customerSchema = z.object({
    companyName: z.string().min(1, "Company Name is required"),
    address: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    website: z.string().optional(),
    phone: z.string().optional(),
    phoneCountryCode: z.string().default("+971"),
    status: z.enum(["ACTIVE", "INACTIVE"]),
    contacts: z.preprocess(emptyToUndefined, z.array(z.object({
        name: z.string().min(1, "Name required"),
        designation: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
        phoneCountryCode: z.string().default("+971"),
        isPrimary: z.coerce.boolean().default(false),
    })).optional()),
    documents: z.preprocess(emptyToUndefined, z.array(z.object({
        name: z.string().optional(),
        url: z.string().min(1, "File is required"),
        expiryDate: z.date().optional().nullable(),
    })).optional()),
});

const normalizeCustomerFormValues = (values) => ({
    ...values,
    contacts: Array.isArray(values.contacts)
        ? values.contacts
            .map((contact) => ({
                ...contact,
                name: contact?.name ?? "",
                designation: contact?.designation ?? "",
                email: contact?.email ?? "",
                phone: contact?.phone ?? "",
                isPrimary: Boolean(contact?.isPrimary),
            }))
            .filter((contact) => contact.name.trim() || contact.designation.trim() || contact.email.trim() || contact.phone.trim())
        : undefined,
    documents: Array.isArray(values.documents)
        ? values.documents
            .map((document) => ({
                ...document,
                name: document?.name ?? "",
                url: document?.url ?? "",
                expiryDate: document?.expiryDate instanceof Date && !Number.isNaN(document.expiryDate.getTime())
                    ? document.expiryDate
                    : null,
            }))
            .filter((document) => document.name.trim() || document.url.trim() || document.expiryDate)
        : undefined,
});

export function CustomerForm({ initialData }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const formId = initialData ? `customer-form-${initialData.id}` : "customer-form-new";
    const [isSaving, setIsSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    const { data: settings } = useQuery({
        queryKey: ["settings", "company"],
        queryFn: () => fetch("/api/settings/company").then(res => res.json()),
        staleTime: 60 * 60 * 1000,
    });

    const form = useForm({
        resolver: zodResolver(customerSchema),
        defaultValues: {
            companyName: initialData?.companyName || "",
            address: initialData?.address || "",
            email: initialData?.email || "",
            website: initialData?.website || "",
            phone: initialData?.phone || "",
            phoneCountryCode: initialData?.phoneCountryCode || "+971",
            status: initialData?.status || "ACTIVE",
            contacts: initialData?.contacts?.map((c) => ({
                name: c.name,
                designation: c.designation || "",
                email: c.email || "",
                phone: c.phone || "",
                phoneCountryCode: c.phoneCountryCode || "+971",
                isPrimary: c.isPrimary || false,
            })) || [{ name: "", designation: "", email: "", phone: "", phoneCountryCode: "+971", isPrimary: true }],
            documents: initialData?.documents?.map((d) => ({
                name: d.name || "",
                url: d.url,
                expiryDate: d.expiryDate ? new Date(d.expiryDate) : null,
            })) || [],
        },
    });
    const { fields: contactFields, append: appendContact, remove: removeContact } = useFieldArray({
        control: form.control,
        name: "contacts",
    });
    const { fields: docFields, append: appendDoc, remove: removeDoc } = useFieldArray({
        control: form.control,
        name: "documents",
    });

    useEffect(() => {
        if (!initialData && settings?.country) {
            const code = COUNTRY_TO_DIAL[settings.country] || "+971";
            if (form.getValues("phoneCountryCode") === "+971") {
                form.setValue("phoneCountryCode", code);
            }
        }
    }, [settings, initialData, form]);

    const handleFileUpload = async (e, index) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        const folderPath = initialData?.id
            ? `customer/${initialData.id}/attachments`
            : "customer/new/attachments";
        formData.append("folder", folderPath);
        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
            if (res.ok) {
                const { url } = await res.json();
                form.setValue(`documents.${index}.url`, url);
                // Set default name if empty
                if (!form.getValues(`documents.${index}.name`)) {
                    form.setValue(`documents.${index}.name`, file.name);
                }
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
    const handlePrimaryContactChange = (index, checked) => {
        const contacts = form.getValues("contacts");
        if (!contacts)
            return;
        const updatedContacts = contacts.map((contact, i) => ({
            ...contact,
            isPrimary: i === index ? checked : (checked ? false : contact.isPrimary)
        }));
        form.setValue("contacts", updatedContacts);
    };
    const onSubmit = async (data) => {
        setIsSaving(true);
        try {
            const url = initialData ? `/api/clients/${initialData.id}` : "/api/clients";
            const method = initialData ? "PUT" : "POST";
            const payload = {
                ...data,
                documents: data.documents?.map(d => ({
                    ...d,
                    expiryDate: d.expiryDate ? d.expiryDate.toISOString() : null
                }))
            };
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                await queryClient.invalidateQueries({ queryKey: ["clients"], refetchType: "all" });
                toast.success(initialData ? "Customer updated" : "Customer created");
                router.refresh();
                router.push("/customers");
            }
            else {
                const err = await res.json();
                toast.error(err.message || "Failed to save");
            }
        }
        catch (error) {
            toast.error("An error occurred");
        }
        finally {
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        const values = normalizeCustomerFormValues(form.getValues());
        const parsed = customerSchema.safeParse(values);

        if (!parsed.success) {
            console.error("Customer form validation errors:", parsed.error.issues);
            toast.error("Please fix the highlighted form errors before saving.");
            return;
        }

        await onSubmit(parsed.data);
    };

    return (<Form {...form}>
            <form
                id={formId}
                onSubmit={(e) => {
                    e.preventDefault();
                    handleSave();
                }}
                className="space-y-8 pb-24"
            >
                <FormCard title="Company Information" description="Basic details about the customer company." icon={Building2}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="companyName" render={({ field }) => (<FormItem>
                                <FormLabel>Company Name <span className="text-red-500">*</span></FormLabel>
                                <FormControl><Input {...field} placeholder="Acme Corp"/></FormControl>
                                <FormMessage />
                            </FormItem>)}/>

                        <FormField control={form.control} name="status" render={({ field }) => (<FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select status"/>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="ACTIVE">Active</SelectItem>
                                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>)}/>

                        <FormField control={form.control} name="email" render={({ field }) => (<FormItem>
                                <FormLabel>Email Address</FormLabel>
                                <FormControl><Input type="email" {...field} placeholder="info@acme.com"/></FormControl>
                                <FormMessage />
                            </FormItem>)}/>

                        <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <div className="flex gap-2">
                                <FormField control={form.control} name="phoneCountryCode" render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="w-44 shrink-0"><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {DIAL_CODES.map(d => <SelectItem key={d.code} value={d.code}>{d.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )} />
                                <FormField control={form.control} name="phone" render={({ field }) => (
                                    <FormControl><Input {...field} placeholder="501234567" className="flex-1" /></FormControl>
                                )} />
                            </div>
                        </FormItem>

                        <FormField control={form.control} name="website" render={({ field }) => (<FormItem>
                                <FormLabel>Website</FormLabel>
                                <FormControl><Input {...field} placeholder="https://acme.com"/></FormControl>
                                <FormMessage />
                            </FormItem>)}/>

                        <FormField control={form.control} name="address" render={({ field }) => (<FormItem className="col-span-2">
                                <FormLabel>Address</FormLabel>
                                <FormControl><Textarea {...field} placeholder="123 Business St, Tech City" rows={3} /></FormControl>
                                <FormMessage />
                            </FormItem>)}/>
                    </div>
                </FormCard>

                <FormCard title="Contact Persons" description="Key people associated with this customer." icon={Users}>
                    <div className="space-y-4">
                        {contactFields.map((field, index) => (
                            <div key={field.id} className="border rounded-lg p-4 bg-slate-50/50 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <FormLabel className="text-xs">Name <span className="text-red-500">*</span></FormLabel>
                                        <Input {...form.register(`contacts.${index}.name`)} placeholder="John Doe"/>
                                        {form.formState.errors.contacts?.[index]?.name && (
                                            <p className="text-xs text-red-500">{form.formState.errors.contacts[index]?.name?.message}</p>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <FormLabel className="text-xs">Designation</FormLabel>
                                        <Input {...form.register(`contacts.${index}.designation`)} placeholder="Manager"/>
                                    </div>
                                    <div className="space-y-1">
                                        <FormLabel className="text-xs">Email</FormLabel>
                                        <Input {...form.register(`contacts.${index}.email`)} placeholder="john@acme.com"/>
                                    </div>
                                    <div className="space-y-1">
                                        <FormLabel className="text-xs">Phone</FormLabel>
                                        <div className="flex gap-2">
                                            <Select
                                                value={form.watch(`contacts.${index}.phoneCountryCode`) || "+971"}
                                                onValueChange={(v) => form.setValue(`contacts.${index}.phoneCountryCode`, v)}
                                            >
                                                <SelectTrigger className="w-36 shrink-0">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {DIAL_CODES.map(d => <SelectItem key={d.code} value={d.code}>{d.label}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <Input {...form.register(`contacts.${index}.phone`)} placeholder="501234567" className="flex-1"/>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            checked={form.watch(`contacts.${index}.isPrimary`)}
                                            onCheckedChange={(checked) => handlePrimaryContactChange(index, checked)}
                                        />
                                        <FormLabel className="text-xs font-normal cursor-pointer">Primary Contact</FormLabel>
                                    </div>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeContact(index)} className="hover:bg-red-100 hover:text-red-600 h-8 w-8">
                                        <Trash2 className="h-4 w-4"/>
                                    </Button>
                                </div>
                            </div>
                        ))}

                        <Button type="button" variant="outline" size="sm" onClick={() => appendContact({ name: "", designation: "", email: "", phone: "", phoneCountryCode: form.getValues("phoneCountryCode") || "+971", isPrimary: contactFields.length === 0 })} className="mt-2">
                            <Plus className="mr-2 h-4 w-4"/> Add Person
                        </Button>
                    </div>
                </FormCard>

                <FormCard title="Documents (Optional)" description="Upload related documents (Contracts, IDs, etc)." icon={FileText}>
                    <div className="space-y-4">
                        {docFields.map((field, index) => (<div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end border p-4 rounded-lg bg-slate-50/50">
                                <div className="md:col-span-4">
                                    <FormLabel className="text-xs">Document Name</FormLabel>
                                    <Input {...form.register(`documents.${index}.name`)} placeholder="e.g. Trade License"/>
                                </div>
                                <div className="md:col-span-4">
                                    <FormLabel className="text-xs">Upload File <span className="text-red-500">*</span></FormLabel>
                                    <Input type="file" onChange={(e) => handleFileUpload(e, index)} disabled={uploading} className="text-xs h-9 cursor-pointer file:cursor-pointer file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:text-xs file:font-semibold file:h-full file:mr-3 file:px-4 file:text-slate-700 dark:file:text-slate-300 hover:file:bg-slate-200 dark:hover:file:bg-slate-700 file:transition-colors p-0 overflow-hidden"/>
                                    {form.watch(`documents.${index}.url`) && <p className="text-[10px] text-green-600 mt-1 truncate">File uploaded successfully</p>}
                                    {form.formState.errors.documents?.[index]?.url && (<p className="text-xs text-red-500 mt-1">File required</p>)}
                                </div>
                                <div className="md:col-span-3">
                                    <FormLabel className="text-xs">Expiry Date (Optional)</FormLabel>
                                    <FormattedDatePicker value={form.watch(`documents.${index}.expiryDate`) || undefined} onChange={(date) => form.setValue(`documents.${index}.expiryDate`, date)}/>
                                </div>
                                <div className="md:col-span-1 flex justify-end">
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeDoc(index)} className="hover:bg-red-100 hover:text-red-600">
                                        <Trash2 className="h-4 w-4"/>
                                    </Button>
                                </div>
                            </div>))}

                        <Button type="button" variant="outline" size="sm" onClick={() => appendDoc({ name: "", url: "", expiryDate: null })} className="mt-2">
                            <Plus className="mr-2 h-4 w-4"/> Add Document
                        </Button>
                    </div>
                </FormCard>

                <StickyFooter
                    formId={formId}
                    onSave={handleSave}
                    isSaving={isSaving}
                    isLoading={uploading}
                    cancelLink="/customers"
                />
            </form>
        </Form>);
}
