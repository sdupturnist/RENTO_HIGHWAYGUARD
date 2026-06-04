import { dbTenant } from "@/app/lib/db";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Badge } from "@/app/Components/ui/badge";
import { Button } from "@/app/Components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/Components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ActivityLogList } from "@/app/Components/common/ActivityLogList";
import { DeleteButton } from "@/app/Components/common/DeleteButton";
import { MaterialEditButton } from "@/app/Components/materials/MaterialEditButton";
import { OverviewPage, OverviewSection, InfoGrid, InfoField } from "@/app/Components/common/Overview";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

const TAB_CLASS = "px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30";

export default async function MaterialDetailsPage(props) {
    const session = await getSession();
    const canView = session ? await verifySessionPermission(session, "Materials", "View") : false;
    if (!canView) {
        return <Forbidden module="materials" action="view" />;
    }

    const canEdit = session ? await verifySessionPermission(session, "Materials", "Edit") : false;
    const canDelete = session ? await verifySessionPermission(session, "Materials", "Delete") : false;

    const params = await props.params;
    const id = parseInt(params.id);
    if (isNaN(id)) notFound();

    const [rows] = await dbTenant(`SELECT * FROM \`materials\` WHERE id = ? LIMIT 1`, [id]);
    if (!rows || rows.length === 0) notFound();

    const material = JSON.parse(JSON.stringify(rows[0]));
    const settings = (await dbTenant("SELECT * FROM `company_settings` LIMIT 1"))[0][0];
    const currencySymbol = settings?.currencySymbol || "AED";

    return (
        <OverviewPage
            title={
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/materials"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <span>{material.name}</span>
                    <Badge
                        variant={material.status === "ACTIVE" ? "default" : "destructive"}
                        className={material.status === "ACTIVE" ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                        {material.status}
                    </Badge>
                </div>
            }
            description={material.materialCode || `MAT-${material.id}`}
            actions={<>
                {canEdit && <MaterialEditButton material={material} currencySymbol={currencySymbol} />}
                {canDelete && <DeleteButton apiPath={`/api/materials/${material.id}`} queryKey="materials" redirectTo="/materials" entityLabel="Material" />}
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
                        <OverviewSection title="Material Information">
                            <InfoGrid>
                                <InfoField label="Code" value={material.materialCode || "-"} />
                                <InfoField label="Name" value={material.name} />
                                <InfoField label="Total Quantity" value={material.totalQuantity?.toString() ?? "-"} />
                                <InfoField label="Status" value={
                                    <Badge
                                        variant={material.status === "ACTIVE" ? "default" : "destructive"}
                                        className={material.status === "ACTIVE" ? "bg-green-600 hover:bg-green-700" : ""}
                                    >
                                        {material.status}
                                    </Badge>
                                } />
                            </InfoGrid>
                        </OverviewSection>

                        <OverviewSection title="Financial Details">
                            <InfoGrid>
                                <InfoField label="Cost Per Day" value={
                                    <span className="inline-flex items-center gap-1">
                                        <CurrencySymbol symbol={currencySymbol} /> {Number(material.costPerDay).toFixed(2)}
                                    </span>
                                } />
                                <InfoField label="Created" value={material.createdAt ? format(new Date(material.createdAt), "dd/MM/yyyy") : "-"} />
                                <InfoField label="Last Updated" value={material.updatedAt ? format(new Date(material.updatedAt), "dd/MM/yyyy") : "-"} />
                            </InfoGrid>
                        </OverviewSection>

                        {material.remarks && (
                            <OverviewSection title="Remarks">
                                <div className="text-sm bg-muted/50 p-2 rounded-md min-h-[60px]">
                                    {material.remarks}
                                </div>
                            </OverviewSection>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="activity">
                    <OverviewSection title="Activity History" description="Recent actions and changes performed on this material.">
                        <ActivityLogList entityType="MATERIAL" entityId={material.id} />
                    </OverviewSection>
                </TabsContent>
            </Tabs>
        </OverviewPage>
    );
}
