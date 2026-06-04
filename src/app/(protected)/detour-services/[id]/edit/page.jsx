import { dbTenant } from "@/app/lib/db";
import { notFound } from "next/navigation";
import { PageHeader } from "@/app/Components/ui/page-header";
import { DetourTemplatePageForm } from "@/app/Components/detour-templates/DetourTemplatePageForm";
import { Button } from "@/app/Components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default async function EditDetourTemplatePage(props) {
    const session = await getSession();
    const canEdit = session ? await verifySessionPermission(session, "Detour Services", "Edit") : false;
    if (!canEdit) {
        return <Forbidden module="detour services" action="edit" />;
    }

    const params = await props.params;
    const id = parseInt(params.id);
    if (isNaN(id)) notFound();

    const [rows] = await dbTenant(`SELECT * FROM \`detour_service_templates\` WHERE id = ? LIMIT 1`, [id]);
    if (!rows || rows.length === 0) notFound();

    const [reqs] = await dbTenant(`
        SELECT resourceType, resourceId, quantity
        FROM \`detour_template_requirements\`
        WHERE templateId = ?
        ORDER BY resourceType, id
    `, [id]);

    const settings = (await dbTenant("SELECT currencySymbol FROM `company_settings` LIMIT 1"))[0][0];
    const currencySymbol = settings?.currencySymbol || "AED";

    const template = JSON.parse(JSON.stringify({ ...rows[0], requirements: reqs || [] }));

    return (
        <div className="max-w-5xl mx-auto pb-24">
            <PageHeader
                title="Edit Detour Service Template"
                description={`${template.templateCode || `DST-${template.id}`} · ${template.name}`}
            >
                <Button variant="outline" size="sm" asChild>
                    <Link href={`/detour-services/${id}`}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
                </Button>
            </PageHeader>
            <DetourTemplatePageForm initialData={template} currencySymbol={currencySymbol} />
        </div>
    );
}
