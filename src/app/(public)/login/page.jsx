import LoginClient from "./LoginClient";
import { headers } from "next/headers";
import { getResolvedTenantBranding } from "@/app/lib/branding-resolver";
import { Suspense } from "react";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LoginPage() {
    let branding = {
        appName: "Rent ERP",
        logoUrl: "",
        loginBrandName: "Rent ERP",
    };

    try {
        const reqHeaders = await headers();
        const subdomain = reqHeaders.get("x-subdomain");
        branding = await getResolvedTenantBranding(subdomain);
    } catch {
        // use defaults
    }

    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950"><p className="text-muted-foreground animate-pulse">Loading...</p></div>}>
            <LoginClient branding={branding} />
        </Suspense>
    );
}
