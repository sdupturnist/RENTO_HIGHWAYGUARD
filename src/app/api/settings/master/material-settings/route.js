import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import { z } from "zod";

const schema = z.object({
    codePrefix: z.string().min(1).max(20),
    startingNumber: z.coerce.number().int().min(1),
    numberPadding: z.coerce.number().int().min(1).max(10),
});

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canView = await verifySessionPermission(session, "Settings", "View");
    if (!canView) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const [rows] = await dbTenant(`SELECT * FROM \`entity_code_settings\` WHERE entityType = 'MATERIAL' LIMIT 1`);
    return NextResponse.json(rows[0] ?? { codePrefix: "MAT", startingNumber: 1001, numberPadding: 4 });
}

export async function PUT(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canEdit = await verifySessionPermission(session, "Settings", "Edit");
    if (!canEdit) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    try {
        const body = await req.json();
        const data = schema.parse(body);
        const [rows] = await dbTenant(`SELECT id FROM \`entity_code_settings\` WHERE entityType = 'MATERIAL' LIMIT 1`);

        if (rows.length > 0) {
            await dbTenant(
                `UPDATE \`entity_code_settings\` SET codePrefix = ?, startingNumber = ?, numberPadding = ? WHERE id = ?`,
                [data.codePrefix, data.startingNumber, data.numberPadding, rows[0].id]
            );
        } else {
            await dbTenant(
                `INSERT INTO \`entity_code_settings\` (entityType, codePrefix, startingNumber, numberPadding) VALUES ('MATERIAL', ?, ?, ?)`,
                [data.codePrefix, data.startingNumber, data.numberPadding]
            );
        }

        await logActivity("SETTINGS", 0, "UPDATE", `Updated material code settings: prefix=${data.codePrefix}`);
        const [updated] = await dbTenant(`SELECT * FROM \`entity_code_settings\` WHERE entityType = 'MATERIAL' LIMIT 1`);
        return NextResponse.json(updated[0]);
    } catch (error) {
        if (error instanceof z.ZodError)
            return NextResponse.json({ message: "Validation failed", errors: error.errors }, { status: 400 });
        return NextResponse.json({ message: "Error updating settings" }, { status: 500 });
    }
}
