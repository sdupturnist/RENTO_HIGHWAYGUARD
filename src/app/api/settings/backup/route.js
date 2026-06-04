import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import archiver from "archiver";
import { headers } from "next/headers";
import mysql from "mysql2/promise";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import { getDbScope, getScopedDir } from "@/app/lib/file-storage";
import { getTenantDbConfig } from "@/app/lib/db-config";
import { assertSafeDbName, dumpMysqlDatabaseToFile, writeMysqlDefaultsFile } from "@/app/lib/mysql-cli";

export async function GET(req) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // A full tenant DB dump is the most sensitive read in the system.
        // Restrict to users with explicit Settings:Edit (i.e. tenant admins).
        const canBackup = await verifySessionPermission(session, "Settings", "Edit");
        if (!canBackup) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const reqHeaders = await headers();
        const subdomain = reqHeaders.get("x-subdomain") || "rento";

        const dbConfig = getTenantDbConfig();
        const tenantDbName = dbConfig.database;
        assertSafeDbName(tenantDbName);

        const dbUser = dbConfig.user;
        const dbPass = dbConfig.password;
        const dbHost = dbConfig.host;
        const dbPort = dbConfig.port;

        // Verify if tenant database exists
        const connection = await mysql.createConnection({
            host: dbHost,
            user: dbUser,
            password: dbPass,
            port: parseInt(String(dbPort), 10),
        });
        try {
            const [rows] = await connection.query("SHOW DATABASES LIKE ?", [tenantDbName]);
            if (!Array.isArray(rows) || rows.length === 0) {
                return NextResponse.json({ error: `Database '${tenantDbName}' could not be located.` }, { status: 404 });
            }
        } finally {
            await connection.end();
        }

        // 1. Temporary Directory for SQL Dump
        const tempDir = path.join(process.cwd(), "tmp", `tenant-backup-${subdomain}-${Date.now()}`);
        await fs.mkdir(tempDir, { recursive: true });

        const sqlDumpPath = path.join(tempDir, `${tenantDbName}_dump.sql`);
        const credsFilePath = await writeMysqlDefaultsFile(tempDir, {
            user: dbUser,
            password: dbPass,
            host: dbHost,
            port: dbPort,
        });

        // 2. Generate SQL Dump for Tenant
        await dumpMysqlDatabaseToFile({
            defaultsFile: credsFilePath,
            dbName: tenantDbName,
            outputFile: sqlDumpPath,
        });

        // 3. Setup Archiver
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('data', (chunk) => writer.write(chunk));
        archive.on('end', () => writer.close());
        archive.on('error', (err) => writer.abort(err));

        // 4. Add SQL Database Dump
        archive.file(sqlDumpPath, { name: "database.sql" });

        // 5. Add File Storage Directory (if it exists)
        const uploadsDir = getScopedDir(getDbScope());
        try {
            const stat = await fs.stat(uploadsDir);
            if (stat.isDirectory()) {
                archive.directory(uploadsDir, 'files');
            }
        } catch (err) {
            // Uploads directory might not exist yet if no files uploaded.
            // This is expected for new tenants — no log noise needed.
        }

        // Finalize Zip
        archive.finalize().then(async () => {
            // Cleanup temp dump file
            await fs.rm(tempDir, { recursive: true, force: true }).catch(() => { });
        });

        // Audit Logging
        await logActivity(subdomain, {
            userId: session.userId,
            entityType: 'SETTINGS',
            entityId: 0,
            action: 'BACKUP_STARTED',
            description: `Triggered complete system backup for ${subdomain}`
        });

        const safeFilename = `backup_${subdomain}_${new Date().toISOString().split('T')[0]}.zip`;

        return new NextResponse(readable, {
            headers: {
                "Content-Disposition": `attachment; filename="${safeFilename}"`,
                "Content-Type": "application/zip",
            }
        });

    } catch (error) {
        console.error("Tenant Backup Error:", error?.message || error);
        return NextResponse.json({ error: error?.message || "Failed to generate tenant backup stream." }, { status: 500 });
    }
}
