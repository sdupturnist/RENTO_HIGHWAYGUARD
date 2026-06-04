import "./globals.css";
import { Toaster } from "@/app/Components/ui/sonner";
import { unstable_noStore as noStore } from "next/cache";
import { getAppBranding } from "@/app/lib/branding-resolver";
import { SettingsProvider } from "@/app/Components/providers/SettingsProvider";
import { ThemeProvider } from "@/app/Components/providers/theme-provider";
import { Inter } from "next/font/google";

export async function generateMetadata() {
    noStore();
    try {
        const branding = await getAppBranding();
        return {
            title: branding.seoTitle,
            description: branding.seoDescription,
            icons: {
                icon: [{ url: "/api/favicon" }],
                shortcut: [{ url: "/api/favicon" }],
                apple: [{ url: "/api/favicon" }],
            },
        };
    } catch {
        return { title: "", description: "" };
    }
}

const inter = Inter({ subsets: ["latin"] });

import QueryProvider from "@/app/Components/providers/QueryProvider";
import StoreInitializer from "@/app/Components/providers/StoreInitializer";

export default async function RootLayout({ children }) {
    let primaryColor = null;

    try {
        const branding = await getAppBranding();
        primaryColor = branding.primaryColor;
    } catch {
        // Safe fallback
    }

    return (
        <html lang="en" suppressHydrationWarning>
            <head />
            <body className={inter.className} suppressHydrationWarning>
                {primaryColor && (
                    <style dangerouslySetInnerHTML={{ __html: `:root { --primary: ${primaryColor}; --ring: ${primaryColor}; }` }} />
                )}
                <QueryProvider>
                    <StoreInitializer />
                    <SettingsProvider>
                        <ThemeProvider>
                            {children}
                            <Toaster position="top-right" />
                        </ThemeProvider>
                    </SettingsProvider>
                </QueryProvider>
            </body>
        </html>
    );
}
