"use client";
import Link from "next/link";
import { PlusCircle, FileText, CreditCard, Truck, Users } from "lucide-react";
export function QuickActions() {
    const actions = [
        { href: "/assignments/new", label: "Add Assignment", icon: PlusCircle, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
        { href: "/timesheets", label: "Generate Timesheet", icon: FileText, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
        { href: "/invoices/new", label: "Create Invoice", icon: CreditCard, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
        { href: "/vehicles/new", label: "Add Vehicle", icon: Truck, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
        { href: "/operators/new", label: "Add Operator", icon: Users, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
    ];
    return (<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-6 animate-slide-up-fade w-full" style={{ animationDelay: "100ms" }}>
        {actions.map((action, index) => (<Link key={index} href={action.href} className="group relative flex flex-col items-center justify-center p-4 md:p-6 rounded-2xl bg-white/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
            <div className={`h-12 w-12 md:h-14 md:w-14 rounded-2xl ${action.bg} flex items-center justify-center mb-3 transition-transform group-hover:scale-110 duration-300 shrink-0`}>
                <action.icon className={`h-6 w-6 md:h-7 md:w-7 ${action.color}`} />
            </div>
            <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs md:text-sm text-center line-clamp-2 leading-tight">{action.label}</span>
        </Link>))}
    </div>);
}
