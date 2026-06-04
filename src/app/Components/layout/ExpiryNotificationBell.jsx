"use client";
import { useEffect, useState, useCallback } from "react";
import { Bell, Truck, FileText, File, ChevronRight, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/app/Components/ui/popover";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/app/lib/utils";
import { useAppStore } from "@/app/lib/store/useAppStore";

const GROUP_ICONS = { Truck, FileText, IdCard: FileText, File };

export function ExpiryNotificationBell() {
    const { expiry: data } = useAppStore();
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    const handleGroupClick = (groupId) => {
        setOpen(false);
        const target = `/?expiryGroup=${groupId}`;
        pathname === "/" ? router.replace(target) : router.push(target);
    };

    const urgentCount = data?.urgentCount || 0;
    const totalCount = data?.totalCount || 0;
    const groups = data?.groups || [];

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-xl h-9 w-9 hover:bg-slate-100 dark:hover:bg-slate-800/50">
                    <Bell className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                    {totalCount > 0 && (
                        <span className={cn(
                            "absolute top-1 right-1 h-4 w-4 min-w-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center leading-none",
                            urgentCount > 0 ? "bg-red-500" : "bg-indigo-500"
                        )}>
                            {totalCount > 99 ? "99+" : totalCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0 rounded-2xl shadow-2xl border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">Expiry Alerts</span>
                    </div>
                    {urgentCount > 0 ? (
                        <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                            {urgentCount} action{urgentCount !== 1 ? 's' : ''} needed
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                            <Check className="h-3 w-3" /> All clear
                        </span>
                    )}
                </div>
                <div className="py-1 max-h-80 overflow-y-auto">
                    {groups.length === 0 ? (
                        <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                            No expiries in the next 90 days
                        </div>
                    ) : (
                        groups.map((group) => {
                            const Icon = GROUP_ICONS[group.icon] || File;
                            const hasUrgent = group.urgentCount > 0;
                            return (
                                <button key={group.id} onClick={() => handleGroupClick(group.id)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left">
                                    <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center shrink-0", hasUrgent ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300" : "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300")}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{group.label}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {group.count} {group.count === 1 ? 'item' : 'items'}
                                            {hasUrgent && <span className="ml-1 text-red-500 font-medium">· {group.urgentCount} action{group.urgentCount !== 1 ? 's' : ''} needed</span>}
                                        </p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                                </button>
                            );
                        })
                    )}
                </div>
                {groups.length > 0 && (
                    <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-2.5">
                        <button onClick={() => { setOpen(false); router.push("/?expiryGroup=all"); }} className="w-full text-center text-xs font-medium text-primary hover:underline">
                            View all {data?.totalCount} expiry alerts on Dashboard
                        </button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
