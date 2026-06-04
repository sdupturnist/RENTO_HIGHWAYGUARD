import { dbTenant } from "@/app/lib/db";
import { PageHeader } from "@/app/Components/ui/page-header";
import { DetourTemplatePageForm } from "@/app/Components/detour-templates/DetourTemplatePageForm";
import { Button } from "@/app/Components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default async function NewDetourTemplatePage() {
    const session = await getSession();
    const canAdd = session ? await verifySessionPermission(session, "Detour Services", "Add") : false;
    if (!canAdd) {
        return <Forbidden module="detour services" action="add" />;
    }

    const settings = (await dbTenant("SELECT currencySymbol FROM `company_settings` LIMIT 1"))[0][0];
    const currencySymbol = settings?.currencySymbol || "AED";

    return (
        <div className="max-w-5xl mx-auto pb-24">
            <PageHeader
                title="New Detour Service Template"
                description="Define a reusable template for detour service deployments."
            >
                <Button variant="outline" size="sm" asChild>
                    <Link href="/detour-services"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
                </Button>
            </PageHeader>
            <DetourTemplatePageForm currencySymbol={currencySymbol} />
        </div>
    );
}
