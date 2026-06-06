"use client";
import { PlayCircle, PauseCircle, Wrench } from "lucide-react";
import { StatusActions } from "@/app/Components/common/StatusActions";

const BASE_OPTIONS = [
    { label: "Activate",    value: "ACTIVE",           icon: PlayCircle,  className: "text-green-600 hover:text-green-700 hover:bg-green-50",   showWhen: (s) => s !== "ACTIVE" },
    { label: "Deactivate",  value: "INACTIVE",          icon: PauseCircle, className: "text-red-600 hover:text-red-700 hover:bg-red-50",         showWhen: (s) => s !== "INACTIVE" && s !== "MAINTENANCE" },
    { label: "Maintenance", value: "UNDER_MAINTENANCE", icon: Wrench,      className: "text-orange-600 hover:text-orange-700 hover:bg-orange-50", showWhen: (s) => s !== "MAINTENANCE" && s !== "UNDER_MAINTENANCE" },
];

export function VehicleStatusActions({ vehicleId, currentStatus, hasActiveAssignment }) {
    const options = BASE_OPTIONS.map((opt) =>
        opt.value === "UNDER_MAINTENANCE"
            ? { ...opt, disabled: hasActiveAssignment, tooltip: "Vehicle has an active assignment. Stop the assignment block first." }
            : opt
    );
    return <StatusActions apiPath={`/api/vehicles/${vehicleId}/status`} currentStatus={currentStatus} entityLabel="Vehicle" queryKey="vehicles" options={options} />;
}
