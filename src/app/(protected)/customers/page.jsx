"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { ClientList } from "@/app/Components/clients/ClientList";
import { PageHeader } from "@/app/Components/ui/page-header";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { useRouter } from "next/navigation";
export default function CustomersPage() {
    const router = useRouter();
    const { loading, can } = usePermissions();
    if (loading)
        return null;
    const canView = can("Customers", "View");
    const canAdd = can("Customers", "Add") || can("Customers", "Edit");
    if (!canView) {
        return <div className="p-8 text-center text-muted-foreground">You do not have permission to view customers.</div>;
    }
    return (<div className="space-y-8">
            <PageHeader title="Customers" description="Manage your customer database and contact persons.">
                {canAdd && (<Button asChild>
                        <Link href="/customers/new">
                            <Plus className="mr-2 h-4 w-4"/> Add Customer
                        </Link>
                    </Button>)}
            </PageHeader>

            <ClientList onEdit={(client) => router.push(`/customers/${client.id}/edit`)}/>
        </div>);
}
