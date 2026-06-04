import { notFound } from "next/navigation";
import { dbTenant, dbQuery } from "@/app/lib/db";
import { AssignmentForm } from "@/app/Components/assignments/AssignmentForm";
import { PageHeader } from "@/app/Components/ui/page-header";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default async function EditAssignmentPage({ params }) {
    const session = await getSession();
    const canEdit = session ? await verifySessionPermission(session, "Assignment", "Edit") : false;
    if (!canEdit) {
        return <Forbidden module="assignments" action="edit" />;
    }

    const id = parseInt((await params).id);
    const canSplit = true;
    const [aRows] = await dbTenant(`SELECT * FROM \`assignments\` WHERE id = ? LIMIT 1`, [id]);
    if (!aRows || aRows.length === 0) {
        notFound();
    }
    const aRow = aRows[0];

    const [blocks] = await dbTenant(`SELECT * FROM \`assignment_blocks\` WHERE assignmentId = ? ORDER BY startDate ASC`, [id]);
    const [attachments] = await dbTenant(`SELECT * FROM \`assignment_attachments\` WHERE assignmentId = ?`, [id]);

    // Fetch block attachments and check for time logs
    const enrichedBlocks = await Promise.all((blocks || []).map(async (b) => {
        const [tlCheck] = await dbTenant(`SELECT id FROM \`daily_time_logs\` WHERE assignmentBlockId = ? LIMIT 1`, [b.id]);
        return {
            ...b,
            dailyTimeLogs: tlCheck || [],
            hasTimeLogs: (tlCheck || []).length > 0,
        };
    }));

    const assignment = {
        ...aRow,
        blocks: enrichedBlocks,
        attachments: attachments || [],
    };

    if (!assignment) {
        notFound();
    }

    // Map blocks to include a simple boolean `hasTimeLogs` property
    const processedAssignment = {
        ...assignment,
        blocks: assignment.blocks.map(block => ({
            ...block,
            hasTimeLogs: block.dailyTimeLogs.length > 0
        }))
    };
    return (<div className="max-w-5xl mx-auto">
            <PageHeader title="Edit Assignment" description={aRow.assignmentCode || `ASG-${id}`}/>
            <AssignmentForm initialData={processedAssignment} canSplit={canSplit} />
        </div>);
}
