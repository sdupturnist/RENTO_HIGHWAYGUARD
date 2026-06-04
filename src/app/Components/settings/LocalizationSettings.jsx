"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, } from "@/app/Components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/app/Components/ui/select";
import { Input } from "@/app/Components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Separator } from "@/app/Components/ui/separator";
import { countries, currencies, dateFormats, timeZones } from "@/app/lib/localization-data";
import { Checkbox } from "@/app/Components/ui/checkbox";
const formSchema = z.object({
    country: z.string().min(1, "Country is required"),
    currency: z.string().min(1, "Currency is required"),
    currencySymbol: z.string().min(1, "Currency Symbol is required"),
    currencyPosition: z.string().min(1, "Currency Position is required"),
    dateFormat: z.string().min(1, "Date Format is required"),
    timeZone: z.string().min(1, "Time Zone is required"),
    weekStartsOn: z.string().min(1, "Week Starts On is required"),
    weekendDays: z.array(z.string()).optional(),
});
export function LocalizationSettings({ onDirtyStateChange }) {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            country: "",
            currency: "USD",
            currencySymbol: "$",
            currencyPosition: "BEFORE",
            dateFormat: "DD/MM/YYYY",
            timeZone: "UTC",
            weekStartsOn: "Monday",
            weekendDays: [],
        },
    });
    const { isDirty } = form.formState;
    // Helper to replace nulls with empty strings
    const sanitize = (data) => {
        const clean = {};
        Object.keys(data).forEach(key => {
            clean[key] = data[key] === null ? "" : data[key];
        });
        return clean;
    };
    useEffect(() => {
        if (onDirtyStateChange) {
            onDirtyStateChange(isDirty);
        }
    }, [isDirty, onDirtyStateChange]);
    useEffect(() => {
        async function loadSettings() {
            try {
                const response = await fetch("/api/settings/company");
                if (response.ok) {
                    const rawData = await response.json();
                    const data = sanitize(rawData);
                    form.reset({
                        country: data.country || "",
                        currency: data.currency || "AED",
                        currencySymbol: data.currencySymbol || "AED",
                        currencyPosition: data.currencyPosition || "BEFORE",
                        dateFormat: data.dateFormat || "DD/MM/YYYY",
                        timeZone: data.timeZone || "UTC",
                        weekStartsOn: data.weekStartsOn || "Monday",
                        weekendDays: data.weekendDays || [],
                    });
                }
            }
            catch (error) {
                console.error("Failed to load settings:", error);
                toast.error("Failed to load settings");
            }
            finally {
                setIsLoading(false);
            }
        }
        loadSettings();
    }, []); // Removed form dependency to avoid loops
    async function onSubmit(values) {
        setIsSaving(true);
        try {
            const response = await fetch("/api/settings/company", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            if (!response.ok) {
                throw new Error("Failed to save settings");
            }
            const data = await response.json();
            form.reset(data); // Reset form with saved data to clear dirty state
            toast.success("Localization settings saved successfully");
        }
        catch (error) {
            console.error("Error saving settings:", error);
            toast.error("Failed to save settings");
        }
        finally {
            setIsSaving(false);
        }
    }
    const handleCountryChange = (countryCode) => {
        const country = countries.find((c) => c.code === countryCode);
        if (country) {
            form.setValue("country", countryCode, { shouldDirty: true });
            form.setValue("currency", country.currency, { shouldDirty: true });
            form.setValue("currencySymbol", country.symbol, { shouldDirty: true });
            form.setValue("dateFormat", country.dateFormat, { shouldDirty: true });
            form.setValue("timeZone", country.timezone, { shouldDirty: true });
        }
    };
    const handleCurrencyChange = (currencyCode) => {
        const currency = currencies.find((c) => c.code === currencyCode);
        if (currency) {
            form.setValue("currency", currencyCode, { shouldDirty: true });
            form.setValue("currencySymbol", currency.symbol, { shouldDirty: true });
        }
    };
    return (<Card>
            <CardHeader>
                <CardTitle>Localization & Format</CardTitle>
                <CardDescription>
                    Regional settings and formatting preferences.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (<div className="flex items-center justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
                    </div>) : (<Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={form.control} name="country" render={({ field }) => (<FormItem>
                                            <FormLabel>Default Country</FormLabel>
                                            <Select onValueChange={(val) => handleCountryChange(val)} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a country"/>
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {countries.map((country) => (<SelectItem key={country.code} value={country.code}>
                                                            {country.name}
                                                        </SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                            <FormDescription>
                                                Selecting a country will auto-populate currency, symbol, and date format.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>)}/>

                                <FormField control={form.control} name="timeZone" render={({ field }) => (<FormItem>
                                            <FormLabel>Time Zone</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select timezone"/>
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {timeZones.map((tz) => (<SelectItem key={tz} value={tz}>
                                                            {tz}
                                                        </SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>)}/>

                                <FormField control={form.control} name="currency" render={({ field }) => (<FormItem>
                                            <FormLabel>Currency</FormLabel>
                                            <Select onValueChange={(val) => handleCurrencyChange(val)} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select currency"/>
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {currencies.map((c) => (<SelectItem key={c.code} value={c.code}>
                                                            {c.name} ({c.code})
                                                        </SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>)}/>

                                <FormField control={form.control} name="currencySymbol" render={({ field }) => (<FormItem>
                                            <FormLabel>Currency Symbol</FormLabel>
                                            <FormControl>
                                                <Input {...field} readOnly className="bg-muted cursor-not-allowed"/>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>)}/>

                                <FormField control={form.control} name="currencyPosition" render={({ field }) => (<FormItem>
                                            <FormLabel>Currency Position</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select position"/>
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="BEFORE">Before Amount ($100)</SelectItem>
                                                    <SelectItem value="AFTER">After Amount (100$)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>)}/>

                                <FormField control={form.control} name="dateFormat" render={({ field }) => (<FormItem>
                                            <FormLabel>Date Format</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select date format"/>
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {dateFormats.map((f) => (<SelectItem key={f.value} value={f.value}>
                                                            {f.label}
                                                        </SelectItem>))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>)}/>

                                <FormField control={form.control} name="weekStartsOn" render={({ field }) => (<FormItem>
                                            <FormLabel>Week Starts On</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select start day"/>
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Monday">Monday</SelectItem>
                                                    <SelectItem value="Sunday">Sunday</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>)}/>

                                <div className="space-y-4 md:col-span-2">
                                    <FormLabel>Weekend Days</FormLabel>
                                    <div className="flex flex-wrap gap-4 p-4 border rounded-md">
                                        {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (<FormField key={day} control={form.control} name="weekendDays" render={({ field }) => {
                    return (<FormItem key={day} className="flex flex-row items-center space-x-2 space-y-0">
                                                            <FormControl>
                                                                <Checkbox checked={field.value?.includes(day)} onCheckedChange={(checked) => {
                            return checked
                                ? field.onChange([...(field.value || []), day])
                                : field.onChange(field.value?.filter((value) => value !== day));
                        }}/>
                                                            </FormControl>
                                                            <FormLabel className="font-normal cursor-pointer">
                                                                {day}
                                                            </FormLabel>
                                                        </FormItem>);
                }}/>))}
                                    </div>
                                    <FormDescription>
                                        Select the days that are considered weekends for this company.
                                    </FormDescription>
                                </div>
                            </div>

                            <Separator />

                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => form.reset()} disabled={isSaving || !isDirty}>
                                    Reset
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving ? (<>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                            Saving...
                                        </>) : (isDirty ? "Save Changes" : "Saved")}
                                </Button>
                            </div>
                        </form>
                    </Form>)}
            </CardContent>
        </Card>);
}
