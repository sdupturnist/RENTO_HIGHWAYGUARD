"use client";
import { PageHeader } from "@/app/Components/ui/page-header";
import { OperatorForm } from "@/app/Components/operators/OperatorForm";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default function NewOperatorPage() {
    const { can, loading } = usePermissions();

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
    }

    if (!can("Operators", "Add")) {
        return <Forbidden module="operators" action="add" />;
    }

    return (<div className="max-w-5xl mx-auto">
            <PageHeader title="Add New Operator" description="Register a new operator or driver in the system."/>
            <OperatorForm />
        </div>);
}
