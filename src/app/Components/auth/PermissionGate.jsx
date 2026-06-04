"use client";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
export function PermissionGate({ children, allowedRoles = [], module, action, fallback = null, }) {
    const { role, can, loading } = usePermissions();
    if (loading)
        return null;
    const normalizedRole = role?.toUpperCase();
    const allowedByModule = module && action ? can(module, action) : false;
    const allowedByRole = allowedRoles.length > 0 && normalizedRole
        ? normalizedRole === "SUPER ADMIN" || allowedRoles.includes(normalizedRole)
        : false;
    if (allowedByModule || allowedByRole || normalizedRole === "SUPER ADMIN") {
        return <>{children}</>;
    }
    return <>{fallback}</>;
}
