import LoginClient from "./LoginClient";
import { headers } from "next/headers";
import { getResolvedTenantBranding } from "@/app/lib/branding-resolver";

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

    return <LoginClient branding={branding} />;
}
