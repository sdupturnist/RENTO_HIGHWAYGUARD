import fs from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";

function validateZipEntries(zip, targetDir) {
    const baseDir = path.resolve(targetDir);
    const basePrefix = `${baseDir}${path.sep}`;

    for (const entry of zip.getEntries()) {
        const normalizedName = String(entry.entryName || "").replace(/\\/g, "/");
        if (!normalizedName || normalizedName.startsWith("/") || /^[A-Za-z]:/.test(normalizedName)) {
            throw new Error(`Unsafe zip entry: ${entry.entryName}`);
        }

        const resolvedTarget = path.resolve(baseDir, normalizedName);
        if (resolvedTarget !== baseDir && !resolvedTarget.startsWith(basePrefix)) {
            throw new Error(`Refusing to extract entry outside target dir: ${entry.entryName}`);
        }
    }
}

export async function extractZipBufferSafely(buffer, targetDir) {
    await fs.mkdir(targetDir, { recursive: true });
    const zip = new AdmZip(buffer);
    validateZipEntries(zip, targetDir);
    zip.extractAllTo(targetDir, true);
}
