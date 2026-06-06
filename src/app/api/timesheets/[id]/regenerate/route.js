import { NextResponse } from "next/server";
import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { verifySession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import { buildDTLQuery, aggregateLogsIntoLines, insertTimesheetLines } from "@/app/lib/timesheet-helpers";

export async function POST(request, props) {
    const params = await props.params;
    const session = await verifySession();
    const canRegenerate = session ? await verifySessionPermission(session, "Timesheet", "Regenerate") : false;
    if (!session || !canRegenerate) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const id = parseInt(params.id);
        const [tsRows] = await dbTenant("SELECT * FROM `timesheets` WHERE id = ?", [id]);
        const timesheet = tsRows?.[0];
        if (!timesheet) return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });

        if (timesheet.status === "INVOICED" || timesheet.approvedAt) {
            return NextResponse.json({ error: "Cannot regenerate approved or invoiced timesheet." }, { status: 403 });
        }

        const [tsSettingsRows] = await dbTenant("SELECT * FROM `timesheet_settings` LIMIT 1");
        const timesheetSettings = tsSettingsRows?.[0] || {};
        if (timesheetSettings.allowRegenerationBeforeInvoice === false) {
            return NextResponse.json({ error: "Regeneration is disabled in settings." }, { status: 403 });
        }

        const [settingsRows] = await dbTenant("SELECT * FROM `company_settings` LIMIT 1");
        const companySettings = settingsRows?.[0] || {};
        const fullDayHours = Number(companySettings.fullDayHours || 8);
        const overtimeMultiplier = Number(companySettings.overtimeMultiplier || 1.5);
        const holidayMultiplier = Number(companySettings.holidayMultiplier || 2.0);

        const isInternal = !!timesheet.isInternal;

        const formatDBDate = (date) => {
            if (!date) return null;
            const d = new Date(date);
            if (isNaN(d.getTime())) return null;
            const y = d.getUTCFullYear();
            const m = String(d.getUTCMonth() + 1).padStart(2, '0');
            const dStr = String(d.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${dStr}`;
        };
        
        const periodStartStr = `${formatDBDate(timesheet.periodStart)} 00:00:00`;
        const periodEndStr = `${formatDBDate(timesheet.periodEnd)} 23:59:59`;

        const { sql: logQuery, params: logParams } = buildDTLQuery({
            isInternal,
            customerId: timesheet.customerId,
            projectId: timesheet.projectId,
            periodStart: periodStartStr,
            periodEnd: periodEndStr
        });
        const [logs] = await dbTenant(logQuery, logParams);
        if (!logs || logs.length === 0) return NextResponse.json({ error: "No time logs found for the period anymore." }, { status: 404 });

        const linesToCreate = aggregateLogsIntoLines(logs, { fullDayHours, overtimeMultiplier, holidayMultiplier });

        await withTenantTransaction(async (tx) => {
            await tx.execute("DELETE FROM `timesheet_lines` WHERE timesheetId = ?", [id]);
            await tx.execute(`
                UPDATE \`timesheets\` SET
                    standardRateMultiplier = ?, overtimeMultiplier = ?, holidayMultiplier = ?,
                    generatedBy = ?, generatedAt = NOW(), updatedAt = NOW()
                WHERE id = ?
            `, [1.0, overtimeMultiplier, holidayMultiplier, Number(session.userId), id]);

            await insertTimesheetLines(tx, id, linesToCreate);
        });

        const [finalRows] = await dbTenant("SELECT * FROM `timesheets` WHERE id = ?", [id]);
        await logActivity("TIMESHEET", id, "REGENERATE", `Timesheet ${timesheet.timesheetCode} regenerated`);
        return NextResponse.json(finalRows[0]);
    } catch (error) {
        console.error("Failed to regenerate timesheet:", error);
        return NextResponse.json({ error: "Failed to regenerate timesheet" }, { status: 500 });
    }
}
