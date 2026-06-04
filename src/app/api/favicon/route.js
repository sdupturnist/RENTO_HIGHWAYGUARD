import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getAppBranding } from "@/app/lib/branding-resolver";
import { getUploadRootDir } from "@/app/lib/file-storage";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const branding = await getAppBranding();
        const faviconUrl = branding.faviconUrl || "";

        // If branding has an upload path, serve that file directly
        if (faviconUrl.startsWith("/api/uploads/")) {
            const segments = faviconUrl.replace("/api/uploads/", "").split("/").map((s) => path.basename(s));
            let filePath = path.join(getUploadRootDir(), ...segments);
            let fileData = null;

            try {
                fileData = await readFile(filePath);
            } catch {
                // If it fails and we have a legacy scoped URL (e.g. ['highway', 'branding', 'file.png']),
                // fall back to reading from the flat directory (omitting the first scope segment).
                if (segments.length > 2) {
                    const flatFilePath = path.join(getUploadRootDir(), ...segments.slice(1));
                    try {
                        fileData = await readFile(flatFilePath);
                        filePath = flatFilePath;
                    } catch {
                        // Both locations failed
                    }
                }
            }

            if (fileData) {
                const ext = path.extname(filePath).toLowerCase();
                const contentType = ext === ".svg" ? "image/svg+xml" : ext === ".png" ? "image/png" : "image/x-icon";
                return new NextResponse(fileData, {
                    status: 200,
                    headers: {
                        "Content-Type": contentType,
                        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                    },
                });
            }
        }

        // Default: try several static fallback locations
        const fallbackPaths = [
            path.join(process.cwd(), "public", "favicon-default.ico"),
            path.join(process.cwd(), "public", "favicon.ico"),
            path.join(process.cwd(), "public", "icon.png"),
        ];
        for (const fp of fallbackPaths) {
            try {
                const data = await readFile(fp);
                const ext = path.extname(fp).toLowerCase();
                const contentType = ext === ".png" ? "image/png" : "image/x-icon";
                return new NextResponse(data, {
                    status: 200,
                    headers: {
                        "Content-Type": contentType,
                        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                    },
                });
            } catch {
                // try next fallback
            }
        }

        // Ultimate fallback: minimal valid 1×1 transparent ICO (never fails)
        // ICO header (6) + ICONDIRENTRY (16) + BITMAPINFOHEADER (40) + pixel data (4+4) = 70 bytes
        const icoBytes = Buffer.from([
            0x00,0x00,0x01,0x00,0x01,0x00,                          // ICO header
            0x01,0x01,0x00,0x00,0x01,0x00,0x20,0x00,                // dir entry part 1
            0x30,0x00,0x00,0x00,0x16,0x00,0x00,0x00,                // dir entry part 2 (48 bytes, offset 22)
            0x28,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x02,0x00,0x00,0x00, // BITMAPINFOHEADER
            0x01,0x00,0x20,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
            0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
            0x00,0x00,0x00,0x00,
            0x00,0x00,0x00,0x00,                                     // XOR mask (1 px BGRA transparent)
            0x00,0x00,0x00,0x00,                                     // AND mask
        ]);
        return new NextResponse(icoBytes, {
            status: 200,
            headers: {
                "Content-Type": "image/x-icon",
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            },
        });
    } catch {
        return new NextResponse(null, { status: 404 });
    }
}
