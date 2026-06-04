import { dbTenant, dbQuery } from "@/app/lib/db";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Badge } from "@/app/Components/ui/badge";
import { Button } from "@/app/Components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/Components/ui/tabs";
import { ArrowLeft, Edit, Car } from "lucide-react";
import Link from "next/link";
import { MaintenanceStatusActions } from "@/app/Components/maintenance/MaintenanceStatusActions";
import { DeleteButton } from "@/app/Components/common/DeleteButton";
import { ActivityLogList } from "@/app/Components/common/ActivityLogList";
import { OverviewPage, OverviewSection, InfoGrid, InfoField } from "@/app/Components/common/Overview";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default async function MaintenanceDetailsPage({ params, }) {
    const session = await getSession();
    const canView = session ? await verifySessionPermission(session, "Maintenance", "View") : false;
    if (!canView) {
        return <Forbidden module="maintenance" action="view" />;
    }

    const canEdit = session ? await verifySessionPermission(session, "Maintenance", "Edit") : false;
    const canDelete = session ? await verifySessionPermission(session, "Maintenance", "Delete") : false;

    const { id } = await params;
    const maintenanceId = parseInt(id);
    if (isNaN(maintenanceId))
        notFound();
    const [mRows] = await dbTenant(`
        SELECT m.*,
               v.vehicleCode, v.regNo, v.ownership,
               vb.name as vehicle_brand_name,
               vm.name as vehicle_model_name,
               mt.name as maintenanceType_name
        FROM \`maintenances\` m
        LEFT JOIN \`vehicles\` v ON v.id = m.vehicleId
        LEFT JOIN \`vehicle_brands\` vb ON vb.id = v.brandId
        LEFT JOIN \`vehicle_models\` vm ON vm.id = v.modelId
        LEFT JOIN \`maintenance_types\` mt ON mt.id = m.maintenanceTypeId
        WHERE m.id = ? LIMIT 1
    `, [maintenanceId]);
    if (!mRows || mRows.length === 0)
        notFound();
    const row = mRows[0];
    const maintenance = {
        ...row,
        vehicle: {
            id: row.vehicleId,
            vehicleCode: row.vehicleCode,
            regNo: row.regNo,
            ownership: row.ownership,
            brand: row.vehicle_brand_name ? { name: row.vehicle_brand_name } : null,
            model: row.vehicle_model_name ? { name: row.vehicle_model_name } : null,
        },
        maintenanceType: { id: row.maintenanceTypeId, name: row.maintenanceType_name },
    };
    const maintenanceView = {
        ...maintenance,
        amount: maintenance.amount ? Number(maintenance.amount) : null,
    };
    const settings = (await dbTenant("SELECT * FROM `company_settings` LIMIT 1"))[0][0];
    const currencySymbol = settings?.currencySymbol || "AED";
    const getStatusColor = (status) => {
        switch (status) {
            case "SCHEDULED": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
            case "IN_PROGRESS": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
            case "COMPLETED": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
            default: return "bg-slate-100 text-slate-800";
        }
    };
    return (<OverviewPage title={<div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/maintenance">
                            <ArrowLeft className="h-4 w-4"/>
                        </Link>
                    </Button>
                    <span>{maintenanceView.maintenanceCode}</span>
                    <Badge className={getStatusColor(maintenanceView.status)} variant="outline">
                        {maintenanceView.status.replace("_", " ")}
                    </Badge>
                </div>} description={<div className="flex items-center gap-1 text-sm">
                    <Car className="h-3 w-3"/>
                    <Link href={`/vehicles/${maintenanceView.vehicleId}`} className="hover:underline flex items-center gap-1">
                        {maintenanceView.vehicle.brand?.name} {maintenanceView.vehicle.model?.name}
                        <span className="font-mono">({maintenanceView.vehicle.vehicleCode})</span>
                    </Link>
                </div>} actions={<>
                    {canEdit && <MaintenanceStatusActions maintenanceId={maintenanceView.id} currentStatus={maintenanceView.status}/>}
                    {canEdit && (
                        <Button variant="outline" asChild>
                            <Link href={`/maintenance/${maintenanceView.id}/edit`}>
                                <Edit className="mr-2 h-4 w-4"/> Edit
                            </Link>
                        </Button>
                    )}
                    {canDelete && <DeleteButton apiPath={`/api/maintenance/${maintenanceView.id}`} redirectTo="/maintenance" entityLabel="Maintenance record" />}
                </>}>

            <Tabs defaultValue="overview" className="space-y-4">
                <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-2 w-fit">
                    <TabsList>
                        <TabsTrigger className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30" value="overview">Overview</TabsTrigger>
                        <TabsTrigger className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30" value="activity">Activity Log</TabsTrigger>
                    </TabsList>
                </div>

                {/* OVERVIEW TAB */}
                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <OverviewSection title="Maintenance Details">
                            <InfoGrid>
                                <InfoField label="Type" value={maintenanceView.maintenanceType.name}/>
                                <InfoField label="Start Date" value={format(new Date(maintenanceView.startDate), "PPP")}/>
                                <InfoField label="End Date" value={maintenanceView.endDate ? format(new Date(maintenanceView.endDate), "PPP") : "-"}/>
                                <InfoField label="Duration" value={maintenanceView.endDate
            ? `${Math.ceil((new Date(maintenanceView.endDate).getTime() - new Date(maintenanceView.startDate).getTime()) / (1000 * 60 * 60 * 24))} days`
            : "Ongoing"}/>
                            </InfoGrid>
                        </OverviewSection>

                        <OverviewSection title="Cost & Vehicle Info">
                            <InfoGrid>
                                <InfoField label="Amount" value={maintenanceView.amount ? (
                                    <span className="inline-flex items-center gap-1">
                                        <CurrencySymbol symbol={currencySymbol} />
                                        {Number(maintenanceView.amount).toFixed(2)}
                                    </span>
                                ) : "-"}/>
                                <InfoField label="Vehicle" value={<Link href={`/vehicles/${maintenanceView.vehicleId}`} className="font-medium hover:underline text-primary">
                                            {maintenanceView.vehicle.vehicleCode}
                                        </Link>}/>
                                <InfoField label="Registration" value={maintenanceView.vehicle.regNo}/>
                                <InfoField label="Ownership" value={maintenanceView.vehicle.ownership}/>
                            </InfoGrid>
                        </OverviewSection>

                        <OverviewSection title="Description & Notes" className="md:col-span-2">
                            <div className="text-sm bg-muted/50 p-3 rounded-md min-h-[80px] whitespace-pre-wrap">
                                {maintenance.description || "No description provided."}
                            </div>
                        </OverviewSection>
                    </div>
                </TabsContent>

                {/* ACTIVITY LOG TAB */}
                <TabsContent value="activity">
                    <OverviewSection title="Activity History" description="Recent actions and changes performed on this maintenance record.">
                        <ActivityLogList entityType="MAINTENANCE" entityId={maintenanceView.id}/>
                    </OverviewSection>
                </TabsContent>
            </Tabs>
        </OverviewPage>);
}
