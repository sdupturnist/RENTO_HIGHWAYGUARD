"use client";
import { useQuery } from "@tanstack/react-query";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/Components/ui/card";
const localizer = momentLocalizer(moment);
export function AssignmentCalendar() {
    const { data: events = [] } = useQuery({
        queryKey: ["assignment-calendar-events"],
        queryFn: async () => {
            const res = await fetch("/api/assignments");
            if (!res.ok) throw new Error("Failed to load calendar events");
            const data = await res.json();
            return data.map((assign) => ({
                id: assign.id,
                title: `${assign.customer.companyName} (${assign.project?.name || 'No Project'})`,
                start: new Date(assign.fromDate),
                end: new Date(assign.toDate),
                resource: assign
            }));
        },
    });

    return (<Card className="h-[600px]">
            <CardHeader>
                <CardTitle>Assignment Schedule</CardTitle>
            </CardHeader>
            <CardContent className="h-full pb-14">
                <Calendar localizer={localizer} events={events} startAccessor="start" endAccessor="end" style={{ height: 500 }} onSelectEvent={(event) => alert(`Assignment: ${event.title}`)}/>
            </CardContent>
        </Card>);
}
