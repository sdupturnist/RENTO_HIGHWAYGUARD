import { dbTenant } from "@/app/lib/db";

export async function autoCompleteExpiredAssignments(params = {}) {
    const now = params?.now ? new Date(params.now) : new Date();

    const [expiredAssignments] = await dbTenant(`
        SELECT id, assignmentCode FROM \`assignments\`
        WHERE status = 'ACTIVE' AND endDate < ?
    `, [now]);

    if (!expiredAssignments || expiredAssignments.length === 0) {
        return {
            completed: 0,
            updatedAssignments: [],
        };
    }

    const ids = expiredAssignments.map((a) => a.id);
    const [res] = await dbTenant(`
        UPDATE \`assignments\` SET status = 'COMPLETED', updatedAt = NOW()
        WHERE id IN (${ids.map(() => '?').join(',')})
    `, ids);

    return {
        completed: Number(res?.affectedRows || 0),
        updatedAssignments: expiredAssignments.map((a) => a.assignmentCode).filter(Boolean),
    };
}
