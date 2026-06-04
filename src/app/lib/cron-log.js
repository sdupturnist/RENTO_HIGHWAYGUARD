import { appendLogLine } from "@/app/lib/file-logging";
import { masterCronRunFile } from "@/app/lib/log-paths";

export async function appendCronLog(entry) {
    await appendLogLine(masterCronRunFile(), {
        ts: new Date().toISOString(),
        scope: "master-cron",
        ...entry,
    });
}
