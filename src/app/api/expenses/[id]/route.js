import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";

export async function GET(request, { params }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canView = await verifySessionPermission(session, "Expenses", "View");
        if (!canView) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const id = parseInt((await params).id);

        const [rows] = await dbTenant(`
            SELECT e.*, 
                   et.name as expenseType_name, 
                   v.vehicleCode as vehicle_vehicleCode,
                   o.name as operator_name, o.operatorCode as operator_operatorCode,
                   p.name as project_name, p.projectCode as project_projectCode,
                   a.assignmentCode as assignment_assignmentCode
            FROM \`expenses\` e
            LEFT JOIN \`expense_types\` et ON et.id = e.expenseTypeId
            LEFT JOIN \`vehicles\` v ON v.id = e.vehicleId
            LEFT JOIN \`operators\` o ON o.id = e.operatorId
            LEFT JOIN \`projects\` p ON p.id = e.projectId
            LEFT JOIN \`assignments\` a ON a.id = e.assignmentId
            WHERE e.id = ? LIMIT 1
        `, [id]);

        if (!rows || rows.length === 0) return NextResponse.json({ message: "Expense not found" }, { status: 404 });

        const e = rows[0];
        const expense = {
            ...e,
            expenseType: { name: e.expenseType_name },
            vehicle: e.vehicleId ? { vehicleCode: e.vehicle_vehicleCode } : null,
            operator: e.operatorId ? { name: e.operator_name, operatorCode: e.operator_operatorCode } : null,
            project: e.projectId ? { name: e.project_name, projectCode: e.project_projectCode } : null,
            assignment: e.assignmentId ? { assignmentCode: e.assignment_assignmentCode } : null
        };

        return NextResponse.json(expense);
    } catch (error) {
        console.error("Error fetching expense:", error);
        return NextResponse.json({ message: "Error fetching expense" }, { status: 500 });
    }
}

export async function PUT(request, { params }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canEdit = await verifySessionPermission(session, "Expenses", "Edit");
        if (!canEdit) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const id = parseInt((await params).id);
        const body = await request.json();
        const {
            expenseTypeId, date, amount, status,
            vehicleId, operatorId, projectId, assignmentId,
            description, attachmentUrl
        } = body;

        const fields = [];
        const values = [];
        if (expenseTypeId !== undefined) { fields.push("expenseTypeId = ?"); values.push(parseInt(expenseTypeId)); }
        if (date !== undefined) { fields.push("date = ?"); values.push(new Date(date)); }
        if (amount !== undefined) { fields.push("amount = ?"); values.push(parseFloat(amount)); }
        if (status !== undefined) { fields.push("status = ?"); values.push(status); }
        if (vehicleId !== undefined) { fields.push("vehicleId = ?"); values.push(vehicleId ? parseInt(vehicleId) : null); }
        if (operatorId !== undefined) { fields.push("operatorId = ?"); values.push(operatorId ? parseInt(operatorId) : null); }
        if (projectId !== undefined) { fields.push("projectId = ?"); values.push(projectId ? parseInt(projectId) : null); }
        if (assignmentId !== undefined) { fields.push("assignmentId = ?"); values.push(assignmentId ? parseInt(assignmentId) : null); }
        if (description !== undefined) { fields.push("description = ?"); values.push(description); }
        if (attachmentUrl !== undefined) { fields.push("attachmentUrl = ?"); values.push(attachmentUrl); }
        fields.push("updatedAt = NOW()");

        const [res] = await dbTenant(`UPDATE \`expenses\` SET ${fields.join(", ")} WHERE id = ?`, [...values, id]);
        if (res.affectedRows === 0) return NextResponse.json({ message: "Expense not found" }, { status: 404 });

        const [rows] = await dbTenant(`
            SELECT e.*, et.name as expenseType_name 
            FROM \`expenses\` e 
            LEFT JOIN \`expense_types\` et ON et.id = e.expenseTypeId 
            WHERE e.id = ?
        `, [id]);
        const expense = rows[0];
        expense.expenseType = { name: expense.expenseType_name };

        await logActivity("EXPENSES", id, "UPDATE", `Updated expense ${expense.expenseCode}`);

        return NextResponse.json(expense);
    } catch (error) {
        console.error("Error updating expense:", error);
        return NextResponse.json({ message: "Error updating expense" }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canDelete = await verifySessionPermission(session, "Expenses", "Delete");
        if (!canDelete) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const id = parseInt((await params).id);

        const [rows] = await dbTenant("SELECT expenseCode FROM `expenses` WHERE id = ? LIMIT 1", [id]);
        if (!rows || rows.length === 0) return NextResponse.json({ message: "Expense not found" }, { status: 404 });
        const expense = rows[0];

        await dbTenant("DELETE FROM `expenses` WHERE id = ?", [id]);

        await logActivity("EXPENSES", id, "DELETE", `Deleted expense ${expense.expenseCode}`);

        return NextResponse.json({ success: true, message: "Expense deleted" });
    } catch (error) {
        console.error("Error deleting expense:", error);
        return NextResponse.json({ message: "Error deleting expense" }, { status: 500 });
    }
}
