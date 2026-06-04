import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/auth";
export async function GET() {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    return NextResponse.json(session); // payload contains role
}
