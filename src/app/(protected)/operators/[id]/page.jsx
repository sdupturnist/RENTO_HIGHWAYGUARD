import { dbTenant, dbQuery } from "@/app/lib/db";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Badge } from "@/app/Components/ui/badge";
import { Button } from "@/app/Components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/Components/ui/tabs";
import { ArrowLeft, Edit } from "lucide-react";
import Link from "next/link";
import { ActivityLogList } from "@/app/Components/common/ActivityLogList";
import { OperatorStatusActions } from "@/app/Components/operators/OperatorStatusActions";
import { DeleteButton } from "@/app/Components/common/DeleteButton";
import { OverviewPage, OverviewSection, InfoGrid, InfoField, FileList } from "@/app/Components/common/Overview";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default async function OperatorDetailsPage(props) {
    const session = await getSession();
    const canView = session ? await verifySessionPermission(session, "Operators", "View") : false;
    if (!canView) {
        return <Forbidden module="operators" action="view" />;
    }

    const canEdit = session ? await verifySessionPermission(session, "Operators", "Edit") : false;
    const canDelete = session ? await verifySessionPermission(session, "Operators", "Delete") : false;

    const params = await props.params;
    const id = parseInt(params.id);
    if (isNaN(id))
        notFound();
    const [opRows] = await dbTenant(`
        SELECT o.*,
               n.name as nationality_name,
               lt.name as licenseType_name
        FROM \`operators\` o
        LEFT JOIN \`nationalities\` n ON n.id = o.nationalityId
        LEFT JOIN \`license_types\` lt ON lt.id = o.licenseTypeId
        WHERE o.id = ? LIMIT 1
    `, [id]);

    if (!opRows || opRows.length === 0)
        notFound();

    const op = opRows[0];

    const [docs] = await dbTenant(`
        SELECT od.*, dt.name as documentTypeName
        FROM \`operator_documents\` od
        LEFT JOIN \`operator_document_types\` dt ON dt.id = od.documentTypeId
        WHERE od.operatorId = ?
    `, [id]);

    const operator = {
        ...op,
        nationality: op.nationalityId ? { id: op.nationalityId, name: op.nationality_name } : null,
        licenseType: { id: op.licenseTypeId, name: op.licenseType_name },
        documents: docs || [],
    };

    const settings = (await dbTenant("SELECT * FROM `company_settings` LIMIT 1"))[0][0];
    const currencySymbol = settings?.currencySymbol || "AED";

    return (<OverviewPage title={<div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
            <Link href="/operators">
                <ArrowLeft className="h-4 w-4" />
            </Link>
        </Button>
        <span>{operator.name}</span>
        <Badge variant={operator.status === "ACTIVE" ? "default" : "destructive"} className={operator.status === "ACTIVE" ? "bg-green-600 hover:bg-green-700" : ""}>
            {operator.status}
        </Badge>
    </div>} description={operator.operatorCode || `OPR-${operator.id}`} actions={<>
        {canEdit && <OperatorStatusActions operatorId={operator.id} currentStatus={operator.status} />}
        {canEdit && (
            <Button variant="outline" asChild>
                <Link href={`/operators/${operator.id}/edit`}>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                </Link>
            </Button>
        )}
        {canDelete && <DeleteButton apiPath={`/api/operators/${operator.id}`} queryKey="operators" redirectTo="/operators" entityLabel="Operator" />}
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
                    <OverviewSection title="Operator Information">
                        <InfoGrid>
                            <InfoField label="Name" value={operator.name} />
                            <InfoField label="Email" value={operator.email || "-"} />
                            <InfoField label="Phone" value={operator.phoneNumber || "-"} />
                            <InfoField label="Experience" value={operator.experienceYears ? `${operator.experienceYears} years` : "-"} />
                        </InfoGrid>
                    </OverviewSection>

                    <OverviewSection title="License Details">
                        <InfoGrid>
                            <InfoField label="License Type" value={operator.licenseType?.name || "-"} />
                            <InfoField label="License No" value={operator.licenseNumber || "-"} />
                            <InfoField label="Issue Date" value={operator.licenseIssueDate ? format(operator.licenseIssueDate, "dd/MM/yyyy") : "-"} />
                            <InfoField label="Expiry Date" value={operator.licenseExpiry ? format(operator.licenseExpiry, "dd/MM/yyyy") : "-"} />
                        </InfoGrid>
                    </OverviewSection>

                    <OverviewSection title="Employment Details">
                        <InfoGrid>
                            <InfoField label="Status" value={<Badge variant={operator.status === "ACTIVE" ? "default" : "destructive"} className={operator.status === "ACTIVE" ? "bg-green-600 hover:bg-green-700" : ""}>
                                {operator.status}
                            </Badge>} />
                            <InfoField label="Joined" value={format(operator.createdAt, "dd/MM/yyyy")} />
                        </InfoGrid>
                    </OverviewSection>

                    <OverviewSection title="Financial & Settings">
                        <InfoGrid>
                            <InfoField label="Base Rate Type" value={operator.baseRateType} />
                            <InfoField label="Hourly Rate" value={<span className="inline-flex items-center gap-1"><CurrencySymbol symbol={currencySymbol} /> {Number(operator.hourlyRate).toFixed(2)}</span>} />
                        </InfoGrid>
                    </OverviewSection>

                    <OverviewSection title="Contact Information">
                        <div>
                            <span className="text-sm text-muted-foreground block mb-1">Address</span>
                            <div className="text-sm bg-muted/50 p-2 rounded-md min-h-[60px]">
                                {operator.address || "No address provided."}
                            </div>
                        </div>
                    </OverviewSection>
                </div>
            </TabsContent>

            {/* DOCUMENTS TAB */}
            <TabsContent value="documents">
                <OverviewSection title="Attached Documents">
                    <FileList files={operator.documents.map(d => ({ ...d, name: d.name || "Untitled Document" })) || []} />
                </OverviewSection>
            </TabsContent>

            {/* ACTIVITY LOG TAB */}
            <TabsContent value="activity">
                <OverviewSection title="Activity History" description="Recent actions and changes performed on this operator.">
                    <ActivityLogList entityType="OPERATOR" entityId={operator.id} />
                </OverviewSection>
            </TabsContent>
        </Tabs>
    </OverviewPage>);
}
