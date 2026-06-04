"use client";
import { PageHeader } from "@/app/Components/ui/page-header";
import { TimeLogForm } from "@/app/Components/time-logs/TimeLogForm";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default function NewTimeLogPage() {
    const { can, loading } = usePermissions();

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
    }

    if (!can("Daily Time Logs", "Add")) {
        return <Forbidden module="daily time logs" action="add" />;
    }

    return (<div className="max-w-5xl mx-auto">
            <PageHeader title="New Time Log" description="Manually create a daily time record"/>
            <TimeLogForm />
        </div>);
}
