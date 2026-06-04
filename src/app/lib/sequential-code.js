function formatSequentialCode(prefix, number, padding, separator = "") {
    return `${prefix}${separator}${String(number).padStart(padding, "0")}`;
}

/**
 * Reserves a sequential code using a raw SQL transaction (tx).
 *
 * Default (monotonic = false):
 *   Locks the settings row (SELECT FOR UPDATE), then computes the next number
 *   as MAX(existing code) + 1, falling back to startingNumber (floor) when the
 *   entity table is empty.  startingNumber is never auto-incremented, so the
 *   value the admin configured in Settings stays stable.
 *
 * monotonic = true (invoices / timesheets):
 *   Classic CAS counter — startingNumber increments on every create and gaps
 *   are never reused. Required for financial documents.
 */
export async function reserveSequentialCode(tx, config) {
    const {
        tableName,
        createSql,
        createParams = [],
        prefixField = "prefix",
        numberField = "startingNumber",
        paddingField = "padding",
        separator = "",
        entityTableName,
        entityCodeField,
        whereKey = null,
        whereValue = null,
        recordId = null,
        monotonic = false,
    } = config;

    const selectSql = recordId
        ? `SELECT * FROM \`${tableName}\` WHERE id = ? LIMIT 1 FOR UPDATE`
        : whereKey
        ? `SELECT * FROM \`${tableName}\` WHERE \`${whereKey}\` = ? LIMIT 1 FOR UPDATE`
        : `SELECT * FROM \`${tableName}\` LIMIT 1 FOR UPDATE`;
    const selectParams = recordId ? [recordId] : whereKey ? [whereValue] : [];

    // ── Monotonic / CAS path (invoices, timesheets) ──────────────────────────
    if (monotonic) {
        const maxAttempts = config.maxAttempts || 8;
        // Monotonic path doesn't need FOR UPDATE — CAS handles concurrency
        const casSql = selectSql.replace(" FOR UPDATE", "");
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const [rows] = await tx.execute(casSql, selectParams);
            let record = rows?.[0];
            if (!record) {
                if (createSql && !recordId) {
                    await tx.execute(createSql, createParams);
                    const [newRows] = await tx.execute(`SELECT * FROM \`${tableName}\` LIMIT 1`);
                    record = newRows[0];
                }
                if (!record) throw new Error(`Sequential code settings not found for table ${tableName}`);
            }
            const currentNumber = Number(record[numberField]);
            const [res] = await tx.execute(
                `UPDATE \`${tableName}\` SET \`${numberField}\` = \`${numberField}\` + 1
                 WHERE id = ? AND \`${numberField}\` = ?`,
                [record.id, currentNumber]
            );
            if (res.affectedRows === 1) {
                const code = formatSequentialCode(
                    record[prefixField], currentNumber,
                    Number(record[paddingField]), separator
                );
                return { code, number: currentNumber, record };
            }
        }
        throw new Error(`Failed to reserve sequential code for table ${tableName}`);
    }

    // ── MAX-based path (all other modules) ───────────────────────────────────
    // Lock the settings row so concurrent creates serialize here.
    const [rows] = await tx.execute(selectSql, selectParams);
    let record = rows?.[0];

    if (!record) {
        if (createSql && !recordId) {
            await tx.execute(createSql, createParams);
            const [newRows] = await tx.execute(selectSql, selectParams);
            record = newRows[0];
        }
        if (!record) throw new Error(`Sequential code settings not found for table ${tableName}`);
    }

    const prefix    = record[prefixField];
    const padding   = Number(record[paddingField]);
    const floor     = Number(record[numberField]); // admin-configured floor, never auto-changed

    // Compute next = MAX(existing numeric part) + 1, or floor if table is empty
    const numOffset = prefix.length + separator.length + 1;

    // Safely escape regex characters in prefix and separator for MySQL REGEXP
    const escapedPrefix = prefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const escapedSeparator = separator.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regexPattern = `^${escapedPrefix}${escapedSeparator}[0-9]+$`;

    const [maxRows] = await tx.execute(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(\`${entityCodeField}\`, ?) AS UNSIGNED)), ?) + 1 AS nextNum
         FROM \`${entityTableName}\`
         WHERE \`${entityCodeField}\` REGEXP ?`,
        [numOffset, floor - 1, regexPattern]
    );
    const codeNumber = Math.max(Number(maxRows[0].nextNum), floor);
    const code = formatSequentialCode(prefix, codeNumber, padding, separator);
    return { code, number: codeNumber, record };
}
