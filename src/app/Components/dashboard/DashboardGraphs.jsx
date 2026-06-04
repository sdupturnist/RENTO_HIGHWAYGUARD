"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/Components/ui/card";
export function DashboardGraphs({ vehicleUtilization, assignmentsByProject }) {
    // Find max values for scaling
    const maxUtilization = Math.max(...vehicleUtilization.map(v => v.daysAssigned), 1);
    const maxProjectCount = Math.max(...assignmentsByProject.map(p => p.count), 1);
    return (<div className="grid gap-6 md:grid-cols-2 animate-slide-up-fade" style={{ animationDelay: "200ms" }}>
        <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/50 shadow-sm">
            <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">Vehicle Utilization (Next 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4 max-h-[260px] overflow-y-auto md:max-h-none md:overflow-visible pr-2 md:pr-0 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                    {vehicleUtilization.length === 0 && <p className="text-slate-400 text-sm">No utilization data.</p>}
                    {vehicleUtilization.slice(0, 8).map((item, index) => (<div key={index} className="flex items-center gap-4 group">
                        <div className="w-24 text-sm font-semibold text-slate-700 dark:text-slate-300 truncate" title={item.vehicleCode}>{item.vehicleCode}</div>
                        <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500 group-hover:opacity-90" style={{ width: `${(item.daysAssigned / 30) * 100}%` }} title={`${item.daysAssigned} days`} />
                        </div>
                        <div className="w-12 text-sm text-right font-medium text-slate-500 dark:text-slate-400">{item.daysAssigned}d</div>
                    </div>))}
                </div>
            </CardContent>
        </Card>

        <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/50 shadow-sm">
            <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">Assignments by Project</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4 max-h-[260px] overflow-y-auto md:max-h-none md:overflow-visible pr-2 md:pr-0 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                    {assignmentsByProject.length === 0 && <p className="text-slate-400 text-sm">No assignment data.</p>}
                    {assignmentsByProject.slice(0, 8).map((item, index) => (<div key={index} className="flex items-center gap-4 group">
                        <div className="w-32 text-sm font-semibold text-slate-700 dark:text-slate-300 truncate" title={item.projectName}>{item.projectName}</div>
                        <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500 group-hover:opacity-90" style={{ width: `${(item.count / maxProjectCount) * 100}%` }} title={`${item.count} assignments`} />
                        </div>
                        <div className="w-8 text-sm text-right font-medium text-slate-500 dark:text-slate-400">{item.count}</div>
                    </div>))}
                </div>
            </CardContent>
        </Card>
    </div>);
}
