"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Paperclip, ExternalLink, FileCheck, Info, FileText } from "lucide-react";
import { format } from "date-fns";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";
import { useSettings } from "@/app/Components/providers/SettingsProvider";

export function InvoiceReadOnlyDetails({ invoice }) {
    const { currencySymbol } = useSettings();

    const hasLpo = invoice.lpoNumber || invoice.lpoAttachmentPath;
    const hasAdjustment = Number(invoice.adjustmentAmount) !== 0 || invoice.adjustmentNote;
    const hasAttachment = invoice.attachmentPath || invoice.isSignedTimesheet;

    if (!hasLpo && !hasAdjustment && !hasAttachment) {
        return null;
    }

    return (
        <div className="grid gap-6 md:grid-cols-3">
            {/* LPO Reference Section */}
            {hasLpo ? (
                <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                            <FileText className="h-4 w-4 text-slate-400" />
                            LPO Reference
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground block">LPO Number</span>
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                {invoice.lpoNumber || "—"}
                            </span>
                        </div>
                        {invoice.lpoAttachmentPath && (
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground block">LPO Document</span>
                                <a
                                    href={invoice.lpoAttachmentPath}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary hover:underline text-sm font-medium mt-0.5"
                                >
                                    <Paperclip className="h-3.5 w-3.5 shrink-0" />
                                    {invoice.lpoAttachmentName || "View LPO Document"}
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl opacity-50">
                    <CardContent className="p-6 flex items-center justify-center h-full text-slate-400 text-sm italic">
                        No LPO reference provided.
                    </CardContent>
                </Card>
            )}

            {/* Adjustments Section */}
            {hasAdjustment ? (
                <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                            <Info className="h-4 w-4 text-slate-400" />
                            Invoice Adjustment
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-1">
                            <span className="text-xs text-muted-foreground block">Amount</span>
                            <span className={`text-lg font-bold flex items-center gap-1 ${Number(invoice.adjustmentAmount) < 0 ? 'text-green-600' : Number(invoice.adjustmentAmount) > 0 ? 'text-amber-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                {Number(invoice.adjustmentAmount) < 0 ? "-" : Number(invoice.adjustmentAmount) > 0 ? "+" : ""}
                                <CurrencySymbol symbol={currencySymbol} />
                                {Math.abs(Number(invoice.adjustmentAmount || 0)).toFixed(2)}
                            </span>
                        </div>
                        {invoice.adjustmentNote && (
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground block">Note</span>
                                <span className="text-sm text-slate-600 dark:text-slate-400 block break-words leading-normal">
                                    {invoice.adjustmentNote}
                                </span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl opacity-50">
                    <CardContent className="p-6 flex items-center justify-center h-full text-slate-400 text-sm italic">
                        No adjustments applied.
                    </CardContent>
                </Card>
            )}

            {/* Signed Timesheet Section */}
            {hasAttachment ? (
                <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                            <FileCheck className="h-4 w-4 text-slate-400" />
                            Signed Timesheet
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {invoice.attachmentPath && (
                            <div className="space-y-1">
                                <span className="text-xs text-muted-foreground block">Document File</span>
                                <a
                                    href={invoice.attachmentPath}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-primary hover:underline text-sm font-medium mt-0.5"
                                >
                                    <Paperclip className="h-3.5 w-3.5 shrink-0" />
                                    {invoice.attachmentName || "View Signed Timesheet"}
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            </div>
                        )}
                        <div className="flex flex-col gap-1.5 pt-1">
                            <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${invoice.isSignedTimesheet ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-700'}`} />
                                <span className="text-xs text-slate-600 dark:text-slate-400">
                                    {invoice.isSignedTimesheet ? "Signed and verified by client" : "Not marked as signed"}
                                </span>
                            </div>
                            {invoice.isSignedTimesheet && invoice.signatureDate && (
                                <div className="space-y-1">
                                    <span className="text-xs text-muted-foreground block">Signature Date</span>
                                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                                        {format(new Date(invoice.signatureDate), "MMM d, yyyy")}
                                    </span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl opacity-50">
                    <CardContent className="p-6 flex items-center justify-center h-full text-slate-400 text-sm italic">
                        No signed timesheet attached.
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
