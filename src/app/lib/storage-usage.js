import fs from "fs/promises";
import path from "path";
import { getScopedDir, getDbScope } from "@/app/lib/file-storage";

const EXCLUDED_ROOT_DIRS = new Set(["audit_logs", "cron_job_logs"]);
const EXCLUDED_NESTED_DIRS = new Set(["activity_logs", "audit_logs", "cron_job_logs"]);

async function sumDirBytes(dir, depth = 0) {
    let total = 0;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) continue;

        if (entry.isDirectory()) {
            if ((depth === 0 && EXCLUDED_ROOT_DIRS.has(entry.name)) || EXCLUDED_NESTED_DIRS.has(entry.name)) {
                continue;
            }
            total += await sumDirBytes(entryPath, depth + 1);
            continue;
        }

        if (entry.isFile()) {
            const stat = await fs.stat(entryPath).catch(() => null);
            total += stat?.size || 0;
        }
    }

    return total;
}

export async function getTenantStorageUsage() {
    const root = getScopedDir(getDbScope());
    const bytesUsed = await sumDirBytes(root);
    const mbUsed = Number((bytesUsed / (1024 * 1024)).toFixed(2));
    return { bytesUsed, mbUsed };
}
