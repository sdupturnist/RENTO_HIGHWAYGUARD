import mysql from "mysql2/promise";
import { cookies } from "next/headers";
import { getTenantDbConfig } from "./db-config";
import { appendLogLine, appendLogLineToAll } from "./file-logging";
import { tenantAuditFile, entityActivityFile, isPerEntityType } from "./log-paths";

// Single pool for the standalone legacy database
let _pool = global._standalonePool || null;

if (process.env.NODE_ENV !== "production") {
    global._standalonePool = _pool;
}

function getPool() {
    if (!_pool) {
        const config = getTenantDbConfig();
        _pool = mysql.createPool({
            host: config.host,
            user: config.user,
            password: config.password,
            database: config.database,
            port: parseInt(config.port, 10),
            waitForConnections: true,
            connectionLimit: 15,
            maxIdle: 5,
            idleTimeout: 10000,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 5000,
        });

        // Handle database pool errors to prevent process crashes in production
        _pool.on("error", (err) => {
            console.error("Database pool error occurred:", err);
        });

        if (process.env.NODE_ENV !== "production") global._standalonePool = _pool;
    }
    return _pool;
}

/**
 * Primary query function — executes against the standalone legacy database.
 * Auto-healing: Intercepts connection drops (ECONNRESET/PROTOCOL_CONNECTION_LOST) and retries once.
 */
const RETRYABLE_DB_ERRORS = new Set([
    "ECONNRESET",
    "PROTOCOL_CONNECTION_LOST",
    "ETIMEDOUT",
    "EPIPE",
    "ER_CLIENT_INTERACTION_TIMEOUT",
]);

export async function dbTenant(sql, params = []) {
    const pool = getPool();
    try {
        return await pool.execute(sql, params);
    } catch (error) {
        if (RETRYABLE_DB_ERRORS.has(error.code)) {
            console.warn(`Database connection dropped (${error.code}). Retrying query once...`);
            await new Promise((resolve) => setTimeout(resolve, 200));
            return await pool.execute(sql, params);
        }
        throw error;
    }
}

dbTenant.query = async (sql, params = []) => {
    const pool = getPool();
    try {
        const [rows] = await pool.query(sql, params);
        return [rows];
    } catch (error) {
        if (RETRYABLE_DB_ERRORS.has(error.code)) {
            console.warn(`Database connection dropped (${error.code}) during query. Retrying once...`);
            await new Promise((resolve) => setTimeout(resolve, 200));
            const [rows] = await pool.query(sql, params);
            return [rows];
        }
        throw error;
    }
};

dbTenant.queryOne = async (sql, params = []) => {
    const pool = getPool();
    try {
        const [rows] = await pool.execute(sql, params);
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        if (RETRYABLE_DB_ERRORS.has(error.code)) {
            console.warn(`Database connection dropped (${error.code}) during queryOne. Retrying once...`);
            await new Promise((resolve) => setTimeout(resolve, 200));
            const [rows] = await pool.execute(sql, params);
            return rows.length > 0 ? rows[0] : null;
        }
        throw error;
    }
};

export const db = dbTenant;

/**
 * Executes a transaction on the standalone database.
 */
