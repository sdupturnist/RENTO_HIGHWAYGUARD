import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";

export async function PUT(req, { params }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const { id } = await params;
        const data = await req.json();

        await dbTenant(`
            UPDATE \`vehicle_code_rules\`
            SET prefix = ?, startingNumber = ?, padding = ?, defaultRentCycle = ?, updatedAt = NOW()
            WHERE id = ?
        `, [data.prefix, parseInt(data.startingNumber), parseInt(data.padding), data.defaultRentCycle || "DAILY", id]);

        const [rows] = await dbTenant("SELECT * FROM `vehicle_code_rules` WHERE id = ?", [id]);
        await logActivity("CONFIG", Number(id), "UPDATE", `Vehicle code rule updated`);
        return NextResponse.json(rows[0]);
    } catch (error) {
        console.error("Error updating vehicle code rule:", error);
        return NextResponse.json({ message: "Error updating code rule" }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const { id } = await params;

        const [rows] = await dbTenant("SELECT COUNT(*) as count FROM `vehicle_code_rules`");
        if (rows[0].count <= 1) {
            return NextResponse.json({ message: "Cannot delete the last prefix rule" }, { status: 400 });
        }

        await dbTenant("DELETE FROM `vehicle_code_rules` WHERE id = ?", [id]);
        await logActivity("CONFIG", Number(id), "DELETE", `Vehicle code rule deleted`);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting vehicle code rule:", error);
        return NextResponse.json({ message: "Error deleting code rule" }, { status: 500 });
    }
}
