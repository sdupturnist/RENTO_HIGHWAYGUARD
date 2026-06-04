import { NextResponse } from "next/server";
import { getTimesheets } from "@/app/lib/services/timesheet-service";
import { verifySession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
export async function GET(request) {
    const session = await verifySession();
    const canView = session ? await verifySessionPermission(session, "Timesheet", "View") : false;
    if (!session || !canView) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const { searchParams } = new URL(request.url);
        const customerId = searchParams.get("customerId");
        const projectId = searchParams.get("projectId");
        const status = searchParams.get("status");
        const uninvoiced = searchParams.get("uninvoiced") === "true";
        const filters = {};
        if (customerId)
            filters.customerId = parseInt(customerId);
        if (projectId)
            filters.projectId = parseInt(projectId);
        if (status)
            filters.status = status.includes(",") ? status.split(",") : status;
        if (uninvoiced)
            filters.uninvoiced = true;
        const enrichedTimesheets = await getTimesheets(filters);
        return NextResponse.json(enrichedTimesheets);
    }
    catch (error) {
        console.error("Failed to fetch timesheets:", error);
        return NextResponse.json({ error: "Failed to fetch timesheets" }, { status: 500 });
    }
}
