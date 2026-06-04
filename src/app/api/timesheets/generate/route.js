import { NextResponse } from "next/server";
import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { startOfDay, endOfDay, format } from "date-fns";
import { verifySession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import { sendMail } from "@/app/lib/email";
import { reserveSequentialCode } from "@/app/lib/sequential-code";
import { fetchTimesheetLines, buildDTLQuery, aggregateLogsIntoLines, insertTimesheetLines } from "@/app/lib/timesheet-helpers";

export async function POST(request) {
    const session = await verifySession();
    const canGenerate = session ? await verifySessionPermission(session, "Timesheet", "Generate") : false;
    if (!session || !canGenerate) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });


    try {
        const body = await request.json();
        const { customerId, projectId, periodStart, periodEnd, generatedBy, force, isInternal } = body;

        if (!isInternal && !customerId && !projectId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }
        if (!periodStart || !periodEnd) {
            return NextResponse.json({ error: "Period dates required" }, { status: 400 });
        }

        const start = `${periodStart} 00:00:00`;
        const end = `${periodEnd} 23:59:59`;
        const generatedByUserId = generatedBy || session.userId || null;

        // 1. Duplicate/Overlap Protection
        let existingRows;
        if (isInternal) {
            [existingRows] = await dbTenant(`
                SELECT id, timesheetCode, periodStart, periodEnd FROM \`timesheets\`
                WHERE isInternal = 1 AND periodStart <= ? AND periodEnd >= ? AND status != 'INVOICED'
                LIMIT 1
            `, [end, start]);
        } else {
            [existingRows] = await dbTenant(`
                SELECT id, timesheetCode, periodStart, periodEnd FROM \`timesheets\`
                WHERE customerId = ? AND (projectId = ? OR (projectId IS NULL AND ? IS NULL))
                  AND periodStart <= ? AND periodEnd >= ? AND status != 'INVOICED'
                LIMIT 1
            `, [customerId, projectId || null, projectId || null, end, start]);
        }

        const existing = existingRows?.[0];
        if (existing && !force) {
            return NextResponse.json({
                error: `A timesheet (${existing.timesheetCode}) overlaps with this period.`,
                existingId: existing.id,
                conflictType: "OVERLAP",
                existingCode: existing.timesheetCode,
                existingPeriod: `${format(new Date(existing.periodStart), "yyyy-MM-dd")} to ${format(new Date(existing.periodEnd), "yyyy-MM-dd")}`
            }, { status: 409 });
        }

        // 2. Fetch Settings
        const [settingsRows] = await dbTenant("SELECT * FROM `company_settings` LIMIT 1");
        const companySettings = settingsRows?.[0] || {};
        const fullDayHours = Number(companySettings.fullDayHours || 8);
        const overtimeMultiplier = Number(companySettings.overtimeMultiplier || 1.5);
        const holidayMultiplier = Number(companySettings.holidayMultiplier || 2.0);

        // 3. Fetch Daily Logs — all block types, billable only
        const { sql: logQuery, params: logParams } = buildDTLQuery({ isInternal, customerId, projectId, periodStart: start, periodEnd: end });
        const [logs] = await dbTenant(logQuery, logParams);
        if (!logs || logs.length === 0) return NextResponse.json({ error: "No time logs found" }, { status: 404 });

        // 4. Aggregation — one line per resource per day (Detailed mode)
        const linesToCreate = aggregateLogsIntoLines(logs, { fullDayHours, overtimeMultiplier, holidayMultiplier });

        // Fetch project LPO to carry forward to timesheet
        let projectLpo = { lpoNumber: null, lpoAttachmentPath: null, lpoAttachmentName: null };
        if (!isInternal && projectId) {
            const [[proj]] = await dbTenant(
                "SELECT lpoNumber, lpoAttachmentPath, lpoAttachmentName FROM `projects` WHERE id = ? LIMIT 1",
                [projectId]
            );
            if (proj) projectLpo = proj;
        }

        // 5. Transaction
        const resultId = await withTenantTransaction(async (tx) => {
            const { code } = await reserveSequentialCode(tx, {
                tableName: "timesheet_settings",
                createSql: "INSERT INTO `timesheet_settings` (codePrefix, startingNumber, numberPadding, createdAt, updatedAt) VALUES (?, ?, ?, NOW(), NOW())",
                createParams: ["TS", 1, 5],
                prefixField: "codePrefix",
                numberField: "startingNumber",
                paddingField: "numberPadding",
                separator: "-",
                entityTableName: "timesheets",
                entityCodeField: "timesheetCode",
            });

            const [tsRes] = await tx.execute(`
                INSERT INTO \`timesheets\` (
                    timesheetCode, customerId, projectId, periodStart, periodEnd,
                    isInternal,
                    standardRateMultiplier, overtimeMultiplier, holidayMultiplier,
                    generatedBy, status,
                    lpoNumber, lpoAttachmentPath, lpoAttachmentName,
                    generatedAt, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
            `, [
                code,
                isInternal ? null : (customerId || null),
                isInternal ? null : (projectId || null),
                start, end,
                isInternal ? 1 : 0,
                1.0, overtimeMultiplier, holidayMultiplier,
                generatedByUserId, "DRAFT",
                projectLpo.lpoNumber || null,
                projectLpo.lpoAttachmentPath || null,
                projectLpo.lpoAttachmentName || null,
            ]);

            const tsId = tsRes.insertId;

            await insertTimesheetLines(tx, tsId, linesToCreate);
            return tsId;
        });

        const [finalRows] = await dbTenant("SELECT * FROM `timesheets` WHERE id = ?", [resultId]);
        const result = finalRows[0];

        await logActivity("Timesheet", result.id, "CREATE", `Timesheet ${result.timesheetCode} generated`);
        if (!isInternal) {
            sendTimesheetNotification(result).catch(err => console.error("Notification failed:", err));
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error("Failed to generate timesheet:", error);
        return NextResponse.json({ error: "Failed to generate timesheet", details: error.message }, { status: 500 });
    }
}

