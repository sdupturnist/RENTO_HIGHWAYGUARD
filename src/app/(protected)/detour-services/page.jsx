import { dbTenant } from "@/app/lib/db";
import { verifySession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { PageHeader } from "@/app/Components/ui/page-header";
import { DetourTemplateList } from "@/app/Components/detour-templates/DetourTemplateList";

export default async function DetourServicesPage() {
    const session = await verifySession();
    const canView = await verifySessionPermission(session, "Detour Services", "View");

    if (!canView) {
        return <div className="p-8 text-center text-muted-foreground">You do not have permission to view detour services.</div>;
    }

    const settings = (await dbTenant("SELECT * FROM `company_settings` LIMIT 1"))[0][0];
    const currencySymbol = settings?.currencySymbol || "AED";

    return (
        <div className="space-y-8">
            <PageHeader title="Detour Services" description="Define detour service templates. Templates specify resource counts — actual vehicles are allocated per assignment." />
            <DetourTemplateList currencySymbol={currencySymbol} />
        </div>
    );
}
