"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Car, Banknote, FileText } from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, } from "@/app/Components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/app/Components/ui/select";
import { Input } from "@/app/Components/ui/input";
import { Textarea } from "@/app/Components/ui/textarea";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { toast } from "sonner";
import { FormCard } from "@/app/Components/ui/form-card";
import { StickyFooter } from "@/app/Components/ui/sticky-footer";

const maintenanceSchema = z.object({
    vehicleId: z.string().min(1, "Vehicle is required"),
    maintenanceTypeId: z.string().min(1, "Maintenance type is required"),
    description: z.string().optional(),
    startDate: z.date(),
    endDate: z.date().optional().nullable(),
    amount: z.string().optional(),
    status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED"]).optional(),
});

export function MaintenanceForm({ initialData, vehicles, maintenanceTypes }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState(null);

    const form = useForm({
        resolver: zodResolver(maintenanceSchema),
        defaultValues: {
            vehicleId: initialData?.vehicleId?.toString() || "",
            maintenanceTypeId: initialData?.maintenanceTypeId?.toString() || "",
            description: initialData?.description || "",
            startDate: initialData?.startDate ? new Date(initialData.startDate) : undefined,
            endDate: initialData?.endDate ? new Date(initialData.endDate) : undefined,
            amount: initialData?.amount?.toString() || "",
            status: initialData?.status || "SCHEDULED",
        },
    });

    // Update selected vehicle when vehicleId changes
    const vehicleId = form.watch("vehicleId");
    useEffect(() => {
        if (vehicleId) {
            const vehicle = vehicles.find((v) => v.id.toString() === vehicleId);
            setSelectedVehicle(vehicle);
        } else {
            setSelectedVehicle(null);
        }
    }, [vehicleId, vehicles]);

    const onSubmit = async (data) => {
        try {
            setLoading(true);
            // validate cost based on ownership
            if (selectedVehicle?.ownership === "OWN") {
                if (!data.amount || parseFloat(data.amount) <= 0) {
                    form.setError("amount", {
                        type: "manual",
                        message: "Amount is required for owned vehicles",
                    });
                    setLoading(false);
                    return;
                }
            }
            const payload = {
                ...data,
                vehicleId: parseInt(data.vehicleId),
                maintenanceTypeId: parseInt(data.maintenanceTypeId),
                amount: data.amount ? parseFloat(data.amount) : null,
            };
            const url = initialData
                ? `/api/maintenance/${initialData.id}`
                : "/api/maintenance";
            const method = initialData ? "PUT" : "POST";
            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || "Something went wrong");
            }
            toast.success(initialData
                ? "Maintenance updated successfully"
                : "Maintenance scheduled successfully");
            // Invalidate and wait before navigating so the list has fresh data on arrival
            await queryClient.invalidateQueries({
                queryKey: ["maintenance"],
                refetchType: "all",
            });
            router.refresh();
            router.push("/maintenance");
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (<Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-24">
                <div className="grid gap-6 md:grid-cols-2">
                    <FormCard title="Vehicle & Type" description="Select vehicle and maintenance type" icon={Car}>
                        <div className="grid gap-6">
                            <FormField control={form.control} name="vehicleId" render={({ field }) => (<FormItem>
                                        <FormLabel>Vehicle</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!initialData}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a vehicle"/>
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {vehicles.map((vehicle) => (<SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                                                        {vehicle.vehicleCode} - {vehicle.vehicleType.name} (
                                                        {vehicle.ownership})
                                                    </SelectItem>))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>)}/>

                            <FormField control={form.control} name="maintenanceTypeId" render={({ field }) => (<FormItem>
                                        <FormLabel>Maintenance Type</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select type"/>
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {maintenanceTypes.map((type) => (<SelectItem key={type.id} value={type.id.toString()}>
                                                        {type.name}
                                                    </SelectItem>))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>)}/>
                        </div>
                    </FormCard>

                    <FormCard title="Schedule & Cost" description="Set dates and amount" icon={Banknote}>
                        <div className="grid gap-6">
                            <div className="grid grid-cols-2 gap-6">
                                <FormField control={form.control} name="startDate" render={({ field }) => (<FormItem className="flex flex-col">
                                            <FormLabel>Start Date</FormLabel>
                                            <FormControl>
                                                <FormattedDatePicker value={field.value} onChange={field.onChange} placeholder="Pick a start date"/>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>)}/>

                                <FormField control={form.control} name="endDate" render={({ field }) => (<FormItem className="flex flex-col">
                                            <FormLabel>End Date (Optional)</FormLabel>
                                            <FormControl>
                                                <FormattedDatePicker value={field.value || undefined} onChange={field.onChange} placeholder="Pick an end date"/>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>)}/>
                            </div>

                            <FormField control={form.control} name="amount" render={({ field }) => (<FormItem>
                                        <FormLabel>
                                            Amount
                                            {selectedVehicle?.ownership === "OWN" && (<span className="text-red-500 ml-1">*</span>)}
                                        </FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" placeholder="0.00" {...field}/>
                                        </FormControl>
                                        <FormDescription>
                                            {selectedVehicle?.ownership === "OWN"
                                                ? "Required for owned vehicles"
                                                : "Optional for third-party vehicles"}
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>)}/>

                            {initialData && (<FormField control={form.control} name="status" render={({ field }) => (<FormItem>
                                            <FormLabel>Status</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select status"/>
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                                                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                                    <SelectItem value="COMPLETED">Completed</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>)}/>)}
                        </div>
                    </FormCard>
                </div>

                <FormCard title="Details" description="Add description or remarks" icon={FileText}>
                    <FormField control={form.control} name="description" render={({ field }) => (<FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Enter maintenance details..." className="resize-none" {...field}/>
                                </FormControl>
                                <FormMessage />
                            </FormItem>)}/>
                </FormCard>

                <StickyFooter isSaving={loading} onCancel={() => router.back()} saveLabel={initialData ? "Update Maintenance" : "Schedule Maintenance"}/>
            </form>
        </Form>);
}