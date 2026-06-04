import { NextResponse } from "next/server";
import { verifyToken } from "@/app/lib/jwt";

const publicRoutes = [
    "/login",
    "/forgot",
    "/reset-password",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/forgot",
    "/api/auth/reset",
];

export async function middleware(request) {
    const url = request.nextUrl;
    const path = url.pathname;

    // Allow static files and Next.js internals
    if (path.startsWith("/_next") || path.startsWith("/static") || path.includes(".")) {
        return NextResponse.next();
    }

    // Allow all API routes to pass through unauthenticated (each route handles its own auth)
    if (path.startsWith("/api")) {
        return NextResponse.next();
    }

    const isPublicRoute = publicRoutes.some(route => path === route || path.startsWith(route));

    const token = request.cookies.get("session")?.value;
    const verifiedToken = token ? await verifyToken(token) : null;
    const isAuthenticated = !!verifiedToken;

    if (!isAuthenticated && !isPublicRoute) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    if (isAuthenticated && path === "/login") {
        const target = verifiedToken?.forcePasswordChange
            ? "/profile?passwordChange=required"
            : "/";
        return NextResponse.redirect(new URL(target, request.url));
    }

    if (
        isAuthenticated &&
        verifiedToken?.forcePasswordChange &&
        !isPublicRoute &&
        path !== "/profile"
    ) {
        return NextResponse.redirect(new URL("/profile?passwordChange=required", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image).*)"],
};
