"use client";
import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Trash2, Car, Shield, FileText, Banknote, AlertTriangle } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription, } from "@/app/Components/ui/form";
import { Input } from "@/app/Components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/app/Components/ui/select";
import { Textarea } from "@/app/Components/ui/textarea";
import { toast } from "sonner";
import { FormCard } from "@/app/Components/ui/form-card";
import { StickyFooter } from "@/app/Components/ui/sticky-footer";
import { useRouter } from "next/navigation";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { useQueryClient } from "@tanstack/react-query";
const vehicleSchema = z.object({
    // Identification
    prefixRuleId: z.coerce.number().min(1, "Please select a vehicle ID prefix").optional(),
    typeId: z.coerce.number().min(1, "Type is required"),
    brandId: z.coerce.number().min(1, "Brand is required"),
    modelId: z.coerce.number().min(1, "Model is required"),
    manufacturingYear: z.coerce.number().min(1900, "Invalid year"),
    status: z.enum(["ACTIVE", "MAINTENANCE", "INACTIVE"]),
    ownership: z.enum(["OWN", "THIRD_PARTY"]),
    // Registration
    regNo: z.string({ required_error: "Registration number is required" }).min(1, "Registration number is required"),
    registrationDate: z.date().optional().nullable(),
    registrationExpiry: z.date({ required_error: "Expiry date is required", invalid_type_error: "Expiry date is required" }),
    registrationAuthorityId: z.coerce.number().min(1, "Registration authority is required"),
    countryOfRegistration: z.string().default("UAE"),
    // Third Party
    thirdPartyOwnerName: z.string().optional().nullable().or(z.literal("")),
    thirdPartyOwnerCompany: z.string().optional().nullable().or(z.literal("")),
    thirdPartyContact: z.string().optional().nullable().or(z.literal("")),
    thirdPartyEmail: z.string().email().optional().nullable().or(z.literal("")),
    thirdPartyAgreementName: z.string().optional().nullable().or(z.literal("")),
    thirdPartyContractStart: z.date().optional().nullable(),
    thirdPartyContractEnd: z.date().optional().nullable(),
    // Rent
    baseRentType: z.enum(["HOURLY", "DAILY", "MONTHLY"]),
    baseRentAmount: z.coerce.number().min(0, "Rent amount cannot be negative"),
    defaultRentCycle: z.enum(["HOURLY", "DAILY"]),
    // Operational
    fuelType: z.enum(["DIESEL", "PETROL", "ELECTRIC", "HYBRID"]).optional().nullable(),
    capacity: z.coerce.number().optional().nullable(),
    remarks: z.string().optional().nullable(),
    documents: z.array(z.object({
        documentTypeId: z.coerce.number().min(1, "Document Type is required"),
        name: z.string().optional().nullable(),
        url: z.string().min(1, "File required"),
        expiryDate: z.date().optional().nullable(),
    })).optional().nullable(),
});
export function VehicleForm({ initialData }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [brands, setBrands] = useState([]);
    const [models, setModels] = useState([]);
    const [filteredModels, setFilteredModels] = useState([]);
    const [types, setTypes] = useState([]);
    const [authorities, setAuthorities] = useState([]);
    const [prefixRules, setPrefixRules] = useState([]);
    const [docTypes, setDocTypes] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    // Year generation
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: currentYear - 1980 + 2 }, (_, i) => currentYear + 1 - i);
    const form = useForm({
        resolver: zodResolver(vehicleSchema),
        defaultValues: (initialData ? {
            prefixRuleId: undefined,
            ...initialData,
            regNo: initialData.regNo || "",
            remarks: initialData.remarks || "", // Handle null
            fuelType: initialData.fuelType || null,
            capacity: initialData.capacity || null,
            registrationDate: initialData.registrationDate ? new Date(initialData.registrationDate) : null,
            registrationExpiry: initialData.registrationExpiry ? new Date(initialData.registrationExpiry) : null,
            thirdPartyOwnerName: initialData.thirdPartyOwnerName || "",
            thirdPartyOwnerCompany: initialData.thirdPartyOwnerCompany || "",
            thirdPartyContact: initialData.thirdPartyContact || "",
            thirdPartyEmail: initialData.thirdPartyEmail || "",
            thirdPartyAgreementName: initialData.thirdPartyAgreementName || "",
            thirdPartyContractStart: initialData.thirdPartyContractStart ? new Date(initialData.thirdPartyContractStart) : null,
            thirdPartyContractEnd: initialData.thirdPartyContractEnd ? new Date(initialData.thirdPartyContractEnd) : null,
            documents: initialData.documents?.map((d) => ({
                documentTypeId: d.documentTypeId,
                name: d.name || "",
                url: d.url,
                expiryDate: d.expiryDate ? new Date(d.expiryDate) : null
            })) || []
        } : {
            prefixRuleId: undefined,
            typeId: undefined,
            brandId: undefined,
            modelId: undefined,
            manufacturingYear: currentYear,
            status: "ACTIVE",
            ownership: "OWN",
            countryOfRegistration: "UAE",
            baseRentType: "HOURLY",
            baseRentAmount: 0,
            defaultRentCycle: "HOURLY",
            fuelType: null,
            documents: [],
        }),
    });
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "documents",
    });
    const ownership = form.watch("ownership");
    const selectedBrandId = form.watch("brandId");
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [bRes, mRes, tRes, aRes, cRes, dtRes] = await Promise.all([
                    fetch("/api/config/brands"),
                    fetch("/api/config/models"),
                    fetch("/api/config/vehicle-types"),
                    fetch("/api/config/authorities"),
                    fetch("/api/config/vehicle-code-rules"),
                    fetch("/api/config/doc-types"),
                ]);
                if (bRes.ok) {
                    const bData = await bRes.json();
                    if (Array.isArray(bData))
                        setBrands(bData);
                }
                else {
                    console.error("Failed to fetch brands:", await bRes.text());
                }
                if (mRes.ok) {
                    const mData = await mRes.json();
                    if (Array.isArray(mData))
                        setModels(mData);
                }
                if (tRes.ok) {
                    const tData = await tRes.json();
                    if (Array.isArray(tData))
                        setTypes(tData);
                }
                if (aRes.ok) {
                    const aData = await aRes.json();
                    if (Array.isArray(aData))
                        setAuthorities(aData);
                }
                if (cRes.ok) {
                    const cData = await cRes.json();
                    const rulesArray = Array.isArray(cData) ? cData : (cData ? [cData] : []);
                    setPrefixRules(rulesArray);
                    if (!initialData && rulesArray[0]?.defaultRentCycle) {
                        form.setValue("defaultRentCycle", rulesArray[0].defaultRentCycle);
                    }
                }
                if (dtRes.ok) {
                    const dtData = await dtRes.json();
                    if (Array.isArray(dtData)) {
                        setDocTypes(dtData.filter(t => t.category === "VEHICLE"));
                    }
                }
            }
            catch (error) {
                console.error("Error loading master data:", error);
                toast.error("Failed to load some configuration data.");
            }
        };
        fetchData();
    }, [initialData, form]);
    const selectedTypeId = form.watch("typeId");
    const [filteredBrands, setFilteredBrands] = useState([]);
    // Filter brands when type changes
    useEffect(() => {
        if (selectedTypeId) {
            const filtered = brands.filter((b) => b.typeId === Number(selectedTypeId));
            setFilteredBrands(filtered);
        }
        else {
            setFilteredBrands([]);
        }
        // Reset brand if type changes and current brand is not valid? 
        // Or just let user re-select. Better to clear if not in new list, but for now simple filter.
    }, [selectedTypeId, brands]);
    // Filter models when brand changes
    useEffect(() => {
        if (selectedBrandId) {
            setFilteredModels(models.filter((m) => m.brandId === Number(selectedBrandId)));
            // Also ensure the brand belongs to the selected type? 
            // If user changes type, brand might be invalid.
        }
        else {
            setFilteredModels([]);
        }
    }, [selectedBrandId, models]);
    const onSubmit = async (data) => {
        if (!initialData && !data.prefixRuleId) {
            form.setError("prefixRuleId", { message: "Please select a vehicle ID prefix" });
            toast.error("Please select a vehicle ID prefix");
            return;
        }
        setIsSaving(true);
        try {
            const url = initialData ? `/api/vehicles/${initialData.id}` : "/api/vehicles";
            const method = initialData ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...data,
                    prefixRuleId: data.prefixRuleId ? Number(data.prefixRuleId) : undefined,
                    registrationDate: data.registrationDate?.toISOString(),
                    registrationExpiry: data.registrationExpiry?.toISOString(),
                    thirdPartyContractStart: data.thirdPartyContractStart?.toISOString(),
                    thirdPartyContractEnd: data.thirdPartyContractEnd?.toISOString(),
                    documents: data.documents?.map((d) => ({
                        ...d,
                        expiryDate: d.expiryDate ? d.expiryDate.toISOString() : null
                    }))
                }),
            });
            if (res.ok) {
                await queryClient.invalidateQueries({ queryKey: ["vehicles"], refetchType: "all" });
                toast.success(initialData ? "Vehicle updated" : "Vehicle created");
                router.refresh();
                router.push("/vehicles");
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
    const handleFileUpload = async (e, index) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        const folderPath = initialData?.id
            ? `vehicle/${initialData.id}/attachments`
            : "vehicle/new/attachments";
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
            toast.error("Please check the form for errors. " + Object.keys(errors).join(", "));
        })} className="space-y-8 pb-24">

                {/* Vehicle Identification */}
                <FormCard title="Vehicle Identification" description="Core vehicle details." icon={Car}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {!initialData && (
                            <FormField control={form.control} name="prefixRuleId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Vehicle ID Prefix <span className="text-red-500">*</span></FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value?.toString()}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select prefix" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {prefixRules.map(r => (
                                                <SelectItem key={r.id} value={String(r.id)}>
                                                    {r.prefix}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        )}

                        <FormField control={form.control} name="ownership" render={({ field }) => (<FormItem>
                                <FormLabel>Ownership</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select ownership"/>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="OWN">Own</SelectItem>
                                        <SelectItem value="THIRD_PARTY">Third Party</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>)}/>

                        <FormField control={form.control} name="typeId" render={({ field }) => (<FormItem>
                                <FormLabel>Vehicle Type <span className="text-red-500">*</span></FormLabel>
                                <Select onValueChange={(val) => {
                field.onChange(val);
                form.setValue("brandId", 0); // Reset brand
                form.setValue("modelId", 0); // Reset model
            }} value={field.value?.toString()}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select type"/>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {types.map((t) => (<SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>)}/>

                        <FormField control={form.control} name="brandId" render={({ field }) => (<FormItem>
                                <FormLabel>Brand <span className="text-red-500">*</span></FormLabel>
                                <Select onValueChange={(val) => {
                field.onChange(val);
                form.setValue("modelId", 0); // Reset model
            }} value={field.value?.toString()} disabled={!selectedTypeId}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select brand"/>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {filteredBrands.map((b) => (<SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>)}/>

                        <FormField control={form.control} name="modelId" render={({ field }) => (<FormItem>
                                <FormLabel>Model <span className="text-red-500">*</span></FormLabel>
                                <Select onValueChange={field.onChange} value={field.value?.toString()} disabled={!selectedBrandId}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select model"/>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {filteredModels.map((m) => (<SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>)}/>

                        <FormField control={form.control} name="manufacturingYear" render={({ field }) => (<FormItem>
                                <FormLabel>Manufacturing Year</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value?.toString()}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select year"/>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {years.map(y => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>)}/>
                    </div>
                </FormCard>

                {/* Registration & Compliance */}
                <FormCard title="Registration & Compliance" description="Legal documentation details." icon={Shield}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="regNo" render={({ field }) => (<FormItem>
                                <FormLabel>Registration Number <span className="text-red-500">*</span></FormLabel>
                                <FormControl><Input {...field} placeholder="DXB-1234"/></FormControl>
                                <FormMessage />
                            </FormItem>)}/>

                        <FormField control={form.control} name="registrationAuthorityId" render={({ field }) => (<FormItem>
                                <FormLabel>Registration Authority <span className="text-red-500">*</span></FormLabel>
                                <Select onValueChange={field.onChange} value={field.value?.toString()}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select authority"/>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {authorities.map((a) => (<SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>)}/>

                        <FormField control={form.control} name="registrationDate" render={({ field }) => (<FormItem className="flex flex-col">
                                <FormLabel>Registration Date</FormLabel>
                                <FormControl>
                                    <FormattedDatePicker value={field.value || undefined} onChange={field.onChange} placeholder="Pick a date"/>
                                </FormControl>
                                <FormMessage />
                            </FormItem>)}/>


                        <FormField control={form.control} name="registrationExpiry" render={({ field }) => (<FormItem className="flex flex-col">
                                <FormLabel>Expiry Date <span className="text-red-500">*</span></FormLabel>
                                <FormControl>
                                    <FormattedDatePicker value={field.value || undefined} onChange={field.onChange} placeholder="Pick a date"/>
                                </FormControl>
                                <FormMessage />
                            </FormItem>)}/>

                        <FormField control={form.control} name="countryOfRegistration" render={({ field }) => (<FormItem>
                                <FormLabel>Country of Registration</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select country"/>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="UAE">UAE</SelectItem>
                                        <SelectItem value="KSA">KSA</SelectItem>
                                        <SelectItem value="Oman">Oman</SelectItem>
                                        <SelectItem value="Qatar">Qatar</SelectItem>
                                        <SelectItem value="Bahrain">Bahrain</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>)}/>
                    </div>
                </FormCard>

                {/* Status */}
                <FormCard title="Vehicle Status" description="Operational availability." icon={AlertTriangle}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                        <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>)}/>

                        {/* Derived Status Display */}
                        {initialData?.registrationExpiry && new Date(initialData.registrationExpiry) < new Date() && (<div className="flex items-center space-x-2 text-red-600 bg-red-50 p-2 rounded-md border border-red-100">
                                <AlertTriangle className="h-4 w-4"/>
                                <span className="text-sm font-medium">Registration Expired</span>
                            </div>)}
                    </div>
                </FormCard>

                {/* Third Party Section (Conditional) */}
                {ownership === "THIRD_PARTY" && (<FormCard title="Third Party Details" description="Owner and contract info." icon={FileText} className="border-orange-200 bg-orange-50/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="thirdPartyOwnerName" render={({ field }) => (<FormItem><FormLabel>Owner Name</FormLabel><FormControl><Input {...field} value={field.value ?? ""}/></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="thirdPartyOwnerCompany" render={({ field }) => (<FormItem><FormLabel>Owner Company</FormLabel><FormControl><Input {...field} value={field.value ?? ""}/></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="thirdPartyContact" render={({ field }) => (<FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} value={field.value ?? ""}/></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="thirdPartyEmail" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} value={field.value ?? ""}/></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="thirdPartyAgreementName" render={({ field }) => (<FormItem><FormLabel>Agreement Name</FormLabel><FormControl><Input {...field} value={field.value ?? ""}/></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={form.control} name="thirdPartyContractStart" render={({ field }) => (<FormItem className="flex flex-col">
                                    <FormLabel>Contract Start</FormLabel>
                                    <FormattedDatePicker value={field.value || undefined} onChange={field.onChange}/>
                                    <FormMessage />
                                </FormItem>)}/>
                            <FormField control={form.control} name="thirdPartyContractEnd" render={({ field }) => (<FormItem className="flex flex-col">
                                    <FormLabel>Contract End</FormLabel>
                                    <FormattedDatePicker value={field.value || undefined} onChange={field.onChange}/>
                                    <FormMessage />
                                </FormItem>)}/>
                        </div>
                    </FormCard>)}

                {/* Rental Configuration */}
                <FormCard title="Rental Configuration" description="Base rent and cycle defaults." icon={Banknote}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FormField control={form.control} name="baseRentType" render={({ field }) => (<FormItem>
                                <FormLabel>Base Rent Type</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select type"/>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="HOURLY">Hourly</SelectItem>
                                        <SelectItem value="DAILY">Daily</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>)}/>

                        <FormField control={form.control} name="baseRentAmount" render={({ field }) => {
                            const amount = Number(field.value) || 0;
                            const rentType = form.watch("baseRentType");
                            // Assume 8 full-day hours for preview (actual calculation uses settings)
                            const PREVIEW_DAY_HOURS = 8;
                            let hourly, daily, monthly;
                            if (rentType === "HOURLY") {
                                hourly = amount;
                                daily = amount * PREVIEW_DAY_HOURS;
                                monthly = daily * 30;
                            } else if (rentType === "DAILY") {
                                daily = amount;
                                hourly = amount / PREVIEW_DAY_HOURS;
                                monthly = amount * 30;
                            } else { // MONTHLY
                                monthly = amount;
                                daily = amount / 30;
                                hourly = daily / PREVIEW_DAY_HOURS;
                            }
                            return (<FormItem>
                                <FormLabel>Base Rent Amount</FormLabel>
                                <FormControl><Input type="number" {...field}/></FormControl>
                                <FormDescription>
                                    Hourly: {hourly.toFixed(2)} &nbsp;|&nbsp; Daily: {daily.toFixed(2)} &nbsp;|&nbsp; Monthly: {monthly.toFixed(2)}
                                </FormDescription>
                                <FormMessage />
                            </FormItem>);
                        }}/>

                        <FormField control={form.control} name="defaultRentCycle" render={({ field }) => (<FormItem>
                                <FormLabel>Billing Cycle</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select cycle"/>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="HOURLY">Hourly</SelectItem>
                                        <SelectItem value="DAILY">Daily</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormDescription>Billing cycle applied when assigning this vehicle (can be overridden per block).</FormDescription>
                                <FormMessage />
                            </FormItem>)}/>
                    </div>
                </FormCard>

                {/* Operational Details */}
                <FormCard title="Operational Details (Optional)" description="Fuel and capacity." icon={Car}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField control={form.control} name="fuelType" render={({ field }) => (<FormItem>
                                <FormLabel>Fuel Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select fuel"/>
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="DIESEL">Diesel</SelectItem>
                                        <SelectItem value="PETROL">Petrol</SelectItem>
                                        <SelectItem value="ELECTRIC">Electric</SelectItem>
                                        <SelectItem value="HYBRID">Hybrid</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>)}/>

                        <FormField control={form.control} name="capacity" render={({ field }) => (<FormItem>
                                <FormLabel>Capacity / Tonnage</FormLabel>
                                <FormControl><Input type="number" {...field} value={field.value ?? ""}/></FormControl>
                                <FormMessage />
                            </FormItem>)}/>

                        <div className="col-span-1 md:col-span-2">
                            <FormField control={form.control} name="remarks" render={({ field }) => (<FormItem>
                                    <FormLabel>Remarks</FormLabel>
                                    <FormControl><Textarea {...field} value={field.value ?? ""}/></FormControl>
                                    <FormMessage />
                                </FormItem>)}/>
                        </div>
                    </div>
                </FormCard>


                {/* Documents */}
                <FormCard title="Documents (Optional)" description="Upload vehicle specific documents." icon={FileText}>
                    <div className="space-y-4">
                        {fields.map((field, index) => (<div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end border p-4 rounded-lg bg-slate-50/50">
                                <div className="md:col-span-5">
                                    <FormLabel className="text-xs">Document Type</FormLabel>
                                    <Select 
                                        onValueChange={(val) => {
                                            form.setValue(`documents.${index}.documentTypeId`, Number(val));
                                            form.clearErrors(`documents.${index}.documentTypeId`);
                                        }} 
                                        value={form.watch(`documents.${index}.documentTypeId`) ? String(form.watch(`documents.${index}.documentTypeId`)) : undefined}
                                    >
                                        <SelectTrigger className="w-full h-9">
                                            <SelectValue placeholder="Select type"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {docTypes.map((dt) => (<SelectItem key={dt.id} value={String(dt.id)}>{dt.name}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                    {form.formState.errors.documents?.[index]?.documentTypeId && (
                                        <p className="text-[11px] text-red-500 mt-1">
                                            {form.formState.errors.documents[index].documentTypeId.message}
                                        </p>
                                    )}
                                </div>
                                <div className="md:col-span-3">
                                    <FormLabel className="text-xs">Upload File</FormLabel>
                                    <Input type="file" onChange={(e) => handleFileUpload(e, index)} disabled={uploading} className="text-xs h-9 cursor-pointer file:cursor-pointer file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:text-xs file:font-semibold file:h-full file:mr-3 file:px-4 file:text-slate-700 dark:file:text-slate-300 hover:file:bg-slate-200 dark:hover:file:bg-slate-700 file:transition-colors p-0 overflow-hidden"/>
                                    {form.watch(`documents.${index}.url`) && (
                                        <p className="text-[10px] text-green-600 mt-1 truncate">
                                            Uploaded: {form.watch(`documents.${index}.url`).split("/").pop()}
                                        </p>
                                    )}
                                    {form.formState.errors.documents?.[index]?.url && (
                                        <p className="text-[11px] text-red-500 mt-1">
                                            {form.formState.errors.documents[index].url.message}
                                        </p>
                                    )}
                                </div>
                                <div className="md:col-span-3">
                                    <FormLabel className="text-xs">Expiry (Optional)</FormLabel>
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

                <StickyFooter isSaving={isSaving} isLoading={uploading} cancelLink="/vehicles"/>
            </form>
        </Form>);
}
