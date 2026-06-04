import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session || !session.userId)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const hasCalendarPermission = await verifySessionPermission(session, "Assignment", "Calendar View");
        if (!hasCalendarPermission)
            return NextResponse.json({ message: "Forbidden: Missing 'Calendar View' permission" }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const start = searchParams.get("start");
        const end = searchParams.get("end");
        if (!start || !end)
            return NextResponse.json({ message: "Start and End dates are required" }, { status: 400 });

        const startDate = new Date(start);
        const endDate = new Date(end);

        const [blocks] = await dbTenant(`
            SELECT b.id, b.blockType, b.startDate, b.endDate, b.status as blockStatus,
                   b.withOperator, b.vehicleId, b.operatorId,
                   b.materialId, b.labourTypeId, b.detourTemplateId, b.detourBlockId,
                   b.quantity, b.workType,
                   v.vehicleCode, vt.name as vehicleType_name,
                   o.name as operator_name,
                   mat.name as material_name,
                   lab.labourType as labour_type_name,
                   dst.name as detour_template_name,
                   a.id as assignmentId, a.isInternal,
                   p.id as project_id, p.name as project_name,
                   c.id as customer_id, c.companyName
            FROM \`assignment_blocks\` b
            LEFT JOIN \`assignments\` a ON a.id = b.assignmentId
            LEFT JOIN \`vehicles\` v ON v.id = b.vehicleId
            LEFT JOIN \`vehicle_types\` vt ON vt.id = v.typeId
            LEFT JOIN \`operators\` o ON o.id = b.operatorId
            LEFT JOIN \`materials\` mat ON mat.id = b.materialId
            LEFT JOIN \`labours\` lab ON lab.id = b.labourTypeId
            LEFT JOIN \`detour_service_templates\` dst ON dst.id = b.detourTemplateId
            LEFT JOIN \`projects\` p ON p.id = a.projectId
            LEFT JOIN \`customers\` c ON c.id = a.customerId
            WHERE b.startDate <= ? AND b.endDate >= ?
              AND a.status != 'DRAFT'
            ORDER BY b.blockType ASC, b.startDate ASC
        `, [endDate, startDate]);

        const [[vCount]] = await dbTenant(`SELECT COUNT(*) as c FROM \`vehicles\` WHERE status = 'ACTIVE'`);
        const [[oCount]] = await dbTenant(`SELECT COUNT(*) as c FROM \`operators\` WHERE status = 'ACTIVE'`);

        const [maintenances] = await dbTenant(`
            SELECT id, vehicleId, startDate, endDate, status
            FROM \`maintenances\`
            WHERE status IN ('SCHEDULED', 'IN_PROGRESS')
              AND startDate <= ?
              AND (endDate IS NULL OR endDate >= ?)
        `, [endDate, startDate]);

        const events = (blocks || []).map(block => ({
            id: block.id,
            blockType: block.blockType || 'VEHICLE',
            assignmentId: block.assignmentId,
            isInternal: !!block.isInternal,
            vehicleId: block.vehicleId,
            operatorId: block.operatorId,
            materialId: block.materialId,
            labourTypeId: block.labourTypeId,
            detourTemplateId: block.detourTemplateId,
            detourBlockId: block.detourBlockId || null,
            quantity: block.quantity,
            workType: block.workType,
            startDate: block.startDate,
            endDate: block.endDate,
            blockStatus: block.blockStatus,
            withOperator: !!block.withOperator,
            vehicle: block.vehicleId ? { code: block.vehicleCode, type: block.vehicleType_name } : null,
            operator: block.operatorId ? { name: block.operator_name } : null,
            material: block.materialId ? { name: block.material_name } : null,
            labour: block.labourTypeId ? { type: block.labour_type_name } : null,
            detourTemplate: block.detourTemplateId ? { name: block.detour_template_name } : null,
            project: block.project_id ? block.project_name : null,
            customer: block.companyName || null,
        }));

        return NextResponse.json({
            events,
            fleetTotals: {
                totalVehicles: vCount.c,
                totalOperators: oCount.c,
            },
            maintenances: maintenances || [],
        });
    } catch (error) {
        console.error("Error fetching calendar data:", error);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}
