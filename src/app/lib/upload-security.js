import crypto from "crypto";
import path from "path";
import { sanitizeFileName } from "@/app/lib/file-storage";

const DANGEROUS_EXTENSIONS = new Set([
    ".php", ".phtml", ".phar", ".exe", ".sh", ".bat", ".cmd", ".com", ".dll",
    ".html", ".htm", ".xhtml", ".js", ".mjs", ".cjs", ".ts", ".jsx", ".tsx",
    ".svg", ".svgz", ".swf", ".cgi", ".pl", ".py", ".htaccess",
]);

const PURPOSE_RULES = {
    general: new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".ico"]),
    brandingLogo: new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]),
    brandingFavicon: new Set([".png", ".ico"]),
};

function hasSignature(buffer, signature, offset = 0) {
    if (buffer.length < offset + signature.length) return false;
    for (let index = 0; index < signature.length; index += 1) {
        if (buffer[offset + index] !== signature[index]) return false;
    }
    return true;
}

function looksLikeText(buffer) {
    if (!buffer?.length) return true;
    let suspicious = 0;
    const sampleLength = Math.min(buffer.length, 4096);
    for (let index = 0; index < sampleLength; index += 1) {
        const byte = buffer[index];
        const isAllowed =
            byte === 9 ||
            byte === 10 ||
            byte === 13 ||
            (byte >= 32 && byte <= 126) ||
            byte >= 128;
        if (!isAllowed) suspicious += 1;
    }
    return suspicious / sampleLength < 0.02;
}

function detectFileKind(buffer, ext) {
    const lowerExt = String(ext || "").toLowerCase();

    if (hasSignature(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
    if (hasSignature(buffer, [0xff, 0xd8, 0xff])) return "jpeg";
    if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
    if (buffer.length >= 6) {
        const gifHeader = buffer.toString("ascii", 0, 6);
        if (gifHeader === "GIF87a" || gifHeader === "GIF89a") return "gif";
    }
    if (hasSignature(buffer, [0x25, 0x50, 0x44, 0x46])) return "pdf";
    if (hasSignature(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
        if (lowerExt === ".doc") return "doc";
        if (lowerExt === ".xls") return "xls";
        return "ole";
    }
    if (hasSignature(buffer, [0x50, 0x4b, 0x03, 0x04]) || hasSignature(buffer, [0x50, 0x4b, 0x05, 0x06]) || hasSignature(buffer, [0x50, 0x4b, 0x07, 0x08])) {
        if (lowerExt === ".docx") return "docx";
        if (lowerExt === ".xlsx") return "xlsx";
        if (lowerExt === ".zip") return "zip";
    }
    if (hasSignature(buffer, [0x00, 0x00, 0x01, 0x00])) return "ico";
    if ((lowerExt === ".csv" || lowerExt === ".txt") && looksLikeText(buffer)) {
        return lowerExt.slice(1);
    }
    return null;
}

function expectedKindsForExtension(ext) {
    switch (ext) {
        case ".jpg":
        case ".jpeg":
            return ["jpeg"];
        case ".png":
            return ["png"];
        case ".gif":
            return ["gif"];
        case ".webp":
            return ["webp"];
        case ".pdf":
            return ["pdf"];
        case ".doc":
            return ["doc"];
        case ".docx":
            return ["docx"];
        case ".xls":
            return ["xls"];
        case ".xlsx":
            return ["xlsx"];
        case ".csv":
            return ["csv"];
        case ".txt":
            return ["txt"];
        case ".ico":
            return ["ico"];
        default:
            return [];
    }
}

export function buildStoredUploadName(originalName, fallbackBase = "upload") {
    const ext = path.extname(originalName || "").toLowerCase();
    const safeName = sanitizeFileName(originalName || `${fallbackBase}${ext || ""}`);
    return `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
}

export function buildStoredBrandingName(prefix, originalName, fallbackExt) {
    const ext = path.extname(originalName || "").toLowerCase() || fallbackExt;
    const safeName = sanitizeFileName(`${prefix}${ext}`);
    return `${prefix}_${Date.now()}_${crypto.randomUUID()}_${safeName}`;
}

export function validateUploadedBuffer({ fileName, fileType, buffer, purpose = "general" }) {
    const ext = path.extname(fileName || "").toLowerCase();
    if (!ext) {
        throw new Error("Uploaded file must have an extension.");
    }
    if (DANGEROUS_EXTENSIONS.has(ext)) {
        throw new Error("Upload of this file type is forbidden.");
    }

    const allowedExtensions = PURPOSE_RULES[purpose] || PURPOSE_RULES.general;
    if (!allowedExtensions.has(ext)) {
        throw new Error("Unsupported file type.");
    }

    if (fileType === "image/svg+xml") {
        throw new Error("SVG uploads are not allowed.");
    }

    const detectedKind = detectFileKind(buffer, ext);
    const expectedKinds = expectedKindsForExtension(ext);
    if (!detectedKind || (expectedKinds.length > 0 && !expectedKinds.includes(detectedKind))) {
        throw new Error("Uploaded file content does not match its extension.");
    }

    return { ext, detectedKind };
}
