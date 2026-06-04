"use client";
import Link from "next/link";
import { Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { RoleList } from "@/app/Components/roles/RoleList";
import { PageHeader } from "@/app/Components/ui/page-header";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { useRouter } from "next/navigation";
import { Forbidden } from "@/app/Components/common/Forbidden";
export default function RolesPage() {
    const router = useRouter();
    const { loading, can } = usePermissions();
    if (loading)
        return null;
    const canView = can("Users & Roles", "View");
    const canAdd = can("Users & Roles", "Add") || can("Users & Roles", "Edit");
    if (!canView) {
        return <Forbidden module="roles" action="view" />;
    }
    return (<div className="space-y-8">
            <PageHeader title="Roles & Permissions" description="Manage system roles and their permissions.">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" asChild>
                        <Link href="/users">
                            <ArrowLeft className="mr-2 h-4 w-4"/> Back
                        </Link>
                    </Button>
                {canAdd && (<Button asChild>
                        <Link href="/users/roles/new">
                            <Plus className="mr-2 h-4 w-4"/> Create Role
                        </Link>
                    </Button>)}
                </div>
            </PageHeader>

            <RoleList onEdit={(role) => router.push(`/users/roles/${role.id}/edit`)}/>
        </div>);
}
