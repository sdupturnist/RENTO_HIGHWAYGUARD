"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Label } from "@/app/Components/ui/label";
import { Switch } from "@/app/Components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/Components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/Components/ui/select";
import { Loader2, Activity, RefreshCw, Play, Server } from "lucide-react";
import { toast } from "sonner";

export default function CronSettings() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [activeTab, setActiveTab] = useState("scheduler");

    const [isEnabled, setIsEnabled] = useState(true);
    const [timezone, setTimezone] = useState("UTC");
    const [frequencyMinutes, setFrequencyMinutes] = useState(1);
    const markDirty = () => setIsDirty(true);
    const [v2Meta, setV2Meta] = useState({
        available: true,
        running: true,
        enabledJobs: 0,
        state: null,
    });

    const timezoneOptions = [
        "UTC",
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "America/Toronto",
        "America/Sao_Paulo",
        "Europe/London",
        "Europe/Paris",
        "Europe/Berlin",
        "Europe/Moscow",
        "Africa/Cairo",
        "Africa/Johannesburg",
        "Asia/Dubai",
        "Asia/Karachi",
        "Asia/Kolkata",
        "Asia/Dhaka",
        "Asia/Bangkok",
        "Asia/Singapore",
        "Asia/Shanghai",
        "Asia/Tokyo",
        "Asia/Seoul",
        "Australia/Sydney",
        "Pacific/Auckland",
    ];

    const [jobsLoading, setJobsLoading] = useState(false);
    const [jobs, setJobs] = useState([]);
    const [jobDrafts, setJobDrafts] = useState({});
    const [savingJobKey, setSavingJobKey] = useState(null);

    const hourOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => String(i + 1)), []);
    const minuteOptions = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")), []);
    const [runsLoading, setRunsLoading] = useState(false);
    const [runs, setRuns] = useState([]);
    const [runPage, setRunPage] = useState(1);
    const [runPagination, setRunPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 20 });
    const [runningManual, setRunningManual] = useState(false);

    useEffect(() => {
        fetch("/api/settings/cron")
            .then(res => res.json())
            .then(data => {
                if (data.cronSettings) {
                    setIsEnabled(data.cronSettings.isEnabled ?? true);
                    setTimezone(data.cronSettings.timezone || "UTC");
                    setFrequencyMinutes(data.cronSettings.frequencyMinutes || 1);
                }
                if (data.v2) {
                    setV2Meta({
                        available: true,
                        running: data.cronSettings?.isEnabled ?? true,
                        enabledJobs: Number(data.v2.enabledJobs || 0),
                        state: data.v2.state || null,
                    });
                }
            })
            .catch(() => toast.error("Failed to load cron settings."))
            .finally(() => setIsLoading(false));
    }, []);

    const fetchJobs = async () => {
        setJobsLoading(true);
        try {
            const res = await fetch("/api/settings/cron/jobs");
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to load cron jobs");
            const jobList = data.jobs || [];
            setJobs(jobList);
            const drafts = {};
            for (const job of jobList) {
                const som = Number(job.startMinuteOfDay || 0);
                const hour24 = Math.floor(som / 60);
                const minute = som % 60;
                const period = hour24 >= 12 ? "PM" : "AM";
                const hour12 = (hour24 % 12) || 12;
                drafts[job.jobKey] = {
                    isEnabled: !!job.isEnabled,
                    frequencyMinutes: Number(job.frequencyMinutes || 1440),
                    startMinuteOfDay: som,
                    startHour: String(hour12),
                    startMinute: String(minute).padStart(2, "0"),
                    startPeriod: period,
                    maxRetries: Number(job.maxRetries ?? 0),
                    retryBackoffSeconds: Number(job.retryBackoffSeconds ?? 60),
                    timeoutSeconds: Number(job.timeoutSeconds ?? 300),
                    runOnMissedWindows: !!job.runOnMissedWindows,
                };
            }
            setJobDrafts(drafts);
        } catch (error) {
            toast.error(error.message || "Failed to load cron jobs");
        } finally {
            setJobsLoading(false);
        }
    };

    const updateJobDraft = (jobKey, patch) => {
        setJobDrafts(prev => ({ ...prev, [jobKey]: { ...prev[jobKey], ...patch } }));
    };

    const updateJobStartTime = (jobKey, patch) => {
        setJobDrafts(prev => {
            const next = { ...prev[jobKey], ...patch };
            const h12 = Math.max(1, Math.min(12, Number(next.startHour || 12)));
            const min = Math.max(0, Math.min(59, Number(next.startMinute || 0)));
            const hour24 = (h12 % 12) + (next.startPeriod === "PM" ? 12 : 0);
            next.startMinuteOfDay = hour24 * 60 + min;
            return { ...prev, [jobKey]: next };
        });
    };

    const handleSaveJob = async (jobKey) => {
        const draft = jobDrafts[jobKey];
        if (!draft) return;
        setSavingJobKey(jobKey);
        try {
            const res = await fetch(`/api/settings/cron/jobs/${jobKey}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    isEnabled: !!draft.isEnabled,
                    frequencyMinutes: Number(draft.frequencyMinutes),
                    startMinuteOfDay: Number(draft.startMinuteOfDay),
                    maxRetries: Number(draft.maxRetries ?? 0),
                    retryBackoffSeconds: Number(draft.retryBackoffSeconds ?? 0),
                    timeoutSeconds: Number(draft.timeoutSeconds ?? 1),
                    runOnMissedWindows: !!draft.runOnMissedWindows,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update cron job");
            toast.success(`Updated: ${jobKey}`);
            await fetchJobs();
        } catch (error) {
            toast.error(error.message || "Failed to update cron job");
        } finally {
            setSavingJobKey(null);
        }
    };

    const fetchRuns = async (page = runPage) => {
        setRunsLoading(true);
        try {
            const res = await fetch(`/api/settings/cron/runs?page=${page}&limit=20`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to load cron runs");
            setRuns(data.runs || []);
            setRunPagination(data.pagination || { page: 1, totalPages: 1, total: 0, limit: 20 });
            setRunPage(page);
        } catch (error) {
            toast.error(error.message || "Failed to load cron runs");
        } finally {
            setRunsLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === "jobs" && jobs.length === 0 && !jobsLoading) fetchJobs();
        if (activeTab === "runs" && runs.length === 0 && !runsLoading) fetchRuns(1);
    }, [activeTab]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!timezone) return toast.error("Timezone is required.");
        if (!frequencyMinutes || isNaN(Number(frequencyMinutes)) || Number(frequencyMinutes) < 1)
            return toast.error("Heartbeat must be at least 1 minute.");

        setIsSaving(true);
        try {
            const res = await fetch("/api/settings/cron", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isEnabled, timezone, frequencyMinutes: Number(frequencyMinutes) }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Settings saved.");
                setIsDirty(false);
                setV2Meta(prev => ({ ...prev, running: !!isEnabled }));
            } else {
                toast.error(data.error || "Failed to update cron settings");
            }
        } catch {
            toast.error("An error occurred while saving.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleManualRun = async () => {
        setRunningManual(true);
        try {
            const res = await fetch("/api/settings/cron/run/manual", { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Manual run failed");
            toast.success("Manual cron cycle triggered.");
            if (activeTab === "runs") await fetchRuns(1);
        } catch (error) {
            toast.error(error.message || "Manual run failed");
        } finally {
            setRunningManual(false);
        }
    };

    if (isLoading) {
        return <div className="p-8 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h3 className="text-xl font-semibold mb-1">Cron Controls</h3>
                    <p className="text-sm text-slate-500">Manage scheduler heartbeat, job configuration, and execution health.</p>
                    <p className={`text-xs mt-1 ${v2Meta.running ? "text-emerald-600" : "text-amber-600"}`}>
                        {v2Meta.running ? "Scheduler is active." : "Scheduler is paused. Enable and save to resume."}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="px-3 py-1.5 rounded-lg border bg-slate-50 text-xs text-slate-600 flex items-center gap-2">
                        <Server className="w-3.5 h-3.5" />
                        {isEnabled ? "Running" : "Paused"}
                    </div>
                    <Button variant="outline" onClick={handleManualRun} disabled={runningManual}>
                        {runningManual ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                        Run Manual Cycle
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
                    <TabsTrigger value="jobs">Jobs</TabsTrigger>
                    <TabsTrigger value="runs">Runs & Health</TabsTrigger>
                </TabsList>

                <TabsContent value="scheduler" className="mt-4">
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="rounded-xl border p-3">
                                <div className="text-xs text-slate-500">Enabled Jobs</div>
                                <div className="text-2xl font-semibold">{v2Meta.enabledJobs}</div>
                            </div>
                            <div className="rounded-xl border p-3">
                                <div className="text-xs text-slate-500">Last Attempt</div>
                                <div className="text-sm font-medium">{v2Meta.state?.lastAttemptedRunAt ? new Date(v2Meta.state.lastAttemptedRunAt).toLocaleString() : "-"}</div>
                            </div>
                            <div className="rounded-xl border p-3">
                                <div className="text-xs text-slate-500">Last Success</div>
                                <div className="text-sm font-medium">{v2Meta.state?.lastSuccessfulRunAt ? new Date(v2Meta.state.lastSuccessfulRunAt).toLocaleString() : "-"}</div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="cron-switch" className="text-base font-semibold">Scheduler Toggle</Label>
                                    <p className="text-sm text-slate-500">
                                        {isEnabled ? "Scheduler is currently executing jobs." : "Scheduler is halted. Automations will not run."}
                                    </p>
                                </div>
                                <Switch
                                    id="cron-switch"
                                    checked={isEnabled}
                                    onCheckedChange={v => { setIsEnabled(v); markDirty(); }}
                                    className={isEnabled ? "bg-green-600" : "bg-slate-300 dark:bg-slate-700"}
                                />
                            </div>
                        </div>

                        <div className={`space-y-5 transition-all duration-300 ${!isEnabled ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
                            <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500 p-2 rounded-md">
                                <Activity className="w-4 h-4" /> Engine Settings
                            </h4>

                            <div className="space-y-2">
                                <Label htmlFor="cronTimezone">Timezone</Label>
                                <Select value={timezone} onValueChange={v => { setTimezone(v); markDirty(); }}>
                                    <SelectTrigger id="cronTimezone">
                                        <SelectValue placeholder="Select timezone" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-72">
                                        {timezoneOptions.map(tz => (
                                            <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-slate-500">Job due-time checks use this timezone.</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="frequencyMinutes">Heartbeat (Minutes)</Label>
                                <Input
                                    id="frequencyMinutes"
                                    type="number"
                                    min="1"
                                    value={frequencyMinutes}
                                    onChange={e => { setFrequencyMinutes(e.target.value); markDirty(); }}
                                    required
                                    placeholder="e.g. 1"
                                />
                                <p className="text-xs text-slate-500">How often the engine wakes up and checks due job windows.</p>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {isSaving ? "Saving..." : isDirty ? "Save Changes" : "Saved"}
                            </Button>
                        </div>
                    </form>
                </TabsContent>

                <TabsContent value="jobs" className="mt-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-500">Configure each scheduled job&apos;s frequency, start time, and retry behaviour.</p>
                        <Button variant="outline" onClick={fetchJobs} disabled={jobsLoading}>
                            {jobsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Refresh
                        </Button>
                    </div>
                    {jobsLoading ? (
                        <div className="p-8 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
                    ) : jobs.length === 0 ? (
                        <div className="rounded-xl border p-6 text-sm text-slate-500">No cron jobs found.</div>
                    ) : (
                        <div className="space-y-4">
                            {jobs.map(job => {
                                const d = jobDrafts[job.jobKey] || {};
                                const isSavingThis = savingJobKey === job.jobKey;
                                return (
                                    <div key={job.jobKey} className="rounded-xl border p-4 space-y-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="font-semibold">{job.name || job.jobKey}</div>
                                                <div className="text-xs text-slate-500">{job.jobKey}</div>
                                                {job.description && <div className="text-sm text-slate-500 mt-0.5">{job.description}</div>}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <Label htmlFor={`enabled-${job.jobKey}`} className="text-sm">
                                                    {d.isEnabled ? "Enabled" : "Disabled"}
                                                </Label>
                                                <Switch
                                                    id={`enabled-${job.jobKey}`}
                                                    checked={!!d.isEnabled}
                                                    onCheckedChange={v => updateJobDraft(job.jobKey, { isEnabled: v })}
                                                    className={d.isEnabled ? "bg-green-600" : ""}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label>Frequency (minutes)</Label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={d.frequencyMinutes ?? 1440}
                                                    onChange={e => updateJobDraft(job.jobKey, { frequencyMinutes: e.target.value })}
                                                    placeholder="e.g. 1440"
                                                />
                                                <p className="text-xs text-slate-500">How often this job runs.</p>
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label>Daily Start Time</Label>
                                                <div className="flex gap-2">
                                                    <Select value={d.startHour || "12"} onValueChange={v => updateJobStartTime(job.jobKey, { startHour: v })}>
                                                        <SelectTrigger className="w-20">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="max-h-60">
                                                            {hourOptions.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                    <Select value={d.startMinute || "00"} onValueChange={v => updateJobStartTime(job.jobKey, { startMinute: v })}>
                                                        <SelectTrigger className="w-20">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="max-h-60">
                                                            {minuteOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                    <Select value={d.startPeriod || "AM"} onValueChange={v => updateJobStartTime(job.jobKey, { startPeriod: v })}>
                                                        <SelectTrigger className="w-20">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="AM">AM</SelectItem>
                                                            <SelectItem value="PM">PM</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <p className="text-xs text-slate-500">Earliest window start in scheduler timezone.</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="space-y-1.5">
                                                <Label>Max Retries</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={d.maxRetries ?? 0}
                                                    onChange={e => updateJobDraft(job.jobKey, { maxRetries: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label>Retry Backoff (seconds)</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={d.retryBackoffSeconds ?? 60}
                                                    onChange={e => updateJobDraft(job.jobKey, { retryBackoffSeconds: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label>Timeout (seconds)</Label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={d.timeoutSeconds ?? 300}
                                                    onChange={e => updateJobDraft(job.jobKey, { timeoutSeconds: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-slate-100 space-y-3">
                                            <div className="flex items-center gap-3">
                                                <Switch
                                                    id={`catchup-${job.jobKey}`}
                                                    checked={!!d.runOnMissedWindows}
                                                    onCheckedChange={v => updateJobDraft(job.jobKey, { runOnMissedWindows: v })}
                                                />
                                                <Label htmlFor={`catchup-${job.jobKey}`} className="text-sm cursor-pointer">
                                                    Catch up missed windows
                                                </Label>
                                            </div>
                                            <div className="flex justify-end">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleSaveJob(job.jobKey)}
                                                    disabled={isSavingThis}
                                                >
                                                    {isSavingThis && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                                                    {isSavingThis ? "Saving..." : "Save Changes"}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="runs" className="mt-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-500">Recent scheduler runs and job-level health.</p>
                        <Button variant="outline" onClick={() => fetchRuns(runPage)} disabled={runsLoading}>
                            {runsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                            Refresh
                        </Button>
                    </div>
                    <div className="rounded-xl border overflow-hidden">
                        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600">
                            <div className="col-span-3">Started</div>
                            <div className="col-span-2">Status</div>
                            <div className="col-span-2">Source</div>
                            <div className="col-span-5">Jobs</div>
                        </div>
                        {runsLoading ? (
                            <div className="p-6 flex items-center justify-center text-slate-500"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...</div>
                        ) : runs.length === 0 ? (
                            <div className="p-6 text-sm text-slate-500">No runs recorded yet.</div>
                        ) : runs.map(run => (
                            <div key={run.id} className="grid grid-cols-12 gap-2 px-3 py-3 border-t text-sm">
                                <div className="col-span-3">{new Date(run.startedAt).toLocaleString()}</div>
                                <div className="col-span-2">{run.status}</div>
                                <div className="col-span-2">{run.triggerSource}</div>
                                <div className="col-span-5 space-y-1">
                                    {(run.jobRuns || []).length === 0 ? (
                                        <div className="text-slate-500">No due job windows</div>
                                    ) : run.jobRuns.map(jr => (
                                        <div key={jr.id} className="text-xs text-slate-600">
                                            {jr.jobKey}: {jr.status} (ok: {jr.successCount}, fail: {jr.failedCount})
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-500">
                            Page {runPagination.page} of {runPagination.totalPages} ({runPagination.total} total)
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={runPagination.page <= 1 || runsLoading} onClick={() => fetchRuns(runPagination.page - 1)}>Previous</Button>
                            <Button variant="outline" size="sm" disabled={runPagination.page >= runPagination.totalPages || runsLoading} onClick={() => fetchRuns(runPagination.page + 1)}>Next</Button>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
