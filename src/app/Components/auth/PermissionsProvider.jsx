"use client";
import { createContext, useContext, useMemo } from "react";
import { useAppStore } from "@/app/lib/store/useAppStore";

const PermissionsContext = createContext(undefined);

export function PermissionsProvider({ children }) {
    const { permissions: data, isLoading, isInitialized, error } = useAppStore();

    const loading = isLoading || !isInitialized;

    const role = data?.role ?? null;
    const isSystem = data?.isSystem ?? false;
    const permissions = Array.isArray(data?.permissions) ? data.permissions : [];

    const hasRolePermission = useMemo(() => {
            const upperRole = role?.toUpperCase();
            return (module, action) => {
                if (loading || error) return false;
                // Super Admin/system roles get all permissions
                if (isSystem || upperRole === "SUPER ADMIN")
                    return true;
            return permissions.some((p) => p.module.toLowerCase() === module.toLowerCase() &&
                p.action.toLowerCase() === action.toLowerCase());
        };
    }, [role, permissions, loading, error, isSystem]);

    const can = useMemo(() => {
        return (module, action) => {
            if (loading || error) return false;
            return hasRolePermission(module, action);
        };
    }, [hasRolePermission, loading, error]);

    const value = {
        role,
        isSystem,
        permissions,
        loading,
        error,
        can,
        hasRolePermission,
    };
    return (<PermissionsContext.Provider value={value}>
        {children}
    </PermissionsContext.Provider>);
}
export function usePermissions() {
    const ctx = useContext(PermissionsContext);
    if (!ctx) {
        throw new Error("usePermissions must be used within PermissionsProvider");
    }
    return ctx;
}
