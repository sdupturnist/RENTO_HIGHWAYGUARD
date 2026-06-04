import { dbTenant, dbQuery } from "@/app/lib/db";
import { PageHeader } from "@/app/Components/ui/page-header";
import { ProjectForm } from "@/app/Components/projects/ProjectForm";
import { notFound } from "next/navigation";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default async function EditProjectPage(props) {
    const session = await getSession();
    const canEdit = session ? await verifySessionPermission(session, "Projects", "Edit") : false;
    if (!canEdit) {
        return <Forbidden module="projects" action="edit" />;
    }

    const params = await props.params;
    const id = parseInt(params.id);
    if (isNaN(id)) {
        notFound();
    }
    const [pRows] = await dbTenant(`SELECT * FROM \`projects\` WHERE id = ? LIMIT 1`, [id]);
    if (!pRows || pRows.length === 0) {
        notFound();
    }
    const project = pRows[0];
    return (<div className="max-w-5xl mx-auto">
            <PageHeader title="Edit Project" description={`${project.projectCode || "-"} · ${project.name}`}/>
            <ProjectForm initialData={project}/>
        </div>);
}
