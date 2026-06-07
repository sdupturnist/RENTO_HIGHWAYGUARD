import { notFound } from "next/navigation";
import { dbTenant, dbQuery } from "@/app/lib/db";
import { format } from "date-fns";
import { Pencil, User, ArrowLeft } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Badge } from "@/app/Components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/Components/ui/tabs";
import { Card, CardContent } from "@/app/Components/ui/card";
import { AssignmentStatusActions } from "@/app/Components/assignments/AssignmentStatusActions";
import { DeleteButton } from "@/app/Components/common/DeleteButton";
import { ActivityLogList } from "@/app/Components/common/ActivityLogList";
import Link from "next/link";
import { AssignmentSendButton } from "@/app/Components/assignments/AssignmentSendButton";
import { AssignmentBlockStopButton } from "@/app/Components/assignments/AssignmentBlockStopButton";
import { OverviewPage, OverviewSection, InfoGrid, InfoField, FileList } from "@/app/Components/common/Overview";
import { ReplaceVehicleModal } from "@/app/Components/assignments/ReplaceVehicleModal";
import { ChangeOperatorModal } from "@/app/Components/assignments/ChangeOperatorModal";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

// ... existing imports

// ... inside the component

export default async function AssignmentViewPage({ params }) {
    const session = await getSession();
    const canView = session ? (await verifySessionPermission(session, "Assignment", "List View") || await verifySessionPermission(session, "Assignment", "View")) : false;
    
    if (!canView) {
        return <Forbidden module="assignments" action="view" />;
    }

    const canEdit = session ? await verifySessionPermission(session, "Assignment", "Edit") : false;
    const canDelete = session ? await verifySessionPermission(session, "Assignment", "Delete") : false;

    const id = parseInt((await params).id);
    const [aRows] = await dbTenant(`
        SELECT a.*,
               c.companyName as customer_companyName,
               p.name as project_name
        FROM \`assignments\` a
        LEFT JOIN \`customers\` c ON c.id = a.customerId
        LEFT JOIN \`projects\` p ON p.id = a.projectId
        WHERE a.id = ? LIMIT 1
    `, [id]);
    if (!aRows || aRows.length === 0) {
        notFound();
    }
    const aRow = aRows[0];

    const contacts = aRow.customerId
        ? await dbTenant(`SELECT * FROM \`contact_persons\` WHERE customerId = ?`, [aRow.customerId]).then(([r]) => r)
        : [];
    const [blocks] = await dbTenant(`
        SELECT b.*,
               v.vehicleCode, v.regNo, v.id as vehicle_db_id,
               vm.name as vehicle_model_name,
               vb.name as vehicle_brand_name,
               o.id as operator_db_id, o.name as operator_name, o.operatorCode as operator_code,
               m.name as material_name,
               l.labourType as labour_type_name,
               dt.name as detour_template_name
        FROM \`assignment_blocks\` b
        LEFT JOIN \`vehicles\` v ON v.id = b.vehicleId
        LEFT JOIN \`vehicle_models\` vm ON vm.id = v.modelId
        LEFT JOIN \`vehicle_brands\` vb ON vb.id = v.brandId
        LEFT JOIN \`operators\` o ON o.id = b.operatorId
        LEFT JOIN \`materials\` m ON m.id = b.materialId
        LEFT JOIN \`labours\` l ON l.id = b.labourTypeId
        LEFT JOIN \`detour_service_templates\` dt ON dt.id = b.detourTemplateId
        WHERE b.assignmentId = ?
        ORDER BY b.startDate ASC
    `, [id]);
    const [attachments] = await dbTenant(`SELECT * FROM \`assignment_attachments\` WHERE assignmentId = ?`, [id]);

    const topLevelBlocks = (blocks || []).filter(b => b.detourBlockId === null);
    const childBlocks = (blocks || []).filter(b => b.detourBlockId !== null);

    const blocksWithAttachments = topLevelBlocks.map((b) => {
        let detourChildren = [];
        if (b.blockType === "DETOUR") {
            detourChildren = childBlocks
                .filter(c => c.detourBlockId === b.id)
                .map(c => ({
                    ...c,
                    vehicle: (c.vehicleId && c.vehicle_db_id) ? { id: c.vehicle_db_id, vehicleCode: c.vehicleCode, regNo: c.regNo, model: { name: c.vehicle_model_name }, brand: { name: c.vehicle_brand_name } } : null,
                    operator: (c.operatorId && c.operator_db_id) ? { id: c.operator_db_id, name: c.operator_name, operatorCode: c.operator_code } : null,
                    material: c.materialId ? { id: c.materialId, name: c.material_name } : null,
                    labour: c.labourTypeId ? { id: c.labourTypeId, labourType: c.labour_type_name } : null,
                }));
        }

        return {
            ...b,
            vehicle: (b.vehicleId && b.vehicle_db_id) ? { id: b.vehicle_db_id, vehicleCode: b.vehicleCode, regNo: b.regNo, model: { name: b.vehicle_model_name }, brand: { name: b.vehicle_brand_name } } : null,
            operator: (b.operatorId && b.operator_db_id) ? { id: b.operator_db_id, name: b.operator_name, operatorCode: b.operator_code } : null,
            material: b.materialId ? { id: b.materialId, name: b.material_name } : null,
            labour: b.labourTypeId ? { id: b.labourTypeId, labourType: b.labour_type_name } : null,
            detourTemplate: b.detourTemplateId ? { id: b.detourTemplateId, name: b.detour_template_name } : null,
            detourChildren,
        };
    });

    const assignment = {
        ...aRow,
        customer: aRow.customerId ? { id: aRow.customerId, companyName: aRow.customer_companyName, contacts: contacts || [] } : null,
        project: aRow.projectId ? { id: aRow.projectId, name: aRow.project_name } : null,
        blocks: blocksWithAttachments,
        attachments: attachments || [],
    };
    return (<OverviewPage title={<div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
            <Link href="/assignments">
                <ArrowLeft className="h-4 w-4" />
            </Link>
        </Button>
        <span>{`${assignment.customer?.companyName ?? "Internal"}${assignment.project ? ` · ${assignment.project.name}` : ""}`}</span>
        <Badge className={assignment.status === "ACTIVE"
            ? "bg-green-600 hover:bg-green-700"
            : assignment.status === "COMPLETED"
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : assignment.status === "DRAFT"
                    ? "bg-slate-400"
                    : "bg-gray-500"}>
            {assignment.status}
        </Badge>
    </div>} description={assignment.assignmentCode || `ASG-${assignment.id}`} actions={<>
        <AssignmentSendButton assignmentId={assignment.id} />
        {canEdit && <AssignmentStatusActions assignmentId={assignment.id} currentStatus={assignment.status} />}
        {canEdit && (
            <Button variant="outline" size="sm" asChild>
                <Link href={`/assignments/${assignment.id}/edit`}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                </Link>
            </Button>
        )}
        {canDelete && (
            <DeleteButton apiPath={`/api/assignments/${assignment.id}`} queryKey="assignments" redirectTo="/assignments" entityLabel="Assignment" />
        )}
    </>}>

        <Tabs defaultValue="overview" className="space-y-6">
            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-2 w-fit">
                <TabsList>
                    <TabsTrigger className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30" value="overview">Overview</TabsTrigger>
                    <TabsTrigger className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30" value="blocks">Vehicle Blocks</TabsTrigger>
                    <TabsTrigger className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30" value="attachments">Attachments</TabsTrigger>
                    <TabsTrigger className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30" value="activity">Activity Log</TabsTrigger>
                </TabsList>
            </div>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                    <OverviewSection title="Customer">
                        <div className="max-w-lg">
                            {assignment.customer ? (<>
                            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-white/60 px-3 py-2">
                                <span className="text-sm text-muted-foreground">Company Name</span>
                                <Link href={`/customers/${assignment.customer.id}`} className="text-primary text-sm font-medium hover:underline">
                                    {assignment.customer.companyName}
                                </Link>
                            </div>
                            {assignment.customer.contacts && assignment.customer.contacts.length > 0 && (<div className="mt-2 flex items-center justify-between rounded-lg border border-border/60 bg-white/60 px-3 py-2">
                                <span className="text-sm text-muted-foreground">Contact Person</span>
                                <span className="text-sm font-medium">
                                    {assignment.customer.contacts.find((c) => c.isPrimary)?.name ||
                                        assignment.customer.contacts[0].name}
                                </span>
                            </div>)}
                            </>) : (
                            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-white/60 px-3 py-2">
                                <span className="text-sm text-muted-foreground">Type</span>
                                <span className="text-sm font-medium italic text-muted-foreground">Internal Assignment</span>
                            </div>
                            )}
                        </div>
                    </OverviewSection>

                    <OverviewSection title="Project">
                        <InfoGrid>
                            <InfoField label="Project Name" value={assignment.project ? (<Link href={`/projects/${assignment.project.id}`} className="text-primary hover:underline">
                                {assignment.project.name}
                            </Link>) : ("-")} />
                            <InfoField label="Billing Cycle" value={<Badge variant="outline">{assignment.billingCycle}</Badge>} />
                        </InfoGrid>
                    </OverviewSection>

                    <OverviewSection title="Assignment Period">
                        <InfoGrid>
                            <InfoField label="Start Date" value={format(new Date(assignment.startDate), "dd MMM yyyy")} />
                            <InfoField label="End Date" value={format(new Date(assignment.endDate), "dd MMM yyyy")} />
                            <InfoField label="Total Vehicle Blocks" value={assignment.blocks.length} />
                        </InfoGrid>
                    </OverviewSection>

                    <OverviewSection title="Assignment Details">
                        <InfoGrid>
                            <InfoField label="Status" value={<Badge variant={assignment.status === "ACTIVE" ? "default" : "secondary"} className={assignment.status === "ACTIVE"
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-blue-600 hover:bg-blue-700 text-white"}>
                                {assignment.status}
                            </Badge>} />
                            <InfoField label="Created At" value={format(new Date(assignment.createdAt), "dd MMM yyyy")} />
                        </InfoGrid>
                    </OverviewSection>
                </div>
            </TabsContent>

            {/* Vehicle Blocks Tab */}
            <TabsContent value="blocks" className="space-y-4">
                {assignment.blocks.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            No vehicle blocks assigned
                        </CardContent>
                    </Card>
                ) : (
                    assignment.blocks.map((block, index) => (
                        <OverviewSection key={block.id} title={`Block #${index + 1} — ${block.blockType ?? "VEHICLE"}`}>
                            <InfoGrid>
                                {(block.blockType === "VEHICLE" || !block.blockType) && (<>
                                    <InfoField label="Vehicle" value={block.vehicle ? (
                                        <Link href={`/vehicles/${block.vehicle.id}`} className="text-primary hover:underline">
                                            {block.vehicle.regNo} — {block.vehicle.model?.name}
                                        </Link>
                                    ) : "No vehicle assigned"} />
                                    <InfoField label="Operator" value={block.withOperator && block.operator ? (
                                        <Link href={`/operators/${block.operator.id}`} className="text-primary hover:underline flex items-center gap-2">
                                            <User className="h-4 w-4" />
                                            {block.operator.name} ({block.operator.operatorCode})
                                        </Link>
                                    ) : "Without operator"} />
                                </>)}
                                {block.blockType === "OPERATOR" && (
                                    <InfoField label="Operator" value={block.operator ? (
                                        <Link href={`/operators/${block.operator.id}`} className="text-primary hover:underline">
                                            {block.operator.name} ({block.operator.operatorCode})
                                        </Link>
                                    ) : "No operator"} />
                                )}
                                {block.blockType === "MATERIAL" && (<>
                                    <InfoField label="Material" value={block.material?.name ?? "—"} />
                                    <InfoField label="Quantity" value={block.quantity} />
                                </>)}
                                {block.blockType === "LABOUR" && (<>
                                    <InfoField label="Labour Type" value={block.labour?.labourType ?? "—"} />
                                    <InfoField label="Quantity" value={block.quantity} />
                                </>)}
                                {block.blockType === "DETOUR" && (
                                    <>
                                        <InfoField label="Detour Template" value={block.detourTemplate?.name ?? "—"} />
                                        {block.detourChildren && block.detourChildren.length > 0 && (
                                            <div className="col-span-1 md:col-span-2 mt-4 pl-4 border-l-2 border-orange-500/40 space-y-3">
                                                <h4 className="text-xs font-semibold text-orange-800 dark:text-orange-400 uppercase tracking-wider">Detour Resource Slots</h4>
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    {block.detourChildren.map((child, idx) => (
                                                        <div key={child.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 dark:bg-slate-900/30">
                                                            <div className="text-xs font-bold text-slate-500 mb-2">Slot #{idx + 1} — {child.blockType}</div>
                                                            <div className="space-y-1 text-sm">
                                                                {child.blockType === "VEHICLE" && (
                                                                    <>
                                                                        <div><strong>Vehicle:</strong> {child.vehicle ? `${child.vehicle.regNo} (${child.vehicle.model?.name || ''})` : "Unassigned"}</div>
                                                                        {!!child.withOperator && (
                                                                            <div><strong>Operator:</strong> {child.operator ? `${child.operator.name} (${child.operator.operatorCode})` : "Unassigned"}</div>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {child.blockType === "OPERATOR" && (
                                                                    <div><strong>Operator:</strong> {child.operator ? `${child.operator.name} (${child.operator.operatorCode})` : "Unassigned"}</div>
                                                                )}
                                                                {child.blockType === "MATERIAL" && (
                                                                    <div><strong>Material:</strong> {child.material?.name ?? "—"} (Qty: {child.quantity})</div>
                                                                )}
                                                                {child.blockType === "LABOUR" && (
                                                                    <div><strong>Labour Type:</strong> {child.labour?.labourType ?? "—"} (Qty: {child.quantity})</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                                <InfoField label="Start Date" value={format(new Date(block.startDate), "dd MMM yyyy")} />
                                <InfoField label="End Date" value={format(new Date(block.endDate), "dd MMM yyyy")} />
                                {block.billingCycle && block.billingCycle !== assignment.billingCycle && (
                                    <InfoField label="Billing Override" value={<Badge variant="outline">{block.billingCycle} (Override)</Badge>} />
                                )}
                                <InfoField label="Auto Time Logs" value={block.enableAutoTimeLogs ? "Enabled" : "Disabled"} />
                                {!!block.enableAutoTimeLogs && (block.blockType === "VEHICLE" || !block.blockType || block.blockType === "OPERATOR" || block.blockType === "DETOUR") && (
                                    <>
                                        <InfoField label="Planned Overtime" value={`${block.plannedOvertimeHours || 0} hrs/day`} />
                                        <InfoField label="Include Weekends" value={block.includeWeekendsForAutoLogs ? "Yes" : "No"} />
                                    </>
                                )}
                            </InfoGrid>

                            {canEdit && (
                                <div className="mt-4 flex flex-wrap justify-end gap-2">
                                    {block.status !== "STOPPED" && assignment.status !== "COMPLETED" && new Date() < new Date(block.endDate) && new Date(block.startDate).getTime() < new Date(block.endDate).getTime() && (block.blockType === "VEHICLE" || !block.blockType) && (
                                        <>
                                            <ReplaceVehicleModal assignmentId={assignment.id} block={block} />
                                            {block.withOperator && (
                                                <ChangeOperatorModal assignmentId={assignment.id} block={block} />
                                            )}
                                        </>
                                    )}
                                    <AssignmentBlockStopButton
                                        assignmentId={assignment.id}
                                        blockId={block.id}
                                        isStopped={block.status === "STOPPED"}
                                        assignmentStatus={assignment.status}
                                        endDate={block.endDate}
                                    />
                                </div>
                            )}
                        </OverviewSection>
                    ))
                )}
            </TabsContent>

            {/* Attachments Tab */}
            <TabsContent value="attachments">
                <OverviewSection title="Assignment Attachments" description="Documents related to this assignment">
                    {assignment.attachments.length === 0 ? (<div className="text-center text-muted-foreground py-8">No attachments</div>) : (<FileList files={assignment.attachments} />)}
                </OverviewSection>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity">
                <OverviewSection title="Activity History" description="Audit trail of changes for this assignment">
                    <ActivityLogList entityType="ASSIGNMENT" entityId={assignment.id} />
                </OverviewSection>
            </TabsContent>
        </Tabs>
    </OverviewPage >);
}
