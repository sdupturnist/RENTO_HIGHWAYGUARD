"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { PageHeader } from "@/app/Components/ui/page-header";
import { TimeLogList } from "@/app/Components/time-logs/TimeLogList";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
export default function TimeLogsPage() {
    const { loading, can } = usePermissions();
    if (loading)
        return null;
    const canView = can("Daily Time Logs", "View");
    const canAdd = can("Daily Time Logs", "Add") || can("Daily Time Logs", "Edit");
    if (!canView) {
        return <div className="p-8 text-center text-muted-foreground">You do not have permission to view daily time logs.</div>;
    }
    return (<div className="space-y-8">
            <PageHeader title="Daily Time Logs" description="View and manage daily time records for assignments.">
                {canAdd && (<Button asChild>
                        <Link href="/time-logs/new">
                            <Plus className="mr-2 h-4 w-4"/> New Time Log
                        </Link>
                    </Button>)}
            </PageHeader>

            <TimeLogList />
        </div>);
}
