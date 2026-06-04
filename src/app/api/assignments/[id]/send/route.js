import { NextResponse } from "next/server";
import { verifySession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { dbTenant } from "@/app/lib/db";
import { sendMail } from "@/app/lib/email";
import { logActivity } from "@/app/lib/logger";

export async function POST(_, { params }) {
    const session = await verifySession();
    const canView = session ? await verifySessionPermission(session, "Assignment", "List View") : false;
    if (!session || !canView) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const id = parseInt((await params).id);

    const [rows] = await dbTenant(`
        SELECT a.*, c.companyName as customer_companyName, c.email as customer_email,
               p.name as project_name
        FROM \`assignments\` a
        LEFT JOIN \`customers\` c ON c.id = a.customerId
        LEFT JOIN \`projects\` p ON p.id = a.projectId
        WHERE a.id = ? LIMIT 1
    `, [id]);

    if (!rows || rows.length === 0)
        return NextResponse.json({ message: "Not found" }, { status: 404 });
    const assignment = rows[0];

    if (!assignment.customer_email)
        return NextResponse.json({ message: "Customer has no email" }, { status: 400 });

    const [blocks] = await dbTenant(`
        SELECT b.*, v.regNo, o.name as operator_name
        FROM \`assignment_blocks\` b
        LEFT JOIN \`vehicles\` v ON v.id = b.vehicleId
        LEFT JOIN \`operators\` o ON o.id = b.operatorId
        WHERE b.assignmentId = ?
    `, [id]);

    const [brandingRows] = await dbTenant("SELECT appName FROM `branding_settings` LIMIT 1");
    const branding = brandingRows?.[0] || {};
    const appName = branding.appName || "Upturnist";

    const appInitials = appName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const startDate = assignment.startDate ? new Date(assignment.startDate).toDateString() : "-";
    const endDate = assignment.endDate ? new Date(assignment.endDate).toDateString() : "-";

    let blocksHtml = "";
    (blocks || []).forEach(block => {
        blocksHtml += `<div style="padding: 6px 0; border-bottom: 1px dashed rgba(49, 46, 129, 0.2);">
            <div>Vehicle: <strong>${block.regNo || 'N/A'}</strong></div>
            <div style="font-size: 13px; color: #4338ca;">Operator: ${block.operator_name || 'N/A'}</div>
        </div>`;
    });

    await sendMail({
        to: assignment.customer_email,
        subject: `${appName}: Assignment ${assignment.assignmentCode}`,
        template: "assignment.html",
        variables: {
            APP_INITIALS: appInitials,
            APP_NAME: appName,
            ASSIGNMENT_CODE: assignment.assignmentCode,
            CUSTOMER: assignment.customer_companyName || "-",
            PROJECT: assignment.project_name || "-",
            START_DATE: startDate,
            END_DATE: endDate,
            BLOCKS_HTML: blocksHtml
        }
    });
    await logActivity("ASSIGNMENT", id, "SENT", `Assignment ${assignment.assignmentCode} emailed to ${assignment.customer_email}`);
    return NextResponse.json({ message: "Assignment emailed successfully" });
}
