import { notFound } from "next/navigation";
import { getTimesheetById } from "@/app/lib/services/timesheet-service";
import { TimesheetDetail } from "@/app/Components/timesheets/TimesheetDetail";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export const dynamic = 'force-dynamic';
export default async function TimesheetDetailPage({ params }) {
    const session = await getSession();
    const canView = session ? await verifySessionPermission(session, "Timesheet", "View") : false;
    if (!canView) {
        return <Forbidden module="timesheets" action="view" />;
    }
    const { id: paramId } = await params;
    const timesheet = await getTimesheetById(parseInt(paramId));
    if (!timesheet) {
        notFound();
    }
    // Serialize dates
    const serializedTimesheet = {
        ...timesheet,
        periodStart: timesheet.periodStart.toISOString(),
        periodEnd: timesheet.periodEnd.toISOString(),
        generatedAt: timesheet.generatedAt.toISOString(),
        createdAt: timesheet.createdAt.toISOString(),
        updatedAt: timesheet.updatedAt.toISOString(),
        lines: timesheet.lines.map(line => ({
            ...line,
            date: line.date.toISOString(),
            createdAt: line.createdAt.toISOString(),
            updatedAt: line.updatedAt.toISOString(),
        }))
    };
    return (<div className="flex-1 space-y-4 pt-6">
            <TimesheetDetail timesheet={serializedTimesheet}/>
        </div>);
}
