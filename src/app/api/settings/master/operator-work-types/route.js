import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import { z } from "zod";

const schema = z.object({
    name: z.string().min(1),
    isBillable: z.boolean().default(true),
});

export async function GET(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canView = await verifySessionPermission(session, "Settings", "View");
    if (!canView) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const [rows] = await dbTenant(`SELECT * FROM \`operator_work_types\` ORDER BY isBillable DESC, name ASC`);
    return NextResponse.json(rows);
}

export async function POST(req) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const canEdit = await verifySessionPermission(session, "Settings", "Edit");
    if (!canEdit) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    try {
        const body = await req.json();
        const data = schema.parse(body);

        const [existing] = await dbTenant(`SELECT id FROM \`operator_work_types\` WHERE name = ? LIMIT 1`, [data.name]);
        if (existing.length > 0)
            return NextResponse.json({ message: "A work type with this name already exists." }, { status: 409 });

        const [result] = await dbTenant(
            `INSERT INTO \`operator_work_types\` (name, isBillable, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())`,
            [data.name, data.isBillable ? 1 : 0]
        );
        await logActivity("OPERATOR_WORK_TYPE", result.insertId, "CREATE", `Created operator work type: ${data.name}`);
        const [rows] = await dbTenant(`SELECT * FROM \`operator_work_types\` WHERE id = ?`, [result.insertId]);
        return NextResponse.json(rows[0], { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError)
            return NextResponse.json({ message: "Validation failed", errors: error.errors }, { status: 400 });
        console.error("POST operator-work-types error:", error);
        return NextResponse.json({ message: "Error creating work type" }, { status: 500 });
    }
}
