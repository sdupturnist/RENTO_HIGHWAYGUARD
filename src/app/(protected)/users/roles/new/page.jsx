"use client";
import { PageHeader } from "@/app/Components/ui/page-header";
import { RoleForm } from "@/app/Components/roles/RoleForm";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default function NewRolePage() {
    const { can, loading } = usePermissions();

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
    }

    if (!can("Users & Roles", "Add")) {
        return <Forbidden module="roles" action="create" />;
    }

    return (<div className="max-w-5xl mx-auto">
            <PageHeader title="Create New Role" description="Define a new role and assign permissions."/>
            <RoleForm />
        </div>);
}
