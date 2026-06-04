import { dbTenant } from "@/app/lib/db";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Badge } from "@/app/Components/ui/badge";
import { Button } from "@/app/Components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/Components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ActivityLogList } from "@/app/Components/common/ActivityLogList";
import { DeleteButton } from "@/app/Components/common/DeleteButton";
import { DetourTemplateEditButton } from "@/app/Components/detour-templates/DetourTemplateEditButton";
import { OverviewPage, OverviewSection, InfoGrid, InfoField } from "@/app/Components/common/Overview";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

const TAB_CLASS = "px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30";

export default async function DetourServiceDetailsPage(props) {
    const session = await getSession();
    const canView = session ? await verifySessionPermission(session, "Detour Services", "View") : false;
    if (!canView) {
        return <Forbidden module="detour services" action="view" />;
    }

    const canEdit = session ? await verifySessionPermission(session, "Detour Services", "Edit") : false;
    const canDelete = session ? await verifySessionPermission(session, "Detour Services", "Delete") : false;

    const params = await props.params;
    const id = parseInt(params.id);
    if (isNaN(id)) notFound();

    const [rows] = await dbTenant(`SELECT * FROM \`detour_service_templates\` WHERE id = ? LIMIT 1`, [id]);
    if (!rows || rows.length === 0) notFound();

    const [reqs] = await dbTenant(`
        SELECT dtr.*,
               CASE dtr.resourceType
                   WHEN 'MATERIAL' THEN (SELECT name FROM \`materials\` WHERE id = dtr.resourceId)
                   WHEN 'LABOUR'   THEN (SELECT labourType FROM \`labours\` WHERE id = dtr.resourceId)
               END as resourceName
        FROM \`detour_template_requirements\` dtr
        WHERE dtr.templateId = ?
        ORDER BY dtr.resourceType, dtr.id
    `, [id]);

    const template = JSON.parse(JSON.stringify({ ...rows[0], requirements: reqs || [] }));
    const settings = (await dbTenant("SELECT * FROM `company_settings` LIMIT 1"))[0][0];
    const currencySymbol = settings?.currencySymbol || "AED";

    return (
        <OverviewPage
            title={
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/detour-services"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <span>{template.name}</span>
                    <Badge
                        variant={template.status === "ACTIVE" ? "default" : "destructive"}
                        className={template.status === "ACTIVE" ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                        {template.status}
                    </Badge>
                </div>
            }
            description={template.templateCode || `DST-${template.id}`}
            actions={<>
                {canEdit && <DetourTemplateEditButton template={template} />}
                {canDelete && <DeleteButton apiPath={`/api/detour-templates/${template.id}`} queryKey="detour-templates" redirectTo="/detour-services" entityLabel="Detour service" />}
            </>}
        >
            <Tabs defaultValue="overview" className="space-y-4">
                <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-2 w-fit">
                    <TabsList>
                        <TabsTrigger className={TAB_CLASS} value="overview">Overview</TabsTrigger>
                        <TabsTrigger className={TAB_CLASS} value="activity">Activity Log</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <OverviewSection title="Template Information">
                            <InfoGrid>
                                <InfoField label="Code" value={template.templateCode || "-"} />
                                <InfoField label="Name" value={template.name} />
                                <InfoField label="Vehicle Slots" value={template.vehicleCount?.toString() ?? "0"} />
                                <InfoField label="Operator Slots" value={template.operatorCount?.toString() ?? "0"} />
                                <InfoField label="Status" value={
                                    <Badge
                                        variant={template.status === "ACTIVE" ? "default" : "destructive"}
                                        className={template.status === "ACTIVE" ? "bg-green-600 hover:bg-green-700" : ""}
                                    >
                                        {template.status}
                                    </Badge>
                                } />
                            </InfoGrid>
                        </OverviewSection>

                        <OverviewSection title="Bundle Billing">
                            <InfoGrid>
                                <InfoField label="Bundle Billing" value={
                                    <Badge variant={template.bundleCostEnabled ? "default" : "secondary"}>
                                        {template.bundleCostEnabled ? "Enabled" : "Disabled"}
                                    </Badge>
                                } />
                                {template.bundleCostEnabled ? (
                                    <InfoField label="Bundle Cost Per Day" value={
                                        <span className="inline-flex items-center gap-1">
                                            <CurrencySymbol symbol={currencySymbol} /> {Number(template.bundleCostPerDay).toFixed(2)}
                                        </span>
                                    } />
                                ) : null}
                                <InfoField label="Created" value={template.createdAt ? format(new Date(template.createdAt), "dd/MM/yyyy") : "-"} />
                                <InfoField label="Last Updated" value={template.updatedAt ? format(new Date(template.updatedAt), "dd/MM/yyyy") : "-"} />
                            </InfoGrid>
                        </OverviewSection>

                        <OverviewSection title="Material & Labour Requirements" description="Resources required for each deployment.">
                            {template.requirements.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-2">No material or labour requirements defined.</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Resource</TableHead>
                                            <TableHead className="text-right">Quantity</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {template.requirements.map((req) => (
                                            <TableRow key={req.id}>
                                                <TableCell>
                                                    <Badge variant="outline">{req.resourceType}</Badge>
                                                </TableCell>
                                                <TableCell>{req.resourceName || "-"}</TableCell>
                                                <TableCell className="text-right">{req.quantity}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </OverviewSection>

                        {template.remarks && (
                            <OverviewSection title="Remarks">
                                <div className="text-sm bg-muted/50 p-2 rounded-md min-h-[60px]">
                                    {template.remarks}
                                </div>
                            </OverviewSection>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="activity">
                    <OverviewSection title="Activity History" description="Recent actions and changes performed on this detour service template.">
                        <ActivityLogList entityType="DETOUR_TEMPLATE" entityId={template.id} />
                    </OverviewSection>
                </TabsContent>
            </Tabs>
        </OverviewPage>
    );
}
