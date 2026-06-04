import { dbTenant } from "@/app/lib/db";
import { verifySession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { PageHeader } from "@/app/Components/ui/page-header";
import { LabourList } from "@/app/Components/labours/LabourList";

export default async function LaboursPage() {
    const session = await verifySession();
    const canView = await verifySessionPermission(session, "Labours", "View");

    if (!canView) {
        return <div className="p-8 text-center text-muted-foreground">You do not have permission to view labours.</div>;
    }

    const settings = (await dbTenant("SELECT * FROM `company_settings` LIMIT 1"))[0][0];
    const currencySymbol = settings?.currencySymbol || "AED";

    return (
        <div className="space-y-8">
            <PageHeader title="Labours" description="Manage quantity-based labour types for operational deployment (Quantity mode)." />
            <LabourList currencySymbol={currencySymbol} />
        </div>
    );
}
