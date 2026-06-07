import { NextResponse } from "next/server";
import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { verifySession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";

export async function GET(request, { params }) {
    const { id: paramId } = await params;
    const invoiceId = parseInt(paramId);
    const session = await verifySession();
    const canView = session ? await verifySessionPermission(session, "Invoices", "View") : false;
    if (!session || !canView) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (isNaN(invoiceId)) {
        return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }
    try {
        const [rows] = await dbTenant(`
            SELECT i.*, 
                   c.companyName as customer_companyName, c.email as customer_email,
                   p.name as project_name,
                   t.timesheetCode as timesheet_timesheetCode
            FROM \`invoices\` i
            LEFT JOIN \`customers\` c ON c.id = i.customerId
            LEFT JOIN \`projects\` p ON p.id = i.projectId
            LEFT JOIN \`timesheets\` t ON t.id = i.timesheetId
            WHERE i.id = ? LIMIT 1
        `, [invoiceId]);

        if (!rows || rows.length === 0) {
            return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
        }

        const invoice = rows[0];
        const [items] = await dbTenant(`SELECT * FROM \`invoice_items\` WHERE invoiceId = ?`, [invoiceId]);
        
        return NextResponse.json({
            ...invoice,
            customer: invoice.customerId ? { id: invoice.customerId, companyName: invoice.customer_companyName, email: invoice.customer_email } : null,
            project: invoice.projectId ? { id: invoice.projectId, name: invoice.project_name } : null,
            timesheet: invoice.timesheetId ? { id: invoice.timesheetId, timesheetCode: invoice.timesheet_timesheetCode } : null,
            items: items || []
        });
    }
    catch (error) {
        console.error("Failed to fetch invoice", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    const { id: paramId } = await params;
    const session = await verifySession();
    const canDelete = session ? await verifySessionPermission(session, "Invoices", "Delete") : false;
    if (!session || !canDelete) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const id = parseInt(paramId);
    if (isNaN(id)) {
        return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }
    try {
        const [rows] = await dbTenant(`
            SELECT i.id, i.timesheetId, i.invoiceNumber, t.timesheetCode 
            FROM \`invoices\` i 
            LEFT JOIN \`timesheets\` t ON t.id = i.timesheetId
            WHERE i.id = ? LIMIT 1
        `, [id]);
        
        if (!rows || rows.length === 0) {
            return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
        }
        const invoice = rows[0];

        await withTenantTransaction(async (tx) => {
            await tx.execute(`DELETE FROM \`invoice_items\` WHERE invoiceId = ?`, [id]);
            await tx.execute(`DELETE FROM \`invoices\` WHERE id = ?`, [id]);
            
            if (invoice.timesheetId) {
                await tx.execute(
                    `UPDATE \`timesheets\` SET status = 'EXPORTED' WHERE id = ?`,
                    [invoice.timesheetId]
                );
            }
        });

        await logActivity("INVOICE", id, "DELETE", `Invoice ${invoice.invoiceNumber} deleted. Timesheet ${invoice.timesheetCode} unlocked.`);
        if (invoice.timesheetId) {
            await logActivity("TIMESHEET", invoice.timesheetId, "UNLOCKED", `Timesheet ${invoice.timesheetCode} unlocked after invoice deletion.`);
        }
        return NextResponse.json({ success: true });
    }
    catch (error) {
        console.error("Failed to delete invoice:", error);
        return NextResponse.json({ error: error.message || "Failed to delete invoice" }, { status: 500 });
    }
}

export async function PATCH(request, { params }) {
    const { id: paramId } = await params;
    const session = await verifySession();
    const canEdit = session ? await verifySessionPermission(session, "Invoices", "Edit") : false;
    if (!session || !canEdit) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const id = parseInt(paramId);
    if (isNaN(id)) {
        return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }
    try {
        const body = await request.json().catch(() => ({}));
        const { action } = body;

        const [invoiceRows] = await dbTenant("SELECT * FROM `invoices` WHERE id = ? LIMIT 1", [id]);
        const invoice = invoiceRows?.[0];
        if (!invoice) {
            return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
        }

        // Attachment update
        if (action === "update-attachment") {
            const { attachmentPath, attachmentName, isSignedTimesheet, signatureDate, lpoNumber, lpoAttachmentPath, lpoAttachmentName } = body;
            await dbTenant(`
                UPDATE \`invoices\` SET
                    attachmentPath = ?, attachmentName = ?,
                    isSignedTimesheet = ?, signatureDate = ?,
                    lpoNumber = ?, lpoAttachmentPath = ?, lpoAttachmentName = ?,
                    updatedAt = NOW()
                WHERE id = ?
            `, [
                attachmentPath ?? invoice.attachmentPath,
                attachmentName ?? invoice.attachmentName,
                isSignedTimesheet != null ? (isSignedTimesheet ? 1 : 0) : (invoice.isSignedTimesheet ?? 0),
                signatureDate || invoice.signatureDate || null,
                lpoNumber ?? invoice.lpoNumber,
                lpoAttachmentPath ?? invoice.lpoAttachmentPath,
                lpoAttachmentName ?? invoice.lpoAttachmentName,
                id,
            ]);
            await logActivity("INVOICE", id, "UPDATE", `Invoice ${invoice.invoiceNumber} attachment updated.`);
            const [updRows] = await dbTenant("SELECT * FROM `invoices` WHERE id = ? LIMIT 1", [id]);
            return NextResponse.json(updRows[0]);
        }

        // Adjustment update (existing behaviour)
        let { adjustmentAmount, adjustmentNote } = body;
        const [settingsRows] = await dbTenant("SELECT enableVat, vatPercentage FROM `company_settings` LIMIT 1");
        const companySettings = settingsRows?.[0];
        const enableVat = companySettings?.enableVat ?? false;
        const vatPercentage = enableVat ? (companySettings?.vatPercentage ?? 0) : 0;

        if (adjustmentAmount === undefined) adjustmentAmount = Number(invoice.adjustmentAmount);
        if (adjustmentNote === undefined) adjustmentNote = invoice.adjustmentNote;

        const subtotal = Number(invoice.subtotal);
        let vatAmount = 0;
        let grandTotal = subtotal;

        if (enableVat) {
            vatAmount = (subtotal * vatPercentage) / 100;
            grandTotal = subtotal + vatAmount + Number(adjustmentAmount);
        } else {
            grandTotal = subtotal + Number(adjustmentAmount);
        }

        await dbTenant(`
            UPDATE \`invoices\`
            SET vatEnabled = ?, vatPercentage = ?, vatAmount = ?, adjustmentAmount = ?, adjustmentNote = ?, grandTotal = ?, totalAmount = ?, updatedAt = NOW()
            WHERE id = ?
        `, [
            enableVat ? 1 : 0, vatPercentage, vatAmount, adjustmentAmount, adjustmentNote || null, grandTotal, grandTotal, id
        ]);

        await logActivity("INVOICE", id, "UPDATE", `Invoice ${invoice.invoiceNumber} updated.`);

        const [updRows] = await dbTenant("SELECT * FROM `invoices` WHERE id = ? LIMIT 1", [id]);
        return NextResponse.json(updRows[0]);
    }
    catch (error) {
        console.error("Failed to update invoice:", error);
        return NextResponse.json({ error: error.message || "Failed to update invoice" }, { status: 500 });
    }
}

export async function PUT(request, { params }) {
    const { id: paramId } = await params;
    const session = await verifySession();
    const canEdit = session ? await verifySessionPermission(session, "Invoices", "Edit") : false;
    if (!session || !canEdit) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const id = parseInt(paramId);
    if (isNaN(id)) {
        return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    try {
        const body = await request.json().catch(() => ({}));
        const {
            date, dueDate, notes,
            lpoNumber, lpoAttachmentPath, lpoAttachmentName,
            attachmentPath, attachmentName, isSignedTimesheet, signatureDate,
            adjustmentAmount, adjustmentNote,
            items
        } = body;

        const [invoiceRows] = await dbTenant("SELECT * FROM `invoices` WHERE id = ? LIMIT 1", [id]);
        const invoice = invoiceRows?.[0];
        if (!invoice) {
            return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
        }

        // Fetch company settings to verify VAT configuration
        const [settingsRows] = await dbTenant("SELECT enableVat, vatPercentage FROM `company_settings` LIMIT 1");
        const companySettings = settingsRows?.[0];
        // Keep invoice's own vatEnabled status or get it from company settings
        const enableVat = invoice.vatEnabled === 1;
        const vatPercentage = Number(invoice.vatPercentage || companySettings?.vatPercentage || 0);

        const updatedInvoice = await withTenantTransaction(async (tx) => {
            let subtotal = Number(invoice.subtotal);

            if (items && Array.isArray(items)) {
                // Delete existing items
                await tx.execute("DELETE FROM `invoice_items` WHERE invoiceId = ?", [id]);

                // Insert new/updated items
                subtotal = 0;
                for (const item of items) {
                    const qty = Number(item.quantity || 0);
                    const price = Number(item.unitPrice || 0);
                    const total = qty * price;
                    subtotal += total;

                    await tx.execute(`
                        INSERT INTO \`invoice_items\` 
                        (invoiceId, description, quantity, unitPrice, total, regularHours, overtimeHours, holidayHours)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        id,
                        item.description,
                        qty,
                        price,
                        total,
                        Number(item.regularHours || 0),
                        Number(item.overtimeHours || 0),
                        Number(item.holidayHours || 0)
                    ]);
                }
            }

            const vatAmount = enableVat ? (subtotal * vatPercentage / 100) : 0;
            const adjAmount = Number(adjustmentAmount !== undefined ? adjustmentAmount : invoice.adjustmentAmount || 0);
            const grandTotal = subtotal + vatAmount + adjAmount;

            await tx.execute(`
                UPDATE \`invoices\` SET
                    date = ?,
                    dueDate = ?,
                    notes = ?,
                    subtotal = ?,
                    vatEnabled = ?,
                    vatPercentage = ?,
                    vatAmount = ?,
                    adjustmentAmount = ?,
                    adjustmentNote = ?,
                    grandTotal = ?,
                    totalAmount = ?,
                    lpoNumber = ?,
                    lpoAttachmentPath = ?,
                    lpoAttachmentName = ?,
                    attachmentPath = ?,
                    attachmentName = ?,
                    isSignedTimesheet = ?,
                    signatureDate = ?,
                    updatedAt = NOW()
                WHERE id = ?
            `, [
                date ? new Date(date) : (invoice.date ? new Date(invoice.date) : null),
                dueDate ? new Date(dueDate) : null,
                notes !== undefined ? notes : invoice.notes,
                subtotal,
                enableVat ? 1 : 0,
                vatPercentage,
                vatAmount,
                adjAmount,
                adjustmentNote !== undefined ? adjustmentNote : invoice.adjustmentNote,
                grandTotal,
                grandTotal,
                lpoNumber !== undefined ? (lpoNumber || null) : (invoice.lpoNumber || null),
                lpoAttachmentPath !== undefined ? (lpoAttachmentPath || null) : (invoice.lpoAttachmentPath || null),
                lpoAttachmentName !== undefined ? (lpoAttachmentName || null) : (invoice.lpoAttachmentName || null),
                attachmentPath !== undefined ? (attachmentPath || null) : (invoice.attachmentPath || null),
                attachmentName !== undefined ? (attachmentName || null) : (invoice.attachmentName || null),
                isSignedTimesheet !== undefined ? (isSignedTimesheet ? 1 : 0) : (invoice.isSignedTimesheet ?? 0),
                signatureDate ? new Date(signatureDate) : (invoice.signatureDate ? new Date(invoice.signatureDate) : null),
                id
            ]);

            const [updatedRows] = await tx.execute("SELECT * FROM `invoices` WHERE id = ? LIMIT 1", [id]);
            return updatedRows[0];
        });

        await logActivity("INVOICE", id, "UPDATE", `Invoice ${invoice.invoiceNumber} details and items updated.`);

        return NextResponse.json(updatedInvoice);
    }
    catch (error) {
        console.error("Failed to update invoice via PUT:", error);
        return NextResponse.json({ error: error.message || "Failed to update invoice" }, { status: 500 });
    }
}

