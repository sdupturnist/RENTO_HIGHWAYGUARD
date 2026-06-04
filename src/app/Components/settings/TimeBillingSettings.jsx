"use client";
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Label } from "@/app/Components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/app/Components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/app/Components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Play, CalendarPlus, Lock } from "lucide-react";
import { useState } from "react";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
export function TimeBillingSettings({ onDirtyStateChange }) {
    const [generating, setGenerating] = useState(false);
    const autoDailyEnabled = true;
    const { register, handleSubmit, reset, control, formState: { isSubmitting, isDirty } } = useForm({
        defaultValues: {
            fullDayHours: 8,
            overtimeStartsAfter: 8,
            overtimeMultiplier: 1.5,
            holidayMultiplier: 2.0,
            weekendMultiplier: 1.5,
            weekendTreatedAs: "OVERTIME",
        }
    });
    const sanitizeData = (data) => {
        return {
            fullDayHours: data.fullDayHours ?? 8,
            overtimeStartsAfter: data.overtimeStartsAfter ?? 8,
            overtimeMultiplier: data.overtimeMultiplier ?? 1.5,
            holidayMultiplier: data.holidayMultiplier ?? 2.0,
            weekendMultiplier: data.weekendMultiplier ?? 1.5,
            weekendTreatedAs: data.weekendTreatedAs ?? "OVERTIME",
        };
    };
    useEffect(() => {
        fetch("/api/settings/company")
            .then(res => res.json())
            .then(data => {
                reset(sanitizeData(data));
            })
            .catch(() => toast.error("Failed to load settings"));
    }, [reset]);
    useEffect(() => {
        if (onDirtyStateChange) {
            onDirtyStateChange(isDirty);
        }
    }, [isDirty, onDirtyStateChange]);

    // Missing Logs State
    const [missingLogsOpen, setMissingLogsOpen] = useState(false);
    const [assignments, setAssignments] = useState([]);
    const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
    const [generatingMissing, setGeneratingMissing] = useState(false);

    // Fetch assignments when dialog opens
    useEffect(() => {
        if (missingLogsOpen && assignments.length === 0) {
            fetch("/api/assignments?perPage=100") // get recent assignments
                .then(res => res.json())
                .then(data => {
                    const allAssignments = data.assignments || [];
                    const activeAndCompleted = allAssignments.filter(a => a.status === "ACTIVE" || a.status === "COMPLETED");
                    setAssignments(activeAndCompleted);
                })
                .catch(err => {
                    toast.error("Failed to fetch assignments");
                    console.error(err);
                });
        }
    }, [missingLogsOpen, assignments.length]);

    const handleMissingLogsSubmit = async () => {
        if (!selectedAssignmentId) {
            toast.error("Please select an assignment");
            return;
        }
        setGeneratingMissing(true);
        try {
            const res = await fetch("/api/admin/generate-missing-logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    assignmentId: parseInt(selectedAssignmentId)
                })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message || `Generated ${data.createdCount} logs.`);
                setMissingLogsOpen(false);
                setSelectedAssignmentId("");
            } else {
                toast.error(data.message || "Failed to generate missing logs");
            }
        } catch (e) {
            toast.error("An error occurred");
        } finally {
            setGeneratingMissing(false);
        }
    };

    const selectedAssignment = assignments.find(a => a.id.toString() === selectedAssignmentId);
    const onSubmit = async (data) => {
        try {
            // Convert strings to numbers for numeric fields
            const numericData = {
                ...data,
                fullDayHours: Number(data.fullDayHours),
                overtimeStartsAfter: Number(data.overtimeStartsAfter),
                overtimeMultiplier: Number(data.overtimeMultiplier),
                holidayMultiplier: Number(data.holidayMultiplier),
                weekendMultiplier: Number(data.weekendMultiplier),
            };
            const res = await fetch("/api/settings/company", {
                method: "POST",
                body: JSON.stringify(numericData),
                headers: { "Content-Type": "application/json" }
            });
            if (res.ok) {
                toast.success("Settings saved successfully");
                const updated = await res.json();
                reset(sanitizeData(updated));
            }
            else {
                toast.error("Failed to save settings");
            }
        }
        catch (e) {
            toast.error("Error saving settings");
        }
    };
    const handleGenerateLogs = async () => {
        setGenerating(true);
        try {
            const res = await fetch("/api/admin/generate-time-logs", {
                method: "POST",
                body: JSON.stringify({ date: new Date() }), // Generate for today
                headers: { "Content-Type": "application/json" }
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
            }
            else {
                toast.error(data.message || "Failed to generate logs");
            }
        }
        catch (error) {
            toast.error("Error generating logs");
        }
        finally {
            setGenerating(false);
        }
    };
    return (<Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>Time & Billing Configuration</CardTitle>
                    <CardDescription>Configure working hours, overtime rules, and billing multipliers.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Dialog open={missingLogsOpen} onOpenChange={setMissingLogsOpen}>
                        <DialogTrigger asChild>
                            <Button variant="secondary" size="sm">
                                <CalendarPlus className="mr-2 h-4 w-4" />
                                Generate Missing Logs
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Generate Missing Logs</DialogTitle>
                                <DialogDescription>
                                    Select an assignment to automatically calculate and generate all missing daily time logs for all its blocks up to today.
                                    This will not create duplicate logs.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Assignment</Label>
                                    <Select value={selectedAssignmentId} onValueChange={setSelectedAssignmentId}>
                                        <SelectTrigger><SelectValue placeholder="Select Assignment" /></SelectTrigger>
                                        <SelectContent>
                                            {assignments.map(a => (
                                                <SelectItem key={a.id} value={a.id.toString()}>
                                                    {a.assignmentCode} - {a.customer?.companyName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setMissingLogsOpen(false)}>Cancel</Button>
                                <Button onClick={handleMissingLogsSubmit} disabled={generatingMissing || !selectedAssignmentId}>
                                    {generatingMissing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Generate"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Button variant="outline" size="sm" onClick={handleGenerateLogs} disabled={generating || !autoDailyEnabled} className={!autoDailyEnabled ? "opacity-60" : ""}>
                        {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : !autoDailyEnabled ? <Lock className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                        Run Auto-Generation (Today)
                    </Button>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="fullDayHours">Standard Full Day (Hours)</Label>
                        <Input id="fullDayHours" type="number" step="0.5" {...register("fullDayHours", { required: true, min: 0, max: 24 })} />
                        <p className="text-xs text-muted-foreground">Standard working hours per day</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="overtimeStartsAfter">Overtime Starts After (Hours)</Label>
                        <Input id="overtimeStartsAfter" type="number" step="0.5" {...register("overtimeStartsAfter", { required: true, min: 0, max: 24 })} />
                        <p className="text-xs text-muted-foreground">Hours after which overtime rates apply</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="overtimeMultiplier">Overtime Multiplier</Label>
                        <Input id="overtimeMultiplier" type="number" step="0.1" {...register("overtimeMultiplier", { required: true, min: 1 })} />
                        <div className="text-xs text-muted-foreground">e.g. 1.5x regular rate</div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="holidayMultiplier">Holiday Multiplier</Label>
                        <Input id="holidayMultiplier" type="number" step="0.1" {...register("holidayMultiplier", { required: true, min: 1 })} />
                        <div className="text-xs text-muted-foreground">e.g. 2.0x regular rate</div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="weekendMultiplier">Weekend Multiplier</Label>
                        <Input id="weekendMultiplier" type="number" step="0.1" {...register("weekendMultiplier", { required: true, min: 1 })} />
                        <div className="text-xs text-muted-foreground">Applied if weekend is treated as Overtime/Holiday</div>
                    </div>
                </div>

                <div className="space-y-2 max-w-md">
                    <Label htmlFor="weekendTreatedAs">Weekend Treated As</Label>
                    <Controller name="weekendTreatedAs" control={control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select rule" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="NORMAL">Normal Day (1.0x)</SelectItem>
                            <SelectItem value="OVERTIME">Overtime Rule</SelectItem>
                            <SelectItem value="HOLIDAY">Holiday Rule</SelectItem>
                        </SelectContent>
                    </Select>)} />
                    <p className="text-xs text-muted-foreground">Determines which multiplier applies on weekends. Note: Weekend days are defined in Localization settings.</p>
                </div>

                <div className="flex justify-end gap-4 pt-4">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isDirty ? "Save Changes" : "Saved"}
                    </Button>
                </div>
            </form>
        </CardContent>
    </Card>);
}
