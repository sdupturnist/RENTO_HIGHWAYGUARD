"use client";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/app/Components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/app/Components/ui/dialog";
import { Label } from "@/app/Components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/Components/ui/select";
import { Input } from "@/app/Components/ui/input";
import { Switch } from "@/app/Components/ui/switch";
import { Checkbox } from "@/app/Components/ui/checkbox";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
export function TimesheetGenerator({ currentUserRole }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [duplicateId, setDuplicateId] = useState(null);
    const [conflictDetails, setConflictDetails] = useState(null);
    // Selection
    const [isInternal, setIsInternal] = useState(false);
    const [customerId, setCustomerId] = useState("");
    const [projectId, setProjectId] = useState("");
    const [selectedAssignmentIds, setSelectedAssignmentIds] = useState([]);

    // Month/Year Selection
    const [selectedMonth, setSelectedMonth] = useState("");
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

    const [periodStart, setPeriodStart] = useState("");
    const [periodEnd, setPeriodEnd] = useState("");

    // Update dates when month/year changes (derived state - keep useEffect)
    useEffect(() => {
        if (selectedMonth !== "" && selectedYear) {
            if (selectedMonth === "custom") {
                setPeriodStart("");
                setPeriodEnd("");
                return;
            }
            const month = parseInt(selectedMonth);
            const year = parseInt(selectedYear);
            if (!isNaN(month) && !isNaN(year)) {
                const date = new Date(year, month, 1);
                setPeriodStart(format(startOfMonth(date), "yyyy-MM-dd"));
                setPeriodEnd(format(endOfMonth(date), "yyyy-MM-dd"));
            }
        }
    }, [selectedMonth, selectedYear]);

    const isPeriodLocked = selectedMonth !== "";

    // Fetch customers and projects with useQuery (enabled when dialog is open)
    const { data: customers = [] } = useQuery({
        queryKey: ["clients-active-assignments"],
        queryFn: async () => {
            const res = await fetch("/api/clients?hasActiveAssignments=true");
            if (!res.ok) throw new Error("Failed to fetch customers");
            return res.json();
        },
        enabled: open,
    });

    const { data: projects = [] } = useQuery({
        queryKey: ["projects-active-assignments"],
        queryFn: async () => {
            const res = await fetch("/api/projects?hasActiveAssignments=true");
            if (!res.ok) throw new Error("Failed to fetch projects");
            return res.json();
        },
        enabled: open,
    });

    const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
        queryKey: ["assignments-for-timesheet", projectId, isInternal],
        queryFn: async () => {
            if (isInternal) {
                const res = await fetch("/api/assignments?isInternal=true&perPage=100");
                if (!res.ok) throw new Error("Failed to fetch internal assignments");
                const data = await res.json();
                return (data.assignments || []).filter(a => a.status === "ACTIVE" || a.status === "COMPLETED");
            }
            if (!projectId || projectId === "0") return [];
            const res = await fetch(`/api/assignments?projectId=${projectId}&perPage=100`);
            if (!res.ok) throw new Error("Failed to fetch project assignments");
            const data = await res.json();
            return (data.assignments || []).filter(a => a.status === "ACTIVE" || a.status === "COMPLETED");
        },
        enabled: open && (isInternal || (!!projectId && projectId !== "0")),
    });

    const MONTHS = [
        { value: "0", label: "January" },
        { value: "1", label: "February" },
        { value: "2", label: "March" },
        { value: "3", label: "April" },
        { value: "4", label: "May" },
        { value: "5", label: "June" },
        { value: "6", label: "July" },
        { value: "7", label: "August" },
        { value: "8", label: "September" },
        { value: "9", label: "October" },
        { value: "10", label: "November" },
        { value: "11", label: "December" },
    ];
    const YEARS = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
    const handleOpenChange = (isOpen) => {
        setOpen(isOpen);
        if (isOpen) {
            setDuplicateId(null);
            setConflictDetails(null);
            setIsInternal(false);
            setCustomerId("");
            setProjectId("");
            setSelectedAssignmentIds([]);
            setSelectedMonth("");
            setSelectedYear(new Date().getFullYear().toString());
            setPeriodStart("");
            setPeriodEnd("");
        }
    };

    const handleCustomerChange = (val) => {
        setCustomerId(val);
        setProjectId("");
        setSelectedAssignmentIds([]);
    };

    const handleGenerate = async () => {
        if (!isInternal) {
            if (!customerId) {
                toast.error("Validation Error", { description: "Customer is required" });
                return;
            }
            if (!projectId || projectId === "0") {
                toast.error("Validation Error", { description: "Project is required" });
                return;
            }
        }
        if (selectedAssignmentIds.length === 0) {
            toast.error("Validation Error", { description: "Select at least one assignment" });
            return;
        }
        if (!periodStart || !periodEnd) {
            toast.error("Validation Error", { description: "Select Period" });
            return;
        }
        setLoading(true);
        try {
            let payload;
            if (isInternal) {
                payload = { isInternal: true, periodStart, periodEnd, assignmentIds: selectedAssignmentIds };
            } else {
                let finalCustomerId = parseInt(customerId);
                let finalProjectId = projectId ? parseInt(projectId) : undefined;
                if (finalProjectId) {
                    const proj = projects.find(p => p.id === finalProjectId);
                    if (proj) finalCustomerId = proj.customerId;
                }
                payload = { customerId: finalCustomerId, projectId: finalProjectId, periodStart, periodEnd, assignmentIds: selectedAssignmentIds };
            }
            const response = await fetch("/api/timesheets/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                const ts = await response.json();
                toast.success("Timesheet Generated", { description: `Timesheet ${ts.timesheetCode} created.` });
                setOpen(false);
                setDuplicateId(null);
                setConflictDetails(null);
                setSelectedAssignmentIds([]);
                queryClient.invalidateQueries({ queryKey: ["timesheets"] });
                queryClient.invalidateQueries({ queryKey: ["uninvoiced-timesheets"] });
                router.refresh();
            }
            else {
                const err = await response.json();
                if (response.status === 409 && err.existingId) {
                    setDuplicateId(err.existingId);
                    setConflictDetails(err);
                }
                else {
                    toast.error("Error", { description: err.error || "Failed" });
                }
            }
        }
        catch (error) {
            console.error(error);
            toast.error("Request failed");
        }
        finally {
            setLoading(false);
        }
    };

    const handleViewExisting = () => {
        if (duplicateId) {
            router.push(`/timesheets/${duplicateId}`);
            setOpen(false);
        }
    };

    const handleRegenerateExisting = async () => {
        if (!duplicateId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/timesheets/${duplicateId}/regenerate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ generatedBy: currentUserRole })
            });
            if (res.ok) {
                toast.success("Timesheet Regenerated");
                setOpen(false);
                setDuplicateId(null);
                setConflictDetails(null);
                setSelectedAssignmentIds([]);
                queryClient.invalidateQueries({ queryKey: ["timesheets"] });
                queryClient.invalidateQueries({ queryKey: ["uninvoiced-timesheets"] });
                router.refresh();
            } else {
                const err = await res.json();
                toast.error("Error", { description: err.error || "Failed to regenerate" });
            }
        } catch (e) {
            toast.error("Request failed");
        } finally {
            setLoading(false);
        }
    };

    const filteredProjects = projects.filter(p => !customerId || p.customerId === parseInt(customerId));

    const { can, loading: permsLoading } = usePermissions();
    const canGenerate = can("Timesheet", "Generate");
    if (permsLoading)
        return null;
    if (!canGenerate)
        return null;
    return (<Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
            <Button>Generate Timesheet</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
            {duplicateId && conflictDetails ? (
                <>
                    <DialogHeader>
                        <DialogTitle className="text-amber-600">Timesheet Already Exists</DialogTitle>
                        <DialogDescription>
                            {conflictDetails.conflictType === "EXACT" ? (
                                <>
                                    A timesheet <strong>({conflictDetails.existingCode})</strong> already exists for this exact same period and assignments.
                                    <br /><br />
                                    Would you like to view it or regenerate it?
                                </>
                            ) : (
                                <>
                                    One or more of the selected assignments already fall under an existing timesheet <strong>({conflictDetails.existingCode})</strong> for the overlapping period <strong>{conflictDetails.existingPeriod}</strong>.
                                    <br /><br />
                                    To proceed, please view the existing timesheet.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 py-4">
                        <Button onClick={handleViewExisting} variant="secondary" className="w-full">
                            View Existing Timesheet
                        </Button>
                        {conflictDetails.conflictType === "EXACT" && !conflictDetails.isApproved && canGenerate && (
                            <Button onClick={handleRegenerateExisting} variant="outline" className="w-full" disabled={loading}>
                                {loading ? "Regenerating..." : "Regenerate Existing"}
                            </Button>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => { setDuplicateId(null); setConflictDetails(null); }}>Back</Button>
                    </DialogFooter>
                </>
            ) : (<>
                <DialogHeader>
                    <DialogTitle>Generate Timesheet</DialogTitle>
                    <DialogDescription>
                        Select criteria to aggregate Daily Time Logs.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                            <Label className="text-sm font-medium">Internal Timesheet</Label>
                            <p className="text-xs text-muted-foreground">Aggregate all internal assignment logs (no customer)</p>
                        </div>
                        <Switch checked={isInternal} onCheckedChange={(v) => { setIsInternal(v); setCustomerId(""); setProjectId(""); setSelectedAssignmentIds([]); }} />
                    </div>

                    {!isInternal && (<>
                    <div className="space-y-2">
                        <Label>Customer <span className="text-red-500">*</span></Label>
                        <Select value={customerId} onValueChange={handleCustomerChange}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Customer" />
                            </SelectTrigger>
                            <SelectContent position="popper" className="z-[100]">
                                {customers.map(c => (<SelectItem key={c.id} value={c.id.toString()}>{c.companyName}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Project <span className="text-red-500">*</span></Label>
                        <Select value={projectId} onValueChange={(val) => { setProjectId(val); setSelectedAssignmentIds([]); }} disabled={!customerId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Project" />
                            </SelectTrigger>
                            <SelectContent position="popper" className="z-[100]">
                                {filteredProjects.map(p => (<SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    </div>
                    </>)}

                    {(isInternal || (projectId && projectId !== "0")) && (
                        <div className="space-y-2">
                            <Label>Select Assignment(s) <span className="text-red-500">*</span></Label>
                            {assignmentsLoading ? (
                                <div className="text-xs text-muted-foreground py-2">Loading assignments...</div>
                            ) : assignments.length === 0 ? (
                                <div className="text-xs text-red-500 py-2">No active/completed assignments found.</div>
                            ) : (
                                <div className="border border-input rounded-md p-3 max-h-40 overflow-y-auto space-y-2 bg-background">
                                    {assignments.map((a) => {
                                        const code = a.assignmentCode || `#${a.id}`;
                                        const range = `${format(new Date(a.startDate), "yyyy-MM-dd")} to ${format(new Date(a.endDate), "yyyy-MM-dd")}`;
                                        return (
                                            <div key={a.id} className="flex items-center space-x-2 py-0.5">
                                                <Checkbox
                                                    id={`assign-${a.id}`}
                                                    checked={selectedAssignmentIds.includes(a.id)}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            setSelectedAssignmentIds(prev => [...prev, a.id]);
                                                        } else {
                                                            setSelectedAssignmentIds(prev => prev.filter(id => id !== a.id));
                                                        }
                                                    }}
                                                />
                                                <label
                                                    htmlFor={`assign-${a.id}`}
                                                    className="text-xs font-medium leading-none cursor-pointer select-none"
                                                >
                                                    {code} <span className="text-muted-foreground">({range})</span>
                                                </label>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Month</Label>
                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Custom Period" />
                                </SelectTrigger>
                                <SelectContent position="popper" className="z-[100] max-h-60">
                                    <SelectItem value="custom">-- Custom Period --</SelectItem>
                                    {MONTHS.map(m => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Year</Label>
                            <Select value={selectedYear} onValueChange={setSelectedYear} disabled={!selectedMonth || selectedMonth === "custom"}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent position="popper" className="z-[100]">
                                    {YEARS.map(y => (<SelectItem key={y} value={y}>{y}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>From Date</Label>
                            <Input
                                type="date"
                                value={periodStart}
                                onChange={(e) => setPeriodStart(e.target.value)}
                                disabled={isPeriodLocked && selectedMonth !== "custom"}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>To Date</Label>
                            <Input
                                type="date"
                                value={periodEnd}
                                onChange={(e) => setPeriodEnd(e.target.value)}
                                disabled={isPeriodLocked && selectedMonth !== "custom"}
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleGenerate} disabled={loading}>
                        {loading ? "Generating..." : "Generate"}
                    </Button>
                </DialogFooter>
            </>)}
        </DialogContent>
    </Dialog>);
}
