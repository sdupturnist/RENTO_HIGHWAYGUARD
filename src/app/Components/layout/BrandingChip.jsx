"use client";
import Link from "next/link";
import { cn } from "@/app/lib/utils";
export function BrandingChip({ compact = false, className, branding, href }) {
    const appName = branding?.appName || "";
    const logoUrl = branding?.logoUrl || "";
    const initials = appName
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "";
    const content = (<div className={cn("flex items-center gap-2", className)} suppressHydrationWarning>
        {logoUrl ? (<img src={logoUrl} alt={appName} className={cn("h-9 w-auto object-contain drop-shadow-sm", compact && "h-8")} suppressHydrationWarning />) : initials ? (<div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold shadow" suppressHydrationWarning>
            {initials}
        </div>) : null}
        {!compact && appName && (<span className="font-semibold tracking-tight text-sm text-foreground">
            {appName}
        </span>)}
    </div>);
    if (!href) return content;
    return (<Link href={href} className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        {content}
    </Link>);
}
