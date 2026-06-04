"use client";
import { PageHeader } from "@/app/Components/ui/page-header";
import { ProjectForm } from "@/app/Components/projects/ProjectForm";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default function NewProjectPage() {
    const { can, loading } = usePermissions();

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
    }

    if (!can("Projects", "Add")) {
        return <Forbidden module="projects" action="add" />;
    }

    return (<div className="max-w-5xl mx-auto">
            <PageHeader title="Create New Project" description="Initialize a new project site and link it to a client."/>
            <ProjectForm />
        </div>);
}
