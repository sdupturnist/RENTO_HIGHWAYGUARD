import { dbTenant } from "@/app/lib/db";
import { verifySession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { PageHeader } from "@/app/Components/ui/page-header";
import { MaterialList } from "@/app/Components/materials/MaterialList";

export default async function MaterialsPage() {
    const session = await verifySession();
    const canView = await verifySessionPermission(session, "Materials", "View");

    if (!canView) {
        return <div className="p-8 text-center text-muted-foreground">You do not have permission to view materials.</div>;
    }

    const settings = (await dbTenant("SELECT * FROM `company_settings` LIMIT 1"))[0][0];
    const currencySymbol = settings?.currencySymbol || "AED";

    return (
        <div className="space-y-8">
            <PageHeader title="Materials" description="Manage quantity-based deployable resources like cones, signboards, and barricades." />
            <MaterialList currencySymbol={currencySymbol} />
        </div>
    );
}
