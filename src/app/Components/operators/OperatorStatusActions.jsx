"use client";
import { PlayCircle, PauseCircle, Ban, Clock } from "lucide-react";
import { StatusActions } from "@/app/Components/common/StatusActions";

const OPTIONS = [
    { label: "Activate",   value: "ACTIVE",   icon: PlayCircle,  className: "text-green-600 hover:text-green-700 hover:bg-green-50", showWhen: (s) => s !== "ACTIVE" },
    { label: "Deactivate", value: "INACTIVE",  icon: PauseCircle, className: "text-red-600 hover:text-red-700 hover:bg-red-50",       showWhen: (s) => s !== "INACTIVE" && s !== "BLOCKED" && s !== "ON_LEAVE" },
    { label: "On Leave",   value: "ON_LEAVE",  icon: Clock,       className: "text-orange-600 hover:text-orange-700 hover:bg-orange-50", showWhen: (s) => s !== "ON_LEAVE" },
    { label: "Block",      value: "BLOCKED",   icon: Ban,         className: "text-gray-600 hover:text-gray-700 hover:bg-gray-50",    showWhen: (s) => s !== "BLOCKED" },
];

export function OperatorStatusActions({ operatorId, currentStatus }) {
    return <StatusActions apiPath={`/api/operators/${operatorId}/status`} currentStatus={currentStatus} entityLabel="Operator" queryKey="operators" options={OPTIONS} />;
}
