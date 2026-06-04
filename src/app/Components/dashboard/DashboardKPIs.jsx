"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Truck, Users, CalendarCheck, Clock, CheckCircle, AlertCircle } from "lucide-react";
export function DashboardKPIs({ metrics }) {
    const kpiItems = [
        { title: "Total Vehicles", value: metrics.totalVehicles, label: "Fleet size", icon: Truck, color: "text-indigo-600", bg: "bg-indigo-100 dark:bg-indigo-900/30", iconColor: "text-indigo-600 dark:text-indigo-400" },
        { title: "Vehicle Available (30d)", value: metrics.availableVehicles, label: "Next 30 days", icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30", iconColor: "text-emerald-600 dark:text-emerald-400" },
        { title: "Total Assignments", value: metrics.assignedVehicles, label: "Current month", icon: CalendarCheck, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30", iconColor: "text-blue-600 dark:text-blue-400" },
        { title: "Available Operator (30d)", value: metrics.activeOperators, label: "Next 30 days", icon: Users, color: "text-violet-600", bg: "bg-violet-100 dark:bg-violet-900/30", iconColor: "text-violet-600 dark:text-violet-400" },
        { title: "Active Assignments", value: metrics.activeAssignments, label: "Ongoing now", icon: Clock, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30", iconColor: "text-amber-600 dark:text-amber-400" },
        { title: "Pending Timesheets", value: metrics.pendingTimesheets, label: "Draft / Outdated", icon: AlertCircle, color: "text-rose-600", bg: "bg-rose-100 dark:bg-rose-900/30", iconColor: "text-rose-600 dark:text-rose-400" },
    ];
    return (<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 animate-slide-up-fade" style={{ animationDelay: "0ms" }}>
        {kpiItems.map((item, index) => (<Card key={index} className="backdrop-blur-sm bg-white/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-slate-600 dark:text-slate-300">{item.title}</CardTitle>
                <div className={`h-8 w-8 rounded-lg ${item.bg} flex items-center justify-center transition-colors group-hover:bg-opacity-100`}>
                    <item.icon className={`h-4 w-4 ${item.iconColor}`} />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">{item.value}</div>
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1">{item.label}</p>
            </CardContent>
        </Card>))}
    </div>);
}
