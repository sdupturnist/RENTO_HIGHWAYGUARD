"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/app/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Input } from "@/app/Components/ui/input";
import { Label } from "@/app/Components/ui/label";
import { Checkbox } from "@/app/Components/ui/checkbox";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { Paperclip, Upload, X, ExternalLink, FileCheck } from "lucide-react";
import { format } from "date-fns";

export function InvoiceAttachment({ invoiceId, initial = {} }) {
    const fileInputRef = useRef(null);
    const lpoFileInputRef = useRef(null);

    const [pendingFile, setPendingFile] = useState(null);
    const [currentPath, setCurrentPath] = useState(initial.attachmentPath || null);
    const [currentName, setCurrentName] = useState(initial.attachmentName || null);
    const [isSignedTimesheet, setIsSignedTimesheet] = useState(!!(initial.isSignedTimesheet));
    const [signatureDate, setSignatureDate] = useState(
        initial.signatureDate ? new Date(initial.signatureDate) : null
    );

    // LPO state
    const [lpoNumber, setLpoNumber] = useState(initial.lpoNumber || "");
    const [lpoFile, setLpoFile] = useState(null);
    const [currentLpoPath, setCurrentLpoPath] = useState(initial.lpoAttachmentPath || null);
    const [currentLpoName, setCurrentLpoName] = useState(initial.lpoAttachmentName || null);

    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            let attachmentPath = currentPath;
            let attachmentName = currentName;
            let lpoAttachmentPath = currentLpoPath;
            let lpoAttachmentName = currentLpoName;

            // Upload signed timesheet file
            if (pendingFile) {
                const fd = new FormData();
                fd.append("file", pendingFile);
                fd.append("folder", `invoices/${invoiceId}/attachments`);
                const upRes = await fetch("/api/upload", { method: "POST", body: fd });
                if (!upRes.ok) throw new Error("Failed to upload file");
                const { url } = await upRes.json();
                attachmentPath = url;
                attachmentName = pendingFile.name;
            }

            // Upload LPO file
            if (lpoFile) {
                const fd = new FormData();
                fd.append("file", lpoFile);
                fd.append("folder", `invoices/${invoiceId}/attachments`);
                const upRes = await fetch("/api/upload", { method: "POST", body: fd });
                if (!upRes.ok) throw new Error("Failed to upload LPO file");
                const { url } = await upRes.json();
                lpoAttachmentPath = url;
                lpoAttachmentName = lpoFile.name;
            }

            const res = await fetch(`/api/invoices/${invoiceId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "update-attachment",
                    attachmentPath,
                    attachmentName,
                    isSignedTimesheet,
                    signatureDate: signatureDate ? format(signatureDate, "yyyy-MM-dd") : null,
                    lpoNumber: lpoNumber || null,
                    lpoAttachmentPath,
                    lpoAttachmentName,
                }),
            });
            if (!res.ok) throw new Error("Failed to save");

            // Update local state
            setCurrentPath(attachmentPath);
            setCurrentName(attachmentName);
            setCurrentLpoPath(lpoAttachmentPath);
            setCurrentLpoName(lpoAttachmentName);
            setPendingFile(null);
            setLpoFile(null);

            toast.success("Attachments saved");
        } catch (e) {
            toast.error(e.message || "Failed to save attachments");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl">
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Paperclip className="h-4 w-4" /> Attachments & LPO
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Signed Timesheet Section */}
                <div className="space-y-3">
                    <h4 className="text-sm font-medium">Signed Timesheet</h4>

                    {(currentPath || pendingFile) && (
                        <div className="flex items-center gap-2 text-sm border rounded-md p-2 bg-muted/40">
                            <FileCheck className="h-4 w-4 text-green-500 shrink-0" />
                            <span className="truncate flex-1 text-muted-foreground">
                                {pendingFile ? pendingFile.name : currentName || currentPath?.split("/").pop()}
                            </span>
                            {currentPath && !pendingFile && (
                                <a href={currentPath} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                </a>
                            )}
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                                onClick={() => { setCurrentPath(null); setCurrentName(null); setPendingFile(null); }}>
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    )}

                    {!currentPath && !pendingFile && (
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="mr-2 h-4 w-4" /> Upload Signed Timesheet
                        </Button>
                    )}
                    {(currentPath || pendingFile) && (
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="mr-2 h-3 w-3" /> Replace File
                        </Button>
                    )}
                    <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => { setPendingFile(e.target.files?.[0] || null); e.target.value = ""; }} />

                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="isSignedTimesheet"
                                checked={isSignedTimesheet}
                                onCheckedChange={setIsSignedTimesheet}
                            />
                            <Label htmlFor="isSignedTimesheet" className="text-sm font-normal cursor-pointer">
                                This is a signed timesheet
                            </Label>
                        </div>

                        {isSignedTimesheet && (
                            <div className="flex items-center gap-2">
                                <Label className="text-sm text-muted-foreground whitespace-nowrap">Signature Date</Label>
                                <FormattedDatePicker
                                    value={signatureDate}
                                    onChange={setSignatureDate}
                                    placeholder="Select date"
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                    <h4 className="text-sm font-medium">LPO Reference</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label className="text-sm">LPO Number</Label>
                            <Input
                                placeholder="e.g. LPO-2025-001"
                                value={lpoNumber}
                                onChange={(e) => setLpoNumber(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">LPO Document</Label>
                            {(currentLpoPath || lpoFile) ? (
                                <div className="flex items-center gap-2 text-sm border rounded-md p-2 bg-muted/40">
                                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span className="truncate flex-1 text-muted-foreground">
                                        {lpoFile ? lpoFile.name : currentLpoName || currentLpoPath?.split("/").pop()}
                                    </span>
                                    {currentLpoPath && !lpoFile && (
                                        <a href={currentLpoPath} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                        </a>
                                    )}
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                                        onClick={() => { setCurrentLpoPath(null); setCurrentLpoName(null); setLpoFile(null); }}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ) : (
                                <Button type="button" variant="outline" size="sm" className="w-full"
                                    onClick={() => lpoFileInputRef.current?.click()}>
                                    <Upload className="mr-2 h-4 w-4" /> Upload LPO
                                </Button>
                            )}
                            {(currentLpoPath || lpoFile) && (
                                <Button type="button" variant="outline" size="sm"
                                    onClick={() => lpoFileInputRef.current?.click()}>
                                    <Upload className="mr-2 h-3 w-3" /> Replace
                                </Button>
                            )}
                            <input ref={lpoFileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                onChange={(e) => { setLpoFile(e.target.files?.[0] || null); e.target.value = ""; }} />
                        </div>
                    </div>
                </div>

                <Button onClick={handleSave} disabled={saving} size="sm">
                    {saving ? "Saving..." : "Save Attachments"}
                </Button>
            </CardContent>
        </Card>
    );
}
