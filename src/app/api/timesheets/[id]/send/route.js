import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { verifySession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { sendMail } from "@/app/lib/email";
import { generateTimesheetPDFBuffer } from "@/app/lib/timesheet-pdf";
import { format } from "date-fns";
import { logActivity } from "@/app/lib/logger";
import { fetchTimesheetLines } from "@/app/lib/timesheet-helpers";

export async function POST(_, props) {
    const params = await props.params;
    const id = parseInt(params.id);
    const session = await verifySession();
    const canView = session ? await verifySessionPermission(session, "Timesheet", "View") : false;
    if (!session || !canView) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    try {
        const [tsRows] = await dbTenant(`
            SELECT t.*, c.companyName, c.email as customerEmail, p.name as projectName
            FROM \`timesheets\` t
            LEFT JOIN \`customers\` c ON c.id = t.customerId
            LEFT JOIN \`projects\` p ON p.id = t.projectId
            WHERE t.id = ?
        `, [id]);
        const timesheet = tsRows?.[0];
        if (!timesheet) return NextResponse.json({ message: "Not found" }, { status: 404 });
        if (timesheet.isInternal) return NextResponse.json({ message: "Cannot send internal timesheet to customer" }, { status: 400 });
        if (!timesheet.customerEmail) return NextResponse.json({ message: "Customer has no email" }, { status: 400 });

        timesheet.lines = await fetchTimesheetLines(id);

        const [brandRows] = await dbTenant("SELECT * FROM `branding_settings` LIMIT 1");
        const branding = brandRows?.[0] || {};
        const appName = branding.appName || "Upturnist";

        const [compRows] = await dbTenant("SELECT * FROM `company_settings` LIMIT 1");
        const companySettings = compRows?.[0] || {};

        const buffer = await generateTimesheetPDFBuffer({
            ...timesheet,
            totalHours: timesheet.lines.reduce((sum, l) => {
                if (l.blockType === "OPERATOR" && l.vehicleId) return sum;
                return sum + Number(l.totalHours || 0);
            }, 0),
            totalVehicles: new Set(timesheet.lines.map(l => l.vehicleId).filter(Boolean)).size,
            totalOperators: new Set(timesheet.lines.map(l => l.operatorId).filter(Boolean)).size,
            companySettings,
            branding,
        });

        const appInitials = appName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
        const periodStart = timesheet.periodStart ? format(new Date(timesheet.periodStart), "dd MMM yyyy") : "-";
        const periodEnd = timesheet.periodEnd ? format(new Date(timesheet.periodEnd), "dd MMM yyyy") : "-";

        await sendMail({
            to: timesheet.customerEmail,
            subject: `${appName}: Timesheet ${timesheet.timesheetCode}`,
            template: "timesheet.html",
            variables: {
                APP_INITIALS: appInitials,
                APP_NAME: appName,
                TIMESHEET_CODE: timesheet.timesheetCode,
                CUSTOMER: timesheet.companyName || "-",
                PROJECT: timesheet.projectName || "-",
                PERIOD_START: periodStart,
                PERIOD_END: periodEnd
            },
            attachments: [{ filename: `${timesheet.timesheetCode}.pdf`, content: buffer }],
        });

        await logActivity("TIMESHEET", id, "SENT", `Timesheet ${timesheet.timesheetCode} emailed to ${timesheet.customerEmail}`);
        return NextResponse.json({ message: "Timesheet emailed successfully" });
    } catch (error) {
        console.error("Failed to email timesheet:", error);
        return NextResponse.json({ message: "Error sending email", error: String(error) }, { status: 500 });
    }
}
