"use client";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/app/Components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/app/Components/ui/dialog";
import { Label } from "@/app/Components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/Components/ui/select";
import { Input } from "@/app/Components/ui/input";
import { Switch } from "@/app/Components/ui/switch";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
export function TimesheetGenerator({ currentUserRole }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [duplicateId, setDuplicateId] = useState(null);
    const [conflictDetails, setConflictDetails] = useState(null);
    // Selection
    const [isInternal, setIsInternal] = useState(false);
    const [customerId, setCustomerId] = useState("");
    const [projectId, setProjectId] = useState("");

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
            setSelectedMonth("");
            setSelectedYear(new Date().getFullYear().toString());
            setPeriodStart("");
            setPeriodEnd("");
        }
    };

    const handleCustomerChange = (val) => {
        setCustomerId(val);
        setProjectId("");
    };

    const handleGenerate = async (forceOverlapping = false) => {
        if (!isInternal && !customerId && !projectId) {
            toast.error("Validation Error", { description: "Select Customer or Project, or enable Internal mode" });
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
                payload = { isInternal: true, periodStart, periodEnd, force: forceOverlapping };
            } else {
                let finalCustomerId = parseInt(customerId);
                let finalProjectId = projectId ? parseInt(projectId) : undefined;
                if (finalProjectId) {
                    const proj = projects.find(p => p.id === finalProjectId);
                    if (proj) finalCustomerId = proj.customerId;
                }
                payload = { customerId: finalCustomerId, projectId: finalProjectId, periodStart, periodEnd, force: forceOverlapping };
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
                router.refresh();
            }
            else {
                const err = await response.json();
                if (response.status === 409 && err.existingId) {
                    setDuplicateId(err.existingId);
                    if (err.conflictType === "OVERLAP") {
                        setConflictDetails({
                            code: err.existingCode,
                            period: err.existingPeriod
                        });
                    }
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

    const handleProceedAnyway = () => {
        handleGenerate(true);
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
            {duplicateId ? (
                conflictDetails ? (
                    <>
                        <DialogHeader>
                            <DialogTitle className="text-amber-600">Overlap Detected</DialogTitle>
                            <DialogDescription>
                                A timesheet <strong>({conflictDetails.code})</strong> already exists for the period <strong>{conflictDetails.period}</strong>.
                                <br /><br />
                                Creating another timesheet for this period may result in duplicate logs being billed.
                                <br /><br />
                                Are you sure you want to proceed?
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-3 py-4">
                            <Button onClick={handleProceedAnyway} variant="destructive" className="w-full" disabled={loading}>
                                {loading ? "Creating..." : "Proceed Anyway (Create Duplicate)"}
                            </Button>
                            <Button onClick={handleViewExisting} variant="secondary" className="w-full">
                                View Existing Timesheet
                            </Button>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => { setDuplicateId(null); setConflictDetails(null); }}>Back</Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>Timesheet Already Exists</DialogTitle>
                            <DialogDescription>
                                A timesheet for this period and scope already exists.
                                Would you like to view it or regenerate it?
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-3 py-4">
                            <Button onClick={handleViewExisting} variant="secondary" className="w-full">
                                View Existing Timesheet
                            </Button>
                            {canGenerate && (<Button onClick={handleRegenerateExisting} variant="outline" className="w-full" disabled={loading}>
                                {loading ? "Regenerating..." : "Regenerate Existing"}
                            </Button>)}
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setDuplicateId(null)}>Back</Button>
                        </DialogFooter>
                    </>)
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
                        <Switch checked={isInternal} onCheckedChange={(v) => { setIsInternal(v); setCustomerId(""); setProjectId(""); }} />
                    </div>

                    {!isInternal && (<>
                    <div className="space-y-2">
                        <Label>Customer</Label>
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
                        <Label>Project (Optional)</Label>
                        <Select value={projectId} onValueChange={setProjectId} disabled={!customerId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Project" />
                            </SelectTrigger>
                            <SelectContent position="popper" className="z-[100]">
                                <SelectItem value="0">-- All Projects --</SelectItem>
                                {filteredProjects.map(p => (<SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    </div>
                    </>)}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Month (Optional)</Label>
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
                    <Button onClick={() => handleGenerate(false)} disabled={loading}>
                        {loading ? "Generating..." : "Generate"}
                    </Button>
                </DialogFooter>
            </>)}
        </DialogContent>
    </Dialog>);
}
