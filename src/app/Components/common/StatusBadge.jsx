"use client";
import { Badge } from "@/app/Components/ui/badge";
import { cn } from "@/app/lib/utils";

const STATUS_CLASSES = {
    ACTIVE:               "bg-green-600 hover:bg-green-700 text-white border-transparent",
    INACTIVE:             "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400",
    DRAFT:                "bg-slate-400 hover:bg-slate-500 text-white border-transparent",
    COMPLETED:            "bg-blue-600 hover:bg-blue-700 text-white border-transparent",
    CANCELLED:            "bg-red-600 hover:bg-red-700 text-white border-transparent",
    PAUSED:               "bg-amber-500 hover:bg-amber-600 text-white border-transparent",
    STOPPED:              "bg-red-600 hover:bg-red-700 text-white border-transparent",
    UNDER_MAINTENANCE:    "bg-orange-500 hover:bg-orange-600 text-white border-transparent",
    EXPIRED_REGISTRATION: "bg-red-600 hover:bg-red-700 text-white border-transparent",
    SCHEDULED:            "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300",
    IN_PROGRESS:          "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-300",
};

function formatLabel(status) {
    return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({ status, className }) {
    const classes = STATUS_CLASSES[status] ?? "bg-slate-100 text-slate-600 border-slate-300";
    return (
        <Badge variant="outline" className={cn(classes, className)}>
            {formatLabel(status)}
        </Badge>
    );
}
