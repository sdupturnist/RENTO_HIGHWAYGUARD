import { dbTenant, dbQuery } from "@/app/lib/db";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Badge } from "@/app/Components/ui/badge";
import { Button } from "@/app/Components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/Components/ui/tabs";
import { ArrowLeft, Edit } from "lucide-react";
import Link from "next/link";
import { VehicleStatusActions } from "@/app/Components/vehicles/VehicleStatusActions";
import { ActivityLogList } from "@/app/Components/common/ActivityLogList";
import { DeleteButton } from "@/app/Components/common/DeleteButton";
import { OverviewPage, OverviewSection, InfoGrid, InfoField, FileList } from "@/app/Components/common/Overview";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default async function VehicleDetailsPage(props) {
    const session = await getSession();
    const canView = session ? await verifySessionPermission(session, "Vehicles", "View") : false;
    if (!canView) {
        return <Forbidden module="vehicles" action="view" />;
    }

    const canEdit = session ? await verifySessionPermission(session, "Vehicles", "Edit") : false;
    const canDelete = session ? await verifySessionPermission(session, "Vehicles", "Delete") : false;

    const params = await props.params;
    const id = parseInt(params.id);
    if (isNaN(id))
        notFound();
    const [vRows] = await dbTenant(`
        SELECT v.*, 
               vb.name as brand_name,
               vm.name as model_name,
               vt.name as vehicleType_name,
               ra.name as registrationAuthority_name
        FROM \`vehicles\` v
        LEFT JOIN \`vehicle_brands\` vb ON vb.id = v.brandId
        LEFT JOIN \`vehicle_models\` vm ON vm.id = v.modelId
        LEFT JOIN \`vehicle_types\` vt ON vt.id = v.typeId
        LEFT JOIN \`registration_authorities\` ra ON ra.id = v.registrationAuthorityId
        WHERE v.id = ? LIMIT 1
    `, [id]);
    
    if (!vRows || vRows.length === 0) notFound();
    const v = vRows[0];

    const [docs] = await dbTenant(`
        SELECT vd.*, dt.name as documentTypeName
        FROM \`vehicle_documents\` vd
        LEFT JOIN \`document_types\` dt ON dt.id = vd.documentTypeId
        WHERE vd.vehicleId = ?
    `, [id]);
    const [assignmentBlocks] = await dbTenant(`
        SELECT * FROM \`assignment_blocks\`
        WHERE vehicleId = ? AND status = 'ACTIVE' AND endDate >= NOW()
        LIMIT 1
    `, [id]);

    const vehicle = {
        ...v,
        brand: v.brandId ? { id: v.brandId, name: v.brand_name } : null,
        model: v.modelId ? { id: v.modelId, name: v.model_name } : null,
        vehicleType: v.typeId ? { id: v.typeId, name: v.vehicleType_name } : null,
        registrationAuthority: v.registrationAuthorityId ? { id: v.registrationAuthorityId, name: v.registrationAuthority_name } : null,
        documents: docs || [],
        assignmentBlocks: assignmentBlocks || []
    };
    const settings = (await dbTenant("SELECT * FROM `company_settings` LIMIT 1"))[0][0];
    const currencySymbol = settings?.currencySymbol || "AED";

    const brandModel = [vehicle.brand?.name, vehicle.model?.name].filter(Boolean).join(" ");
    const vehicleDesc = [brandModel, vehicle.regNo].filter(Boolean).join(" · ") || "-";
    const hasActiveAssignment = vehicle.assignmentBlocks && vehicle.assignmentBlocks.length > 0;

    return (<OverviewPage title={<div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
            <Link href="/vehicles">
                <ArrowLeft className="h-4 w-4" />
            </Link>
        </Button>
        <span>{vehicle.vehicleCode || `VEH-${vehicle.id}`}</span>
        <Badge variant={vehicle.status === "ACTIVE"
            ? "default"
            : vehicle.status === "UNDER_MAINTENANCE"
                ? "secondary"
                : "destructive"} className={vehicle.status === "ACTIVE"
                    ? "bg-green-600 hover:bg-green-700"
                    : vehicle.status === "UNDER_MAINTENANCE"
                        ? "bg-orange-500 hover:bg-orange-600"
                        : ""}>
            {vehicle.status.replace(/_/g, " ")}
        </Badge>
    </div>} description={vehicleDesc} actions={<>
        {canEdit && <VehicleStatusActions vehicleId={vehicle.id} currentStatus={vehicle.status} hasActiveAssignment={hasActiveAssignment} />}
        {canEdit && (
            <Button variant="outline" asChild>
                <Link href={`/vehicles/${vehicle.id}/edit`}>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                </Link>
            </Button>
        )}
        {canDelete && <DeleteButton apiPath={`/api/vehicles/${vehicle.id}`} queryKey="vehicles" redirectTo="/vehicles" entityLabel="Vehicle" />}
    </>}>

        <Tabs defaultValue="overview" className="space-y-4">
            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-2 w-fit">
                <TabsList>
                    <TabsTrigger className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30" value="overview">Overview</TabsTrigger>
                    <TabsTrigger className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30" value="documents">Documents</TabsTrigger>
                    <TabsTrigger className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30" value="activity">Activity Log</TabsTrigger>
                </TabsList>
            </div>

            {/* OVERVIEW TAB */}
            <TabsContent value="overview" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                    <OverviewSection title="Vehicle Information">
                        <InfoGrid>
                            <InfoField label="Type" value={vehicle.vehicleType?.name || "-"} />
                            <InfoField label="Brand" value={vehicle.brand?.name || "-"} />
                            <InfoField label="Model" value={vehicle.model?.name || "-"} />
                            <InfoField label="Year" value={vehicle.manufacturingYear || "-"} />
                        </InfoGrid>
                    </OverviewSection>

                    <OverviewSection title="Registration Details">
                        <InfoGrid>
                            <InfoField label="Reg No" value={vehicle.regNo || "-"} />
                            <InfoField label="Authority" value={vehicle.registrationAuthority?.name || "-"} />
                            <InfoField label="Registration Date" value={vehicle.registrationDate ? format(vehicle.registrationDate, "dd/MM/yyyy") : "-"} />
                            <InfoField label="Expiry Date" value={vehicle.registrationExpiry ? format(vehicle.registrationExpiry, "dd/MM/yyyy") : "-"} />
                        </InfoGrid>
                    </OverviewSection>

                    <OverviewSection title="Rent Configuration">
                        <InfoGrid>
                            <InfoField label="Base Rent Type" value={vehicle.baseRentType} />
                            <InfoField label="Amount" value={<span className="inline-flex items-center gap-1"><CurrencySymbol symbol={currencySymbol} /> {Number(vehicle.baseRentAmount).toFixed(2)}</span>} />
                            <InfoField label="Billing Cycle" value={vehicle.defaultRentCycle} />
                        </InfoGrid>
                    </OverviewSection >

                    <OverviewSection title="Ownership">
                        <InfoGrid>
                            <InfoField label="Ownership Type" value={vehicle.ownership} />
                            {vehicle.ownership === "THIRD_PARTY" && (<>
                                <InfoField label="Owner Name" value={vehicle.thirdPartyOwnerName || "-"} />
                                <InfoField label="Company" value={vehicle.thirdPartyOwnerCompany || "-"} />
                                <InfoField label="Contract End" value={vehicle.thirdPartyContractEnd
                                    ? format(vehicle.thirdPartyContractEnd, "dd/MM/yyyy")
                                    : "-"} />
                            </>)}
                        </InfoGrid>
                    </OverviewSection>

                    <OverviewSection title="Operational & Remarks" className="md:col-span-2">
                        <InfoGrid cols={2}>
                            <InfoField label="Fuel Type" value={vehicle.fuelType || "-"} />
                            <InfoField label="Capacity" value={vehicle.capacity ? Number(vehicle.capacity).toString() : "-"} />
                            <InfoField label="Country" value={vehicle.countryOfRegistration} />
                            <InfoField label="Remarks" value={<div className="text-left text-sm">{vehicle.remarks || "No remarks."}</div>} />
                        </InfoGrid>
                    </OverviewSection>
                </div >
            </ TabsContent >

            {/* DOCUMENTS TAB */}
            < TabsContent value="documents" >
                <OverviewSection title="Attached Documents">
                    <FileList files={vehicle.documents.map(d => ({ ...d, name: d.name || d.documentTypeName || d.url?.split('/').pop() || "Document" })) || []} />
                </OverviewSection>
            </TabsContent >

            {/* ACTIVITY LOG TAB */}
            < TabsContent value="activity" >
                <OverviewSection title="Activity History" description="Recent actions and changes for this vehicle.">
                    <ActivityLogList entityType="VEHICLE" entityId={vehicle.id} />
                </OverviewSection>
            </TabsContent >
        </Tabs >
    </OverviewPage >);
}
