import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";

export async function PUT(request, props) {
    const params = await props.params;
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const body = await request.json();
        const { isActive, name } = body;
        const id = parseInt(params.id);

        let updateClause = "updatedAt = NOW()";
        const updateParams = [];
        if (isActive !== undefined) {
            updateClause += ", isActive = ?";
            updateParams.push(isActive ? 1 : 0);
        }
        if (name !== undefined) {
            updateClause += ", name = ?";
            updateParams.push(name.trim());
        }
        updateParams.push(id);

        await dbTenant(`UPDATE \`expense_types\` SET ${updateClause} WHERE id = ?`, updateParams);

        const [rows] = await dbTenant("SELECT * FROM `expense_types` WHERE id = ?", [id]);
        await logActivity("EXPENSE_TYPE", id, "UPDATE", `Updated expense type: ${rows[0]?.name ?? id}`);
        return NextResponse.json(rows[0]);
    } catch (error) {
        if (error?.code === "ER_DUP_ENTRY") {
            return NextResponse.json({ message: "Expense type name already exists" }, { status: 400 });
        }
        console.error("Error updating expense type:", error);
        return NextResponse.json({ message: "Error updating expense type" }, { status: 500 });
    }
}

export async function DELETE(request, props) {
    const params = await props.params;
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const id = parseInt(params.id);

        const [[{ count }]] = await dbTenant("SELECT COUNT(*) as count FROM `expenses` WHERE expenseTypeId = ?", [id]);
        if (count > 0) {
            return NextResponse.json(
                { message: "Cannot delete expense type because it is used in existing expenses." },
                { status: 400 }
            );
        }

        const [etRows] = await dbTenant("SELECT name FROM `expense_types` WHERE id = ? LIMIT 1", [id]);
        const etName = etRows?.[0]?.name ?? id;
        await dbTenant("DELETE FROM `expense_types` WHERE id = ?", [id]);
        await logActivity("EXPENSE_TYPE", id, "DELETE", `Deleted expense type: ${etName}`);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting expense type:", error);
        return NextResponse.json({ message: "Error deleting expense type" }, { status: 500 });
    }
}
