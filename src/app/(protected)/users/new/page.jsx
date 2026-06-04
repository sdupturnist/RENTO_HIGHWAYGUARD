"use client";
import { PageHeader } from "@/app/Components/ui/page-header";
import { UserForm } from "@/app/Components/users/UserForm";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default function NewUserPage() {
    const { can, loading } = usePermissions();

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
    }

    if (!can("Users & Roles", "Add")) {
        return <Forbidden module="users" action="create" />;
    }

    return (<div className="max-w-5xl mx-auto">
            <PageHeader title="Add New User" description="Create a new system user and assign a role."/>
            <UserForm />
        </div>);
}
