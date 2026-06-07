"use client";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { DashboardKPIs } from "@/app/Components/dashboard/DashboardKPIs";
import { DashboardGraphs } from "@/app/Components/dashboard/DashboardGraphs";
import { VehicleAssignmentSnapshot } from "@/app/Components/dashboard/VehicleAssignmentSnapshot";
import { QuickActions } from "@/app/Components/dashboard/QuickActions";
import { ExpiryOverview } from "@/app/Components/dashboard/ExpiryOverview";
import { ApprovedUninvoicedTimesheets } from "@/app/Components/dashboard/ApprovedUninvoicedTimesheets";
import { useQuery } from "@tanstack/react-query";

export default function DashboardPage() {
    const [currentTime, setCurrentTime] = useState(new Date());

    const { data: metricsData, isLoading: loading } = useQuery({
        queryKey: ["dashboard-metrics"],
        queryFn: async () => {
            const res = await fetch("/api/dashboard/metrics");
            if (!res.ok) throw new Error("Failed to fetch");
            const json = await res.json();
            return json.data;
        },
        staleTime: 0,
    });

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const data = metricsData;
    if (loading) {
        return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground animate-pulse">Loading operational overview...</p></div>;
    }
    if (!data)
        return <div className="p-8">Failed to load dashboard data.</div>;
    return (<div className="flex-1 space-y-8  min-h-screen bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Operational overview: Vehicles, Assignments, and Performance.</p>
            </div>
            <div className="flex items-center flex-wrap sm:flex-nowrap gap-2 text-xs md:text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 md:px-4 rounded-xl md:rounded-full shadow-sm border border-indigo-100 dark:border-indigo-900/50 w-fit">
                <Clock className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{currentTime.toLocaleDateString()}</span>
                <span className="text-indigo-300 dark:text-indigo-600 shrink-0 hidden sm:inline">•</span>
                <span className="whitespace-nowrap">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        </div>

        <DashboardKPIs metrics={data.kpis} />

        <div className="grid gap-8">
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Quick Actions</h2>
                </div>
                <QuickActions />
            </section>

            <ApprovedUninvoicedTimesheets />

            <ExpiryOverview />

            <DashboardGraphs vehicleUtilization={data.graphs.vehicleUtilization} assignmentsByProject={data.graphs.assignmentsByProject} />

            <VehicleAssignmentSnapshot data={data.snapshot} />
        </div>
    </div>);
}
