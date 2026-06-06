"use client";
import { useState } from "react";
import { Button } from "@/app/Components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/Components/ui/tooltip";

/**
 * Generic status transition component.
 *
 * options: Array<{
 *   label:    string
 *   value:    string          — target status sent in the PATCH/PUT body
 *   icon:     LucideIcon
 *   className: string         — button colour classes
 *   showWhen: (currentStatus: string) => boolean
 *   disabled?: boolean        — renders button disabled (grey out)
 *   tooltip?: string          — shown in a Tooltip when disabled is true
 * }>
 */
export function StatusActions({
    apiPath,
    method = "PATCH",
    currentStatus,
    entityLabel = "Status",
    queryKey,
    options,
}) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);

    const updateStatus = async (targetStatus) => {
        setLoading(true);
        try {
            const res = await fetch(apiPath, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: targetStatus }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || "Failed to update status");
            }
            toast.success(`${entityLabel} marked as ${targetStatus.replace(/_/g, " ")}`);
            if (queryKey) {
                if (Array.isArray(queryKey)) {
                    if (queryKey.length > 0 && Array.isArray(queryKey[0])) {
                        await Promise.all(
                            queryKey.map((key) =>
                                queryClient.invalidateQueries({ queryKey: key, refetchType: "all" })
                            )
                        );
                    } else {
                        await queryClient.invalidateQueries({ queryKey, refetchType: "all" });
                    }
                } else {
                    await queryClient.invalidateQueries({ queryKey: [queryKey], refetchType: "all" });
                }
            }
            router.refresh();
        } catch (error) {
            toast.error(error.message || "Error updating status");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <Button disabled variant="outline"><Loader2 className="h-4 w-4 animate-spin" /></Button>;
    }

    const visible = options.filter((opt) => opt.showWhen(currentStatus));

    return (
        <div className="flex items-center gap-2">
            {visible.map((opt) => {
                const Icon = opt.icon;
                const btn = (
                    <Button
                        key={opt.value + opt.label}
                        variant="outline"
                        size="sm"
                        onClick={() => !opt.disabled && updateStatus(opt.value)}
                        disabled={!!opt.disabled}
                        className={opt.className}
                    >
                        <Icon className="mr-2 h-4 w-4" /> {opt.label}
                    </Button>
                );
                if (opt.disabled && opt.tooltip) {
                    return (
                        <TooltipProvider key={opt.value + opt.label}>
                            <Tooltip>
                                <TooltipTrigger asChild><span tabIndex={0}>{btn}</span></TooltipTrigger>
                                <TooltipContent><p>{opt.tooltip}</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    );
                }
                return btn;
            })}
        </div>
    );
}
