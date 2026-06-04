import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";

export async function GET() {
    try {
        const [rows] = await dbTenant(
            "SELECT appName, slogan, loginBrandName, logoUrl, faviconUrl, primaryColor, metaTitle, metaDescription FROM `branding_settings` LIMIT 1"
        );
        return NextResponse.json(rows?.[0] || {});
    } catch (error) {
        return NextResponse.json({ message: "Failed to fetch branding settings" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const data = await request.json();
        const [rows] = await dbTenant("SELECT id FROM `branding_settings` LIMIT 1");
        const existing = rows?.[0];

        if (existing) {
            await dbTenant(`
                UPDATE \`branding_settings\` SET
                    appName = ?, slogan = ?, loginBrandName = ?,
                    logoUrl = ?, faviconUrl = ?, primaryColor = ?,
                    metaTitle = ?, metaDescription = ?, updatedAt = NOW()
                WHERE id = ?
            `, [
                data.appName || null, data.slogan || null, data.loginBrandName || null,
                data.logoUrl || null, data.faviconUrl || null, data.primaryColor || null,
                data.metaTitle || null, data.metaDescription || null,
                existing.id,
            ]);
        } else {
            await dbTenant(`
                INSERT INTO \`branding_settings\`
                    (appName, slogan, loginBrandName, logoUrl, faviconUrl, primaryColor, metaTitle, metaDescription, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                data.appName || null, data.slogan || null, data.loginBrandName || null,
                data.logoUrl || null, data.faviconUrl || null, data.primaryColor || null,
                data.metaTitle || null, data.metaDescription || null,
            ]);
        }

        const [updRows] = await dbTenant(
            "SELECT appName, slogan, loginBrandName, logoUrl, faviconUrl, primaryColor, metaTitle, metaDescription FROM `branding_settings` LIMIT 1"
        );
        await logActivity("SETTINGS", 0, "UPDATE", "Branding settings updated");
        return NextResponse.json(updRows[0]);
    } catch (error) {
        console.error("Error saving branding settings:", error);
        return NextResponse.json({ message: "Failed to update branding settings" }, { status: 500 });
    }
}
