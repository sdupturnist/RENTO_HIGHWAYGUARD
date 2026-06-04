import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { verifySession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";

export async function GET(request) {
    const session = await verifySession();
    const canView = session ? await verifySessionPermission(session, "Invoices", "View") : false;
    if (!session || !canView) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const [invoices] = await dbTenant(`
            SELECT i.*, 
                   c.companyName as customer_companyName, 
                   p.name as project_name,
                   t.timesheetCode as timesheet_timesheetCode
            FROM \`invoices\` i
            LEFT JOIN \`customers\` c ON i.customerId = c.id
            LEFT JOIN \`projects\` p ON i.projectId = p.id
            LEFT JOIN \`timesheets\` t ON i.timesheetId = t.id
            ORDER BY i.createdAt DESC
        `);

        // Format for frontend
        const formatted = invoices.map(i => ({
            ...i,
            customer: i.customer_companyName ? { companyName: i.customer_companyName } : null,
            project: i.project_name ? { name: i.project_name } : null,
            timesheet: i.timesheet_timesheetCode ? { timesheetCode: i.timesheet_timesheetCode } : null,
        }));

        return NextResponse.json(formatted);
    }
    catch (error) {
        console.error("Failed to fetch invoices:", error);
        return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await verifySession();
    const canEdit = session ? await verifySessionPermission(session, "Invoices", "Edit") : false;
    if (!session || !canEdit) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { timesheetId, date, dueDate, reference, notes, applyVat } = body;

        if (!timesheetId) return NextResponse.json({ error: "timesheetId is required" }, { status: 400 });
        if (!date || isNaN(new Date(date).getTime())) return NextResponse.json({ error: "Valid invoice date is required" }, { status: 400 });
        if (!dueDate || isNaN(new Date(dueDate).getTime())) return NextResponse.json({ error: "Valid due date is required" }, { status: 400 });

        // 1. Fetch Timesheet with Relations for Aggregation
        const [timesheetRows] = await dbTenant(`
            SELECT t.*, c.companyName as customer_companyName, p.name as project_name
            FROM \`timesheets\` t
            LEFT JOIN \`customers\` c ON t.customerId = c.id
            LEFT JOIN \`projects\` p ON t.projectId = p.id
            WHERE t.id = ?
        `, [timesheetId]);
        const timesheet = timesheetRows[0];

        if (!timesheet) {
            return NextResponse.json({ error: "Timesheet not found" }, { status: 404 });
        }

        if (timesheet.isInternal) {
            return NextResponse.json({ error: "Internal timesheets cannot be invoiced." }, { status: 400 });
        }

        const [existingInvoiceRows] = await dbTenant("SELECT id FROM `invoices` WHERE timesheetId = ?", [timesheetId]);
        if (existingInvoiceRows.length > 0 || timesheet.status === "INVOICED") {
            return NextResponse.json({ error: "Timesheet is already invoiced" }, { status: 400 });
        }

        // 2. Fetch Timesheet Lines with all resource types
        const [lines] = await dbTenant(`
            SELECT l.*,
                   v.vehicleCode, vt.name as vehicleTypeName, v.baseRentType,
                   o.name as operatorName, o.operatorCode,
                   mat.name as materialName,
                   lab.labourType as labourTypeName,
                   ab.bundleBilling, dst.name as detourTemplateName
            FROM \`timesheet_lines\` l
            LEFT JOIN \`vehicles\` v ON l.vehicleId = v.id
            LEFT JOIN \`vehicle_types\` vt ON v.typeId = vt.id
            LEFT JOIN \`operators\` o ON l.operatorId = o.id
            LEFT JOIN \`materials\` mat ON mat.id = l.materialId
            LEFT JOIN \`labours\` lab ON lab.id = l.labourTypeId
            LEFT JOIN \`assignment_blocks\` ab ON ab.id = l.detourBlockId
            LEFT JOIN \`detour_service_templates\` dst ON dst.id = ab.detourTemplateId
            WHERE l.timesheetId = ?
            ORDER BY l.date ASC
        `, [timesheetId]);

        // Fetch Company Settings (needed for fullDayHours in daily vehicle pricing calculations)
        const [settingsRows] = await dbTenant("SELECT enableVat, vatPercentage, fullDayHours FROM `company_settings` LIMIT 1");
        const companySettings = settingsRows[0];
        const fullDayHours = Number(companySettings?.fullDayHours || 8);

        const invoiceItemsData = [];
        let totalInvoiceAmount = 0;
        const groups = {};

        for (const line of lines) {
            const bt = line.blockType || "VEHICLE";
            const isBundled = line.detourBlockId && line.bundleBilling;

            let key, description;
            if (isBundled) {
                key = `BUNDLE-${line.detourBlockId}`;
                description = line.detourTemplateName || "Detour Service";
            } else if (bt === "VEHICLE" || !line.blockType) {
                const vc = line.vehicleCode || line.resourceNameSnapshot || "N/A";
                const op = line.operatorCode || "NO_OP";
                key = `V-${vc}-${op}`;
                description = `${line.vehicleTypeName || "Vehicle"} - ${vc}${line.operatorName ? ` (${line.operatorName})` : " (No Operator)"}`;
            } else if (bt === "OPERATOR") {
                key = `OP-${line.operatorId}`;
                description = `Operator: ${line.operatorName || line.resourceNameSnapshot || "N/A"}`;
            } else if (bt === "MATERIAL") {
                key = `MAT-${line.materialId}`;
                description = `Material: ${line.materialName || line.resourceNameSnapshot || "N/A"}`;
            } else if (bt === "LABOUR") {
                key = `LAB-${line.labourTypeId}`;
                description = `Labour: ${line.labourTypeName || line.resourceNameSnapshot || "N/A"}`;
            } else {
                key = `OTHER-${line.id}`;
                description = line.resourceNameSnapshot || "Unknown";
            }

            if (!groups[key]) {
                groups[key] = {
                    description,
                    blockType: isBundled ? "BUNDLE" : bt,
                    baseRentType: line.baseRentType || null,
                    regularHours: 0, overtimeHours: 0, holidayHours: 0,
                    quantity: 0,
                    totalAmount: 0,
                };
            }

            const g = groups[key];
            g.regularHours += Number(line.regularHours || 0);
            g.overtimeHours += Number(line.overtimeHours || 0);
            g.holidayHours += Number(line.holidayHours || 0);
            g.quantity += Number(line.quantity || 0);
            g.totalAmount += Number(line.calculatedAmount || 0);
        }

        for (const key in groups) {
            const g = groups[key];
            const bt = g.blockType;
            let quantity, unitPrice;

            if (bt === "MATERIAL" || bt === "LABOUR") {
                quantity = g.quantity || 1;
                unitPrice = quantity > 0 ? g.totalAmount / quantity : g.totalAmount;
            } else if (bt === "VEHICLE" && g.baseRentType === "DAILY") {
                const totalHours = g.regularHours + g.overtimeHours + g.holidayHours;
                quantity = totalHours / fullDayHours;
                unitPrice = quantity > 0 ? g.totalAmount / quantity : g.totalAmount;
                g.description += " (Days)";
            } else {
                const totalHours = g.regularHours + g.overtimeHours + g.holidayHours;
                quantity = totalHours > 0 ? totalHours : 1;
                unitPrice = totalHours > 0 ? g.totalAmount / totalHours : g.totalAmount;
            }

            invoiceItemsData.push({
                description: g.description,
                quantity: parseFloat(quantity.toFixed(4)),
                unitPrice: parseFloat(unitPrice.toFixed(4)),
                total: g.totalAmount,
                regularHours: g.regularHours,
                overtimeHours: g.overtimeHours,
                holidayHours: g.holidayHours,
            });
            totalInvoiceAmount += g.totalAmount;
        }

        // 3. VAT logic
        const useVat = applyVat === undefined ? !!companySettings?.enableVat : Boolean(applyVat && companySettings?.enableVat);
        const vatPercentage = useVat ? (Number(companySettings?.vatPercentage) || 0) : 0;
        const subtotal = totalInvoiceAmount;
        const vatAmount = useVat ? (subtotal * vatPercentage / 100) : 0;
        const grandTotal = subtotal + vatAmount;

        const { withTenantTransaction } = await import("@/app/lib/db");
        const invoiceId = await withTenantTransaction(async (tx) => {
            // Re-check status inside transaction
            const [fresh] = await tx.execute("SELECT status FROM `timesheets` WHERE id = ? FOR UPDATE", [timesheetId]);
            if (!fresh[0] || fresh[0].status === "INVOICED") throw new Error("Timesheet already invoiced");

            const [invSettings] = await tx.execute("SELECT * FROM `invoice_settings` LIMIT 1");
            const { reserveSequentialCode } = await import("@/app/lib/sequential-code");
            const { code: invoiceNumber } = await reserveSequentialCode(tx, {
                tableName: "invoice_settings",
                createSql: "INSERT INTO `invoice_settings` (codePrefix, startingNumber, numberPadding, createdAt, updatedAt) VALUES (?, ?, ?, NOW(), NOW())",
                createParams: ["INV", 1, 5],
                prefixField: "codePrefix", numberField: "startingNumber", paddingField: "numberPadding", separator: "-",
                entityTableName: "invoices",
                entityCodeField: "invoiceNumber",
            });

            const [invResult] = await tx.execute(`
                INSERT INTO \`invoices\`
                (invoiceNumber, date, dueDate, reference, notes, customerId, projectId, timesheetId,
                 subtotal, vatEnabled, vatPercentage, vatAmount, grandTotal, totalAmount,
                 periodStart, periodEnd, status,
                 lpoNumber, lpoAttachmentPath, lpoAttachmentName,
                 createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
                invoiceNumber, new Date(date), new Date(dueDate), reference, notes,
                timesheet.customerId, timesheet.projectId, timesheetId,
                subtotal, useVat ? 1 : 0, vatPercentage, vatAmount, grandTotal, grandTotal,
                timesheet.periodStart, timesheet.periodEnd, "GENERATED",
                timesheet.lpoNumber || null,
                timesheet.lpoAttachmentPath || null,
                timesheet.lpoAttachmentName || null,
            ]);

            const newInvoiceId = invResult.insertId;

            for (const item of invoiceItemsData) {
                await tx.execute(`
                    INSERT INTO \`invoice_items\` 
                    (invoiceId, description, quantity, unitPrice, total, regularHours, overtimeHours, holidayHours)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [newInvoiceId, item.description, item.quantity, item.unitPrice, item.total, item.regularHours, item.overtimeHours, item.holidayHours]);
            }

            if (invSettings[0]?.lockTimesheetOnCreate !== false) {
                await tx.execute("UPDATE `timesheets` SET status = 'INVOICED', updatedAt = NOW() WHERE id = ?", [timesheetId]);
            }

            return newInvoiceId;
        });

        await logActivity("INVOICE", invoiceId, "CREATE", `Invoice created for timesheet ${timesheet.timesheetCode}`);
        sendInvoiceNotification(invoiceId).catch(err => console.error("Notification failed:", err));

        return NextResponse.json({ success: true, invoiceId });
    }
    catch (error) {
        console.error("Failed to create invoice:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

async function sendInvoiceNotification(invoiceId) {
    const [notifRows] = await dbTenant("SELECT * FROM `notification_settings` LIMIT 1");
    const notif = notifRows[0];
    if (!notif?.sendInvoiceToCustomer) return;

    const [invRows] = await dbTenant(`
        SELECT i.*, c.email as customerEmail, c.companyName as customerName, p.name as projectName, t.timesheetCode
        FROM \`invoices\` i
        JOIN \`customers\` c ON i.customerId = c.id
        LEFT JOIN \`projects\` p ON i.projectId = p.id
        LEFT JOIN \`timesheets\` t ON i.timesheetId = t.id
        WHERE i.id = ?
    `, [invoiceId]);
    const invoice = invRows[0];
    if (!invoice?.customerEmail) return;

    const [brandingRows] = await dbTenant("SELECT appName FROM `branding_settings` LIMIT 1");
    const appName = brandingRows[0]?.appName || "RentERP";
    const initials = appName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

    let attachments = [];
    try {
        const { generateInvoicePDFBuffer } = await import("@/app/lib/pdfGenerator");
        const [compRows] = await dbTenant("SELECT * FROM `company_settings` LIMIT 1");
        const [itemRows] = await dbTenant("SELECT * FROM `invoice_items\` WHERE invoiceId = ?", [invoiceId]);
        
        const fullInvoice = { ...invoice, items: itemRows, customer: { companyName: invoice.customerName }, project: { name: invoice.projectName } };
        const invoiceBuffer = await generateInvoicePDFBuffer(fullInvoice, compRows[0], brandingRows[0]);
        attachments.push({ filename: `${invoice.invoiceNumber}.pdf`, content: invoiceBuffer });

        if (notif.attachTimesheetWithInvoice && invoice.timesheetId) {
            const { generateTimesheetPDFBuffer } = await import("@/app/lib/timesheet-pdf");
            const [tsRows] = await dbTenant(`
                SELECT t.*, c.companyName as customer_companyName, p.name as project_name
                FROM \`timesheets\` t
                LEFT JOIN \`customers\` c ON t.customerId = c.id
                LEFT JOIN \`projects\` p ON t.projectId = p.id
                WHERE t.id = ?
            `, [invoice.timesheetId]);
            const [lineRows] = await dbTenant(`
                SELECT l.*, v.vehicleCode, m.name as modelName, o.name as operatorName,
                       mat.name as materialName, lab.labourType as labourTypeName
                FROM \`timesheet_lines\` l
                LEFT JOIN \`vehicles\` v ON l.vehicleId = v.id
                LEFT JOIN \`vehicle_models\` m ON v.modelId = m.id
                LEFT JOIN \`operators\` o ON l.operatorId = o.id
                LEFT JOIN \`materials\` mat ON mat.id = l.materialId
                LEFT JOIN \`labours\` lab ON lab.id = l.labourTypeId
                WHERE l.timesheetId = ?
            `, [invoice.timesheetId]);

            const tsBuffer = await generateTimesheetPDFBuffer({
                ...tsRows[0],
                customer: { companyName: tsRows[0].customer_companyName },
                project: { name: tsRows[0].project_name },
                lines: lineRows.map(l => ({
                    ...l,
                    vehicle: l.vehicleId ? { vehicleCode: l.vehicleCode, model: { name: l.modelName } } : null,
                    operator: l.operatorId ? { name: l.operatorName } : null,
                    material: l.materialId ? { name: l.materialName } : null,
                    labour: l.labourTypeId ? { labourType: l.labourTypeName } : null,
                })),
                totalHours: lineRows.reduce((s, l) => s + Number(l.totalHours || 0), 0),
                totalVehicles: new Set(lineRows.filter(l => l.vehicleId).map(l => l.vehicleId)).size,
                totalOperators: new Set(lineRows.filter(l => l.operatorId).map(l => l.operatorId)).size,
                companySettings: compRows[0],
                branding: brandingRows[0]
            });
            attachments.push({ filename: `${invoice.timesheetCode}.pdf`, content: tsBuffer });
        }
    } catch (e) {
        console.error("PDF attachment failed:", e);
    }

    const { sendMail } = await import("@/app/lib/email");
    await sendMail({
        to: invoice.customerEmail,
        subject: `${appName}: Invoice ${invoice.invoiceNumber}`,
        template: "invoice.html",
        variables: {
            APP_NAME: appName,
            APP_INITIALS: initials,
            INVOICE_NUMBER: invoice.invoiceNumber,
            CUSTOMER: invoice.customerName,
            PROJECT: invoice.projectName || "No project",
            INVOICE_DATE: new Date(invoice.date).toDateString(),
            DUE_DATE: invoice.dueDate ? new Date(invoice.dueDate).toDateString() : "N/A",
            TOTAL: String(invoice.grandTotal),
        },
        attachments: attachments.length > 0 ? attachments : undefined,
    });
}

