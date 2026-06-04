import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";

function generateDateSet(startDate, endDate) {
    const set = new Set();
    const cur = new Date(startDate);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    while (cur <= end) {
        set.add(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
    }
    return set;
}

export async function GET(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const excludeAssignmentId = searchParams.get("excludeAssignmentId");

    if (!startDate || !endDate) {
        return NextResponse.json({ message: "startDate and endDate required" }, { status: 400 });
    }

    try {
        // Includes weekends — conservative: if any overlap exists, resource is marked busy
        const proposedDates = generateDateSet(new Date(startDate), new Date(endDate));
        const proposedArr = [...proposedDates];

        const excludeClause = excludeAssignmentId ? "AND a.id != ?" : "";
        const params = excludeAssignmentId ? [excludeAssignmentId] : [];

        const [vBlocks] = await dbTenant(`
            SELECT b.vehicleId, b.startDate, b.endDate, b.includeWeekendsForAutoLogs
            FROM \`assignment_blocks\` b
            JOIN \`assignments\` a ON a.id = b.assignmentId
            WHERE b.vehicleId IS NOT NULL AND b.status != 'STOPPED'
              AND a.status IN ('ACTIVE', 'DRAFT')
              ${excludeClause}
        `, params);

        const [oBlocks] = await dbTenant(`
            SELECT b.operatorId, b.startDate, b.endDate, b.includeWeekendsForAutoLogs
            FROM \`assignment_blocks\` b
            JOIN \`assignments\` a ON a.id = b.assignmentId
            WHERE b.operatorId IS NOT NULL AND b.status != 'STOPPED'
              AND a.status IN ('ACTIVE', 'DRAFT')
              ${excludeClause}
        `, params);

        const busyVehicleIds = new Set();
        for (const block of vBlocks || []) {
            const blockDates = generateDateSet(new Date(block.startDate), new Date(block.endDate));
            if (proposedArr.some(d => blockDates.has(d))) {
                busyVehicleIds.add(block.vehicleId);
            }
        }

        const busyOperatorIds = new Set();
        for (const block of oBlocks || []) {
            const blockDates = generateDateSet(new Date(block.startDate), new Date(block.endDate));
            if (proposedArr.some(d => blockDates.has(d))) {
                busyOperatorIds.add(block.operatorId);
            }
        }

        return NextResponse.json({
            busyVehicleIds: [...busyVehicleIds],
            busyOperatorIds: [...busyOperatorIds],
        });
    } catch (error) {
        console.error("Error fetching available resources:", error);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}
