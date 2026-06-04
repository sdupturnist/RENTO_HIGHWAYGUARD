export function getMinuteWindowBoundary(input = new Date()) {
    const date = new Date(input);
    date.setSeconds(0, 0);
    return date;
}

export function buildWindowsBetween(startInclusive, endInclusive, frequencyMinutes) {
    const windows = [];
    if (!startInclusive || !endInclusive || frequencyMinutes <= 0) return windows;

    const cursor = getMinuteWindowBoundary(startInclusive);
    const end = getMinuteWindowBoundary(endInclusive);
    const stepMs = frequencyMinutes * 60 * 1000;

    while (cursor <= end) {
        const windowStart = new Date(cursor);
        const windowEnd = new Date(cursor.getTime() + stepMs - 1);
        windows.push({ windowStart, windowEnd });
        cursor.setTime(cursor.getTime() + stepMs);
    }

    return windows;
}
