import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getSession } from "@/app/lib/auth";
import { buildUploadUrl, getDbScope, getScopedDir, sanitizeRelativeFolder } from "@/app/lib/file-storage";
import { buildStoredUploadName, validateUploadedBuffer } from "@/app/lib/upload-security";
import { logActivity } from "@/app/lib/logger";

export async function POST(request) {
    const session = await getSession();
    if (!session)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const data = await request.formData();
    const file = data.get("file");
    const folder = data.get("folder")?.trim() || "";
    if (!file) {
        return NextResponse.json({ message: "No file uploaded" }, { status: 400 });
    }
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const MAX_SIZE = Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024);
    if (buffer.length > MAX_SIZE) {
        return NextResponse.json({ message: "File too large" }, { status: 413 });
    }

    try {
        validateUploadedBuffer({ fileName: file.name, fileType: file.type, buffer, purpose: "general" });
    } catch (error) {
        const message = error?.message || "Unsupported file type";
        const status = message.includes("forbidden") ? 403 : 415;
        return NextResponse.json({ message }, { status });
    }

    const filename = buildStoredUploadName(file.name || "upload");
    const scope = getDbScope();
    const safeFolder = sanitizeRelativeFolder(folder);
    const targetDir = getScopedDir(scope, safeFolder);

    await mkdir(targetDir, { recursive: true });
    await writeFile(path.join(targetDir, filename), buffer);

    const fileUrl = buildUploadUrl(scope, safeFolder, filename);
    await logActivity("FILE", 0, "UPLOAD", `File uploaded: ${file.name} → ${fileUrl}`);
    return NextResponse.json({ url: fileUrl });
}
