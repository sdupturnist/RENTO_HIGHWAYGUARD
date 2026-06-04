"use client";
import { PlayCircle, CheckCircle } from "lucide-react";
import { StatusActions } from "@/app/Components/common/StatusActions";

const OPTIONS = [
    { label: "Activate",    value: "ACTIVE",    icon: PlayCircle,  className: "text-green-600 hover:text-green-700 hover:bg-green-50", showWhen: (s) => s === "DRAFT" },
    { label: "Complete",    value: "COMPLETED", icon: CheckCircle, className: "text-blue-600 hover:text-blue-700 hover:bg-blue-50",    showWhen: (s) => s === "ACTIVE" },
    { label: "Reactivate",  value: "ACTIVE",    icon: PlayCircle,  className: "text-green-600 hover:text-green-700 hover:bg-green-50", showWhen: (s) => s === "COMPLETED" },
];

export function AssignmentStatusActions({ assignmentId, currentStatus }) {
    return <StatusActions apiPath={`/api/assignments/${assignmentId}`} currentStatus={currentStatus} entityLabel="Assignment" options={OPTIONS} />;
}
