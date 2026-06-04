"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { UserCog, Loader2 } from "lucide-react";
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
    changeDate: z.date({
        required_error: "Change date is required.",
    }),
    newOperatorId: z.coerce.number().min(1, "Please select a replacement operator."),
    reason: z.string().optional(),
});

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function ChangeOperatorModal({ assignmentId, block }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);

    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            reason: "",
        },
    });

    const { data: allOperators = [], isLoading: fetchingOperators } = useQuery({
        queryKey: ["operators"],
        queryFn: async () => {
            const res = await fetch("/api/operators");
            if (!res.ok) throw new Error("Failed to load operators");
            return res.json();
        },
        enabled: open,
        staleTime: 30 * 1000,
    });

    // Filter out operators that are not ACTIVE and the current operator
    const operators = allOperators.filter(
        (o) => o.status === "ACTIVE" && o.id !== block.operatorId
    );

    const { mutate: changeOperator, isPending: loading } = useMutation({
        mutationFn: async (values) => {
            const body = {
                changeDate: values.changeDate.toISOString(),
                newOperatorId: values.newOperatorId,
                reason: values.reason,
            };

            const res = await fetch(
                `/api/assignments/${assignmentId}/blocks/${block.id}/change-operator`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                }
            );

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to change operator");
            }
            return res.json();
        },
        onSuccess: () => {
            toast.success("Operator changed successfully");
            setOpen(false);
            queryClient.invalidateQueries({ queryKey: ["assignments"] });
            queryClient.invalidateQueries({ queryKey: ["assignment", assignmentId] });
            router.refresh();
        },
        onError: (error) => {
            toast.error(error.message);
        }
    });

    const handleOpenChange = (newOpen) => {
        setOpen(newOpen);
        if (!newOpen) {
            form.reset();
        }
    };

    const onSubmit = (values) => {
        if (values.changeDate <= new Date(block.startDate)) {
            form.setError("changeDate", {
                type: "manual",
                message: "Change date must be after the block's start date.",
            });
            return;
        }

        if (values.changeDate > new Date(block.endDate)) {
            form.setError("changeDate", {
                type: "manual",
                message: "Change date must be within the block's current period.",
            });
            return;
        }
        changeOperator(values);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <UserCog className="mr-2 h-4 w-4" />
                    Change Operator
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Change Operator</DialogTitle>
                    <DialogDescription>
                        Splits the current assignment block into two segments. The new operator will take over starting from the change date.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                        <FormField
                            control={form.control}
                            name="newOperatorId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>New Operator</FormLabel>
                                    <Select
                                        disabled={fetchingOperators}
                                        onValueChange={(val) => field.onChange(parseInt(val))}
                                        value={field.value?.toString()}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={fetchingOperators ? "Loading..." : "Select new operator"} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {operators.map((o) => (
                                                <SelectItem key={o.id} value={o.id.toString()}>
                                                    {o.name} ({o.operatorCode})
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
                            name="changeDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Change Date</FormLabel>
                                    <FormControl>
                                        <FormattedDatePicker
                                            value={field.value}
                                            onChange={field.onChange}
                                            placeholder="Pick change date"
                                            minDate={new Date(new Date(block.startDate).getTime() + 86400000)}
                                            maxDate={new Date(block.endDate)}
                                        />
                                    </FormControl>
                                    <p className="text-[0.8rem] text-muted-foreground mt-1">
                                        The old operator's block will end the day before this date.
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
                                            placeholder="Why is this operator being replaced?"
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
                                Change Operator
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
