import { NextResponse } from "next/server";
import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import { reserveSequentialCode } from "@/app/lib/sequential-code";
import { z } from "zod";

const labourSchema = z.object({
    labourType: z.string().min(1),
    totalQuantity: z.number().min(0),
    costPerDay: z.number().min(0),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
    remarks: z.string().optional().nullable(),
});

export async function GET(req) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canView = await verifySessionPermission(session, "Labours", "View");
        if (!canView) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const [rows] = await dbTenant(`
            SELECT l.*,
                   COALESCE((
                       SELECT SUM(ab.quantity)
                       FROM \`assignment_blocks\` ab
                       INNER JOIN \`assignments\` a ON a.id = ab.assignmentId
                       WHERE ab.labourTypeId = l.id
                         AND ab.blockType = 'LABOUR'
                         AND ab.status != 'STOPPED'
                         AND a.status NOT IN ('COMPLETED')
                         AND ab.endDate >= CURDATE()
                   ), 0) as allocatedQty
            FROM \`labours\` l
            ORDER BY l.createdAt DESC, l.id DESC
        `);

        return NextResponse.json(rows.map(r => ({
            ...r,
            allocatedQty: Number(r.allocatedQty),
            availableQty: Math.max(0, Number(r.totalQuantity) - Number(r.allocatedQty)),
        })));
    } catch (error) {
        console.error("GET labours error:", error);
        return NextResponse.json({ message: "Error fetching labours" }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canAdd = await verifySessionPermission(session, "Labours", "Add");
        if (!canAdd) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const body = await req.json();
        const data = labourSchema.parse(body);

        const labourId = await withTenantTransaction(async (tx) => {
            const { code } = await reserveSequentialCode(tx, {
                tableName: "entity_code_settings",
                createSql: "INSERT INTO `entity_code_settings` (entityType, codePrefix, startingNumber, numberPadding) VALUES (?, ?, ?, ?)",
                createParams: ["LABOUR", "LAB", 1001, 4],
                whereKey: "entityType",
                whereValue: "LABOUR",
                prefixField: "codePrefix",
                numberField: "startingNumber",
                paddingField: "numberPadding",
                separator: "-",
                entityTableName: "labours",
                entityCodeField: "labourCode",
            });

            const [result] = await tx.execute(
                `INSERT INTO \`labours\` (labourCode, labourType, totalQuantity, costPerDay, status, remarks, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [code, data.labourType, data.totalQuantity, data.costPerDay, data.status, data.remarks ?? null]
            );
            return result.insertId;
        });

        await logActivity("LABOUR", labourId, "CREATE", `Created labour type: ${data.labourType}`);
        return NextResponse.json({ id: labourId, success: true }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError)
            return NextResponse.json({ message: "Validation failed", errors: error.errors }, { status: 400 });
        console.error("POST labour error:", error);
        return NextResponse.json({ message: "Error creating labour" }, { status: 500 });
    }
}
