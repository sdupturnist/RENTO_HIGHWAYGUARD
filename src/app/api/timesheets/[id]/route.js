import { NextResponse } from "next/server";
import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { verifySession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import { fetchTimesheetLines } from "@/app/lib/timesheet-helpers";

export async function GET(request, props) {
    const params = await props.params;
    const session = await verifySession();
    const canView = session ? await verifySessionPermission(session, "Timesheet", "View") : false;
    if (!session || !canView) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const id = parseInt(params.id);
        const [tsRows] = await dbTenant(`
            SELECT t.*, c.companyName, p.name as projectName
            FROM \`timesheets\` t
            LEFT JOIN \`customers\` c ON c.id = t.customerId
            LEFT JOIN \`projects\` p ON p.id = t.projectId
            WHERE t.id = ?
        `, [id]);

        const timesheet = tsRows?.[0];
        if (!timesheet) return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });

        timesheet.lines = await fetchTimesheetLines(id);

        let latestUpdate = null;
        if (timesheet.isInternal) {
            const [[row]] = await dbTenant(`
                SELECT MAX(updatedAt) as latestUpdate FROM \`daily_time_logs\`
                WHERE isInternal = 1 AND date >= ? AND date <= ?
            `, [timesheet.periodStart, timesheet.periodEnd]);
            latestUpdate = row?.latestUpdate;
        } else {
            const [[row]] = await dbTenant(`
                SELECT MAX(updatedAt) as latestUpdate FROM \`daily_time_logs\`
                WHERE customerId = ? AND (projectId = ? OR (projectId IS NULL AND ? IS NULL))
                  AND date >= ? AND date <= ?
            `, [timesheet.customerId, timesheet.projectId || null, timesheet.projectId || null, timesheet.periodStart, timesheet.periodEnd]);
            latestUpdate = row?.latestUpdate;
        }

        const isOutdated = latestUpdate && new Date(latestUpdate) > new Date(timesheet.generatedAt);

        let totalHours = 0, totalRegularHours = 0, totalOvertimeHours = 0, totalHolidayHours = 0;
        for (const line of timesheet.lines) {
            totalHours += Number(line.totalHours || 0);
            totalRegularHours += Number(line.regularHours || 0);
            totalOvertimeHours += Number(line.overtimeHours || 0);
            totalHolidayHours += Number(line.holidayHours || 0);
        }

        const [settingsRows] = await dbTenant("SELECT * FROM `timesheet_settings` LIMIT 1");
        const [companyRows] = await dbTenant("SELECT * FROM `company_settings` LIMIT 1");
        const [brandRows] = await dbTenant("SELECT * FROM `branding_settings` LIMIT 1");

        return NextResponse.json({
            ...timesheet,
            totalHours,
            totalRegularHours,
            totalOvertimeHours,
            totalHolidayHours,
            isOutdated,
            allowRegenerationBeforeInvoice: !!(settingsRows?.[0]?.allowRegenerationBeforeInvoice ?? true),
            companySettings: companyRows?.[0] || {},
            branding: brandRows?.[0] || {},
        });
    } catch (error) {
        console.error("Failed to fetch timesheet details:", error);
        return NextResponse.json({ error: "Failed to fetch timesheet details" }, { status: 500 });
    }
}

export async function DELETE(request, props) {
    const params = await props.params;
    const session = await verifySession();
    const canDelete = session ? await verifySessionPermission(session, "Timesheet", "Delete") : false;
    if (!session || !canDelete) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const id = parseInt(params.id);
        const [rows] = await dbTenant("SELECT status, approvedAt FROM `timesheets` WHERE id = ?", [id]);
        const timesheet = rows?.[0];

        if (!timesheet) return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
        if (timesheet.status === "INVOICED" || timesheet.approvedAt) {
            return NextResponse.json({ error: "Cannot delete approved or invoiced timesheet." }, { status: 403 });
        }

        await withTenantTransaction(async (tx) => {
            await tx.execute("DELETE FROM `timesheet_lines` WHERE timesheetId = ?", [id]);
            await tx.execute("DELETE FROM `timesheets` WHERE id = ?", [id]);
        });
        await logActivity("Timesheet", id, "DELETE", `Timesheet ID ${id} deleted`);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete timesheet:", error);
        return NextResponse.json({ error: "Failed to delete timesheet" }, { status: 500 });
    }
}

export async function PATCH(request, props) {
    const params = await props.params;
    const session = await verifySession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const id = parseInt(params.id);
        const body = await request.json();
        const { status, action, approvalNote, approvedAt, notes, viewMode } = body;

        let permissionAction = "Edit";
        if (action === "approve" || action === "unapprove") {
            permissionAction = "Approve";
        }
        const canPerform = await verifySessionPermission(session, "Timesheet", permissionAction);
        if (!canPerform) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const [rows] = await dbTenant("SELECT status, approvedAt FROM `timesheets` WHERE id = ?", [id]);
        if (!rows?.[0]) return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
        const freshTimesheet = rows[0];

        if (freshTimesheet.status === "INVOICED" && action !== "unapprove") {
            return NextResponse.json({ error: "Cannot modify invoiced timesheet." }, { status: 403 });
        }
        if (freshTimesheet.approvedAt && action !== "unapprove" && status !== "EXPORTED") {
            return NextResponse.json({ error: "Cannot modify approved timesheet." }, { status: 403 });
        }

        if (action === "approve") {
            await dbTenant(`
                UPDATE \`timesheets\` SET
                    approvedAt = ?, approvedBy = ?, approvalNote = ?, updatedAt = NOW()
                WHERE id = ?
            `, [approvedAt ? new Date(approvedAt) : new Date(), Number(session.userId), approvalNote || null, id]);
            await logActivity("Timesheet", id, "APPROVE", `Timesheet approved by user ${session.userId}. Note: ${approvalNote || "None"}`);
        } else if (action === "unapprove") {
            await dbTenant(`
                UPDATE \`timesheets\` SET
                    approvedAt = NULL, approvedBy = NULL, approvalNote = NULL, updatedAt = NOW()
                WHERE id = ?
            `, [id]);
            await logActivity("Timesheet", id, "UNAPPROVE", `Timesheet approval removed by user ${session.userId}.`);
        } else if (action === "update-view-mode") {
            await dbTenant("UPDATE `timesheets` SET viewMode = ?, updatedAt = NOW() WHERE id = ?", [viewMode || "DETAILED", id]);
            await logActivity("Timesheet", id, "UPDATE", `Timesheet viewMode updated to ${viewMode}`);
        } else if (action === "update-notes") {
            await dbTenant("UPDATE `timesheets` SET notes = ?, updatedAt = NOW() WHERE id = ?", [notes || null, id]);
            await logActivity("Timesheet", id, "UPDATE", "Timesheet notes updated");
        } else if (status) {
            await dbTenant("UPDATE `timesheets` SET status = ?, updatedAt = NOW() WHERE id = ?", [status, id]);
            await logActivity("Timesheet", id, "UPDATE", `Timesheet status updated to ${status}`);
        } else {
            return NextResponse.json({ error: "Status or action required" }, { status: 400 });
        }

        const [finalRows] = await dbTenant("SELECT * FROM `timesheets` WHERE id = ?", [id]);
        return NextResponse.json(finalRows[0]);
    } catch (error) {
        console.error("Failed to update timesheet:", error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
}
