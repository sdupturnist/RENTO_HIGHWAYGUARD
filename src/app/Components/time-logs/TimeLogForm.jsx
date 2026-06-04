"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, } from "@/app/Components/ui/form";
import { Input } from "@/app/Components/ui/input";
import { Textarea } from "@/app/Components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/app/Components/ui/select";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { toast } from "sonner";
import { Calendar } from "lucide-react";
import { FormCard } from "@/app/Components/ui/form-card";
import { StickyFooter } from "@/app/Components/ui/sticky-footer";
const timeLogSchema = z.object({
    date: z.date({ message: "Date is required" }),
    assignmentId: z.coerce.number().min(1, "Assignment is required"),
    assignmentBlockId: z.coerce.number().min(1, "Block is required"),
    workType: z.string().optional(),
    workedHours: z.coerce.number().min(0).max(24, "Cannot exceed 24 hours").optional().nullable(),
    quantity: z.coerce.number().min(0, "Quantity must be positive").optional().nullable(),
    isWeekend: z.coerce.boolean().default(false),
    isHoliday: z.coerce.boolean().default(false),
    remarks: z.string().optional(),
});
export function TimeLogForm({ initialData }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [assignments, setAssignments] = useState([]);
    
    const form = useForm({
        resolver: zodResolver(timeLogSchema),
        defaultValues: {
            date: initialData ? new Date(initialData.date) : new Date(),
            assignmentId: initialData?.assignmentId || 0,
            assignmentBlockId: initialData?.assignmentBlockId || 0,
            workType: initialData?.workType || "Full Day",
            workedHours: initialData?.workedHours !== undefined ? initialData.workedHours : 8,
            quantity: initialData?.quantity !== undefined ? initialData.quantity : 1,
            isWeekend: initialData?.isWeekend || false,
            isHoliday: initialData?.isHoliday || false,
            remarks: initialData?.remarks || "",
        },
    });

    const watchedAssignmentId = form.watch("assignmentId");
    const watchedBlockId = form.watch("assignmentBlockId");

    // Fetch Assignments on Mount — use a large perPage so all active assignments appear in the dropdown
    const { data: assignmentsData } = useQuery({
        queryKey: ["assignments-active"],
        queryFn: async () => {
            const res = await fetch("/api/assignments?status=ACTIVE&perPage=1000&page=1");
            const data = await res.json();
            return data.assignments || [];
        },
    });

    useEffect(() => {
        if (assignmentsData) setAssignments(assignmentsData);
    }, [assignmentsData]);

    // Fetch dynamic assignment details (to get detailed blocks and detour children)
    const { data: assignmentDetails } = useQuery({
        queryKey: ["assignment-details", watchedAssignmentId],
        queryFn: async () => {
            if (!watchedAssignmentId || watchedAssignmentId === "0" || watchedAssignmentId === 0) return null;
            const res = await fetch(`/api/assignments/${watchedAssignmentId}`);
            return res.json();
        },
        enabled: !!watchedAssignmentId && watchedAssignmentId !== "0" && watchedAssignmentId !== 0,
    });

    const availableBlocks = [];
    if (assignmentDetails?.blocks) {
        assignmentDetails.blocks.forEach(b => {
            if (b.blockType === "DETOUR") {
                if (b.detourChildren) {
                    b.detourChildren.forEach(child => {
                        let resourceLabel = "";
                        if (child.blockType === "VEHICLE" && child.vehicle) {
                            resourceLabel = `Vehicle: ${child.vehicle.regNo || child.vehicle.vehicleCode}`;
                        } else if (child.blockType === "OPERATOR" && child.operator) {
                            resourceLabel = `Operator: ${child.operator.name}`;
                        } else if (child.blockType === "MATERIAL" && child.material) {
                            resourceLabel = `Material: ${child.material.name}`;
                        } else if (child.blockType === "LABOUR" && child.labour) {
                            resourceLabel = `Labour: ${child.labour.labourType}`;
                        } else {
                            resourceLabel = `${child.blockType} Resource`;
                        }
                        availableBlocks.push({
                            id: child.id,
                            blockType: child.blockType,
                            label: `Detour: ${b.detourTemplate?.name || "Detour"} -> ${resourceLabel}`,
                            raw: child,
                        });
                    });
                }
            } else {
                let resourceLabel = "";
                if (b.blockType === "VEHICLE" && b.vehicle) {
                    resourceLabel = `Vehicle: ${b.vehicle.regNo || b.vehicle.vehicleCode}`;
                } else if (b.blockType === "OPERATOR" && b.operator) {
                    resourceLabel = `Operator: ${b.operator.name}`;
                } else if (b.blockType === "MATERIAL" && b.material) {
                    resourceLabel = `Material: ${b.material.name}`;
                } else if (b.blockType === "LABOUR" && b.labour) {
                    resourceLabel = `Labour: ${b.labour.labourType}`;
                } else {
                    resourceLabel = `${b.blockType} Resource`;
                }
                availableBlocks.push({
                    id: b.id,
                    blockType: b.blockType,
                    label: `${b.blockType}: ${resourceLabel}`,
                    raw: b,
                });
            }
        });
    }

    const selectedBlock = availableBlocks.find(b => b.id === Number(watchedBlockId));
    const blockType = selectedBlock?.blockType || initialData?.blockType || "VEHICLE";
    const isQtyBased = blockType === "MATERIAL" || blockType === "LABOUR";

    // Set default hours or quantity when block changes
    useEffect(() => {
        if (watchedBlockId && availableBlocks.length > 0 && !initialData) {
            const block = availableBlocks.find(b => b.id === Number(watchedBlockId));
            if (block) {
                if (block.blockType === "VEHICLE" || block.blockType === "OPERATOR") {
                    const hours = block.raw?.defaultHours || (8 + Number(block.raw?.plannedOvertimeHours || 0));
                    form.setValue("workedHours", hours);
                } else if (block.blockType === "MATERIAL" || block.blockType === "LABOUR") {
                    const qty = block.raw?.quantity || 1;
                    form.setValue("quantity", qty);
                }
            }
        }
    }, [watchedBlockId, availableBlocks, initialData, form]);
    // Fetch Company Settings to Determine Weekend
    const [weekendDays, setWeekendDays] = useState([]);
    const { data: companyData } = useQuery({
        queryKey: ["company-settings"],
        queryFn: async () => {
            const res = await fetch("/api/settings/company");
            return res.json();
        },
    });
    useEffect(() => {
        if (companyData?.weekendDays) {
            setWeekendDays(Array.isArray(companyData.weekendDays) ? companyData.weekendDays : []);
        }
    }, [companyData]);
    const watchedDate = form.watch("date");
    useEffect(() => {
        if (watchedDate && weekendDays.length > 0) {
            const dayName = format(watchedDate, "EEEE");
            const isWeekend = weekendDays.includes(dayName);
            // Always enforce the company setting for weekend
            form.setValue("isWeekend", isWeekend);
        }
    }, [watchedDate, weekendDays, form]);
    const { mutate: saveTimeLog, isPending: loading } = useMutation({
        mutationFn: async (values) => {
            const url = initialData ? `/api/time-logs/${initialData.id}` : "/api/time-logs";
            const method = initialData ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            const data = await res.json();
            if (res.status === 409) {
                throw new Error(data.message || "Duplicate time log exists");
            }
            if (!res.ok) {
                throw new Error(data.message || "Something went wrong");
            }
            return data;
        },
        onSuccess: async () => {
            toast.success(initialData ? "Time log updated" : "Time log created");
            // Invalidate and wait for refetch to complete BEFORE navigating,
            // so the list page has fresh data the moment it mounts.
            await queryClient.invalidateQueries({
                queryKey: ["time-logs"],
                refetchType: "all",
            });
            router.refresh();
            router.push("/time-logs");
        },
        onError: (error) => {
            toast.error(error.message);
        },
    });
    const onSubmit = (values) => {
        const payload = {
            ...values,
            workedHours: isQtyBased ? 0 : Number(values.workedHours || 0),
            quantity: isQtyBased ? Number(values.quantity || 1) : null,
            workType: isQtyBased ? (blockType === "MATERIAL" ? "Material" : "Labour") : (values.workType || "Full Day"),
        };
        saveTimeLog(payload);
    };
    return (<Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-24">
                <FormCard title="Time Log Details" description="Record daily vehicle and operator time" icon={Calendar}>
                    <div className="grid gap-6 md:grid-cols-2">

                        <div className="md:col-span-2">
                            <FormField control={form.control} name="date" render={({ field }) => (<FormItem>
                                        <FormLabel>Date <span className="text-red-500">*</span></FormLabel>
                                        <FormControl>
                                            <FormattedDatePicker value={field.value} onChange={field.onChange} placeholder="Select date"/>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>)}/>
                        </div>

                        <FormField control={form.control} name="assignmentId" render={({ field }) => (<FormItem>
                                    <FormLabel>Assignment <span className="text-red-500">*</span></FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value ? String(field.value) : undefined} disabled={!!initialData}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Assignment"/>
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {assignments.map((assignment) => (<SelectItem key={assignment.id} value={String(assignment.id)}>
                                                    {assignment.assignmentCode} - {assignment.customer?.companyName || "Internal"}
                                                </SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>)}/>

                        <FormField control={form.control} name="assignmentBlockId" render={({ field }) => (<FormItem>
                                    <FormLabel>Deployment Block <span className="text-red-500">*</span></FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value ? String(field.value) : undefined} disabled={!watchedAssignmentId || !!initialData}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={initialData ? "Loading Block..." : "Select Block"}/>
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {availableBlocks.map((b) => (<SelectItem key={b.id} value={String(b.id)}>
                                                    {b.label}
                                                </SelectItem>))}
                                            {initialData && availableBlocks.length === 0 && (
                                                <SelectItem value={String(initialData.assignmentBlockId)}>
                                                    {initialData.resourceNameSnapshot || `Block #${initialData.assignmentBlockId}`}
                                                </SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>)}/>

                        {/* Work Type Removed from UI - defaults to 'Full Day' via form defaultValues */}
                        <input type="hidden" {...form.register("workType")}/>

                        <div className="grid grid-cols-2 gap-4 md:col-span-2">
                            {isQtyBased ? (
                                <FormField control={form.control} name="quantity" render={({ field }) => (<FormItem>
                                            <FormLabel>Quantity <span className="text-red-500">*</span></FormLabel>
                                            <FormControl>
                                                <Input type="number" step="1" min="1" {...field} onChange={e => field.onChange(Number(e.target.value))}/>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>)}/>
                            ) : (
                                <FormField control={form.control} name="workedHours" render={({ field }) => (<FormItem>
                                            <FormLabel>Worked Hours <span className="text-red-500">*</span></FormLabel>
                                            <FormControl>
                                                <Input type="number" step="0.5" min="0" max="24" {...field} onChange={e => field.onChange(Number(e.target.value))}/>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>)}/>
                            )}
                        </div>

                        <div className="flex gap-6 md:col-span-2">
                            {/* Weekend Indicator - Only show if true */}
                            {form.getValues("isWeekend") && (<div className="p-3 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-2 text-amber-800 text-sm flex-1">
                                    <span className="font-semibold">Note:</span>
                                    This date falls on a weekend as per company settings.
                                </div>)}

                            {/* Hidden field to ensure value is submitted */}
                            <input type="hidden" {...form.register("isWeekend")}/>
                            <FormField control={form.control} name="isHoliday" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 shadow-sm h-full">
                                        <FormControl>
                                            <input type="checkbox" checked={field.value} onChange={field.onChange} className="h-4 w-4"/>
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel>
                                                Is Holiday?
                                            </FormLabel>
                                        </div>
                                    </FormItem>)}/>
                        </div>

                        <div className="md:col-span-2">
                            <FormField control={form.control} name="remarks" render={({ field }) => (<FormItem>
                                        <FormLabel>Remarks</FormLabel>
                                        <FormControl>
                                            <Textarea {...field} placeholder="Optional remarks..."/>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>)}/>
                        </div>

                    </div>
                </FormCard>

                <StickyFooter isSaving={loading} cancelLink="/time-logs" saveLabel={initialData ? "Update Time Log" : "Create Time Log"}/>
            </form>
        </Form>);
}