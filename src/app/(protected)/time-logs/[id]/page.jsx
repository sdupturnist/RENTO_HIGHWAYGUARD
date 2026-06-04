import { verifySession } from "@/app/lib/auth";
import { dbTenant, dbQuery } from "@/app/lib/db";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/Components/ui/tabs";
import { Badge } from "@/app/Components/ui/badge";
import { ActivityLogList } from "@/app/Components/common/ActivityLogList";
import Link from "next/link";
import { Button } from "@/app/Components/ui/button";
import { ArrowLeft, Edit } from "lucide-react";
import { DeleteButton } from "@/app/Components/common/DeleteButton";
import { OverviewPage, OverviewSection, SectionGrid, InfoGrid, InfoField } from "@/app/Components/common/Overview";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default async function DailyTimeLogViewPage({ params }) {
    const session = await verifySession();
    if (!session)
        redirect("/login");

    const canView = await verifySessionPermission(session, "Daily Time Logs", "View");
    if (!canView) {
        return <Forbidden module="daily time logs" action="view" />;
    }

    const canEdit = await verifySessionPermission(session, "Daily Time Logs", "Edit");
    const canDelete = await verifySessionPermission(session, "Daily Time Logs", "Delete");

    const { id: paramId } = await params;
    const id = parseInt(paramId);
    if (isNaN(id))
        notFound();
    const [logRows] = await dbTenant(`
        SELECT dtl.*,
               c.companyName as customer_companyName,
               p.name as project_name,
               a.assignmentCode,
               v.vehicleCode, v.regNo, vt.name as vehicleType_name,
               o.name as operator_name, o.operatorCode as operator_code
        FROM \`daily_time_logs\` dtl
        LEFT JOIN \`customers\` c ON c.id = dtl.customerId
        LEFT JOIN \`projects\` p ON p.id = dtl.projectId
        LEFT JOIN \`assignments\` a ON a.id = dtl.assignmentId
        LEFT JOIN \`vehicles\` v ON v.id = dtl.vehicleId
        LEFT JOIN \`vehicle_types\` vt ON vt.id = v.typeId
        LEFT JOIN \`operators\` o ON o.id = dtl.operatorId
        WHERE dtl.id = ? LIMIT 1
    `, [id]);
    if (!logRows || logRows.length === 0)
        notFound();
    const row = logRows[0];
    const log = {
        ...row,
        customer: { companyName: row.customer_companyName },
        project: row.projectId ? { name: row.project_name } : null,
        assignment: { id: row.assignmentId, assignmentCode: row.assignmentCode },
        vehicle: { id: row.vehicleId, vehicleCode: row.vehicleCode, regNo: row.regNo, vehicleType: { name: row.vehicleType_name } },
        operator: row.operatorId ? { id: row.operatorId, name: row.operator_name, operatorCode: row.operator_code } : null,
    };
    // Calculate total - Not needed, just facts
    // const totalHours = log.regularHours + log.overtimeHours + log.holidayHours;
    return (<OverviewPage title={<div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
            <Link href="/time-logs">
                <ArrowLeft className="h-4 w-4" />
            </Link>
        </Button>
        <span>Time Log Details</span>
        <Badge variant="outline">{log.workType}</Badge>
    </div>} description={`${format(log.date, "EEEE, MMMM do, yyyy")} • ${log.customer.companyName}`} actions={<>
        {canEdit && (
            <Button variant="outline" size="sm" asChild>
                <Link href={`/time-logs/${log.id}/edit`}>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                </Link>
            </Button>
        )}
        {canDelete && <DeleteButton apiPath={`/api/time-logs/${log.id}`} queryKey="time-logs" redirectTo="/time-logs" entityLabel="Time log" />}
    </>}>

        <Tabs defaultValue="overview" className="space-y-4">
            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-2 w-fit">
                <TabsList>
                    <TabsTrigger className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30" value="overview">Overview</TabsTrigger>
                    <TabsTrigger className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30" value="activity">Activity Log</TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="overview" className="space-y-4">
                <SectionGrid>
                    <OverviewSection title="Log Information" className="md:col-span-2 lg:col-span-2">
                        <InfoGrid>
                            <InfoField label="Date" value={format(log.date, "EEEE, MMMM do, yyyy")} />
                            <InfoField label="Work Type" value={<Badge variant="outline">{log.workType}</Badge>} />
                            <InfoField label="Vehicle" value={<Link href={`/vehicles/${log.vehicle.id}`} className="text-primary hover:underline">{`${log.vehicle.vehicleCode} - ${log.vehicle.vehicleType.name}`}</Link>} />
                            <InfoField label="Registration" value={<Link href={`/vehicles/${log.vehicle.id}`} className="text-primary hover:underline">{log.vehicle.regNo || "No Reg No"}</Link>} />
                            <InfoField label="Operator" value={log.operator ? <Link href={`/operators/${log.operator.id}`} className="text-primary hover:underline">{log.operator.name}</Link> : "N/A"} />
                            {log.operator && <InfoField label="Operator Code" value={<Link href={`/operators/${log.operator.id}`} className="text-primary hover:underline">{log.operator.operatorCode}</Link>} />}
                            <InfoField label="Customer" value={log.customer.companyName} />
                            <InfoField label="Project" value={log.project?.name || "N/A"} />
                            <InfoField label="Assignment" value={<Link href={`/assignments/${log.assignmentId}`} className="text-primary hover:underline">
                                {log.assignment.assignmentCode}
                            </Link>} />
                            <InfoField label="Status Flags" value={<div className="flex flex-wrap gap-2 justify-end">
                                {log.isWeekend && <Badge variant="secondary">Weekend</Badge>}
                                {log.isHoliday && <Badge variant="secondary">Holiday</Badge>}
                                {log.autoGenerated && <Badge variant="outline">Auto-Generated</Badge>}
                            </div>} />
                        </InfoGrid>
                        <div className="pt-4 border-t mt-4">
                            <span className="text-sm font-medium text-muted-foreground">Remarks</span>
                            <p className="text-sm mt-1">{log.remarks || "No remarks provided."}</p>
                        </div>
                    </OverviewSection>

                    <OverviewSection title="Hours Logged">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-2">
                                <span className="text-muted-foreground font-medium">Worked Hours</span>
                                <span className="font-mono font-bold text-3xl">{(log.workedHours || 0).toFixed(2)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground border-t pt-2">
                                Note: Final regular, overtime, and holiday hours will be calculated during Timesheet generation based on company rules and rate cards.
                            </p>
                        </div>
                    </OverviewSection>
                </SectionGrid>
            </TabsContent>
            <TabsContent value="activity">
                <OverviewSection title="Activity History">
                    <ActivityLogList entityType="DAILYTIMELOG" entityId={log.id} />
                </OverviewSection>
            </TabsContent>
        </Tabs>
    </OverviewPage>);
}
