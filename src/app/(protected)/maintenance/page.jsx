"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { PageHeader } from "@/app/Components/ui/page-header";
import { MaintenanceList } from "@/app/Components/maintenance/MaintenanceList";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
export default function MaintenancePage() {
    const { loading, can } = usePermissions();
    if (loading)
        return null;
    const canView = can("Maintenance", "View");
    const canAdd = can("Maintenance", "Add") || can("Maintenance", "Edit");
    if (!canView) {
        return <div className="p-8 text-center text-muted-foreground">You do not have permission to view maintenance.</div>;
    }
    return (<div className="space-y-8">
            <PageHeader title="Vehicle Maintenance" description="Track maintenance records, costs, and vehicle availability.">
                {canAdd && (<Button asChild>
                        <Link href="/maintenance/add">
                            <Plus className="mr-2 h-4 w-4"/> Schedule Maintenance
                        </Link>
                    </Button>)}
            </PageHeader>

            <MaintenanceList />
        </div>);
}
