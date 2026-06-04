"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { UserList } from "@/app/Components/users/UserList";
import { PageHeader } from "@/app/Components/ui/page-header";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { useRouter } from "next/navigation";
import { Forbidden } from "@/app/Components/common/Forbidden";
export default function UsersPage() {
    const router = useRouter();
    const { loading, can } = usePermissions();
    if (loading)
        return null;
    const canView = can("Users & Roles", "View");
    const canAdd = can("Users & Roles", "Add") || can("Users & Roles", "Edit");
    if (!canView) {
        return <Forbidden module="users" action="view" />;
    }
    return (<div className="space-y-8">
            <PageHeader title="Users" description="Manage system users and their access roles.">
                <div className="flex gap-2">
                    <Link href="/users/roles">
                        <Button variant="outline">
                            Manage Roles
                        </Button>
                    </Link>
                    {canAdd && (<Button asChild>
                            <Link href="/users/new">
                                <Plus className="mr-2 h-4 w-4"/> Add User
                            </Link>
                        </Button>)}
                </div>
            </PageHeader>

            <UserList onEdit={(user) => router.push(`/users/${user.id}/edit`)}/>
        </div>);
}
