import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const [brands] = await dbTenant(`
            SELECT b.*, t.name as type_name,
                   (SELECT COUNT(*) FROM \`vehicle_models\` m WHERE m.brandId = b.id) as models_count,
                   (SELECT COUNT(*) FROM \`vehicles\` v WHERE v.brandId = b.id) as vehicles_count
            FROM \`vehicle_brands\` b
            LEFT JOIN \`vehicle_types\` t ON t.id = b.typeId
            ORDER BY b.name ASC
        `);

        const formattedBrands = (brands || []).map(b => ({
            ...b,
            type: b.typeId ? { id: b.typeId, name: b.type_name } : null,
            _count: { models: b.models_count, vehicles: b.vehicles_count }
        }));

        return NextResponse.json(formattedBrands);
    } catch (error) {
        console.error("Error fetching brands:", error);
        return NextResponse.json({ message: "Error fetching brands" }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const { name, typeId } = await req.json();
        if (!name) return NextResponse.json({ message: "Name is required" }, { status: 400 });

        const [res] = await dbTenant(`
            INSERT INTO \`vehicle_brands\` (name, typeId, createdAt, updatedAt)
            VALUES (?, ?, NOW(), NOW())
        `, [name, typeId ? parseInt(typeId) : null]);

        const [rows] = await dbTenant(`SELECT * FROM \`vehicle_brands\` WHERE id = ? LIMIT 1`, [res.insertId]);
        await logActivity("CONFIG", res.insertId, "CREATE", `Brand created: ${name}`);
        return NextResponse.json(rows[0]);
    } catch (error) {
        console.error("Error creating brand:", error);
        return NextResponse.json({ message: "Error creating brand", error: String(error) }, { status: 500 });
    }
}
