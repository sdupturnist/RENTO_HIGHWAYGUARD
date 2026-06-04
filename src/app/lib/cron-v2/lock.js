/**
 * Distributed lock for the cron-v2 engine.
 *
 * Was previously backed by MySQL `GET_LOCK()`. Now backed by a flock-style
 * file lock at `<masterFolder>/cron_job_logs/.lock` so the cron no longer
 * depends on the master DB being reachable.
 *
 * The signature of `withMasterCronLock` is preserved so all existing callers
 * (engine.js, /api/master/cron/run, /api/master/cron/run/manual) continue
 * to work unchanged.
 */

import { withFileLock } from "@/app/lib/cron-v2/file-lock";
import { masterCronLockFile } from "@/app/lib/log-paths";

export async function withMasterCronLock(_lockName, callback) {
    return withFileLock(masterCronLockFile(), callback);
}
