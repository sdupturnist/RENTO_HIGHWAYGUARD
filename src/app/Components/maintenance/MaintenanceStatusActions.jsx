"use client";
import { PlayCircle, CheckCircle, RotateCcw } from "lucide-react";
import { StatusActions } from "@/app/Components/common/StatusActions";

const OPTIONS = [
    { label: "Start",    value: "IN_PROGRESS", icon: PlayCircle,  className: "text-amber-600 hover:text-amber-700 hover:bg-amber-50",   showWhen: (s) => s === "SCHEDULED" },
    { label: "Complete", value: "COMPLETED",   icon: CheckCircle, className: "text-green-600 hover:text-green-700 hover:bg-green-50",   showWhen: (s) => s === "IN_PROGRESS" },
    { label: "Re-open",  value: "IN_PROGRESS", icon: RotateCcw,   className: "text-muted-foreground hover:text-foreground",             showWhen: (s) => s === "COMPLETED" },
];

export function MaintenanceStatusActions({ maintenanceId, currentStatus }) {
    return <StatusActions apiPath={`/api/maintenance/${maintenanceId}/status`} currentStatus={currentStatus} entityLabel="Maintenance" options={OPTIONS} />;
}
