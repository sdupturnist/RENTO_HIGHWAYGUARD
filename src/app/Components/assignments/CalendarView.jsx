"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, startOfDay, endOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { cn } from "@/app/lib/utils";
import { Card } from "@/app/Components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/Components/ui/tooltip";
import { DayInspector } from "./DayInspector";
import { useRouter } from "next/navigation";

export function CalendarView({ permissions }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const router = useRouter();

    const { data: calendarData, isLoading } = useQuery({
        queryKey: ["assignment-calendar", startOfMonth(currentDate).toISOString()],
        queryFn: async () => {
            const start = startOfMonth(currentDate).toISOString();
            const end = endOfMonth(currentDate).toISOString();
            const [eventsRes, settingsRes] = await Promise.all([
                fetch(`/api/assignments/calendar?start=${start}&end=${end}`),
                fetch(`/api/settings/company`)
            ]);
            let events = [];
            let fleetTotals = { totalVehicles: 0, totalOperators: 0 };
            let maintenances = [];
            let weekendDays = [];
            if (eventsRes.ok) {
                const data = await eventsRes.json();
                events = data.events || [];
                fleetTotals = data.fleetTotals || { totalVehicles: 0, totalOperators: 0 };
                maintenances = data.maintenances || [];
            }
            if (settingsRes.ok) {
                const settings = await settingsRes.json();
                if (Array.isArray(settings.weekendDays)) weekendDays = settings.weekendDays;
            }
            return { events, fleetTotals, maintenances, weekendDays };
        },
    });

    const events = calendarData?.events || [];
    const fleetTotals = calendarData?.fleetTotals || { totalVehicles: 0, totalOperators: 0 };
    const maintenances = calendarData?.maintenances || [];
    const weekendDays = calendarData?.weekendDays || [];

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const goToToday = () => setCurrentDate(new Date());

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    const getDayEvents = (day) => {
        return events.filter(event => {
            const s = startOfDay(new Date(event.startDate));
            const e = endOfDay(new Date(event.endDate));
            return day >= s && day <= e;
        });
    };

    const handleViewAssignment = (assignmentId) => {
        router.push(`/assignments/${assignmentId}`);
    };

    const handleAddAssignment = (date) => {
        router.push(`/assignments/new?date=${date.toISOString()}`);
    };

    return (
        <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
            <div className="flex h-[calc(100vh-220px)] flex-col relative">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between p-4 border-b gap-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            {format(currentDate, "MMMM yyyy")}
                            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        </h2>
                        <div className="flex items-center space-x-1">
                            <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={goToToday} className="h-8 text-xs">
                                Today
                            </Button>
                            <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-md">
                        <span className="font-medium text-muted-foreground">Occupancy:</span>
                        <div className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full bg-green-500 inline-block" /> Low</div>
                        <div className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full bg-orange-400 inline-block" /> Medium</div>
                        <div className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full bg-red-500 inline-block" /> High</div>
                        <div className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-500" /> Shortage</div>
                    </div>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 border-b bg-muted/40">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                        <div key={day} className="p-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto">
                    <TooltipProvider delayDuration={100}>
                        <div className="grid grid-cols-7 auto-rows-fr min-h-[600px] h-full">
                            {calendarDays.map((day) => {
                                const dayEvents = getDayEvents(day);
                                const isCurrentMonth = isSameMonth(day, currentDate);
                                const isDayToday = isToday(day);
                                const dayName = format(day, "EEEE");
                                const isWeekend = weekendDays.includes(dayName);

                                const assignmentCount = new Set(dayEvents.map(e => e.assignmentId).filter(Boolean)).size;
                                const vehicleCount = new Set(dayEvents.filter(e => e.blockType === 'VEHICLE').map(e => e.vehicleId).filter(Boolean)).size;
                                const operatorCount = new Set([
                                    ...dayEvents.filter(e => e.blockType === 'VEHICLE' && e.withOperator && e.operatorId).map(e => e.operatorId),
                                    ...dayEvents.filter(e => e.blockType === 'OPERATOR' && e.operatorId).map(e => e.operatorId),
                                ]).size;
                                const materialCount = dayEvents.filter(e => e.blockType === 'MATERIAL').length;
                                const detourCount = dayEvents.filter(e => e.blockType === 'DETOUR').length;
                                const maintenanceCount = new Set(maintenances.filter(m => {
                                    const mStart = startOfDay(new Date(m.startDate));
                                    const mEnd = m.endDate ? endOfDay(new Date(m.endDate)) : endOfMonth(currentDate);
                                    return day >= mStart && day <= mEnd;
                                }).map(m => m.vehicleId)).size;

                                const hasActivity = assignmentCount > 0 || maintenanceCount > 0;

                                // Occupancy bar
                                const vOcc = fleetTotals.totalVehicles > 0 ? vehicleCount / fleetTotals.totalVehicles : 0;
                                const oOcc = fleetTotals.totalOperators > 0 ? operatorCount / fleetTotals.totalOperators : 0;
                                const avgOcc = fleetTotals.totalVehicles > 0 || fleetTotals.totalOperators > 0
                                    ? (vOcc + oOcc) / 2 : 0;
                                const barColor = avgOcc >= 0.9 ? 'bg-red-500' : avgOcc >= 0.5 ? 'bg-orange-400' : 'bg-green-500';
                                const vShortage = fleetTotals.totalVehicles > 0 && vOcc >= 0.9;
                                const oShortage = fleetTotals.totalOperators > 0 && oOcc >= 0.9;

                                return (
                                    <Tooltip key={day.toISOString()}>
                                        <TooltipTrigger asChild>
                                            <div
                                                className={cn(
                                                    "group/cell flex flex-col border-b border-r p-1.5 min-h-[100px] cursor-pointer transition-colors relative",
                                                    !isCurrentMonth && "bg-muted/10 text-muted-foreground",
                                                    isWeekend && isCurrentMonth && !isDayToday && "bg-orange-50/30 dark:bg-orange-900/10",
                                                    isDayToday && "bg-blue-50/50 dark:bg-blue-900/10",
                                                    selectedDate?.toDateString() === day.toDateString() && "ring-2 ring-inset ring-primary"
                                                )}
                                                onClick={() => setSelectedDate(day)}
                                            >
                                                {/* Date number + shortage warning */}
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className={cn(
                                                        "text-sm font-medium h-6 w-6 flex items-center justify-center rounded-full shrink-0",
                                                        isDayToday && "bg-primary text-primary-foreground"
                                                    )}>
                                                        {format(day, "d")}
                                                    </span>
                                                    {(vShortage || oShortage) && (
                                                        <AlertTriangle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />
                                                    )}
                                                </div>

                                                {/* Occupancy bar */}
                                                {hasActivity && (
                                                    <div className="h-1 w-full rounded-full bg-muted/40 mb-1.5">
                                                        <div
                                                            className={`h-1 rounded-full transition-all ${barColor}`}
                                                            style={{ width: `${Math.min(100, Math.round(avgOcc * 100))}%` }}
                                                        />
                                                    </div>
                                                )}

                                                {/* Count indicators */}
                                                {hasActivity && (
                                                    <div className="flex flex-col gap-0.5 text-[10px] font-medium text-muted-foreground">
                                                        <span>📋 {assignmentCount}</span>
                                                        <span>🚚 {vehicleCount}/{fleetTotals.totalVehicles}</span>
                                                        <span>👷 {operatorCount}/{fleetTotals.totalOperators}</span>
                                                        {materialCount > 0 && <span>🧱 {materialCount}</span>}
                                                        {detourCount > 0 && <span>🚧 {detourCount}</span>}
                                                        {maintenanceCount > 0 && <span className="text-orange-600">🔧 {maintenanceCount}</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </TooltipTrigger>

                                        {hasActivity && (
                                            <TooltipContent
                                                side="top"
                                                avoidCollisions={false}
                                                className="w-52 p-3 bg-popover text-popover-foreground border shadow-xl rounded-lg text-xs z-[100]"
                                                sideOffset={5}
                                            >
                                                <div className="font-semibold mb-2 border-b pb-1.5">
                                                    {format(day, "d MMM yyyy")}
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">📋 Assignments</span>
                                                        <span className="font-medium">{assignmentCount}</span>
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">🚚 Vehicles</span>
                                                            <span className="font-medium">{vehicleCount} / {fleetTotals.totalVehicles}</span>
                                                        </div>
                                                        <div className="flex justify-between text-[10px] text-muted-foreground pl-3 mt-0.5">
                                                            <span>Available</span>
                                                            <span>{Math.max(0, fleetTotals.totalVehicles - vehicleCount - maintenanceCount)}</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">👷 Operators</span>
                                                            <span className="font-medium">{operatorCount} / {fleetTotals.totalOperators}</span>
                                                        </div>
                                                        <div className="flex justify-between text-[10px] text-muted-foreground pl-3 mt-0.5">
                                                            <span>Available</span>
                                                            <span>{Math.max(0, fleetTotals.totalOperators - operatorCount)}</span>
                                                        </div>
                                                    </div>
                                                    {materialCount > 0 && (
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">🧱 Materials</span>
                                                            <span className="font-medium">{materialCount} deployments</span>
                                                        </div>
                                                    )}
                                                    {detourCount > 0 && (
                                                        <div className="flex justify-between">
                                                            <span className="text-muted-foreground">🚧 Detours</span>
                                                            <span className="font-medium">{detourCount} active</span>
                                                        </div>
                                                    )}
                                                    {maintenanceCount > 0 && (
                                                        <div className="flex justify-between text-orange-600 dark:text-orange-400">
                                                            <span>🔧 In Maintenance</span>
                                                            <span className="font-medium">{maintenanceCount}</span>
                                                        </div>
                                                    )}
                                                    {isWeekend && (
                                                        <div className="pt-1 border-t text-[10px] text-muted-foreground">
                                                            Weekend — some resources may be available
                                                        </div>
                                                    )}
                                                    {(vShortage || oShortage) && (
                                                        <div className="pt-1 border-t text-red-600 dark:text-red-400 font-medium space-y-0.5">
                                                            {vShortage && <div>⚠ Vehicle shortage</div>}
                                                            {oShortage && <div>⚠ Operator shortage</div>}
                                                        </div>
                                                    )}
                                                </div>
                                            </TooltipContent>
                                        )}
                                    </Tooltip>
                                );
                            })}
                        </div>
                    </TooltipProvider>
                </div>

                {/* Inspector panel */}
                {selectedDate && (
                    <DayInspector
                        date={selectedDate}
                        events={getDayEvents(selectedDate)}
                        fleetTotals={fleetTotals}
                        onClose={() => setSelectedDate(null)}
                        onViewAssignment={handleViewAssignment}
                        onAddAssignment={handleAddAssignment}
                        canAdd={permissions.canAdd}
                        canView={permissions.canView}
                    />
                )}
            </div>
        </Card>
    );
}
