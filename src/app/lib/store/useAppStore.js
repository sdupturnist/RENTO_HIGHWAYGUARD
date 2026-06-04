import { create } from "zustand";

export const useAppStore = create((set, get) => ({
    // Data State
    brands: [],
    profile: null,
    expiry: null,
    securitySettings: null,
    permissions: null,
    companySettings: null,

    // Status State
    isInitialized: false,
    isLoading: false,
    error: null,

    // Actions
    initialize: async (force = false) => {
        // Prevent re-initialization if already loaded or currently loading
        if ((get().isInitialized || get().isLoading) && !force) return;

        set({ isLoading: true, error: null });

        try {
            // Fetch all core data in parallel
            const [
                brandsRes,
                profileRes,
                expiryRes,
                securityRes,
                permissionsRes,
                companyRes
            ] = await Promise.all([
                fetch("/api/config/brands").then(res => res.json()).catch(() => ({ data: [] })),
                fetch("/api/profile").then(res => res.json()).catch(() => ({ data: null })),
                fetch("/api/expiry").then(res => res.json()).catch(() => ({ data: null })),
                fetch("/api/settings/security").then(res => res.json()).catch(() => ({ data: null })),
                fetch("/api/auth/permissions").then(res => res.json()).catch(() => ({ data: [] })),
                fetch("/api/settings/company").then(res => res.json()).catch(() => null)
            ]);

            set({
                brands: brandsRes?.data || [],
                profile: profileRes?.data || profileRes || null,
                expiry: expiryRes?.data || expiryRes || null,
                securitySettings: securityRes?.data || securityRes || null,
                permissions: permissionsRes?.data || permissionsRes || [],
                companySettings: companyRes?.data || companyRes || null,
                isInitialized: true,
                isLoading: false
            });
        } catch (err) {
            console.error("Store initialization failed:", err);
            set({ error: err.message, isLoading: false });
        }
    },

    // Individual refreshers (if needed)
    refreshProfile: async () => {
        const res = await fetch("/api/profile").then(res => res.json()).catch(() => null);
        if (res) set({ profile: res.data || res });
    },

    refreshSettings: async () => {
        const res = await fetch("/api/settings/company").then(res => res.json()).catch(() => null);
        if (res) set({ companySettings: res.data || res });
    },

    clearStore: () => {
        set({
            brands: [],
            profile: null,
            expiry: null,
            securitySettings: null,
            permissions: null,
            companySettings: null,
            isInitialized: false
        });
    }
}));
