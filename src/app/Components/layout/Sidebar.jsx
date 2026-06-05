"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { LayoutDashboard, Truck, Users, Briefcase, CalendarDays, FileText, BarChart3, Settings, Building2, Clock, ScrollText, Wrench, Receipt, Package, HardHat, Triangle } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { SheetClose } from "@/app/Components/ui/sheet";
export const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Vehicles", href: "/vehicles", icon: Truck },
    { name: "Operators", href: "/operators", icon: Users },
    { name: "Materials", href: "/materials", icon: Package },
    { name: "Labours", href: "/labours", icon: HardHat },
    { name: "Detour Services", href: "/detour-services", icon: Triangle },
    { name: "Customers", href: "/customers", icon: Building2 },
    { name: "Projects", href: "/projects", icon: Briefcase },
    { name: "Assignments", href: "/assignments", icon: CalendarDays },
    { name: "Daily Time Logs", href: "/time-logs", icon: Clock },
    { name: "Timesheets", href: "/timesheets", icon: FileText },
    { name: "Invoices", href: "/invoices", icon: FileText },
    { name: "Expenses", href: "/expenses", icon: Receipt },
    { name: "Maintenance", href: "/maintenance", icon: Wrench },
    { name: "Reports", href: "/reports", icon: BarChart3 },
    { name: "Users & Roles", href: "/users", icon: Users },
    { name: "Audit Logs", href: "/audit-logs", icon: ScrollText },
    { name: "Settings", href: "/settings", icon: Settings },
];
export function SidebarNav({ onNavigate, mobile }) {
    const { can, hasRolePermission, loading } = usePermissions();
    const pathname = usePathname();

    const filteredItems = navItems.filter((item) => {
        switch (item.name) {
            case "Assignments":
                return hasRolePermission("Assignment", "View") || hasRolePermission("Assignment", "Calendar View");
            case "Daily Time Logs":
                return hasRolePermission("Daily Time Logs", "View");
            case "Timesheets":
                return hasRolePermission("Timesheet", "View");
            case "Users & Roles":
                return hasRolePermission("Users & Roles", "View");
            case "Audit Logs":
                return hasRolePermission("Audit Logs", "View");
            case "Reports":
                return hasRolePermission("Reports", "View");
            case "Settings":
                return hasRolePermission("Settings", "View");
            case "Expenses":
                return hasRolePermission("Expenses", "View");
            default:
                return hasRolePermission(item.name, "View");
        }
    });
    if (loading) {
        return (<nav className="space-y-2">
            {[...Array(6)].map((_, idx) => (<div key={idx} className="h-9 rounded-2xl bg-slate-100 animate-pulse dark:bg-slate-800" />))}
        </nav>);
    }

    return (<>
        <nav className="space-y-1.5 pb-4 pt-2">
            {filteredItems.map((item) => {
                const isActive = item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                
                const handleClick = (e) => {
                    if (onNavigate) {
                        onNavigate();
                    }
                };

                const linkNode = (
                    <Link key={item.href} href={item.href} prefetch={false} onClick={handleClick} data-active={isActive ? "true" : undefined} className={cn("group relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-300 overflow-hidden", isActive
                        ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground border border-primary/30 shadow-[0_0_20px_-5px] shadow-primary/30 dark:shadow-primary/40"
                        : "text-slate-500 hover:bg-slate-100/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/40 dark:hover:text-slate-100 border border-transparent hover:translate-x-1")}
                    >
                        <div className={cn("absolute left-0 top-1/2 -translate-y-1/2 h-9 w-[4px] rounded-r-full transition-all duration-300 shadow-[2px_0_10px] shadow-primary/50", isActive ? "bg-primary opacity-100 scale-y-100" : "bg-primary opacity-0 scale-y-0")} />
                        <Icon className={cn("h-5 w-5 relative z-10 transition-transform duration-300 group-hover:scale-110", isActive ? "text-primary" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300")} />
                        <span className="relative z-10 flex-1">{item.name}</span>
                    </Link>
                );

                return mobile && SheetClose ? (
                    <SheetClose key={`wrapper-${item.href}`} asChild>
                        {linkNode}
                    </SheetClose>
                ) : (
                    <React.Fragment key={`wrapper-${item.href}`}>{linkNode}</React.Fragment>
                );
            })}
        </nav>
    </>);
}
export function Sidebar({ branding }) {
    const appName = branding?.appName || "";
    const logoUrl = branding?.logoUrl || "";
    const slogan = branding?.slogan || "";
    return (<div className="hidden lg:flex h-screen min-h-0 flex-col bg-white/75 dark:bg-slate-950/75 backdrop-blur-2xl border-r border-border/70 w-60 min-w-[15rem] md:w-64 md:min-w-64 transition-all duration-300 shadow-[0_20px_60px_-28px_rgba(15,23,42,0.4)]">
        <div className="px-4 pt-6 pb-4 shrink-0">
            <Link href="/" className="flex items-center gap-3 pl-2 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-10 w-auto object-contain drop-shadow-sm" />
                ) : (
                    <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                        <span className="font-bold text-primary-foreground text-lg">
                            {appName ? appName[0].toUpperCase() : "R"}
                        </span>
                    </div>
                )}
                {appName && (
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white truncate">{appName}</h1>
                        {slogan ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{slogan}</p>
                        ) : null}
                    </div>
                )}
            </Link>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-5">
            <SidebarNav />
        </div>
    </div>);
}
