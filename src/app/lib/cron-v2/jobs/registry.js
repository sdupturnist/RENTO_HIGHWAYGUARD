import { generateDailyTimeLogs } from "@/app/services/timeLogGenerator";
import { autoCompleteExpiredAssignments } from "@/app/services/assignmentAutoComplete";
import { getClientDb } from "@/app/lib/db";
import { processExpiryEmailReminders } from "@/app/services/expiryEmailReminders";

export const CRON_JOB_KEYS = {
    DAILY_TIME_LOGS: "daily_time_logs",
    ASSIGNMENT_AUTO_COMPLETE: "assignment_auto_complete",
    EXPIRY_EMAIL_REMINDERS: "expiry_email_reminders",
};

async function runDailyTimeLogs({ tenant, windowStart }) {
    const tenantDb = getClientDb(tenant.subdomain);
    const result = await generateDailyTimeLogs(windowStart, tenantDb);
    return {
        processed: true,
        created: Number(result?.created || 0),
        skipped: Number(result?.skipped || 0),
    };
}

async function runAssignmentAutoComplete({ tenant, windowEnd }) {
    const tenantDb = getClientDb(tenant.subdomain);
    const result = await autoCompleteExpiredAssignments({ now: windowEnd }, tenantDb);

    return {
        processed: true,
        completed: Number(result?.completed || 0),
    };
}

export const cronJobRegistry = {
    [CRON_JOB_KEYS.DAILY_TIME_LOGS]: {
        key: CRON_JOB_KEYS.DAILY_TIME_LOGS,
        name: "Daily Time Log Generation",
        runForTenant: runDailyTimeLogs,
    },
    [CRON_JOB_KEYS.ASSIGNMENT_AUTO_COMPLETE]: {
        key: CRON_JOB_KEYS.ASSIGNMENT_AUTO_COMPLETE,
        name: "Assignment Auto Complete",
        runForTenant: runAssignmentAutoComplete,
    },
    [CRON_JOB_KEYS.EXPIRY_EMAIL_REMINDERS]: {
        key: CRON_JOB_KEYS.EXPIRY_EMAIL_REMINDERS,
        name: "Expiry Email Reminders",
        runForTenant: processExpiryEmailReminders,
    },
};
