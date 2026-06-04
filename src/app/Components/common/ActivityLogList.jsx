"use client";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ScrollArea } from "@/app/Components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/app/Components/ui/avatar";
import { useQuery } from "@tanstack/react-query";

export function ActivityLogList({ entityType, entityId }) {
    const { data: logs = [], isLoading: loading } = useQuery({
        queryKey: ["activity-logs", entityType, entityId],
        queryFn: async () => {
            const res = await fetch(`/api/activity-logs?entityType=${entityType}&entityId=${entityId}`);
            if (!res.ok) throw new Error("Failed to fetch logs");
            return res.json();
        },
        enabled: !!entityType && !!entityId,
    });
    if (loading)
        return <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground"/></div>;
    if (logs.length === 0)
        return <div className="text-center p-4 text-muted-foreground">No recent activity.</div>;
    return (<ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6">
                {logs.map((log) => (<div key={log.id} className="flex gap-4">
                        <Avatar className="h-8 w-8">
                            <AvatarFallback>{log.user?.name?.[0] || "S"}</AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium leading-none">{log.user?.name || "System"}</p>
                                <span className="text-xs text-muted-foreground">
                                    {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                <span className="font-semibold text-foreground uppercase text-xs mr-2 border px-1 rounded">
                                    {log.displayAction || log.action}
                                </span>
                                {log.displayDescription || log.description}
                            </p>
                        </div>
                    </div>))}
            </div>
        </ScrollArea>);
}
