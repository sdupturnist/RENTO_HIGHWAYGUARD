import { NextResponse } from "next/server";
import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { generateMaintenanceCode, calculateMaintenanceStatus, validateMaintenanceCost } from "@/app/lib/maintenance-utils";
import { logActivity } from "@/app/lib/logger";

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canView = await verifySessionPermission(session, "Maintenance", "View");
        if (!canView)
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1") || 1;
        const perPage = parseInt(searchParams.get("perPage") || "50") || 50;
        const vehicleId = searchParams.get("vehicleId");
        const maintenanceTypeId = searchParams.get("maintenanceTypeId");
        const status = searchParams.get("status");
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");
        const skip = (page - 1) * perPage;

        const conditions = [];
        const params = [];
        if (vehicleId) { conditions.push("m.vehicleId = ?"); params.push(parseInt(vehicleId)); }
        if (maintenanceTypeId) { conditions.push("m.maintenanceTypeId = ?"); params.push(parseInt(maintenanceTypeId)); }
        if (status) { conditions.push("m.status = ?"); params.push(status); }
        if (dateFrom) { conditions.push("m.startDate >= ?"); params.push(`${dateFrom.substring(0, 10)} 00:00:00`); }
        if (dateTo) { conditions.push("m.startDate <= ?"); params.push(`${dateTo.substring(0, 10)} 23:59:59.999`); }

        const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

        const [maintenances] = await dbTenant(`
            SELECT m.*,
                   v.vehicleCode, v.ownership,
                   vt.name as vehicleType_name,
                   mt.name as maintenanceType_name
            FROM \`maintenances\` m
            LEFT JOIN \`vehicles\` v ON v.id = m.vehicleId
            LEFT JOIN \`vehicle_types\` vt ON vt.id = v.typeId
            LEFT JOIN \`maintenance_types\` mt ON mt.id = m.maintenanceTypeId
            ${where}
            ORDER BY m.startDate DESC
            LIMIT ${perPage} OFFSET ${skip}
        `, params);

        const [countResult] = await dbTenant(`
            SELECT COUNT(*) as total FROM \`maintenances\` m ${where}
        `, params);

        const result = (maintenances || []).map(m => ({
            ...m,
            vehicle: { vehicleCode: m.vehicleCode, ownership: m.ownership, vehicleType: { name: m.vehicleType_name } },
            maintenanceType: { name: m.maintenanceType_name },
        }));

        return NextResponse.json({
            maintenances: result,
            total: countResult[0]?.total || 0,
            page,
            perPage,
            totalPages: Math.ceil((countResult[0]?.total || 0) / perPage),
        });
    } catch (error) {
        console.error("Error fetching maintenances:", error);
        return NextResponse.json({ message: "Error fetching maintenances" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await getSession();
        if (!session)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canEdit = await verifySessionPermission(session, "Maintenance", "Edit");
        if (!canEdit)
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });


        const body = await request.json();
        const { vehicleId, maintenanceTypeId, description, startDate, endDate, amount, status } = body;

        if (!vehicleId || !maintenanceTypeId || !startDate)
            return NextResponse.json({ message: "Vehicle, maintenance type, and start date are required" }, { status: 400 });

        const [vehicleRows] = await dbTenant(`SELECT ownership FROM \`vehicles\` WHERE id = ? LIMIT 1`, [parseInt(vehicleId)]);
        const vehicle = vehicleRows?.[0];
        if (!vehicle)
            return NextResponse.json({ message: "Vehicle not found" }, { status: 404 });

        // Check for conflicting active assignment blocks
        const [conflictRows] = await dbTenant(`
            SELECT b.id, a.assignmentCode
            FROM \`assignment_blocks\` b
            JOIN \`assignments\` a ON a.id = b.assignmentId
            WHERE b.vehicleId = ?
              AND b.status = 'ACTIVE'
              AND (
                  (b.startDate <= ? AND b.endDate >= ?) OR
                  (b.startDate <= ? AND b.endDate >= ?) OR
                  (b.startDate >= ? AND b.endDate <= ?)
              )
            LIMIT 1
        `, [
            parseInt(vehicleId),
            new Date(startDate), new Date(startDate),
            endDate ? new Date(endDate) : new Date(startDate), endDate ? new Date(endDate) : new Date(startDate),
            new Date(startDate), endDate ? new Date(endDate) : new Date(startDate),
        ]);
        if (conflictRows?.[0]) {
            return NextResponse.json({
                message: `Cannot schedule maintenance. Vehicle is currently active in assignment ${conflictRows[0].assignmentCode}. Stop the assignment block first.`
            }, { status: 400 });
        }

        const costValidation = validateMaintenanceCost(vehicle.ownership, amount);
        if (!costValidation.valid)
            return NextResponse.json({ message: costValidation.error }, { status: 400 });

        const maintenanceStatus = status || calculateMaintenanceStatus(new Date(startDate));

        const maintenanceId = await withTenantTransaction(async (tx) => {
            const maintenanceCode = await generateMaintenanceCode(tx);
            const [result] = await tx.execute(
                `INSERT INTO \`maintenances\`
                 (maintenanceCode, vehicleId, maintenanceTypeId, description, startDate, endDate, amount, status, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [
                    maintenanceCode, parseInt(vehicleId), parseInt(maintenanceTypeId),
                    description || null, new Date(startDate),
                    endDate ? new Date(endDate) : null,
                    amount ? parseFloat(amount) : null, maintenanceStatus,
                ]
            );
            const newId = result.insertId;
            await tx.execute(
                `UPDATE \`vehicles\` SET status = 'UNDER_MAINTENANCE', updatedAt = NOW() WHERE id = ?`,
                [parseInt(vehicleId)]
            );
            return newId;
        });

        await logActivity("MAINTENANCE", maintenanceId, "CREATE", `Maintenance created ID: ${maintenanceId}`);

        const [rows] = await dbTenant(`
            SELECT m.*, v.vehicleCode, v.ownership, mt.name as maintenanceType_name
            FROM \`maintenances\` m
            LEFT JOIN \`vehicles\` v ON v.id = m.vehicleId
            LEFT JOIN \`maintenance_types\` mt ON mt.id = m.maintenanceTypeId
            WHERE m.id = ? LIMIT 1
        `, [maintenanceId]);
        const m = rows?.[0];
        return NextResponse.json({
            ...m,
            vehicle: { vehicleCode: m?.vehicleCode, ownership: m?.ownership },
            maintenanceType: { name: m?.maintenanceType_name },
        }, { status: 201 });
    } catch (error) {
        console.error("Error creating maintenance:", error);
        return NextResponse.json({ message: "Error creating maintenance" }, { status: 500 });
    }
}
