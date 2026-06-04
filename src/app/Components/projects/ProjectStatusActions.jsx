"use client";
import { PlayCircle, PauseCircle, CheckCircle } from "lucide-react";
import { StatusActions } from "@/app/Components/common/StatusActions";

const OPTIONS = [
    { label: "Activate",    value: "ACTIVE",    icon: PlayCircle,   className: "text-green-600 hover:text-green-700 hover:bg-green-50", showWhen: (s) => s !== "ACTIVE" && s !== "COMPLETED" },
    { label: "Deactivate",  value: "INACTIVE",  icon: PauseCircle,  className: "text-red-600 hover:text-red-700 hover:bg-red-50",       showWhen: (s) => s === "ACTIVE" },
    { label: "Complete",    value: "COMPLETED", icon: CheckCircle,  className: "text-blue-600 hover:text-blue-700 hover:bg-blue-50",    showWhen: (s) => s === "ACTIVE" },
    { label: "Reactivate",  value: "ACTIVE",    icon: PlayCircle,   className: "text-green-600 hover:text-green-700 hover:bg-green-50", showWhen: (s) => s === "COMPLETED" },
];

export function ProjectStatusActions({ projectId, currentStatus }) {
    return <StatusActions apiPath={`/api/projects/${projectId}`} currentStatus={currentStatus} entityLabel="Project" options={OPTIONS} />;
}
