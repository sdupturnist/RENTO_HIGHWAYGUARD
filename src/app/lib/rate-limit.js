const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_ATTEMPTS = 10; // per window
// In-memory store per Node.js instance; for distributed environments replace with Redis.
const buckets = new Map();
function getBucket(key) {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (bucket && bucket.expires > now) {
        return bucket;
    }
    const fresh = { count: 0, expires: now + WINDOW_MS };
    buckets.set(key, fresh);
    return fresh;
}
export async function checkRateLimit(key) {
    const bucket = getBucket(key);
    bucket.count += 1;
    const remaining = MAX_ATTEMPTS - bucket.count;
    const resetMs = bucket.expires - Date.now();
    const limited = bucket.count > MAX_ATTEMPTS;
    return { limited, remaining: Math.max(0, remaining), resetMs: Math.max(0, resetMs) };
}
