import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";

export async function GET(req) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const brandId = searchParams.get("brandId");

        let query = `
            SELECT m.*, b.name as brand_name,
                   (SELECT COUNT(*) FROM \`vehicles\` v WHERE v.modelId = m.id) as vehicles_count
            FROM \`vehicle_models\` m
            LEFT JOIN \`vehicle_brands\` b ON b.id = m.brandId
        `;
        const params = [];
        if (brandId) {
            query += " WHERE m.brandId = ?";
            params.push(parseInt(brandId));
        }
        query += " ORDER BY m.name ASC";

        const [models] = await dbTenant(query, params);

        const formattedModels = (models || []).map(m => ({
            ...m,
            brand: m.brandId ? { id: m.brandId, name: m.brand_name } : null,
            _count: { vehicles: m.vehicles_count }
        }));

        return NextResponse.json(formattedModels);
    } catch (error) {
        console.error("Error fetching models:", error);
        return NextResponse.json({ message: "Error fetching models" }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const { name, brandId } = await req.json();
        if (!name || !brandId) return NextResponse.json({ message: "Name and Brand ID are required" }, { status: 400 });

        const [res] = await dbTenant(`
            INSERT INTO \`vehicle_models\` (name, brandId, createdAt, updatedAt)
            VALUES (?, ?, NOW(), NOW())
        `, [name, parseInt(brandId)]);

        const [rows] = await dbTenant(`SELECT * FROM \`vehicle_models\` WHERE id = ? LIMIT 1`, [res.insertId]);
        await logActivity("CONFIG", res.insertId, "CREATE", `Vehicle model created: ${name}`);
        return NextResponse.json(rows[0]);
    } catch (error) {
        console.error("Error creating model:", error);
        return NextResponse.json({ message: "Error creating model" }, { status: 500 });
    }
}
