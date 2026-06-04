import { dbTenant, dbQuery } from "@/app/lib/db";
import { Button } from "@/app/Components/ui/button";
import { Edit, MapPin, ArrowLeft, Paperclip, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/app/Components/ui/badge";
import { ProjectStatusActions } from "@/app/Components/projects/ProjectStatusActions";
import { DeleteButton } from "@/app/Components/common/DeleteButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/Components/ui/tabs";
import { ActivityLogList } from "@/app/Components/common/ActivityLogList";
import { OverviewPage, OverviewSection, InfoGrid, InfoField } from "@/app/Components/common/Overview";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default async function ViewProjectPage(props) {
    const session = await getSession();
    const canView = session ? await verifySessionPermission(session, "Projects", "View") : false;
    if (!canView) {
        return <Forbidden module="projects" action="view" />;
    }

    const canEdit = session ? await verifySessionPermission(session, "Projects", "Edit") : false;
    const canDelete = session ? await verifySessionPermission(session, "Projects", "Delete") : false;

    const params = await props.params;
    const id = parseInt(params.id);
    if (isNaN(id)) {
        notFound();
    }
    const [pRows] = await dbTenant(`
        SELECT p.*, c.companyName as customer_companyName 
        FROM \`projects\` p
        LEFT JOIN \`customers\` c ON c.id = p.customerId
        WHERE p.id = ? LIMIT 1
    `, [id]);
    if (!pRows || pRows.length === 0) {
        notFound();
    }
    const project = {
        ...pRows[0],
        customer: pRows[0].customerId ? { id: pRows[0].customerId, companyName: pRows[0].customer_companyName } : null
    };
    return (<OverviewPage title={<div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/projects">
                            <ArrowLeft className="h-4 w-4"/>
                        </Link>
                    </Button>
                    <span>{project.name}</span>
                    <Badge variant={project.status === "ACTIVE"
                ? "default"
                : project.status === "COMPLETED"
                    ? "secondary"
                    : "destructive"} className={project.status === "ACTIVE"
                ? "bg-green-600 hover:bg-green-700"
                : project.status === "COMPLETED"
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-red-600 hover:bg-red-700"}>
                        {project.status}
                    </Badge>
                </div>} description={`${project.projectCode || "-"} • ${project.customer?.companyName || ""}`} actions={<>
                    {canEdit && <ProjectStatusActions projectId={project.id} currentStatus={project.status}/>}
                    {canEdit && (
                        <Button variant="outline" asChild>
                            <Link href={`/projects/${project.id}/edit`}>
                                <Edit className="mr-2 h-4 w-4"/> Edit
                            </Link>
                        </Button>
                    )}
                    {canDelete && <DeleteButton apiPath={`/api/projects/${project.id}`} queryKey="projects" redirectTo="/projects" entityLabel="Project" />}
                </>}>

            <Tabs defaultValue="overview" className="space-y-6">
                <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-2 w-fit">
                    <TabsList>
                        <TabsTrigger className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30" value="overview">Overview</TabsTrigger>
                        <TabsTrigger className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30" value="activity">Activity Log</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="overview" className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <OverviewSection title="Project Details">
                            <InfoGrid>
                                <InfoField label="Client" value={<Link href={`/customers/${project.customerId}`} className="text-primary hover:underline">
                                            {project.customer.companyName}
                                        </Link>}/>
                                <InfoField label="Project Code" value={project.projectCode || "-"}/>
                                <InfoField label="Status" value={<Badge variant={project.status === "ACTIVE"
                ? "default"
                : project.status === "COMPLETED"
                    ? "secondary"
                    : "destructive"} className={project.status === "ACTIVE"
                ? "bg-green-600 hover:bg-green-700"
                : project.status === "COMPLETED"
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-red-600 hover:bg-red-700"}>
                                        {project.status}
                                    </Badge>}/>
                                <InfoField label="Created" value={new Date(project.createdAt).toLocaleDateString()}/>
                            </InfoGrid>
                        </OverviewSection>

                        <OverviewSection title="Location & Timeline">
                            <InfoGrid>
                                <InfoField label="Location" value={project.location ? (<div className="flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-muted-foreground"/>
                                                <span>{project.location}</span>
                                            </div>) : "-"}/>
                            </InfoGrid>
                        </OverviewSection>

                        <OverviewSection title="Billing Configuration" className="md:col-span-2">
                            <InfoGrid cols={2}>
                                <InfoField label="Billing Cycle" value={<Badge variant="secondary">{project.billingCycle}</Badge>}/>
                            </InfoGrid>
                        </OverviewSection>

                        {(project.lpoNumber || project.lpoAttachmentPath) && (
                            <OverviewSection title="LPO Reference" className="md:col-span-2">
                                <InfoGrid cols={2}>
                                    <InfoField label="LPO Number" value={project.lpoNumber || "—"}/>
                                    <InfoField label="LPO Document" value={
                                        project.lpoAttachmentPath ? (
                                            <a href={project.lpoAttachmentPath} target="_blank" rel="noopener noreferrer"
                                               className="inline-flex items-center gap-2 text-sm border rounded-md px-3 py-1.5 hover:bg-muted/50 transition-colors">
                                                <Paperclip className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-primary font-medium">
                                                    {project.lpoAttachmentName || project.lpoAttachmentPath.split("/").pop()}
                                                </span>
                                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                            </a>
                                        ) : "—"
                                    }/>
                                </InfoGrid>
                            </OverviewSection>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="activity">
                    <OverviewSection title="Activity History" description="Recent changes for this project.">
                        <ActivityLogList entityType="PROJECT" entityId={project.id}/>
                    </OverviewSection>
                </TabsContent>
            </Tabs>
        </OverviewPage>);
}
