"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
    AlertTriangle,
    BellRing,
    CalendarClock,
    Car,
    CheckCircle2,
    ChevronRight,
    FileText,
    ShieldAlert,
    User as UserIcon,
    Loader2,
    Lock
} from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/app/Components/ui/card";
import { Badge } from "@/app/Components/ui/badge";
import { Button } from "@/app/Components/ui/button";
import { ScrollArea } from "@/app/Components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/app/Components/ui/tabs";
import Link from "next/link";
export function ExpiryTrackerCard() {
    const [filter, setFilter] = useState("all");

    const { data = { items: [], active: false }, isLoading: loading } = useQuery({
        queryKey: ["dashboard-expiries"],
        queryFn: async () => {
            const res = await fetch("/api/dashboard/expiries");
            if (!res.ok) throw new Error("Failed to fetch expiries");
            return res.json();
        },
        enabled: true,
    });

    const filteredItems = useMemo(() => {
        if (!data.items) return [];
        if (filter === "all") return data.items;
        return data.items.filter(item => item.category === filter);
    }, [data.items, filter]);

    if (!data.active) return null;

    const getIcon = (category) => {
        switch (category) {
            case 'vehicle': return <Car className="h-5 w-5" />;
            case 'operator': return <UserIcon className="h-5 w-5" />;
            case 'document': return <FileText className="h-5 w-5" />;
            default: return <BellRing className="h-5 w-5" />;
        }
    };

    const getUrgencyBadge = (urgency, daysRemaining) => {
        if (urgency === 'expired') {
            return <Badge variant="destructive" className="flex gap-1 items-center px-2 py-0.5"><ShieldAlert className="h-3 w-3" /> Expired</Badge>;
        }
        if (urgency === 'urgent') {
            return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200 flex gap-1 items-center px-2 py-0.5 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"><AlertTriangle className="h-3 w-3" /> {daysRemaining} {daysRemaining === 1 ? 'Day' : 'Days'}</Badge>;
        }
        return <Badge variant="secondary" className="flex gap-1 items-center px-2 py-0.5 text-slate-600 dark:text-slate-300"><CalendarClock className="h-3 w-3" /> {daysRemaining} Days</Badge>;
    };

    const getUrgencyColor = (urgency) => {
        if (urgency === 'expired') return 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400';
        if (urgency === 'urgent') return 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400';
        return 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400';
    };

    return (
        <Card id="expiry-section" className="border-slate-200/60 dark:border-slate-800/60 shadow-sm bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden flex flex-col h-full">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                        <CardTitle className="text-xl flex items-center gap-2">
                            <BellRing className="h-5 w-5 text-indigo-500" />
                            Expiring & Missing Items
                        </CardTitle>
                        <CardDescription>
                            Track upcoming validity expirations across all assets.
                        </CardDescription>
                    </div>
                    {data.items?.length > 0 && (
                        <Tabs value={filter} onValueChange={setFilter} className="w-full sm:w-auto self-start sm:self-auto">
                            <TabsList className="grid w-full grid-cols-4 sm:w-[350px]">
                                <TabsTrigger value="all">All</TabsTrigger>
                                <TabsTrigger value="vehicle">Vehicles</TabsTrigger>
                                <TabsTrigger value="operator">Operators</TabsTrigger>
                                <TabsTrigger value="document">Docs</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0 flex flex-col flex-1 h-[350px]">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500 min-h-[300px]">
                        <Loader2 className="h-8 w-8 animate-spin mb-4 text-indigo-500" />
                        <p className="text-sm font-medium">Scanning records for expiries...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[300px] bg-slate-50/50 dark:bg-slate-900/20">
                        <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                            {filter === "all" ? "All Caught Up!" : "No Expiries Here"}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                            {filter === "all"
                                ? "There are no upcoming expirations or missing documents based on your configured notification thresholds."
                                : `There are no upcoming expirations in the ${filter} category.`}
                        </p>
                        {filter !== "all" && (
                            <Button variant="link" className="mt-4" onClick={() => setFilter("all")}>
                                View All Categories
                            </Button>
                        )}
                    </div>
                ) : (
                    <ScrollArea className="flex-1">
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredItems.map((item) => (
                                <Link
                                    key={item.id}
                                    href={item.link}
                                    className="flex items-center gap-4 p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group"
                                >
                                    <div className={`p-3 rounded-xl shrink-0 transition-colors ${getUrgencyColor(item.urgency)}`}>
                                        {getIcon(item.category)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                                {item.entityName}
                                            </h4>
                                            {getUrgencyBadge(item.urgency, item.daysRemaining)}
                                        </div>
                                        <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 truncate gap-2">
                                            <span className="font-medium text-slate-700 dark:text-slate-300">
                                                {item.type}
                                            </span>
                                            <span className="text-slate-300 dark:text-slate-600">•</span>
                                            <span className="truncate">{item.reference}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <span className={`text-xs font-medium ${item.urgency === 'expired' ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                            {new Date(item.expiryDate).toLocaleDateString()}
                                        </span>
                                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-500 transition-colors translate-x-0 group-hover:translate-x-1" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}
