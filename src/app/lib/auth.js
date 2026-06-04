import { cookies } from "next/headers";
export { signToken, verifyToken } from "@/app/lib/jwt";
import { signToken, verifyToken } from "@/app/lib/jwt";
import { validateApiKey } from "@/app/lib/api-auth";
export { ROLES, PERMISSIONS, hasPermission } from "@/app/lib/permissions";

export async function setSession(payload) {
    const token = await signToken(payload);
    const cookieStore = await cookies();
    cookieStore.set("session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        path: "/",
        sameSite: "strict",
    });
}

export async function clearSession() {
    const cookieStore = await cookies();
    cookieStore.delete("session");
}

export async function getSession() {
    try {
        const { headers } = await import("next/headers");
        const headerList = await headers();
        const apiKey = headerList.get("x-api-key");
        if (apiKey) {
            const apiSession = await validateApiKey({ headers: headerList });
            if (apiSession) return apiSession;
        }
    } catch (e) {
        // headers() may fail in some contexts
    }

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session")?.value;
    if (!sessionToken) return null;

    const session = await verifyToken(sessionToken);
    if (!session) return null;

    return session;
}

export async function verifySession() {
    const session = await getSession();
    if (!session || !session.role) return null;
    return session;
}
