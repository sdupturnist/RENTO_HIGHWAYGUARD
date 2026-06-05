import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";

// All permissions that should exist in the system
const REQUIRED_PERMISSIONS = [
    { module: "Dashboard", action: "View" },
    { module: "Vehicles", action: "View" },
    { module: "Vehicles", action: "Add" },
    { module: "Vehicles", action: "Edit" },
    { module: "Vehicles", action: "Delete" },
    { module: "Operators", action: "View" },
    { module: "Operators", action: "Add" },
    { module: "Operators", action: "Edit" },
    { module: "Operators", action: "Delete" },
    { module: "Customers", action: "View" },
    { module: "Customers", action: "Add" },
    { module: "Customers", action: "Edit" },
    { module: "Customers", action: "Delete" },
    { module: "Projects", action: "View" },
    { module: "Projects", action: "Add" },
    { module: "Projects", action: "Edit" },
    { module: "Projects", action: "Delete" },
    { module: "Materials", action: "View" },
    { module: "Materials", action: "Add" },
    { module: "Materials", action: "Edit" },
    { module: "Materials", action: "Delete" },
    { module: "Labours", action: "View" },
    { module: "Labours", action: "Add" },
    { module: "Labours", action: "Edit" },
    { module: "Labours", action: "Delete" },
    { module: "Detour Services", action: "View" },
    { module: "Detour Services", action: "Add" },
    { module: "Detour Services", action: "Edit" },
    { module: "Detour Services", action: "Delete" },
    { module: "Assignment", action: "View" },
    { module: "Assignment", action: "Add" },
    { module: "Assignment", action: "Edit" },
    { module: "Assignment", action: "Delete" },
    { module: "Daily Time Logs", action: "View" },
    { module: "Daily Time Logs", action: "Add" },
    { module: "Daily Time Logs", action: "Edit" },
    { module: "Daily Time Logs", action: "Delete" },
    { module: "Timesheet", action: "View" },
    { module: "Timesheet", action: "Generate" },
    { module: "Timesheet", action: "Regenerate" },
    { module: "Timesheet", action: "Delete" },
    { module: "Invoices", action: "View" },
    { module: "Invoices", action: "Add" },
    { module: "Invoices", action: "Edit" },
    { module: "Invoices", action: "Delete" },
    { module: "Expenses", action: "View" },
    { module: "Expenses", action: "Add" },
    { module: "Expenses", action: "Edit" },
    { module: "Expenses", action: "Delete" },
    { module: "Maintenance", action: "View" },
    { module: "Maintenance", action: "Add" },
    { module: "Maintenance", action: "Edit" },
    { module: "Maintenance", action: "Delete" },
    { module: "Reports", action: "View" },
    { module: "Users & Roles", action: "View" },
    { module: "Users & Roles", action: "Add" },
    { module: "Users & Roles", action: "Edit" },
    { module: "Users & Roles", action: "Delete" },
    { module: "Audit Logs", action: "View" },
    { module: "Settings", action: "View" },
    { module: "Settings", action: "Edit" },
];

// GET /api/permissions - List all permissions grouped by module
export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        // Auto-seed permissions if table is empty or missing entries
        const [existingRows] = await dbTenant("SELECT COUNT(*) as count FROM `permissions`");
        if (!existingRows[0]?.count || existingRows[0].count < REQUIRED_PERMISSIONS.length) {
            for (const perm of REQUIRED_PERMISSIONS) {
                await dbTenant(
                    "INSERT IGNORE INTO `permissions` (module, action) VALUES (?, ?)",
                    [perm.module, perm.action]
                );
            }
        }

        const [permissions] = await dbTenant("SELECT * FROM `permissions` ORDER BY module ASC, action ASC");

        const moduleOrder = [
            "Dashboard", "Vehicles", "Operators", "Materials", "Labours", "Detour Services",
            "Customers", "Projects",
            "Assignment", "Daily Time Logs", "Timesheet", "Invoices", "Expenses",
            "Maintenance", "Reports", "Users & Roles", "Audit Logs", "Settings"
        ];

        // Group permissions by module
        const groupedPermissions = {};
        moduleOrder.forEach(mod => { groupedPermissions[mod] = []; });

        (permissions || []).forEach((p) => {
            if (!groupedPermissions[p.module]) groupedPermissions[p.module] = [];
            groupedPermissions[p.module].push(p);
        });

        // Clean up empty modules
        Object.keys(groupedPermissions).forEach(key => {
            if (groupedPermissions[key].length === 0) delete groupedPermissions[key];
        });

        return NextResponse.json({
            permissions: permissions || [],
            groupedPermissions,
        });
    } catch (error) {
        console.error("Error fetching permissions:", error);
        return NextResponse.json({ message: "Error fetching permissions", details: error?.message }, { status: 500 });
    }
}
