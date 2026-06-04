"use client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { format, isValid } from "date-fns";
import { Truck, FileText, File, AlertTriangle, RefreshCw, X, ArrowRight, Lock } from "lucide-react";
import { cn } from "@/app/lib/utils";
import Link from "next/link";
import { Button } from "@/app/Components/ui/button";
import { useAppStore } from "@/app/lib/store/useAppStore";

const GROUP_META = {
    "vehicle-registration": { label: "Vehicle Registration", icon: Truck, color: "indigo" },
    "vehicle-documents": { label: "Vehicle Documents", icon: FileText, color: "violet" },
    "operator-license": { label: "Operator License", icon: FileText, color: "amber" },
    "operator-documents": { label: "Operator Documents", icon: File, color: "sky" },
};

const URGENCY_CONFIG = {
    expired: { label: "Expired", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800" },
    critical: { label: "Critical", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800" },
    warning: { label: "Warning", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
    upcoming: { label: "Upcoming", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
};

const COLOR_MAP = {
    indigo: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300",
    violet: "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300",
    amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300",
    sky: "bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-300",
};

export function ExpiryOverview() {
    const { expiry: data, isLoading: loading, initialize: refreshData } = useAppStore();
    const searchParams = useSearchParams();
    const router = useRouter();
    const rawGroupId = searchParams.get("expiryGroup");
    const selectedGroupId = rawGroupId || "all";

    const fetchData = useCallback(async () => {
        refreshData(true);
    }, [refreshData]);

    if (loading) return <div className="rounded-2xl border border-slate-200/60 bg-white/50 animate-pulse h-24" />;

    if (!data || data.totalCount === 0) return null;

    const groups = data.groups || [];
    const selectedGroup = selectedGroupId === "all" ? null : groups.find((g) => g.id === selectedGroupId);

    const totalUrgent = groups.reduce((sum, g) => sum + (g.urgentCount || 0), 0);
    const allGroup = { id: "all", count: data.totalCount, urgentCount: totalUrgent, label: "All Alerts" };
    const displayGroups = [allGroup, ...groups];

    const detailItems = selectedGroupId === "all" ? groups.flatMap((g) => g.items) : selectedGroup?.items || [];

    const clearSelection = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("expiryGroup");
        router.replace(`/?${params.toString()}`, { scroll: false });
    };

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" /> Expiry Alerts
                </h2>
                <button onClick={fetchData} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors">
                    <RefreshCw className="h-3 w-3" /> Refresh
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {displayGroups.map((group) => {
                    const meta = group.id === "all"
                        ? { label: "All Alerts", icon: AlertTriangle, color: "red" }
                        : (GROUP_META[group.id] || {});
                    const Icon = meta.icon || File;
                    const color = meta.color || "indigo";
                    const isActive = selectedGroupId === group.id;
                    const colorClass = COLOR_MAP[color] || "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300";

                    return (
                        <button
                            key={group.id}
                            onClick={() => {
                                isActive ? clearSelection() : router.replace(`/?${new URLSearchParams({ ...Object.fromEntries(searchParams), expiryGroup: group.id }).toString()}`, { scroll: false });
                            }}
                            className={cn(
                                "rounded-2xl border p-4 text-left transition-all duration-200 hover:shadow-md",
                                isActive ? "border-primary/40 bg-primary/5 dark:bg-primary/10 shadow-md" : "border-slate-200/60 bg-white/70 dark:bg-slate-900/70 hover:border-slate-300"
                            )}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center", colorClass)}><Icon className="h-4 w-4" /></div>
                                {group.urgentCount > 0 && <span className="text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-md">{group.urgentCount} action{group.urgentCount !== 1 ? 's' : ''} needed</span>}
                            </div>
                            <p className="text-xl font-bold text-slate-900 dark:text-white">{group.count}</p>
                            <p className="text-xs text-slate-500 mt-0.5 leading-tight">{meta.label || group.label}</p>
                        </button>
                    );
                })}
            </div>

            {selectedGroupId && detailItems.length > 0 && (
                <div className="rounded-2xl border border-slate-200/60 bg-white/70 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                        <p className="text-sm font-semibold text-slate-800">
                            {selectedGroupId === "all" ? `All Expiry Items (${detailItems.length})` : `${GROUP_META[selectedGroupId]?.label || selectedGroupId} — ${detailItems.length} items`}
                        </p>
                        <button onClick={clearSelection} className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50/80">
                                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Code</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Name / Description</th>
                                    {selectedGroupId === "all" && <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Type</th>}
                                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Expiry Date</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Days Left</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Status</th>
                                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">View</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {detailItems.map((item, idx) => {
                                    const urgency = URGENCY_CONFIG[item.urgency] || URGENCY_CONFIG.upcoming;
                                    const expDate = item.expiry && isValid(new Date(item.expiry)) ? format(new Date(item.expiry), "dd MMM yyyy") : "-";
                                    const daysLabel = item.daysLeft < 0 ? `${Math.abs(item.daysLeft)}d ago` : `${item.daysLeft}d`;

                                    return (
                                        <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs text-slate-600 font-medium">{item.code}</td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-slate-800 text-sm">{item.name}</p>
                                                {item.subLabel && <p className="text-xs text-slate-400">{item.subLabel}</p>}
                                            </td>
                                            {selectedGroupId === "all" && <td className="px-4 py-3 text-xs text-slate-500">{item.type}</td>}
                                            <td className="px-4 py-3 text-sm text-slate-600">{expDate}</td>
                                            <td className="px-4 py-3">
                                                <span className={cn("font-semibold text-sm", item.urgency === "expired" ? "text-red-600" : item.urgency === "critical" ? "text-orange-600" : item.urgency === "warning" ? "text-amber-600" : "text-blue-600")}>
                                                    {daysLabel}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border", urgency.className)}>
                                                    {urgency.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Link href={item.href} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                                                    Open <ArrowRight className="h-3 w-3" />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </section>
    );
}