async function sendTimesheetNotification(timesheet) {
    const [notifRows] = await dbTenant("SELECT sendTimesheetToCustomer FROM `notification_settings` LIMIT 1");
    if (!notifRows?.[0]?.sendTimesheetToCustomer) return;
    if (!timesheet.customerId) return;

    const [custRows] = await dbTenant("SELECT companyName, email FROM `customers` WHERE id = ?", [timesheet.customerId]);
    const customer = custRows?.[0];
    if (!customer?.email) return;

    const [brandRows] = await dbTenant("SELECT appName FROM `branding_settings` LIMIT 1");
    const appName = brandRows?.[0]?.appName || "Upturnist";
    const initials = appName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

    const [tsRows] = await dbTenant(`
        SELECT t.*, c.companyName, p.name as projectName
        FROM \`timesheets\` t
        LEFT JOIN \`customers\` c ON c.id = t.customerId
        LEFT JOIN \`projects\` p ON p.id = t.projectId
        WHERE t.id = ?
    `, [timesheet.id]);
    const fullTs = tsRows?.[0];
    if (!fullTs) return;

    fullTs.lines = await fetchTimesheetLines(timesheet.id);

    let buffer = null;
    try {
        const { generateTimesheetPDFBuffer } = await import("@/app/lib/timesheet-pdf");
        const [compRows] = await dbTenant("SELECT * FROM `company_settings` LIMIT 1");
        buffer = await generateTimesheetPDFBuffer({
            ...fullTs,
            totalHours: fullTs.lines.reduce((sum, l) => sum + Number(l.totalHours || 0), 0),
            totalVehicles: new Set(fullTs.lines.map(l => l.vehicleId).filter(Boolean)).size,
            totalOperators: new Set(fullTs.lines.map(l => l.operatorId).filter(Boolean)).size,
            companySettings: compRows?.[0] || {},
            branding: brandRows?.[0] || {},
        });
    } catch (e) {
        console.error("PDF generation failed:", e);
    }

    await sendMail({
        to: customer.email,
        subject: `${appName}: Timesheet ${timesheet.timesheetCode}`,
        template: "timesheet.html",
        variables: {
            APP_NAME: appName,
            APP_INITIALS: initials,
            TIMESHEET_CODE: timesheet.timesheetCode,
            CUSTOMER: customer.companyName || "Customer",
            PROJECT: fullTs.projectName || "No project",
            PERIOD_START: new Date(timesheet.periodStart).toDateString(),
            PERIOD_END: new Date(timesheet.periodEnd).toDateString(),
        },
        attachments: buffer ? [{ filename: `${timesheet.timesheetCode}.pdf`, content: buffer }] : undefined,
    });
}
