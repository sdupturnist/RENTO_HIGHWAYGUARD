"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { ProjectList } from "@/app/Components/projects/ProjectList";
import { PageHeader } from "@/app/Components/ui/page-header";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { useRouter } from "next/navigation";
export default function ProjectsPage() {
    const router = useRouter();
    const { loading, can } = usePermissions();
    if (loading)
        return null;
    const canView = can("Projects", "View");
    const canAdd = can("Projects", "Add") || can("Projects", "Edit");
    if (!canView) {
        return <div className="p-8 text-center text-muted-foreground">You do not have permission to view projects.</div>;
    }
    return (<div className="space-y-8">
            <PageHeader title="Projects" description="Manage projects and billing configurations.">
                {canAdd && (<Button asChild>
                        <Link href="/projects/new">
                            <Plus className="mr-2 h-4 w-4"/> Add Project
                        </Link>
                    </Button>)}
            </PageHeader>

            <ProjectList onEdit={(project) => router.push(`/projects/${project.id}/edit`)}/>
        </div>);
}
