import { AssignmentForm } from "@/app/Components/assignments/AssignmentForm";
import { PageHeader } from "@/app/Components/ui/page-header";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default async function NewAssignmentPage() {
    const session = await getSession();
    const canAdd = session ? await verifySessionPermission(session, "Assignment", "Add") : false;
    if (!canAdd) {
        return <Forbidden module="assignments" action="add" />;
    }
    return (<div className="max-w-5xl mx-auto">
            <PageHeader title="New Assignment" description="Create a new vehicle and operator assignment"/>
            <AssignmentForm />
        </div>);
}
