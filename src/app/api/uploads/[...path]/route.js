import { NextResponse } from "next/server";

/**
 * Legacy upload-serve route. Kept only for backward compatibility — every
 * URL produced by `buildUploadUrl()` already points at `/api/uploads/...`,
 * which is the single canonical (and security-hardened) route.
 *
 * Any request that lands here is redirected to the canonical path. This
 * eliminates the previous duplication where two routes had to be kept in
 * sync, and ensures all auth / scope-isolation checks happen in exactly
 * one place.
 */
export async function GET(request, { params }) {
    const { path: segments } = await params;
    if (!segments || segments.length === 0) {
        return NextResponse.json({ message: "File not found" }, { status: 404 });
    }
    const target = `/api/storage/${segments.map(encodeURIComponent).join("/")}`;
    return NextResponse.redirect(new URL(target, request.url), 308);
}
