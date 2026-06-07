"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Badge } from "@/app/Components/ui/badge";
import { Button } from "@/app/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/Components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Download, RefreshCw, Trash2, ArrowLeft, Send, CheckCircle, Pencil, FileText, Paperclip, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/app/Components/ui/alert";
import Link from "next/link";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/app/Components/ui/alert-dialog";
import { generateTimesheetPDF } from "@/app/lib/timesheet-pdf";
import { PermissionGate } from "@/app/Components/auth/PermissionGate";
import { PERMISSIONS } from "@/app/lib/permissions-constants";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/Components/ui/dialog";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { Textarea } from "@/app/Components/ui/textarea";
import { ActivityLogList } from "@/app/Components/common/ActivityLogList";

const VIEW_MODES = [
    { value: "DETAILED", label: "Detailed" },
    { value: "GROUP_BY_RESOURCE", label: "Group by Resource" },
    { value: "GROUP_BY_DETOUR", label: "Group by Detour" },
];

function applyViewMode(lines, mode) {
    if (mode !== "GROUP_BY_RESOURCE" && mode !== "GROUP_BY_DETOUR" && mode !== "DETAILED") {
        mode = "DETAILED";
    }
    if (mode === "DETAILED") {
        const detailedMap = new Map();
        const remainingLines = [];

        for (const line of lines) {
            const dVal = new Date(line.date);
            const dateStr = !isNaN(dVal.getTime()) ? dVal.toISOString().slice(0, 10) : "";
            const bt = line.blockType || "VEHICLE";

            if (bt === "VEHICLE") {
                const key = `${dateStr}-${line.vehicleId}`;
                detailedMap.set(key, { ...line, _dateLabel: format(dVal, "dd MMM") });
            } else {
                remainingLines.push(line);
            }
        }

        for (const line of remainingLines) {
            const dVal = new Date(line.date);
            const dateStr = !isNaN(dVal.getTime()) ? dVal.toISOString().slice(0, 10) : "";
            const bt = line.blockType || "VEHICLE";

            if (bt === "OPERATOR" && line.vehicleId) {
                const key = `${dateStr}-${line.vehicleId}`;
                if (detailedMap.has(key)) {
                    const vehicleEntry = detailedMap.get(key);
                    vehicleEntry.operator = line.operator || { name: line.resourceNameSnapshot, id: line.operatorId };
                    // Set operatorName snapshot fallback
                    vehicleEntry.operatorName = line.operatorName || line.resourceNameSnapshot;
                    continue;
                }
            }
            const uniqueKey = `OTHER-${line.id || Math.random()}`;
            detailedMap.set(uniqueKey, { ...line, _dateLabel: format(dVal, "dd MMM") });
        }

        return Array.from(detailedMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    const grouped = new Map();
    for (const line of lines) {
        const blockType = line.blockType || "VEHICLE";
        let key;
        if (mode === "GROUP_BY_RESOURCE") {
            if (blockType === "VEHICLE") key = `V-${line.vehicleId}`;
            else if (blockType === "OPERATOR") key = `O-${line.operatorId}`;
            else if (blockType === "MATERIAL") key = `M-${line.materialId}`;
            else key = `L-${line.labourTypeId}`;
        } else if (mode === "GROUP_BY_VEHICLE_TYPE") {
            key = `VT-${line.vehicleTypeName || "other"}`;
        } else if (mode === "GROUP_BY_OPERATOR") {
            key = `OP-${line.operatorId || "none"}`;
        } else if (mode === "GROUP_BY_DETOUR") {
            key = `DET-${line.detourBlockId || "direct"}`;
        } else if (mode === "BUNDLE_SUMMARY") {
            key = `BDL-${line.detourTemplateName || line.resourceNameSnapshot || blockType}`;
        } else {
            key = `${blockType}-${line.vehicleId || line.operatorId || line.materialId || line.labourTypeId}`;
        }

        if (!grouped.has(key)) {
            grouped.set(key, { ...line, _dates: [], regularHours: 0, overtimeHours: 0, holidayHours: 0, totalHours: 0, quantity: 0, calculatedAmount: 0 });
        }
        const entry = grouped.get(key);
        entry._dates.push(line.date);
        entry.regularHours += Number(line.regularHours || 0);
        entry.overtimeHours += Number(line.overtimeHours || 0);
        entry.holidayHours += Number(line.holidayHours || 0);
        entry.totalHours += Number(line.totalHours || 0);
        entry.quantity += Number(line.quantity || 0);
        entry.calculatedAmount += Number(line.calculatedAmount || 0);
    }

    return Array.from(grouped.values()).map(entry => {
        const timestamps = entry._dates.map(d => new Date(d).getTime()).filter(Boolean);
        const minDate = timestamps.length ? new Date(Math.min(...timestamps)) : null;
        const maxDate = timestamps.length ? new Date(Math.max(...timestamps)) : null;
        const _dateLabel = minDate && maxDate && minDate.getTime() !== maxDate.getTime()
            ? `${format(minDate, "dd MMM")} – ${format(maxDate, "dd MMM")}`
            : minDate ? format(minDate, "dd MMM") : "—";
        return { ...entry, _dateLabel };
    });
}

export function TimesheetDetail({ timesheet }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [regenerating, setRegenerating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [sending, setSending] = useState(false);

    // Approval State
    const [showApprovalDialog, setShowApprovalDialog] = useState(false);
    const [approvalDate, setApprovalDate] = useState(new Date());
    const [approvalNote, setApprovalNote] = useState("");
    const [approving, setApproving] = useState(false);

    // Notes State
    const [editingNotes, setEditingNotes] = useState(false);
    const [notesText, setNotesText] = useState(timesheet.notes || "");
    const [savingNotes, setSavingNotes] = useState(false);
    const [viewMode, setViewMode] = useState(timesheet.viewMode || "DETAILED");

    const viewedLines = useMemo(() => applyViewMode(timesheet.lines, viewMode), [timesheet.lines, viewMode]);

    const handleViewModeChange = async (newMode) => {
        setViewMode(newMode);
        try {
            await fetch(`/api/timesheets/${timesheet.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "update-view-mode", viewMode: newMode })
            });
            toast.success("View mode updated");
            router.refresh();
        } catch {
            toast.error("Failed to save view mode");
        }
    };
    const handleRegenerate = async () => {
        setRegenerating(true);
        try {
            const res = await fetch(`/api/timesheets/${timesheet.id}/regenerate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            });
            if (res.ok) {
                toast.success("Regenerated", { description: "Timesheet updated with latest logs." });
                queryClient.invalidateQueries({ queryKey: ["timesheets"] });
                queryClient.invalidateQueries({ queryKey: ["uninvoiced-timesheets"] });
                router.refresh();
            }
            else {
                const err = await res.json();
                toast.error(err.error || "Failed");
            }
        }
        catch (error) {
            console.error(error);
            toast.error("Request failed");
        }
        finally {
            setRegenerating(false);
        }
    };
    const handleDelete = async () => {
        setDeleting(true);
        try {
            const res = await fetch(`/api/timesheets/${timesheet.id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                toast.success("Deleted", { description: "Timesheet deleted." });
                queryClient.invalidateQueries({ queryKey: ["timesheets"] });
                queryClient.invalidateQueries({ queryKey: ["uninvoiced-timesheets"] });
                router.push("/timesheets");
            }
            else {
                const err = await res.json();
                toast.error(err.error || "Failed to delete");
            }
        }
        catch (error) {
            console.error(error);
            toast.error("Request failed");
        }
        finally {
            setDeleting(false);
            setShowDeleteDialog(false);
        }
    };
    
    const handleApprovalSubmit = async () => {
        setApproving(true);
        try {
            const res = await fetch(`/api/timesheets/${timesheet.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "approve",
                    approvedAt: approvalDate,
                    approvalNote: approvalNote
                })
            });
            
            if (res.ok) {
                toast.success("Timesheet Approved");
                setShowApprovalDialog(false);
                queryClient.invalidateQueries({ queryKey: ["timesheets"] });
                queryClient.invalidateQueries({ queryKey: ["uninvoiced-timesheets"] });
                router.refresh();
            } else {
                const err = await res.json();
                toast.error(err.error || "Failed to approve timesheet");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred while approving");
        } finally {
            setApproving(false);
        }
    };

    const handleRemoveApproval = async () => {
        setApproving(true);
        try {
            const res = await fetch(`/api/timesheets/${timesheet.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "unapprove" })
            });
            
            if (res.ok) {
                toast.success("Approval Removed");
                queryClient.invalidateQueries({ queryKey: ["timesheets"] });
                queryClient.invalidateQueries({ queryKey: ["uninvoiced-timesheets"] });
                router.refresh();
            } else {
                const err = await res.json();
                toast.error(err.error || "Failed to remove approval");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred");
        } finally {
            setApproving(false);
        }
    };
    
    const handleSaveNotes = async () => {
        setSavingNotes(true);
        try {
            const res = await fetch(`/api/timesheets/${timesheet.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "update-notes", notes: notesText }),
            });
            if (res.ok) {
                toast.success("Notes saved");
                setEditingNotes(false);
                queryClient.invalidateQueries({ queryKey: ["timesheets"] });
                queryClient.invalidateQueries({ queryKey: ["uninvoiced-timesheets"] });
                router.refresh();
            } else {
                toast.error("Failed to save notes");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setSavingNotes(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case "DRAFT": return <Badge variant="secondary">Draft</Badge>;
            case "EXPORTED": return <Badge variant="default" className="bg-blue-600">Exported</Badge>;
            case "INVOICED": return <Badge variant="default" className="bg-green-600">Invoiced</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };
    const handleSendEmail = async () => {
        setSending(true);
        try {
            const res = await fetch(`/api/timesheets/${timesheet.id}/send`, { method: "POST" });
            if (res.ok) {
                toast.success("Timesheet emailed");
            }
            else {
                const err = await res.json().catch(() => ({}));
                toast.error(err.message || "Failed to send timesheet email");
            }
        }
        catch (error) {
            console.error(error);
            toast.error("Failed to send timesheet email");
        }
        finally {
            setSending(false);
        }
    };
    return (<div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4 min-w-0">
                <Button variant="ghost" size="icon" className="flex-shrink-0 mt-1" asChild>
                    <Link href="/timesheets"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div className="min-w-0">
                    <h2 className="text-3xl font-bold tracking-tight">{timesheet.timesheetCode}</h2>
                    <div className="flex items-center gap-2 text-muted-foreground mt-1 flex-wrap">
                        {timesheet.isInternal
                            ? <Badge variant="secondary" className="bg-slate-100 text-slate-700">Internal</Badge>
                            : (
                                <>
                                    <span>{timesheet.customer?.companyName ?? "—"}</span>
                                    {timesheet.project?.name && (
                                        <>
                                            <span>•</span>
                                            <span className="font-medium text-foreground">{timesheet.project.name}</span>
                                        </>
                                    )}
                                </>
                            )
                        }
                        <span>•</span>
                        <span>{format(new Date(timesheet.periodStart), "dd MMM yyyy")} - {format(new Date(timesheet.periodEnd), "dd MMM yyyy")}</span>
                        <span>•</span>
                        {timesheet.status === "INVOICED" ? (
                            getStatusBadge("INVOICED")
                        ) : timesheet.approvedAt ? (
                            <>
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    Approved {format(new Date(timesheet.approvedAt), "MMM d")}
                                </Badge>
                                {timesheet.status === "EXPORTED" && (
                                    <Badge variant="default" className="bg-blue-600">Exported</Badge>
                                )}
                            </>
                        ) : (
                            getStatusBadge(timesheet.status)
                        )}
                    </div>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                
                <PermissionGate module="Timesheet" action="Approve">
                    {timesheet.approvedAt ? (
                        <Button variant="outline" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200" onClick={handleRemoveApproval} disabled={approving}>
                            Remove Approval
                        </Button>
                    ) : (
                        <Button variant="outline" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200" onClick={() => setShowApprovalDialog(true)}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Mark Approved
                        </Button>
                    )}
                </PermissionGate>
                
                <Button variant="outline" onClick={handleSendEmail} disabled={sending}>
                    <Send className={`mr-2 h-4 w-4 ${sending ? "animate-pulse" : ""}`} />
                    {sending ? "Sending..." : "Send Email"}
                </Button>
                {timesheet.status !== "INVOICED" && !timesheet.approvedAt && (<>
                    <PermissionGate module="Timesheet" action="Regenerate">
                        {timesheet.allowRegenerationBeforeInvoice !== false && (<Button variant="outline" onClick={handleRegenerate} disabled={regenerating}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
                            Regenerate
                        </Button>)}
                    </PermissionGate>
                    <PermissionGate module="Timesheet" action="Delete">
                        <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} disabled={deleting}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </Button>
                    </PermissionGate>
                </>)}
                <Button onClick={async () => {
                    await generateTimesheetPDF(timesheet, viewMode);
                    if (timesheet.status === "DRAFT") {
                        await fetch(`/api/timesheets/${timesheet.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ status: "EXPORTED" })
                        });
                        queryClient.invalidateQueries({ queryKey: ["timesheets"] });
                        queryClient.invalidateQueries({ queryKey: ["uninvoiced-timesheets"] });
                        router.refresh();
                    }
                }}>
                    <Download className="mr-2 h-4 w-4" /> Export PDF
                </Button>
            </div>
        </div>

        {timesheet.isOutdated && (<Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Outdated</AlertTitle>
            <AlertDescription>
                Daily logs in this period have changed since this timesheet was generated.
                Regenerate to update statistics.
            </AlertDescription>
        </Alert>)}

        <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{timesheet.totalHours.toFixed(1)}</div>
                </CardContent>
            </Card>
            <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4">
                        <div>
                            <span className="text-xs text-muted-foreground uppercase tracking-wider block">Regular</span>
                            <span className="font-semibold">{timesheet.totalRegularHours?.toFixed(1) || "0.0"}</span>
                        </div>
                        <div className="border-l pl-4 border-slate-200 dark:border-slate-700">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider block">Overtime</span>
                            <span className="font-semibold text-amber-600 dark:text-amber-500">{timesheet.totalOvertimeHours?.toFixed(1) || "0.0"}</span>
                        </div>
                        <div className="border-l pl-4 border-slate-200 dark:border-slate-700">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider block">Holiday</span>
                            <span className="font-semibold text-red-600 dark:text-red-500">{timesheet.totalHolidayHours?.toFixed(1) || "0.0"}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Standard Logic</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-xs text-muted-foreground">
                        Multipliers: x{timesheet.standardRateMultiplier} Std, x{timesheet.overtimeMultiplier} OT, x{timesheet.holidayMultiplier} Hol
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm font-medium">Notes</CardTitle>
                    {!editingNotes && !timesheet.approvedAt && timesheet.status !== "INVOICED" && (
                        <PermissionGate module="Timesheet" action="Edit">
                            <Button variant="ghost" size="sm" onClick={() => setEditingNotes(true)}>
                                <Pencil className="h-4 w-4 mr-1" /> {notesText ? "Edit" : "Add Notes"}
                            </Button>
                        </PermissionGate>
                    )}
                </CardHeader>
                <CardContent>
                    {editingNotes ? (
                        <div className="space-y-3">
                            <Textarea
                                value={notesText}
                                onChange={(e) => setNotesText(e.target.value)}
                                placeholder="Add notes for this timesheet (will appear in exported PDF)..."
                                rows={4}
                                className="resize-none"
                            />
                            <div className="flex gap-2">
                                <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes}>
                                    {savingNotes ? "Saving..." : "Save Notes"}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => { setEditingNotes(false); setNotesText(timesheet.notes || ""); }}>
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : notesText ? (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notesText}</p>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">No notes added.</p>
                    )}
                </CardContent>
            </Card>

            {timesheet.lpoNumber || timesheet.lpoAttachmentPath ? (
                <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4 text-slate-400" />
                            LPO Reference
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground block">LPO Number</span>
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                {timesheet.lpoNumber || "—"}
                            </span>
                        </div>
                        {timesheet.lpoAttachmentPath && (
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground block">LPO Document</span>
                                <a
                                    href={timesheet.lpoAttachmentPath}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary hover:underline text-sm font-medium mt-0.5"
                                >
                                    <Paperclip className="h-3.5 w-3.5 shrink-0" />
                                    {timesheet.lpoAttachmentName || "View LPO Document"}
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 opacity-50">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-400">
                            <FileText className="h-4 w-4" />
                            LPO Reference
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 flex items-center justify-center text-slate-400 text-sm italic">
                        No LPO reference provided.
                    </CardContent>
                </Card>
            )}
        </div>

        <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Timesheet Lines</CardTitle>
                <Select value={viewMode} onValueChange={handleViewModeChange}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="View mode" />
                    </SelectTrigger>
                    <SelectContent>
                        {VIEW_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Resource</TableHead>
                            <TableHead>Operator</TableHead>
                            <TableHead className="text-right">Normal</TableHead>
                            <TableHead className="text-right">OT</TableHead>
                            <TableHead className="text-right">Hol</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right font-bold">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {viewedLines.map((line, idx) => {
                            const blockType = line.blockType || "VEHICLE";
                            const isQtyBased = blockType === "MATERIAL" || blockType === "LABOUR";
                            return (
                                <TableRow key={line.id ?? idx}>
                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                        {line._dateLabel}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-[10px] px-1 h-5 font-normal">
                                            {blockType}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {blockType === "VEHICLE" && line.vehicle ? (
                                            <Link href={`/vehicles/${line.vehicle.id}`} className="text-primary hover:underline text-sm">
                                                {line.vehicle.regNo || line.vehicle.vehicleCode || "—"}{line.vehicle.model?.name ? ` • ${line.vehicle.model.name}` : ""}
                                            </Link>
                                        ) : blockType === "OPERATOR" && line.operator ? (
                                            <Link href={`/operators/${line.operator.id}`} className="text-primary hover:underline text-sm">
                                                {line.operator.name}
                                            </Link>
                                        ) : blockType === "MATERIAL" && line.material ? (
                                            <span className="text-sm">{line.material.name}</span>
                                        ) : blockType === "LABOUR" && line.labour ? (
                                            <span className="text-sm">{line.labour.labourType}</span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">{line.resourceNameSnapshot || "—"}</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {blockType === "VEHICLE" && line.operator ? (
                                            <Link href={`/operators/${line.operator.id}`} className="text-primary hover:underline">
                                                {line.operator.name}
                                            </Link>
                                        ) : "—"}
                                    </TableCell>
                                    <TableCell className="text-right text-sm">{isQtyBased ? "—" : (Number(line.regularHours || 0).toFixed(1))}</TableCell>
                                    <TableCell className="text-right text-sm">{isQtyBased ? "—" : (Number(line.overtimeHours || 0).toFixed(1))}</TableCell>
                                    <TableCell className="text-right text-sm">{isQtyBased ? "—" : (Number(line.holidayHours || 0).toFixed(1))}</TableCell>
                                    <TableCell className="text-right text-sm">{isQtyBased ? Number(line.quantity || 0) : "—"}</TableCell>
                                    <TableCell className="text-right font-bold text-sm">
                                        {isQtyBased ? `×${Number(line.quantity || 0)}` : Number(line.totalHours || 0).toFixed(1)}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        
        {/* Activity Log */}
        <Card className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60">
            <CardHeader>
                <CardTitle className="text-sm font-medium">Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
                <ActivityLogList entityType="TIMESHEET" entityId={timesheet.id} />
            </CardContent>
        </Card>

        {/* Approval Dialog */}
        <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Mark Timesheet as Approved</DialogTitle>
                    <DialogDescription>
                        Record that this timesheet has been approved by the client or manager.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none">Approval Date</label>
                        <FormattedDatePicker 
                            value={approvalDate}
                            onChange={(date) => setApprovalDate(date)}
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none">Internal Note (Optional)</label>
                        <Textarea 
                            placeholder="Received email from client confirming timesheet..."
                            value={approvalNote}
                            onChange={(e) => setApprovalNote(e.target.value)}
                            rows={3}
                        />
                    </div>
                </div>
                
                <DialogFooter>
                    <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>Cancel</Button>
                    <Button 
                        onClick={handleApprovalSubmit} 
                        disabled={approving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        {approving ? "Saving..." : "Confirm Approval"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Timesheet?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently remove this timesheet. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>);
}
