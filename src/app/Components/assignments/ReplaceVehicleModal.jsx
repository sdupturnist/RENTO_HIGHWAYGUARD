"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { Lock } from "lucide-react";

import { Button } from "@/app/Components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/app/Components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/app/Components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/app/Components/ui/select";
import { Textarea } from "@/app/Components/ui/textarea";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";

const formSchema = z.object({
    replacementDate: z.date({
        required_error: "Replacement date is required.",
    }),
    newVehicleId: z.coerce.number().min(1, "Please select a replacement vehicle."),
    reason: z.string().optional(),
});

export function ReplaceVehicleModal({ assignmentId, block }) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            reason: "",
        },
    });

    // Load available vehicles when modal opens
    const { data: vehicles = [], isLoading: fetchingVehicles } = useQuery({
        queryKey: ["available-vehicles-for-replace", block.vehicleId],
        queryFn: async () => {
            const res = await fetch("/api/vehicles");
            if (!res.ok) throw new Error("Failed to load vehicles");
            const data = await res.json();
            return data.filter(
                (v) => v.status === "ACTIVE" && v.id !== block.vehicleId
            );
        },
        enabled: open,
    });

    // Handle modal close to reset form
    const handleOpenChange = (newOpen) => {
        setOpen(newOpen);
        if (!newOpen) {
            form.reset();
        }
    };

    const onSubmit = async (values) => {
        // Validate that replacement date is within the block's current period
        const replacementDateStr = format(values.replacementDate, "yyyy-MM-dd");
        const blockStartStr = format(new Date(block.startDate), "yyyy-MM-dd");
        const blockEndStr = format(new Date(block.endDate), "yyyy-MM-dd");

        if (values.replacementDate <= new Date(block.startDate)) {
            form.setError("replacementDate", {
                type: "manual",
                message: "Replacement date must be after the block's start date.",
            });
            return;
        }

        if (values.replacementDate > new Date(block.endDate)) {
            form.setError("replacementDate", {
                type: "manual",
                message: "Replacement date must be within the block's current period.",
            });
            return;
        }

        setLoading(true);
        try {
            const body = {
                replacementDate: values.replacementDate.toISOString(),
                newVehicleId: values.newVehicleId,
                reason: values.reason,
            };

            const res = await fetch(
                `/api/assignments/${assignmentId}/blocks/${block.id}/replace-vehicle`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                }
            );

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to replace vehicle");
            }

            toast.success("Vehicle replaced successfully");
            setOpen(false);
            queryClient.invalidateQueries({ queryKey: ["assignments"] });
            queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] });
            router.refresh();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    Replace Vehicle
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Replace Vehicle</DialogTitle>
                    <DialogDescription>
                        Splits the current assignment block into two segments. The original vehicle will be released, and the new vehicle will take over starting from the replacement date.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        <FormField
                            control={form.control}
                            name="newVehicleId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Replacement Vehicle</FormLabel>
                                    <Select
                                        disabled={fetchingVehicles}
                                        onValueChange={(val) => field.onChange(parseInt(val))}
                                        value={field.value?.toString()}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={fetchingVehicles ? "Loading..." : "Select new vehicle"} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {vehicles.map((v) => (
                                                <SelectItem key={v.id} value={v.id.toString()}>
                                                    {v.vehicleCode} ({v.regNo || "No Reg"}) — {v.model?.name ?? ""}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="replacementDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Replacement Date</FormLabel>
                                    <FormControl>
                                        <FormattedDatePicker
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Pick replacement date"
                                            minDate={new Date(new Date(block.startDate).getTime() + 86400000)}
                                            maxDate={new Date(block.endDate)}
                                        />
                                    </FormControl>
                                    <p className="text-[0.8rem] text-muted-foreground mt-1">
                                        The old vehicle's block will end the day before this date.
                                    </p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reason (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Why is this vehicle being replaced?"
                                            className="resize-none"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setOpen(false)}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Replace Vehicle
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
