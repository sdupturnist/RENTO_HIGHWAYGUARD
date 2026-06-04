import { getTimesheets } from "@/app/lib/services/timesheet-service";
import { TimesheetTable } from "@/app/Components/timesheets/TimesheetTable";
import { TimesheetGenerator } from "@/app/Components/timesheets/TimesheetGenerator";
import { verifySession, getSession } from "@/app/lib/auth";
import { Input } from "@/app/Components/ui/input";
import { Button } from "@/app/Components/ui/button";
import { Search } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/app/Components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export const dynamic = 'force-dynamic';
export default async function TimesheetsPage({ searchParams }) {
    const session = await getSession();
    const canView = session ? await verifySessionPermission(session, "Timesheet", "View") : false;
    if (!canView) {
        return <Forbidden module="timesheets" action="view" />;
    }
    // Await searchParams
    const params = await searchParams;
    // Parse filters
    const query = params.q || "";
    const fromDate = params.from ? new Date(params.from) : undefined;
    const toDate = params.to ? new Date(params.to) : undefined;
    const timesheets = await getTimesheets({
        search: query,
        periodStart: fromDate,
        periodEnd: toDate
    });
    // Serialize dates for Client Component
    const serializedTimesheets = timesheets.map((t) => ({
        ...t,
        periodStart: t.periodStart.toISOString(),
        periodEnd: t.periodEnd.toISOString(),
        generatedAt: t.generatedAt.toISOString(),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
    }));
    return (<div className="flex-1 space-y-4 pt-6">
        <PageHeader title="Timesheets" description="Generate and manage timesheets for customer billing.">
            <TimesheetGenerator currentUserRole={session?.role} />
        </PageHeader>

        <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
            <CardHeader>
                <CardTitle>Timesheet Records</CardTitle>
                <CardDescription>
                    View all generated timesheets and their status.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <form className="flex flex-col md:flex-row w-full items-start md:items-center gap-3 md:gap-2">
                        <div className="relative w-full md:flex-1">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                            <Input placeholder="Search timesheets..." name="q" defaultValue={params.q} className="pl-10 bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-800/50 focus:bg-white dark:focus:bg-slate-900 rounded-xl transition-all w-full" />
                        </div>
                        <div className="flex w-full md:w-auto gap-2">
                            <Input type="date" name="from" defaultValue={params.from} className="w-full md:w-[150px]" />
                            <Input type="date" name="to" defaultValue={params.to} className="w-full md:w-[150px]" />
                        </div>
                        <div className="flex w-full md:w-auto gap-2">
                            <Button type="submit" variant="secondary" className="flex-1 md:flex-none">
                                Filter
                            </Button>
                            {(params.q || params.from || params.to) && (<Button variant="ghost" asChild className="flex-1 md:flex-none">
                                <Link href="/timesheets">Reset</Link>
                            </Button>)}
                        </div>
                    </form>
                </div>

                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800/60 overflow-hidden">
                    <TimesheetTable data={serializedTimesheets} />
                </div>
            </CardContent>
        </Card>
    </div>);
}
