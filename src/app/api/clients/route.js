import { NextResponse } from "next/server";
import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { z } from "zod";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import { reserveSequentialCode } from "@/app/lib/sequential-code";
import { revalidatePath } from "next/cache";

const contactSchema = z.object({
    name: z.string().min(1),
    designation: z.string().optional(),
    email: z.string().optional().or(z.literal("")),
    phone: z.string().optional(),
    phoneCountryCode: z.string().optional(),
    isPrimary: z.coerce.boolean().default(false),
});
const documentSchema = z.object({
    name: z.string().optional(),
    url: z.string().min(1),
    expiryDate: z.string().optional().nullable(),
});
const createCustomerSchema = z.object({
    companyName: z.string().min(1),
    address: z.string().optional(),
    email: z.string().optional().or(z.literal("")),
    website: z.string().optional(),
    phone: z.string().optional(),
    phoneCountryCode: z.string().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
    contacts: z.array(contactSchema).optional(),
    documents: z.array(documentSchema).optional(),
});

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const allowed = await verifySessionPermission(session, "Customers", "View");
        if (!allowed)
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const hasActiveAssignments = searchParams.get("hasActiveAssignments") === "true";

        let sql = `
            SELECT c.*,
                   COUNT(DISTINCT p.id) as projectCount
            FROM \`customers\` c
            LEFT JOIN \`projects\` p ON p.customerId = c.id
        `;
        const params = [];
        const conditions = [];

        if (status) {
            conditions.push("c.status = ?");
            params.push(status);
        }
        if (hasActiveAssignments) {
            conditions.push(`EXISTS (
                SELECT 1 FROM \`assignments\` a
                JOIN \`projects\` ap ON ap.id = a.projectId
                WHERE ap.customerId = c.id AND a.status IN ('ACTIVE', 'COMPLETED')
            )`);
        }
        if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
        sql += " GROUP BY c.id ORDER BY c.companyName ASC";

        const [customers] = await dbTenant(sql, params);

        const customerIds = (customers || []).map((c) => c.id);
        const contactsByCustomer = {};
        if (customerIds.length > 0) {
            const placeholders = customerIds.map(() => "?").join(",");
            const [allContacts] = await dbTenant(`SELECT * FROM \`contact_persons\` WHERE customerId IN (${placeholders})`, customerIds);
            for (const contact of allContacts) {
                if (!contactsByCustomer[contact.customerId]) contactsByCustomer[contact.customerId] = [];
                contactsByCustomer[contact.customerId].push(contact);
            }
        }

        const enriched = (customers || []).map((cust) => ({
            ...cust,
            contacts: contactsByCustomer[cust.id] || [],
            _count: { projects: Number(cust.projectCount) },
        }));

        return NextResponse.json(enriched);
    } catch (error) {
        console.error("Error fetching customers:", error);
        return NextResponse.json({ message: "Error fetching customers" }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const allowed = await verifySessionPermission(session, "Customers", "Edit");
    if (!allowed)
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });


    try {
        const body = await request.json();
        const data = createCustomerSchema.parse(body);

        const customerId = await withTenantTransaction(async (tx) => {
            const { code } = await reserveSequentialCode(tx, {
                tableName: "customer_code_rules",
                createSql: "INSERT INTO `customer_code_rules` (prefix, startingNumber, padding, updatedAt) VALUES (?, ?, ?, NOW())",
                createParams: ["CST", 1001, 4],
                separator: "-",
                entityTableName: "customers",
                entityCodeField: "customerCode",
            });

            const [result] = await tx.execute(
                `INSERT INTO \`customers\` (customerCode, companyName, address, email, website, phone, phoneCountryCode, status, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [code, data.companyName, data.address || null, data.email || null,
                 data.website || null, data.phone || null, data.phoneCountryCode || '+971', data.status]
            );
            const newId = result.insertId;

            if (data.contacts?.length > 0) {
                for (const contact of data.contacts) {
                    await tx.execute(
                        `INSERT INTO \`contact_persons\` (name, designation, email, phone, phoneCountryCode, isPrimary, customerId)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [contact.name, contact.designation || null, contact.email || null,
                         contact.phone || null, contact.phoneCountryCode || '+971', contact.isPrimary ? 1 : 0, newId]
                    );
                }
            }
            if (data.documents?.length > 0) {
                for (const doc of data.documents) {
                    await tx.execute(
                        `INSERT INTO \`customer_documents\` (name, url, expiryDate, customerId, createdAt)
                         VALUES (?, ?, ?, ?, NOW())`,
                        [doc.name || "", doc.url, doc.expiryDate ? new Date(doc.expiryDate) : null, newId]
                    );
                }
            }
            return newId;
        });

        await logActivity("CUSTOMER", customerId, "CREATE", `Created customer ID: ${customerId}`);
        revalidatePath("/customers");
        const [rows] = await dbTenant(`SELECT * FROM \`customers\` WHERE id = ? LIMIT 1`, [customerId]);
        return NextResponse.json(rows?.[0] || { id: customerId });
    } catch (error) {
        if (error instanceof z.ZodError)
            return NextResponse.json({ message: "Invalid input", errors: error.errors }, { status: 400 });
        console.error("Error creating customer:", error);
        return NextResponse.json({ message: "Error creating customer" }, { status: 500 });
    }
}
