"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, List, Calendar } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { AssignmentList } from "@/app/Components/assignments/AssignmentList";
import { CalendarView } from "@/app/Components/assignments/CalendarView";
import { PageHeader } from "@/app/Components/ui/page-header";
import { useRouter, useSearchParams } from "next/navigation";
export function AssignmentsPageClient({ canViewList, canViewCalendar, canAdd, canEdit, canDelete }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    // Determine default view based on permissions
    // Logic: If both allowed -> List. If one -> that one.
    const defaultView = canViewList ? "list" : (canViewCalendar ? "calendar" : "");
    const viewParam = searchParams.get("view");
    const [view, setView] = useState((viewParam === "list" || viewParam === "calendar") ? viewParam : defaultView);
    // Sync state with URL or permissions
    useEffect(() => {
        if (view === "list" && !canViewList)
            setView("calendar");
        if (view === "calendar" && !canViewCalendar)
            setView("list");
    }, [canViewList, canViewCalendar]);
    const handleViewChange = (newView) => {
        setView(newView);
        router.push(`/assignments?view=${newView}`);
    };
    if (!canViewList && !canViewCalendar) {
        return <div className="p-8 text-center text-muted-foreground">You do not have permission to view assignments.</div>;
    }
    return (<div className="space-y-8">
            <PageHeader title="Assignments" description="Manage resource allocations to customers and projects.">
                <div className="flex items-center gap-4">
                    {/* View Toggle */}
                    <div className="flex bg-muted p-1 rounded-lg">
                        {canViewList && (<button onClick={() => handleViewChange("list")} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${view === "list"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/50"}`}>
                                <List className="h-4 w-4"/>
                                <span className="hidden sm:inline">List</span>
                             </button>)}
                        {canViewCalendar && (<button onClick={() => handleViewChange("calendar")} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${view === "calendar"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/50"}`}>
                                <Calendar className="h-4 w-4"/>
                                <span className="hidden sm:inline">Calendar</span>
                            </button>)}
                    </div>

                    {/* Add Button */}
                    {canAdd && (<Button asChild>
                            <Link href="/assignments/new">
                                <Plus className="mr-2 h-4 w-4"/>
                                <span className="hidden sm:inline">New Assignment</span>
                                <span className="sm:hidden">New</span>
                            </Link>
                        </Button>)}
                </div>
            </PageHeader>

            {view === "list" && canViewList && (<AssignmentList onEdit={(assign) => router.push(`/assignments/${assign.id}/edit`)} canEdit={canEdit} canDelete={canDelete} />)}

            {view === "calendar" && canViewCalendar && (<CalendarView permissions={{ canView: canViewList, canAdd }}/>)}
        </div>);
}
