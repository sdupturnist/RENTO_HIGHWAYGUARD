import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { headers } from "next/headers";
import mysql from "mysql2/promise";
import { getSession } from "@/app/lib/auth";
import { logActivity } from "@/app/lib/logger";
import { getDbScope, getScopedDir } from "@/app/lib/file-storage";
import { getTenantDbConfig } from "@/app/lib/db-config";
import { assertSafeDbName, importMysqlDatabaseFromFile, writeMysqlDefaultsFile } from "@/app/lib/mysql-cli";
import { extractZipBufferSafely } from "@/app/lib/zip-security";

export async function POST(req) {
    let tempDir = null;

    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const reqHeaders = await headers();
        const subdomain = reqHeaders.get("x-subdomain") || "rento";

        const dbConfig = getTenantDbConfig();
        const tenantDbName = dbConfig.database;
        assertSafeDbName(tenantDbName);

        const dbUser = dbConfig.user;
        const dbPass = dbConfig.password;
        const dbHost = dbConfig.host;
        const dbPort = dbConfig.port;

        // Read uploaded files
        const data = await req.formData();
        const file = data.get("backupFile");
        const restoreDb = data.get("restoreDb") === "true";
        const restoreFiles = data.get("restoreFiles") === "true";

        if (!file) {
            return NextResponse.json({ error: "No backup file uploaded" }, { status: 400 });
        }
        if (!restoreDb && !restoreFiles) {
            return NextResponse.json({ error: "No components selected for restore." }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        tempDir = path.join(process.cwd(), "tmp", `tenant-restore-${subdomain}-${Date.now()}`);
        await fs.mkdir(tempDir, { recursive: true });

        // 1. Unzip
        const extractDir = path.join(tempDir, "extracted");
        await extractZipBufferSafely(buffer, extractDir);

        const sqlDumpPath = path.join(extractDir, "database.sql");
        const restoredFilesDir = path.join(extractDir, "files");

        if (restoreDb) {
            // 2. Validate SQL file exists
            try {
                await fs.access(sqlDumpPath);
            } catch {
                return NextResponse.json({ error: "Invalid Backup Zip: 'database.sql' not found." }, { status: 400 });
            }

            // 3. Drop & Recreate Tenant Database
            const connection = await mysql.createConnection({
                host: dbHost,
                user: dbUser,
                password: dbPass,
                port: parseInt(String(dbPort), 10),
            });
            await connection.query(`DROP DATABASE IF EXISTS \`${tenantDbName}\``);
            await connection.query(`CREATE DATABASE \`${tenantDbName}\``);
            await connection.end();

            const credsFilePath = await writeMysqlDefaultsFile(tempDir, {
                user: dbUser,
                password: dbPass,
                host: dbHost,
                port: dbPort,
            });
            await importMysqlDatabaseFromFile({
                defaultsFile: credsFilePath,
                dbName: tenantDbName,
                inputFile: sqlDumpPath,
            });
        }

        if (restoreFiles) {
            // 5. Replace Files Directory
            const tenantUploadsDir = getScopedDir(getDbScope());

            try {
                const hasRestoredFiles = await fs.stat(restoredFilesDir).then(() => true).catch(() => false);

                if (hasRestoredFiles) {
                    // Wipe current directory securely before pasting backup
                    await fs.rm(tenantUploadsDir, { recursive: true, force: true }).catch(() => { });

                    // Make sure parent directories are fine
                    await fs.mkdir(path.dirname(tenantUploadsDir), { recursive: true });

                    // Move from Extracted > Real location
                    await fs.rename(restoredFilesDir, tenantUploadsDir);
                }
            } catch (fileErr) {
                console.warn("Issue replacing files during restore:", fileErr);
            }
        }

        // Final Audit
        await logActivity(subdomain, {
            userId: session.userId,
            entityType: 'SETTINGS',
            entityId: 0,
            action: 'RESTORE_COMPLETED',
            description: `Successfully restored tenant database and configurations for ${subdomain}`
        });

        return NextResponse.json({ success: true, message: "System restored successfully!" });

    } catch (error) {
        console.error("Tenant Restore Error:", error);
        return NextResponse.json({ error: "Failed to process the restore backup." }, { status: 500 });
    } finally {
        // Cleanup Temp Directory
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });
        }
    }
}
