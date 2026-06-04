import fs from "fs/promises";
import { createReadStream, createWriteStream } from "fs";
import path from "path";
import { spawn } from "child_process";

export function assertSafeDbName(name) {
    if (!name || !/^[A-Za-z0-9_]+$/.test(name)) {
        throw new Error("Refusing to operate on unsafe database name.");
    }
}

function escapeCnfValue(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function writeMysqlDefaultsFile(tempDir, config) {
    const filePath = path.join(tempDir, ".my.cnf");
    const lines = [
        "[client]",
        `user="${escapeCnfValue(config.user)}"`,
        `password="${escapeCnfValue(config.password)}"`,
        `host=${config.host}`,
        `port=${config.port}`,
        "",
    ];
    await fs.writeFile(filePath, lines.join("\n"), { mode: 0o600 });
    return filePath;
}

function waitForChild(child, commandName) {
    return new Promise((resolve, reject) => {
        let stderr = "";
        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`${commandName} failed${stderr ? `: ${stderr.trim()}` : ""}`));
        });
    });
}

export async function dumpMysqlDatabaseToFile({ defaultsFile, dbName, outputFile }) {
    assertSafeDbName(dbName);
    const child = spawn("mysqldump", [
        `--defaults-extra-file=${defaultsFile}`,
        "--single-transaction",
        "--quick",
        dbName,
    ], {
        stdio: ["ignore", "pipe", "pipe"],
    });

    const outputStream = createWriteStream(outputFile, { mode: 0o600 });
    const streamDone = new Promise((resolve, reject) => {
        outputStream.on("finish", resolve);
        outputStream.on("error", reject);
    });
    child.stdout.pipe(outputStream);
    await Promise.all([
        waitForChild(child, "mysqldump"),
        streamDone,
    ]);
}

export async function importMysqlDatabaseFromFile({ defaultsFile, dbName, inputFile }) {
    assertSafeDbName(dbName);
    const child = spawn("mysql", [
        `--defaults-extra-file=${defaultsFile}`,
        dbName,
    ], {
        stdio: ["pipe", "ignore", "pipe"],
    });

    createReadStream(inputFile).pipe(child.stdin);
    await waitForChild(child, "mysql import");
}
