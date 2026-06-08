"use client";

import { useEffect } from "react";
import { useAppStore } from "@/app/lib/store/useAppStore";
import { usePathname } from "next/navigation";

export default function StoreInitializer() {
    const initialize = useAppStore((state) => state.initialize);
    const refreshExpiry = useAppStore((state) => state.refreshExpiry);
    const pathname = usePathname();

    useEffect(() => {
        // We only initialize once per session.
        // We don't depend on pathname here to prevent refetching on route change.
        initialize();
    }, [initialize]);

    useEffect(() => {
        // Refresh expiry alerts/notifications on route transitions
        refreshExpiry();
    }, [pathname, refreshExpiry]);

    return null;
}
