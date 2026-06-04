import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import mime from "mime-types";
import { getUploadRootDir } from "@/app/lib/file-storage";

export async function GET(_request, { params }) {
    try {
        const { path: segments } = await params;
        if (!segments || segments.length === 0) {
            return NextResponse.json({ message: "File not found" }, { status: 404 });
        }

        if (segments.some((s) => s.includes("..") || s.includes("/") || s.includes("\\"))) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const rootDir = getUploadRootDir();
        const filePath = path.join(rootDir, ...segments.map((s) => path.basename(s)));
        const data = await readFile(filePath);
        const contentType = mime.lookup(filePath) || "application/octet-stream";

        return new NextResponse(data, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch {
        return NextResponse.json({ message: "File not found" }, { status: 404 });
    }
}

