function parseUrlOrThrow(rawUrl, varName) {
    if (!rawUrl) {
        throw new Error(`${varName} environment variable is required`);
    }
    try {
        return new URL(rawUrl);
    } catch (err) {
        throw new Error(`${varName} is not a valid URL: ${err.message}`);
    }
}

// Extracts the database name from environment variables.
export function getTenantDbName() {
    if (process.env.DATABASE_URL) {
        try {
            const url = new URL(process.env.DATABASE_URL);
            const name = url.pathname.replace(/^\//, "").split("?")[0].trim();
            return name.replace(/[^a-z0-9_-]/gi, "-").toLowerCase() || "db";
        } catch {
            return process.env.DB_NAME || "db";
        }
    }
    return process.env.DB_NAME || "db";
}

// Returns the connection config pieces, supporting both DATABASE_URL and individual variables.
export function getTenantDbConfig() {
    if (process.env.DATABASE_URL) {
        const url = parseUrlOrThrow(process.env.DATABASE_URL, "DATABASE_URL");
        return {
            url,
            host: url.hostname,
            port: url.port || "3306",
            user: decodeURIComponent(url.username || "") || process.env.DB_USER || "root",
            password: decodeURIComponent(url.password || ""),
            database: url.pathname.replace(/^\//, ""),
        };
    }

    return {
        host: process.env.DB_HOST || "127.0.0.1",
        port: process.env.DB_PORT || "3306",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "rento",
    };
}
