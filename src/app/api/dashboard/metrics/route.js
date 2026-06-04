import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";

export async function GET() {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    try {
        const today = new Date();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        // Formats a date to local MySQL standard datetime string, avoiding timezone/UTC distortions
        const fmt = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            const h = String(d.getHours()).padStart(2, "0");
            const min = String(d.getMinutes()).padStart(2, "0");
            const sec = String(d.getSeconds()).padStart(2, "0");
            return `${y}-${m}-${day} ${h}:${min}:${sec}`;
        };

        const [
            [totalVehiclesRows],
            [availableVehiclesRows],
            [assignedVehiclesMonthRows],
            [activeOperatorsRows],
            [activeAssignmentsRows],
            [pendingTimesheetsRows],
            [vehiclesWithAssignmentsRows],
            [assignmentsByProjectRaw],
        ] = await Promise.all([
            // Total active vehicles (including under maintenance / expired registration)
            dbTenant(`SELECT COUNT(*) as cnt FROM \`vehicles\` WHERE status IN ('ACTIVE', 'UNDER_MAINTENANCE', 'EXPIRED_REGISTRATION')`, []),

            // Available vehicles (no active/future assignment block, strictly ACTIVE/healthy)
            dbTenant(
                `SELECT COUNT(*) as cnt FROM \`vehicles\` v
                 WHERE v.status = 'ACTIVE'
                 AND NOT EXISTS (
                     SELECT 1 FROM \`assignment_blocks\` ab
                     JOIN \`assignments\` a ON a.id = ab.assignmentId
                     WHERE ab.vehicleId = v.id
                     AND ab.status != 'STOPPED'
                     AND a.status = 'ACTIVE'
                     AND ab.startDate <= ? AND ab.endDate >= ?
                 )`,
                [fmt(thirtyDaysFromNow), fmt(startOfDay)]
             ),

            // Vehicles assigned in current month
            dbTenant(
                `SELECT COUNT(DISTINCT ab.vehicleId) as cnt
                 FROM \`assignment_blocks\` ab
                 JOIN \`assignments\` a ON a.id = ab.assignmentId
                 WHERE ab.status != 'STOPPED'
                   AND a.status = 'ACTIVE'
                   AND ab.startDate <= ? AND ab.endDate >= ?`,
                [fmt(endOfMonth), fmt(startOfMonth)]
            ),

            // Available operators (no active/future assignment block in next 30 days)
            dbTenant(
                `SELECT COUNT(*) as cnt FROM \`operators\` o
                 WHERE o.status = 'ACTIVE'
                 AND NOT EXISTS (
                     SELECT 1 FROM \`assignment_blocks\` ab
                     JOIN \`assignments\` a ON a.id = ab.assignmentId
                     WHERE ab.operatorId = o.id
                     AND ab.status != 'STOPPED'
                     AND a.status = 'ACTIVE'
                     AND ab.startDate <= ? AND ab.endDate >= ?
                 )`,
                [fmt(thirtyDaysFromNow), fmt(startOfDay)]
            ),

            // Active assignments (currently running)
            dbTenant(
                `SELECT COUNT(*) as cnt FROM \`assignments\`
                 WHERE status = 'ACTIVE' AND startDate <= ? AND endDate >= ?`,
                [fmt(today), fmt(startOfDay)]
            ),

            // Pending (DRAFT) timesheets
            dbTenant(`SELECT COUNT(*) as cnt FROM \`timesheets\` WHERE status = 'DRAFT'`, []),

            // Vehicles with assignments (for utilization graph + snapshot) - LEFT JOIN so unassigned active fleet is represented
            dbTenant(
                `SELECT v.id, v.vehicleCode, v.status,
                        vt.name as vehicleTypeName,
                        ab.id as blockId, ab.startDate, ab.endDate,
                        a.id as assignmentId,
                        a.isInternal,
                        c.companyName as customerName,
                        p.name as projectName
                 FROM \`vehicles\` v
                 LEFT JOIN \`vehicle_types\` vt ON vt.id = v.typeId
                 LEFT JOIN \`assignment_blocks\` ab ON ab.vehicleId = v.id AND ab.status != 'STOPPED' AND ab.endDate >= ?
                    AND EXISTS (SELECT 1 FROM \`assignments\` a2 WHERE a2.id = ab.assignmentId AND a2.status = 'ACTIVE')
                 LEFT JOIN \`assignments\` a ON a.id = ab.assignmentId AND a.status = 'ACTIVE'
                 LEFT JOIN \`customers\` c ON c.id = a.customerId
                 LEFT JOIN \`projects\` p ON p.id = a.projectId
                 WHERE v.status IN ('ACTIVE','UNDER_MAINTENANCE','EXPIRED_REGISTRATION')
                 ORDER BY ab.startDate ASC
                 LIMIT 50`,
                [fmt(startOfDay)]
            ),

            // Assignments by project (for project graph)
            dbTenant(
                `SELECT a.projectId, COUNT(*) as cnt, p.name as projectName
                 FROM \`assignments\` a
                 LEFT JOIN \`projects\` p ON p.id = a.projectId
                 WHERE a.status = 'ACTIVE' AND a.startDate <= ? AND a.endDate >= ?
                 GROUP BY a.projectId, p.name
                 ORDER BY cnt DESC
                 LIMIT 10`,
                 [fmt(thirtyDaysFromNow), fmt(startOfDay)]
            ),
        ]);

        const totalVehicles = totalVehiclesRows?.[0]?.cnt ?? 0;
        const availableVehicles = availableVehiclesRows?.[0]?.cnt ?? 0;
        const assignedVehiclesMonth = assignedVehiclesMonthRows?.[0]?.cnt ?? 0;
        const activeOperators = activeOperatorsRows?.[0]?.cnt ?? 0;
        const activeAssignments = activeAssignmentsRows?.[0]?.cnt ?? 0;
        const pendingTimesheets = pendingTimesheetsRows?.[0]?.cnt ?? 0;

        // Process utilization graph — deduplicate by vehicle, take nearest block
        const seen = new Set();
        const uniqueVehicles = [];
        for (const row of (vehiclesWithAssignmentsRows || [])) {
            if (!seen.has(row.id)) {
                seen.add(row.id);
                uniqueVehicles.push(row);
            }
        }

        const vehicleUtilization = uniqueVehicles.map((v) => {
            if (!v.blockId) return null;
            const start = new Date(v.startDate) < today ? today : new Date(v.startDate);
            const end = new Date(v.endDate) > thirtyDaysFromNow ? thirtyDaysFromNow : new Date(v.endDate);
            const daysAssigned = end > start
                ? Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
                : 0;
            return { vehicleCode: v.vehicleCode, daysAssigned };
        }).filter((v) => v && v.daysAssigned > 0).sort((a, b) => b.daysAssigned - a.daysAssigned).slice(0, 10);

        const assignmentsByProject = (assignmentsByProjectRaw || []).map((a) => ({
            projectName: a.projectName || "Unknown",
            count: Number(a.cnt),
        }));

        const snapshotData = uniqueVehicles
            .filter((v) => v.blockId)
            .map((v) => {
                const end = v.endDate ? new Date(v.endDate) : null;
                const daysRemaining = end ? Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : undefined;
                return {
                    id: v.id,
                    vehicleCode: v.vehicleCode,
                    type: v.vehicleTypeName || "-",
                    status: v.status,
                    assignment: {
                        customerName: v.customerName,
                        projectName: v.projectName || "-",
                        startDate: v.startDate,
                        endDate: v.endDate,
                        isInternal: v.isInternal ?? 0,
                    },
                    daysRemaining,
                };
            });


        return NextResponse.json({
            status: "success",
            data: {
                kpis: {
                    totalVehicles,
                    availableVehicles,
                    assignedVehicles: assignedVehiclesMonth,
                    activeOperators,
                    activeAssignments,
                    pendingTimesheets,
                },
                graphs: { vehicleUtilization, assignmentsByProject },
                snapshot: snapshotData,
            },
        });
    } catch (error) {
        console.error("Dashboard Error:", error);
        return NextResponse.json({ message: "Error loading metrics" }, { status: 500 });
    }
}
