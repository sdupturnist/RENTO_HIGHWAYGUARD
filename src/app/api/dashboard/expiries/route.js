import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { getExpiryItemsForTenant } from "@/app/lib/services/expiry-service";

export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }



        // 2. Fetch Tenant Settings
        const settings = (await dbTenant("SELECT * FROM `notification_settings` LIMIT 1"))[0][0] || {
            enableExpiryNotifications: true,
            vehicleExpiryThresholds: [7, 14, 30],
            operatorExpiryThresholds: [7, 14, 30],
        };

        if (!settings.enableExpiryNotifications) {
            return NextResponse.json({ active: false, items: [] });
        }

        const items = await getExpiryItemsForTenant(dbQuery, settings);

        // Group into Exired, Urgent (<= 7 days), Upcoming (> 7 days)
        const expired = items.filter(i => i.daysRemaining < 0);
        const urgent = items.filter(i => i.daysRemaining >= 0 && i.daysRemaining <= 7);
        const upcoming = items.filter(i => i.daysRemaining > 7);

        return NextResponse.json({
            active: true,
            summary: {
                total: items.length,
                expired: expired.length,
                urgent: urgent.length,
                upcoming: upcoming.length,
            },
            items
        });

    } catch (error) {
        console.error("Error fetching expiries:", error);
        return NextResponse.json({ message: "Failed to load expiries" }, { status: 500 });
    }
}
