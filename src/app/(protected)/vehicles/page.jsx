import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { VehicleList } from "@/app/Components/vehicles/VehicleList";
import { PageHeader } from "@/app/Components/ui/page-header";
import { dbTenant } from "@/app/lib/db";
import { verifySession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";

export default async function VehiclesPage() {
    const session = await verifySession();
    const canView = await verifySessionPermission(session, "Vehicles", "View");
    const canAdd = (await verifySessionPermission(session, "Vehicles", "Add")) || (await verifySessionPermission(session, "Vehicles", "Edit"));

    if (!canView) {
        return <div className="p-8 text-center text-muted-foreground">You do not have permission to view vehicles.</div>;
    }

    const settings = (await dbTenant("SELECT * FROM `company_settings` LIMIT 1"))[0][0];
    const currencySymbol = settings?.currencySymbol || "AED";

    return (
        <div className="space-y-8">
            <PageHeader title="Vehicles" description="Manage vehicle fleet, registrations, and documents.">
                {canAdd && (
                    <Button asChild>
                        <Link href="/vehicles/new">
                            <Plus className="mr-2 h-4 w-4" /> Add Vehicle
                        </Link>
                    </Button>
                )}
            </PageHeader>

            <VehicleList currencySymbol={currencySymbol} />
        </div>
    );
}
