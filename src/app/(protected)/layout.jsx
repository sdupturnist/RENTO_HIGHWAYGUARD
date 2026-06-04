export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { Sidebar, SidebarNav } from "@/app/Components/layout/Sidebar";
import { UserNav } from "@/app/Components/layout/UserNav";
import { ExpiryNotificationBell } from "@/app/Components/layout/ExpiryNotificationBell";
import { Sheet, SheetContent, SheetTrigger } from "@/app/Components/ui/sheet";
import { Button } from "@/app/Components/ui/button";
import { Menu, HelpCircle } from "lucide-react";
import { BrandingChip } from "@/app/Components/layout/BrandingChip";
import { PermissionsProvider } from "@/app/Components/auth/PermissionsProvider";
import { getResolvedTenantBranding } from "@/app/lib/branding-resolver";
import Link from "next/link";

export default async function DashboardLayout({ children, }) {
    let primaryColor = null;
    let brandingData = { appName: "", logoUrl: "", slogan: "" };
    try {
        const branding = await getResolvedTenantBranding();
        primaryColor = branding?.primaryColor || null;
        brandingData = {
            appName: branding?.appName || "",
            logoUrl: branding?.logoUrl || "",
            slogan: branding?.slogan || "",
        };
    } catch {
        // defaults will be used
    }

    return (<PermissionsProvider>
        {primaryColor && (
            <style dangerouslySetInnerHTML={{ __html: `:root { --primary: ${primaryColor}; --ring: ${primaryColor}; }` }} />
        )}
        <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar branding={brandingData} />
            <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
                <header className="flex h-16 items-center gap-4 px-3 md:px-6 py-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-b border-border/70 z-10">
                    <div className="flex items-center gap-3 lg:hidden">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="outline" size="icon">
                                    <Menu className="h-5 w-5" />
                                    <span className="sr-only">Open navigation</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[18rem] px-0 pt-2 flex flex-col h-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl">
                                <div className="px-4 py-4 border-b border-border/70 shrink-0">
                                    <BrandingChip branding={brandingData} href="/" />
                                </div>
                                <div className="px-2 py-4 flex-1 overflow-y-auto">
                                    <SidebarNav mobile />
                                </div>
                            </SheetContent>
                        </Sheet>
                        <BrandingChip compact branding={brandingData} href="/" />
                    </div>
                    <div className="flex items-center gap-3 ml-auto">
                        <ExpiryNotificationBell />
                        <Link href="/knowledge-base" title="Knowledge Base (User Manual)">
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300">
                                <HelpCircle className="h-5 w-5 text-slate-500 hover:text-primary dark:text-slate-400 dark:hover:text-primary transition-colors" />
                            </Button>
                        </Link>
                        <UserNav />
                    </div>
                </header>
                <main className="flex-1 overflow-y-auto px-3 pb-4 md:px-8 md:pb-10 pt-3 md:pt-6">
                    <div className="mx-auto max-w-7xl w-full space-y-6">{children}</div>
                    <footer className="mx-auto max-w-7xl w-full mt-10 pt-4 border-t border-border/50">
                        <p className="text-center text-xs text-slate-400 dark:text-slate-600 tracking-wide">
                            © {new Date().getFullYear()} UPTURNIST Fleet Management Operation. All rights reserved.
                        </p>
                    </footer>
                </main>
            </div>
        </div>
    </PermissionsProvider>);
}
