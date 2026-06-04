"use client";
import { PageHeader } from "@/app/Components/ui/page-header";
import { CustomerForm } from "@/app/Components/customers/CustomerForm";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default function NewCustomerPage() {
    const { can, loading } = usePermissions();

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
    }

    if (!can("Customers", "Add")) {
        return <Forbidden module="customers" action="add" />;
    }

    return (<div className="max-w-5xl mx-auto">
            <PageHeader title="Add New Customer" description="Create a new customer profile. Fields marked with * are required."/>
            <CustomerForm />
        </div>);
}
