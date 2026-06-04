import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";

export async function PATCH(request, { params }) {
    try {
        const resolvedParams = await params;
        const { id } = resolvedParams;

        if (!id) return NextResponse.json({ message: "ID is missing" }, { status: 400 });

        const expenseId = parseInt(id);
        if (isNaN(expenseId)) return NextResponse.json({ message: "Invalid ID format" }, { status: 400 });

        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const hasPermission = await verifySessionPermission(session, "Expenses", "Edit");
        if (!hasPermission) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const body = await request.json();
        const { status } = body;
        if (!status) return NextResponse.json({ message: "Status is required" }, { status: 400 });

        const [rows] = await dbTenant(`SELECT status, expenseCode FROM \`expenses\` WHERE id = ? LIMIT 1`, [expenseId]);
        if (!rows || rows.length === 0) return NextResponse.json({ message: "Expense not found" }, { status: 404 });
        const existing = rows[0];

        await dbTenant(`UPDATE \`expenses\` SET status = ?, updatedAt = NOW() WHERE id = ?`, [status, expenseId]);

        await logActivity("EXPENSES", expenseId, "STATUS_CHANGE", `Changed status for ${existing.expenseCode} from ${existing.status} to ${status}`);

        const [updRows] = await dbTenant(`SELECT * FROM \`expenses\` WHERE id = ? LIMIT 1`, [expenseId]);
        return NextResponse.json(updRows[0]);
    } catch (error) {
        console.error("Error updating expense status:", error);
        return NextResponse.json({ message: error?.message || "Error updating expense status" }, { status: 500 });
    }
}
