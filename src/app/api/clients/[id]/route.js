import { NextResponse } from "next/server";
import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import { checkEntityUsage, buildUsageError } from "@/app/lib/entity-usage";

export async function GET(request, props) {
    const params = await props.params;
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const allowed = await verifySessionPermission(session, "Customers", "View");
    if (!allowed)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt(params.id);
    const [cRows] = await dbTenant(`SELECT * FROM \`customers\` WHERE id = ? LIMIT 1`, [id]);
    if (!cRows || cRows.length === 0)
        return NextResponse.json({ message: "Customer not found" }, { status: 404 });

    const [contacts] = await dbTenant(`SELECT * FROM \`contact_persons\` WHERE customerId = ?`, [id]);
    const [documents] = await dbTenant(`SELECT * FROM \`customer_documents\` WHERE customerId = ?`, [id]);
    const [projects] = await dbTenant(`SELECT * FROM \`projects\` WHERE customerId = ?`, [id]);

    return NextResponse.json({
        ...cRows[0],
        contacts: contacts || [],
        documents: documents || [],
        projects: projects || [],
    });
}

export async function PUT(request, props) {
    const params = await props.params;
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const allowed = await verifySessionPermission(session, "Customers", "Edit");
    if (!allowed)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt(params.id);
    const body = await request.json();

    try {
        const [existing] = await dbTenant(`SELECT id, companyName FROM \`customers\` WHERE id = ? LIMIT 1`, [id]);
        if (!existing || existing.length === 0)
            return NextResponse.json({ message: "Customer not found" }, { status: 404 });

        await withTenantTransaction(async (tx) => {
            // Update main customer record
            const fields = [];
            const values = [];
            if (body.companyName !== undefined) { fields.push("companyName = ?"); values.push(body.companyName); }
            if (body.address !== undefined) { fields.push("address = ?"); values.push(body.address); }
            if (body.email !== undefined) { fields.push("email = ?"); values.push(body.email || null); }
            if (body.website !== undefined) { fields.push("website = ?"); values.push(body.website || null); }
            if (body.phone !== undefined) { fields.push("phone = ?"); values.push(body.phone || null); }
            if (body.phoneCountryCode !== undefined) { fields.push("phoneCountryCode = ?"); values.push(body.phoneCountryCode || '+971'); }
            if (body.status !== undefined) { fields.push("status = ?"); values.push(body.status); }
            fields.push("updatedAt = NOW()");

            if (fields.length > 1) {
                await tx.execute(`UPDATE \`customers\` SET ${fields.join(", ")} WHERE id = ?`, [...values, id]);
            }

            // Replace contacts if provided
            if (Array.isArray(body.contacts)) {
                await tx.execute(`DELETE FROM \`contact_persons\` WHERE customerId = ?`, [id]);
                for (const c of body.contacts) {
                    await tx.execute(
                        `INSERT INTO \`contact_persons\` (customerId, name, designation, email, phone, phoneCountryCode, isPrimary) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [id, c.name, c.designation || null, c.email || null, c.phone || null, c.phoneCountryCode || '+971', c.isPrimary ? 1 : 0]
                    );
                }
            }

            // Replace documents if provided
            if (Array.isArray(body.documents)) {
                await tx.execute(`DELETE FROM \`customer_documents\` WHERE customerId = ?`, [id]);
                for (const d of body.documents) {
                    await tx.execute(
                        `INSERT INTO \`customer_documents\` (customerId, name, url, expiryDate, createdAt) VALUES (?, ?, ?, ?, NOW())`,
                        [id, d.name || "", d.url, d.expiryDate ? new Date(d.expiryDate) : null]
                    );
                }
            }
        });

        const [updRows] = await dbTenant(`SELECT * FROM \`customers\` WHERE id = ? LIMIT 1`, [id]);
        const [contacts] = await dbTenant(`SELECT * FROM \`contact_persons\` WHERE customerId = ?`, [id]);
        const [documents] = await dbTenant(`SELECT * FROM \`customer_documents\` WHERE customerId = ?`, [id]);

        await logActivity("CUSTOMER", id, "UPDATE", `Updated customer: ${updRows[0].companyName}`);

        return NextResponse.json({
            ...updRows[0],
            contacts: contacts || [],
            documents: documents || [],
        });
    } catch (error) {
        console.error("Error updating customer:", error);
        return NextResponse.json({ message: "Error updating customer" }, { status: 500 });
    }
}

export async function DELETE(request, props) {
    const params = await props.params;
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const allowed = await verifySessionPermission(session, "Customers", "Delete");
    if (!allowed)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const id = parseInt(params.id);
    try {
        const [cRows] = await dbTenant(`SELECT companyName, customerCode FROM \`customers\` WHERE id = ? LIMIT 1`, [id]);
        if (!cRows || cRows.length === 0)
            return NextResponse.json({ message: "Customer not found" }, { status: 404 });
        const customer = cRows[0];

        const { inUse, usedIn, counts } = await checkEntityUsage("customer", id);
        if (inUse)
            return NextResponse.json({ message: buildUsageError(usedIn, counts) }, { status: 409 });

        await withTenantTransaction(async (tx) => {
            await tx.execute(`DELETE FROM \`contact_persons\` WHERE customerId = ?`, [id]);
            await tx.execute(`DELETE FROM \`customer_documents\` WHERE customerId = ?`, [id]);
            await tx.execute(`DELETE FROM \`customers\` WHERE id = ?`, [id]);
        });

        await logActivity("CUSTOMER", id, "DELETE", `Deleted customer: ${customer.companyName} (${customer.customerCode})`);

        return NextResponse.json({ message: "Customer deleted successfully." });
    } catch (error) {
        console.error("Error deleting customer:", error);
        return NextResponse.json({ message: "Error deleting customer" }, { status: 500 });
    }
}
