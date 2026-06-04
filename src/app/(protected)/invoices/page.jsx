'use client';
import { InvoiceList } from "@/app/Components/invoices/InvoiceList";
import { Button } from "@/app/Components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/app/Components/ui/page-header";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { Forbidden } from "@/app/Components/common/Forbidden";
export default function InvoicesPage() {
    const { loading, can } = usePermissions();
    if (loading)
        return null;
    const canView = can("Invoices", "View");
    const canAdd = can("Invoices", "Add") || can("Invoices", "Edit");
    if (!canView) {
        return <Forbidden module="invoices" action="view" />;
    }
    return (<div className="flex-1 space-y-4 pt-6">
            <PageHeader title="Invoices" description="Manage and track your billing documents.">
                {canAdd && (<Button asChild>
                        <Link href="/invoices/new">
                            <Plus className="mr-2 h-4 w-4"/> Create Invoice
                        </Link>
                    </Button>)}
            </PageHeader>

            <InvoiceList />
        </div>);
}
