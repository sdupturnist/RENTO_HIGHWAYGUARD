import { NextResponse } from "next/server";
import { getAppBranding } from "@/app/lib/branding-resolver";

export async function GET() {
    try {
        const branding = await getAppBranding();
        return NextResponse.json(branding);
    } catch (error) {
        console.error("Branding resolver error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
