import { notFound } from "next/navigation";
import { dbTenant, dbQuery } from "@/app/lib/db";
import { PageHeader } from "@/app/Components/ui/page-header";
import { TimeLogForm } from "@/app/Components/time-logs/TimeLogForm";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default async function EditTimeLogPage({ params }) {
    const session = await getSession();
    const canEdit = session ? await verifySessionPermission(session, "Daily Time Logs", "Edit") : false;
    if (!canEdit) {
        return <Forbidden module="daily time logs" action="edit" />;
    }

    const { id } = await params;
    const [logRows] = await dbTenant(`
        SELECT dtl.*, a.assignmentCode, a.customerId as assignment_customerId
        FROM \`daily_time_logs\` dtl
        LEFT JOIN \`assignments\` a ON a.id = dtl.assignmentId
        WHERE dtl.id = ? LIMIT 1
    `, [parseInt(id)]);
    if (!logRows || logRows.length === 0) {
        notFound();
    }
    const row = logRows[0];
    const timeLog = {
        ...row,
        assignment: { id: row.assignmentId, assignmentCode: row.assignmentCode }
    };
    return (<div className="max-w-5xl mx-auto">
            <PageHeader title="Edit Time Log" description={`Editing time log for ${timeLog.assignment.assignmentCode} - ${timeLog.date.toLocaleDateString()}`}/>
            <TimeLogForm initialData={timeLog}/>
        </div>);
}
