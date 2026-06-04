"use client";
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Label } from "@/app/Components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/app/Components/ui/select";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { countries } from "@/app/lib/countries";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";

import { DIAL_CODES } from "@/app/lib/phone-codes";

export function CompanySettings({ onDirtyStateChange }) {
    const { register, handleSubmit, reset, control, watch, formState: { isSubmitting, isDirty } } = useForm({
        defaultValues: {
            companyName: "",
            companyEmail: "",
            address: "",
            city: "",
            state: "",
            country: "",
            zipCode: "",
            phoneCountryCode: "+971",
            phone: "",
            taxNumber: "",
            website: "",
            enableVat: false,
            vatPercentage: 5.0,
        }
    });

    const watchVatEnabled = watch("enableVat");

    const sanitizeData = (data) => {
        return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value === null ? "" : value]));
    };

    useEffect(() => {
        fetch("/api/settings/company")
            .then(res => res.json())
            .then(data => {
                const safeData = sanitizeData(data);
                reset({ ...safeData });
            })
            .catch(() => toast.error("Failed to load settings"));
    }, [reset]);

    useEffect(() => {
        if (onDirtyStateChange) {
            onDirtyStateChange(isDirty);
        }
    }, [isDirty, onDirtyStateChange]);

    const onSubmit = async (data) => {
        try {
            const res = await fetch("/api/settings/company", {
                method: "POST",
                body: JSON.stringify(data),
                headers: { "Content-Type": "application/json" }
            });
            if (res.ok) {
                toast.success("Settings saved successfully");
                const updated = await res.json();
                reset({ ...sanitizeData(updated) });
            } else {
                toast.error("Failed to save settings");
            }
        } catch (e) {
            toast.error("Error saving settings");
        }
    };

    return (<Card>
        <CardHeader>
            <CardTitle>Company Profile</CardTitle>
            <CardDescription>Manage your company details for invoices and reports.</CardDescription>
        </CardHeader>
        <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="companyName">Company Name <span className="text-red-500">*</span></Label>
                        <Input id="companyName" {...register("companyName", { required: true })} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="companyEmail">Company Email</Label>
                        <Input id="companyEmail" type="email" {...register("companyEmail")} />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <div className="flex gap-2">
                            <Controller name="phoneCountryCode" control={control} render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="w-44 shrink-0"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {DIAL_CODES.map(d => <SelectItem key={d.code} value={d.code}>{d.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )} />
                            <Input id="phone" {...register("phone")} placeholder="501234567" className="flex-1" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="website">Website</Label>
                        <Input id="website" {...register("website")} />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" {...register("address")} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input id="city" {...register("city")} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Input id="state" {...register("state")} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Controller name="country" control={control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Country" />
                            </SelectTrigger>
                            <SelectContent>
                                {countries.map((country) => (<SelectItem key={country.code} value={country.code}>
                                    {country.name}
                                </SelectItem>))}
                            </SelectContent>
                        </Select>)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="zipCode">Zip Code <span className="text-muted-foreground text-xs">(Optional)</span></Label>
                        <Input id="zipCode" {...register("zipCode")} />
                    </div>
                </div>

                <div className="space-y-4 border p-4 rounded-md bg-muted/20 relative overflow-hidden">
                    <Label className="text-base font-semibold flex items-center gap-2">
                        Tax / VAT Configuration
                    </Label>
                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="enableVat"
                            {...register("enableVat")}
                            checked={watchVatEnabled}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        />
                        <Label htmlFor="enableVat" className="font-normal cursor-pointer">
                            Enable VAT / Tax Calculation
                        </Label>
                    </div>
                    {watchVatEnabled && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="space-y-2">
                            <Label htmlFor="vatPercentage">VAT Percentage (%) <span className="text-red-500">*</span></Label>
                            <Input id="vatPercentage" type="number" step="0.01" {...register("vatPercentage", { required: watchVatEnabled, valueAsNumber: true })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="taxNumber">VAT / Tax Number <span className="text-red-500">*</span></Label>
                            <Input id="taxNumber" {...register("taxNumber", { required: watchVatEnabled })} />
                        </div>
                    </div>)}
                </div>

                <div className="flex justify-end gap-4">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isDirty ? "Save Changes" : "Saved"}
                    </Button>
                </div>
            </form>
        </CardContent>
    </Card>);
}
