"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/app/Components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Label } from "@/app/Components/ui/label";
import { Checkbox } from "@/app/Components/ui/checkbox";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { Paperclip, Upload, X, ExternalLink, FileCheck } from "lucide-react";
import { format } from "date-fns";

export function InvoiceAttachment({ invoiceId, initial = {} }) {
    const fileInputRef = useRef(null);

    const [pendingFile, setPendingFile] = useState(null);
    const [currentPath, setCurrentPath] = useState(initial.attachmentPath || null);
    const [currentName, setCurrentName] = useState(initial.attachmentName || null);
    const [isSignedTimesheet, setIsSignedTimesheet] = useState(!!(initial.isSignedTimesheet));
    const [signatureDate, setSignatureDate] = useState(
        initial.signatureDate ? new Date(initial.signatureDate) : null
    );

    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            let attachmentPath = currentPath;
            let attachmentName = currentName;

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

            const res = await fetch(`/api/invoices/${invoiceId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "update-attachment",
                    attachmentPath,
                    attachmentName,
                    isSignedTimesheet,
                    signatureDate: signatureDate ? format(signatureDate, "yyyy-MM-dd") : null,
                }),
            });
            if (!res.ok) throw new Error("Failed to save");

            // Update local state
            setCurrentPath(attachmentPath);
            setCurrentName(attachmentName);
            setPendingFile(null);

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

                {(initial.lpoNumber || initial.lpoAttachmentPath) && (
                    <div className="border-t pt-4 space-y-3">
                        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">LPO Reference</h4>
                        <div className="grid gap-3 sm:grid-cols-2 text-sm">
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground block">LPO Number</span>
                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                    {initial.lpoNumber || "—"}
                                </span>
                            </div>
                            {initial.lpoAttachmentPath && (
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground block">LPO Document</span>
                                    <a
                                        href={initial.lpoAttachmentPath}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-primary hover:underline font-medium mt-0.5"
                                    >
                                        <Paperclip className="h-3.5 w-3.5 shrink-0" />
                                        {initial.lpoAttachmentName || "View LPO Document"}
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <Button onClick={handleSave} disabled={saving} size="sm">
                    {saving ? "Saving..." : "Save Attachments"}
                </Button>
            </CardContent>
        </Card>
    );
}
