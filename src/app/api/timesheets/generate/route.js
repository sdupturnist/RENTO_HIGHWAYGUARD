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
        const { customerId, projectId, periodStart, periodEnd, generatedBy, isInternal, assignmentIds } = body;

        if (!isInternal && !customerId && !projectId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }
        if (!periodStart || !periodEnd) {
            return NextResponse.json({ error: "Period dates required" }, { status: 400 });
        }
        if (!assignmentIds || !Array.isArray(assignmentIds) || assignmentIds.length === 0) {
            return NextResponse.json({ error: "At least one assignment must be selected." }, { status: 400 });
        }

        const start = `${periodStart} 00:00:00`;
        const end = `${periodEnd} 23:59:59`;
        const generatedByUserId = generatedBy || session.userId || null;

        // 1. Duplicate/Overlap Protection
        let existingRows;
        if (isInternal) {
            [existingRows] = await dbTenant(`
                SELECT t.id, t.timesheetCode, t.periodStart, t.periodEnd, t.status, t.approvedAt,
                       GROUP_CONCAT(ta.assignmentId) as assignmentIdsStr
                FROM \`timesheets\` t
                LEFT JOIN \`timesheet_assignments\` ta ON t.id = ta.timesheetId
                WHERE t.isInternal = 1 AND t.periodStart <= ? AND t.periodEnd >= ?
                GROUP BY t.id
            `, [end, start]);
        } else {
            [existingRows] = await dbTenant(`
                SELECT t.id, t.timesheetCode, t.periodStart, t.periodEnd, t.status, t.approvedAt,
                       GROUP_CONCAT(ta.assignmentId) as assignmentIdsStr
                FROM \`timesheets\` t
                LEFT JOIN \`timesheet_assignments\` ta ON t.id = ta.timesheetId
                WHERE t.customerId = ? AND (t.projectId = ? OR (t.projectId IS NULL AND ? IS NULL)) AND t.isInternal = 0
                  AND t.periodStart <= ? AND t.periodEnd >= ?
                GROUP BY t.id
            `, [customerId, projectId || null, projectId || null, end, start]);
        }

        const selectedIds = assignmentIds.map(Number);
        for (const row of existingRows || []) {
            const rowAssignments = row.assignmentIdsStr ? row.assignmentIdsStr.split(",").map(Number) : [];
            const intersection = selectedIds.filter(id => rowAssignments.includes(id));
            if (intersection.length > 0) {
                const isExactMatch = selectedIds.length === rowAssignments.length && selectedIds.every(id => rowAssignments.includes(id));
                const existingPeriodStartStr = format(new Date(row.periodStart), "yyyy-MM-dd");
                const existingPeriodEndStr = format(new Date(row.periodEnd), "yyyy-MM-dd");
                const isSamePeriod = existingPeriodStartStr === periodStart && existingPeriodEndStr === periodEnd;

                if (isExactMatch && isSamePeriod) {
                    return NextResponse.json({
                        error: `A timesheet (${row.timesheetCode}) already exists for this exact same period and assignments.`,
                        existingId: row.id,
                        conflictType: "EXACT",
                        existingCode: row.timesheetCode,
                        isApproved: row.status === "INVOICED" || row.approvedAt !== null,
                        existingPeriod: `${existingPeriodStartStr} to ${existingPeriodEndStr}`
                    }, { status: 409 });
                }

                return NextResponse.json({
                    error: `Selected assignments fall under an existing timesheet (${row.timesheetCode}) for the period ${existingPeriodStartStr} to ${existingPeriodEndStr}.`,
                    existingId: row.id,
                    conflictType: "PARTIAL",
                    existingCode: row.timesheetCode,
                    existingPeriod: `${existingPeriodStartStr} to ${existingPeriodEndStr}`
                }, { status: 409 });
            }
        }

        // 2. Fetch Settings
        const [settingsRows] = await dbTenant("SELECT * FROM `company_settings` LIMIT 1");
        const companySettings = settingsRows?.[0] || {};
        let fullDayHours = Number(companySettings.fullDayHours || 8);
        let overtimeStartsAfter = Number(companySettings.overtimeStartsAfter ?? fullDayHours);
        const overtimeMultiplier = Number(companySettings.overtimeMultiplier || 1.5);
        const holidayMultiplier = Number(companySettings.holidayMultiplier || 2.0);

        if (projectId) {
            const [[proj]] = await dbTenant("SELECT fullDayHours, overtimeStartsAfter FROM `projects` WHERE id = ? LIMIT 1", [projectId]);
            if (proj) {
                if (proj.fullDayHours !== null) fullDayHours = Number(proj.fullDayHours);
                if (proj.overtimeStartsAfter !== null) overtimeStartsAfter = Number(proj.overtimeStartsAfter);
                else if (proj.fullDayHours !== null) overtimeStartsAfter = Number(proj.fullDayHours);
            }
        }

        // 3. Fetch Daily Logs — filtered by selected assignmentIds
        const { sql: logQuery, params: logParams } = buildDTLQuery({
            isInternal,
            customerId,
            projectId,
            periodStart: start,
            periodEnd: end,
            assignmentIds: selectedIds
        });
        const [logs] = await dbTenant(logQuery, logParams);
        if (!logs || logs.length === 0) return NextResponse.json({ error: "No time logs found for selected assignments in this period" }, { status: 404 });

        // 4. Aggregation — one line per resource per day (Detailed mode)
        const linesToCreate = aggregateLogsIntoLines(logs, { fullDayHours, overtimeStartsAfter, overtimeMultiplier, holidayMultiplier });

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

            // Insert assignment mappings
            for (const assignId of selectedIds) {
                await tx.execute("INSERT INTO `timesheet_assignments` (timesheetId, assignmentId) VALUES (?, ?)", [tsId, assignId]);
            }

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
            totalHours: fullTs.lines.reduce((sum, l) => {
                if (l.blockType === "OPERATOR" && l.vehicleId) return sum;
                return sum + Number(l.totalHours || 0);
            }, 0),
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