export async function withTenantTransaction(callback) {
    const pool = getPool();
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await callback(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Audit logging for tenant operations.
 */
export async function logTenantActivity({
    subdomain,
    action,
    entityType,
    entityId,
    description,
}) {
    try {
        let actorId = null;
        let actorEmail = null;
        try {
            const cookieStore = await cookies();
            const sessionToken = cookieStore.get("session")?.value;
            if (sessionToken) {
                const { verifyToken } = await import("./jwt");
                const session = await verifyToken(sessionToken);
                if (session?.userId) actorId = Number(session.userId);
                if (session?.email) actorEmail = String(session.email);
            }
        } catch { }

        const entry = {
            ts: new Date().toISOString(),
            actor: { userId: actorId, email: actorEmail, scope: "tenant", auto: false },
            action,
            entityType: entityType?.toUpperCase(),
            entityId: Number(entityId) || 0,
            description,
        };

        const targets = [tenantAuditFile()];
        if (entityType && isPerEntityType(entityType) && entityId) {
            targets.push(entityActivityFile(entityType.toUpperCase(), entityId));
        }
        await appendLogLineToAll(targets, entry);
    } catch (error) {
        console.error("logTenantActivity failed:", error);
    }
}

// Compatibility Proxy for Legacy Db Calls
const createDbProxy = (dbFn) => {
    const proxyFn = new Proxy({}, {
        get: (target, modelName) => {
            if (modelName === '$transaction') {
                return async (callbackOrArray) => {
                    if (Array.isArray(callbackOrArray)) {
                        return Promise.all(callbackOrArray);
                    }
                    return withTenantTransaction(async (tx) => {
                        const txProxy = createDbProxy(async (sql, params) => tx.execute(sql, params));
                        return callbackOrArray(txProxy);
                    });
                };
            }
            return new Proxy({}, {
                get: (modelTarget, methodName) => {
                    return async (args) => {
                        const tableName = tableMap[modelName] || modelName;
                        if (methodName === 'findMany') {
                            let sql = `SELECT * FROM \`${tableName}\``;
                            const params = [];
                            if (args?.where) {
                                const whereParts = buildWhereClause(args.where, params);
                                if (whereParts) sql += " WHERE " + whereParts;
                            }
                            if (args?.orderBy) {
                                const orderByArr = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
                                const orderParts = orderByArr.map(ob => {
                                    const field = Object.keys(ob)[0];
                                    const dir = String(ob[field]).toUpperCase();
                                    return `\`${field}\` ${dir}`;
                                });
                                sql += ` ORDER BY ${orderParts.join(", ")}`;
                            }
                            if (args?.take) sql += ` LIMIT ${parseInt(args.take)}`;
                            if (args?.skip) sql += ` OFFSET ${parseInt(args.skip)}`;
                            const [rows] = await dbFn(sql, params);
                            return rows;
                        }
                        if (methodName === 'findUnique' || methodName === 'findFirst') {
                            let sql = `SELECT * FROM \`${tableName}\``;
                            const params = [];
                            if (args?.where) {
                                const whereParts = buildWhereClause(args.where, params);
                                if (whereParts) sql += " WHERE " + whereParts;
                            }
                            sql += " LIMIT 1";
                            const [rows] = await dbFn(sql, params);
                            return rows && rows.length > 0 ? rows[0] : null;
                        }
                        if (methodName === 'count') {
                            let sql = `SELECT COUNT(*) as count FROM \`${tableName}\``;
                            const params = [];
                            if (args?.where) {
                                const whereParts = buildWhereClause(args.where, params);
                                if (whereParts) sql += " WHERE " + whereParts;
                            }
                            const [rows] = await dbFn(sql, params);
                            return rows[0]?.count || 0;
                        }
                        if (methodName === 'create') {
                            const data = flattenData(args.data);
                            const keys = Object.keys(data);
                            const values = Object.values(data);
                            const sql = `INSERT INTO \`${tableName}\` (\`${keys.join('`, `')}\`) VALUES (${keys.map(() => '?').join(', ')})`;
                            const [result] = await dbFn(sql, values);
                            const [rows] = await dbFn(`SELECT * FROM \`${tableName}\` WHERE id = ? LIMIT 1`, [result.insertId]);
                            return rows?.[0] || { id: result.insertId, ...data };
                        }
                        if (methodName === 'update') {
                            const data = flattenData(args.data);
                            const keys = Object.keys(data);
                            const values = Object.values(data);
                            const whereParams = [];
                            const whereParts = buildWhereClause(args.where, whereParams);
                            const setClause = keys.map(k => `\`${k}\` = ?`).join(', ');
                            await dbFn(`UPDATE \`${tableName}\` SET ${setClause} WHERE ${whereParts}`, [...values, ...whereParams]);
                            const refetchParams = [];
                            const refetchWhere = buildWhereClause(args.where, refetchParams);
                            const [rows] = await dbFn(`SELECT * FROM \`${tableName}\` WHERE ${refetchWhere} LIMIT 1`, refetchParams);
                            return rows?.[0] || { ...data, ...args.where };
                        }
                        if (methodName === 'upsert') {
                            const data = flattenData({ ...args.create, ...args.update });
                            const keys = Object.keys(data);
                            const values = Object.values(data);
                            const updateSet = keys.map(k => `\`${k}\` = VALUES(\`${k}\`)`).join(', ');
                            const sql = `INSERT INTO \`${tableName}\` (\`${keys.join('`, `')}\`) VALUES (${keys.map(() => '?').join(', ')})
                                         ON DUPLICATE KEY UPDATE ${updateSet}`;
                            const [result] = await dbFn(sql, values);
                            const whereParams = [];
                            const whereParts = buildWhereClause(args.where, whereParams);
                            const [rows] = await dbFn(`SELECT * FROM \`${tableName}\` WHERE ${whereParts} LIMIT 1`, whereParams);
                            return rows?.[0] || { id: result.insertId, ...data };
                        }
                        if (methodName === 'delete') {
                            const whereParams = [];
                            const whereParts = buildWhereClause(args.where, whereParams);
                            await dbFn(`DELETE FROM \`${tableName}\` WHERE ${whereParts}`, whereParams);
                            return args.where;
                        }
                        if (methodName === 'deleteMany') {
                            if (!args?.where || Object.keys(args.where).length === 0) {
                                await dbFn(`DELETE FROM \`${tableName}\``, []);
                            } else {
                                const whereParams = [];
                                const whereParts = buildWhereClause(args.where, whereParams);
                                await dbFn(`DELETE FROM \`${tableName}\` WHERE ${whereParts}`, whereParams);
                            }
                            return { count: 0 };
                        }
                        if (methodName === 'updateMany') {
                            const data = flattenData(args.data);
                            const keys = Object.keys(data);
                            const values = Object.values(data);
                            const whereParams = [];
                            const whereParts = buildWhereClause(args.where || {}, whereParams);
                            const setClause = keys.map(k => `\`${k}\` = ?`).join(', ');
                            const sql = whereParts
                                ? `UPDATE \`${tableName}\` SET ${setClause} WHERE ${whereParts}`
                                : `UPDATE \`${tableName}\` SET ${setClause}`;
                            const [result] = await dbFn(sql, [...values, ...whereParams]);
                            return { count: result.affectedRows || 0 };
                        }
                        if (methodName === 'aggregate') {
                            if (args._sum) {
                                const field = Object.keys(args._sum)[0];
                                let sql = `SELECT SUM(\`${field}\`) as _sum FROM \`${tableName}\``;
                                const params = [];
                                if (args?.where) {
                                    const whereParts = buildWhereClause(args.where, params);
                                    if (whereParts) sql += " WHERE " + whereParts;
                                }
                                const [rows] = await dbFn(sql, params);
                                return { _sum: { [field]: rows[0]?._sum || 0 } };
                            }
                        }
                        throw new Error(`Db method ${methodName} on ${modelName} not implemented in shim.`);
                    };
                }
            });
        }
    });
    return proxyFn;
};

function flattenData(data) {
    const result = {};
    for (const [key, value] of Object.entries(data || {})) {
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
            if (value.connect || value.disconnect || value.create || value.createMany || value.set || value.update) {
                if (value.connect?.id !== undefined) {
                    result[`${key}Id`] = value.connect.id;
                }
            } else {
                result[key] = value;
            }
        } else if (value !== undefined) {
            result[key] = value;
        }
    }
    return result;
}

function buildWhereClause(where, params) {
    if (!where || Object.keys(where).length === 0) return '';
    const parts = [];
    for (const [key, value] of Object.entries(where)) {
        if (key === 'OR' || key === 'AND' || key === 'NOT') continue;
        if (value === null) {
            parts.push(`\`${key}\` IS NULL`);
        } else if (typeof value === 'object' && !(value instanceof Date)) {
            if (value.gte !== undefined) { parts.push(`\`${key}\` >= ?`); params.push(value.gte); }
            if (value.lte !== undefined) { parts.push(`\`${key}\` <= ?`); params.push(value.lte); }
            if (value.gt !== undefined) { parts.push(`\`${key}\` > ?`); params.push(value.gt); }
            if (value.lt !== undefined) { parts.push(`\`${key}\` < ?`); params.push(value.lt); }
            if (value.contains !== undefined) { parts.push(`\`${key}\` LIKE ?`); params.push(`%${value.contains}%`); }
            if (value.not !== undefined) { parts.push(`\`${key}\` != ?`); params.push(value.not); }
            if (value.in !== undefined) {
                parts.push(`\`${key}\` IN (${value.in.map(() => '?').join(',')})`);
                params.push(...value.in);
            }
            if (value.notIn !== undefined) {
                parts.push(`\`${key}\` NOT IN (${value.notIn.map(() => '?').join(',')})`);
                params.push(...value.notIn);
            }
            if (value.is !== null && value.is !== undefined) {
                if (value.is === null) parts.push(`\`${key}\` IS NULL`);
            }
        } else {
            parts.push(`\`${key}\` = ?`);
            params.push(value);
        }
    }
    return parts.join(' AND ');
}

const tableMap = {
    user: 'users', 
    role: 'roles', 
    tenant: 'tenants', 
    vehicle: 'vehicles',
    maintenance: 'maintenances', 
    maintenanceType: 'maintenance_types',
    permission: 'permissions',
    apiKey: 'api_keys',
    invoice: 'invoices', 
    assignment: 'assignments',
    project: 'projects', 
    operator: 'operators', 
    client: 'customers',
    expense: 'expenses', 
    timeLog: 'daily_time_logs', 
    timesheet: 'timesheets',
    dailyTimeLog: 'daily_time_logs',
};

export const dbQuery = createDbProxy(dbTenant);
export const masterDb = createDbProxy(dbTenant);
export const getClientDb = () => createDbProxy(dbTenant);

// Compatibility shims for code not yet migrated away from multi-tenant signatures
export function getTenantPool() { return getPool(); }
export async function getSubdomain() { return "standalone"; }
