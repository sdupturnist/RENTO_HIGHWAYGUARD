"use client";
import { PlayCircle, PauseCircle } from "lucide-react";
import { StatusActions } from "@/app/Components/common/StatusActions";

const OPTIONS = [
    { label: "Activate",   value: "ACTIVE",   icon: PlayCircle,  className: "text-green-600 hover:text-green-700 hover:bg-green-50", showWhen: (s) => s !== "ACTIVE" },
    { label: "Deactivate", value: "INACTIVE",  icon: PauseCircle, className: "text-red-600 hover:text-red-700 hover:bg-red-50",       showWhen: (s) => s !== "INACTIVE" },
];

export function CustomerStatusActions({ customerId, currentStatus }) {
    return <StatusActions apiPath={`/api/clients/${customerId}`} method="PUT" currentStatus={currentStatus} entityLabel="Customer" queryKey="clients" options={OPTIONS} />;
}
