import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { z } from "zod";
import { getSession } from "@/app/lib/auth";
import { ensureCompanySettingsColumns } from "@/app/lib/company-settings-columns";
import { logActivity } from "@/app/lib/logger";
const settingsSchema = z.object({
    companyName: z.string().min(1).optional(),
    companyEmail: z.string().email().optional().nullable().or(z.literal("")).transform(val => val || null),
    address: z.string().nullable().optional().transform(val => val || null),
    city: z.string().nullable().optional().transform(val => val || null),
    state: z.string().nullable().optional().transform(val => val || null),
    country: z.string().nullable().optional().transform(val => val || null),
    zipCode: z.string().nullable().optional().transform(val => val || null),
    phone: z.string().nullable().optional().transform(val => val || null),
    phoneCountryCode: z.string().nullable().optional().transform(val => val || "+971"),
    taxNumber: z.string().nullable().optional().transform(val => val || null),
    website: z.string().nullable().optional().transform(val => val || null),
    currency: z.string().optional(),
    dateFormat: z.string().optional(),
    timeZone: z.string().optional(),
    currencySymbol: z.string().optional(),
    currencyPosition: z.string().optional(),
    weekStartsOn: z.string().optional(),
    fullDayHours: z.number().min(0).max(24).optional(),
    overtimeStartsAfter: z.number().min(0).max(24).optional(),
    overtimeMultiplier: z.number().min(1).optional(),
    holidayMultiplier: z.number().min(1).optional(),
    weekendMultiplier: z.number().min(1).optional(),
    weekendTreatedAs: z.enum(["NORMAL", "OVERTIME", "HOLIDAY"]).optional(),
    weekendDays: z.array(z.string()).optional(),
    enableVat: z.preprocess(val => (val === undefined || val === null) ? undefined : (typeof val === "number" ? Boolean(val) : val), z.coerce.boolean().optional()),
    vatPercentage: z.preprocess(val => (val === undefined || val === null || val === "") ? undefined : Number(val), z.number().min(0).optional()),
});

export async function GET(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        await ensureCompanySettingsColumns(request);

        let [rows] = await dbTenant("SELECT * FROM `company_settings` LIMIT 1");
        let settings = rows[0];

        if (!settings) {
            await dbTenant("INSERT INTO `company_settings` (companyName, updatedAt) VALUES (?, NOW())", ["Rental Enterprise Corp"]);
            [rows] = await dbTenant("SELECT * FROM `company_settings` LIMIT 1");
            settings = rows[0];
        }

        const filteredSettings = {
            ...settings,
            companyName: settings.companyName ?? "",
            companyEmail: settings.companyEmail ?? "",
            currencySymbol: settings?.currencySymbol || "AED",
            phone: settings.phone ?? "",
            phoneCountryCode: settings.phoneCountryCode ?? "+971",
            address: settings.address ?? "",
            city: settings.city ?? "",
            state: settings.state ?? "",
            country: settings.country ?? "",
            zipCode: settings.zipCode ?? "",
            taxNumber: settings.taxNumber ?? "",
            website: settings.website ?? "",
            weekendDays: settings.weekendDays ?? [],
            enableVat: Boolean(settings.enableVat),
            vatPercentage: settings.vatPercentage !== null && settings.vatPercentage !== undefined ? Number(settings.vatPercentage) : 5.0,
        };
        return NextResponse.json(filteredSettings);
    }
    catch (error) {
        console.error("Error loading company settings:", error);
        return NextResponse.json({ message: "Error loading settings" }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    try {
        await ensureCompanySettingsColumns(request);

        const body = await request.json();
        const parsed = settingsSchema.parse(body);

        // Only update fields that were actually sent in the request body
        const bodyKeys = new Set(Object.keys(body));
        const dataToSave = Object.fromEntries(
            Object.entries(parsed).filter(([k, v]) => bodyKeys.has(k) && v !== undefined)
        );

        const [existing] = await dbTenant("SELECT id FROM `company_settings` LIMIT 1");
        const fields = Object.keys(dataToSave);

        if (existing.length > 0) {
            if (fields.length > 0) {
                const sql = `UPDATE \`company_settings\` SET ${fields.map(f => `\`${f}\` = ?`).join(", ")}, updatedAt = NOW() WHERE id = ?`;
                const params = [...fields.map(f => {
                    const val = dataToSave[f];
                    return Array.isArray(val) ? JSON.stringify(val) : val;
                }), existing[0].id];
                await dbTenant(sql, params);
            }
        } else {
            const sql = `INSERT INTO \`company_settings\` (${fields.map(f => `\`${f}\``).join(", ")}, updatedAt) VALUES (${fields.map(() => "?").join(", ")}, NOW())`;
            const params = fields.map(f => {
                const val = dataToSave[f];
                return Array.isArray(val) ? JSON.stringify(val) : val;
            });
            await dbTenant(sql, params);
        }

        const [rows] = await dbTenant("SELECT * FROM `company_settings` LIMIT 1");
        const settings = rows[0];
        
        const filteredSettings = {
            ...settings,
            companyName: settings.companyName ?? "",
            companyEmail: settings.companyEmail ?? "",
            currencySymbol: settings?.currencySymbol || "AED",
            phone: settings.phone ?? "",
            phoneCountryCode: settings.phoneCountryCode ?? "+971",
            address: settings.address ?? "",
            city: settings.city ?? "",
            state: settings.state ?? "",
            country: settings.country ?? "",
            zipCode: settings.zipCode ?? "",
            taxNumber: settings.taxNumber ?? "",
            website: settings.website ?? "",
            weekendDays: settings.weekendDays ?? [],
            enableVat: Boolean(settings.enableVat),
            vatPercentage: settings.vatPercentage !== null && settings.vatPercentage !== undefined ? Number(settings.vatPercentage) : 5.0,
        };

        await logActivity("SETTINGS", 0, "UPDATE", "Company settings updated");
        return NextResponse.json(filteredSettings);
    }
    catch (error) {
        console.error("Error saving settings:", error);
        if (error instanceof z.ZodError) return NextResponse.json({ message: "Validation error", errors: error.errors }, { status: 400 });
        return NextResponse.json({ message: "Error saving settings" }, { status: 500 });
    }
}

