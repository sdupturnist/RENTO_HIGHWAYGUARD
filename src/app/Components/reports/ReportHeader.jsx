"use client";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Card, CardHeader } from "@/app/Components/ui/card";
import { useState } from "react";
import Link from "next/link";
export function ReportHeader({ title, description, onExportPDF, onExportExcel, canExport = true, backHref, }) {
    const [exportingPDF, setExportingPDF] = useState(false);
    const [exportingExcel, setExportingExcel] = useState(false);
    const handlePDFExport = async () => {
        if (!onExportPDF)
            return;
        setExportingPDF(true);
        try {
            await onExportPDF();
        }
        finally {
            setExportingPDF(false);
        }
    };
    const handleExcelExport = async () => {
        if (!onExportExcel)
            return;
        setExportingExcel(true);
        try {
            await onExportExcel();
        }
        finally {
            setExportingExcel(false);
        }
    };
    return (<Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm">
        <CardHeader className="pb-3">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex flex-col gap-1 w-full md:w-auto">
                    <div className="flex items-center gap-3">
                        {backHref && (<Button variant="ghost" size="icon" asChild className="h-9 w-9 shrink-0">
                            <Link href={backHref} aria-label="Back to reports">←</Link>
                        </Button>)}
                        <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
                            {title}
                        </h1>
                    </div>
                    <div className="text-sm text-muted-foreground ml-0 md:ml-12">{description}</div>
                </div>
                {canExport && (onExportPDF || onExportExcel) && (<div className="flex flex-wrap gap-2 w-full md:w-auto justify-start md:justify-end">
                    {onExportPDF && (<Button variant="outline" size="sm" onClick={handlePDFExport} disabled={exportingPDF || exportingExcel} className="gap-2 flex-1 md:flex-none">
                        <FileDown className="h-4 w-4" />
                        {exportingPDF ? "Exporting..." : "Export PDF"}
                    </Button>)}
                    {onExportExcel && (<Button variant="outline" size="sm" onClick={handleExcelExport} disabled={exportingPDF || exportingExcel} className="gap-2 flex-1 md:flex-none">
                        <FileSpreadsheet className="h-4 w-4" />
                        {exportingExcel ? "Exporting..." : "Export Excel"}
                    </Button>)}
                </div>)}
            </div>
        </CardHeader>
    </Card>);
}
