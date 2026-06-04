import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { verifySession } from "@/app/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request) {
    // 1. Double check authentication via session (defense-in-depth)
    const session = await verifySession();
    if (!session) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
        // 2. Read the original HTML manual file
        const filePath = path.join(process.cwd(), "usermanual", "RentERP_User_Manual_v4.html");
        let html = fs.readFileSync(filePath, "utf8");

        // 3. Inject a premium "Back to Dashboard" button in the sidebar header for navigation ease
        const targetHeader = '<div class="sidebar-header">';
        const logoAndVersion = `
  <div class="sidebar-header">
    <div class="logo">Rent<span>O</span></div>
    <div class="version">User Manual · v4 (User Edition)</div>
    <a href="/" style="display:inline-block;margin-top:10px;background:rgba(255,255,255,0.12);color:#fff;padding:6px 14px;border-radius:8px;font-size:0.72rem;font-weight:600;text-decoration:none;border-left:none;transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.22)'" onmouseout="this.style.background='rgba(255,255,255,0.12)'">← Back to Dashboard</a>
  </div>
        `.trim();

        const headerStartIndex = html.indexOf(targetHeader);
        if (headerStartIndex !== -1) {
            // Find the 3rd "</div>" closing tag after headerStartIndex
            // 1st belongs to <div class="logo">...</div>
            // 2nd belongs to <div class="version">...</div>
            // 3rd belongs to <div class="sidebar-header">...</div>
            let count = 0;
            let index = headerStartIndex;
            while (count < 3) {
                index = html.indexOf('</div>', index + 1);
                if (index === -1) break;
                count++;
            }

            if (count === 3 && index !== -1) {
                const headerEndIndex = index + 6;
                html = html.substring(0, headerStartIndex) + logoAndVersion + html.substring(headerEndIndex);
            }
        }

        // 4. Dynamically customize brand names: Rent ERP / RentERP / logo -> RentO
        html = html.replaceAll("Rent<span>ERP</span>", "Rent<span>O</span>");
        html = html.replaceAll("Rent ERP", "RentO");
        html = html.replaceAll("RentERP", "RentO");

        // 5. Return raw HTML response
        return new NextResponse(html, {
            headers: {
                "Content-Type": "text/html; charset=utf-8",
                "X-Frame-Options": "DENY",
                "X-Content-Type-Options": "nosniff"
            }
        });
    } catch (error) {
        console.error("Failed to read RentERP_User_Manual_v4.html:", error);
        return new NextResponse(
            `<html><body style="font-family:sans-serif;padding:40px;color:#ef4444;"><h2>Failed to load User Manual</h2><p>${error.message}</p></body></html>`,
            {
                status: 500,
                headers: { "Content-Type": "text/html" }
            }
        );
    }
}
