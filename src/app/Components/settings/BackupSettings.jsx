"use client";

import { useState } from "react";
import { Button } from "@/app/Components/ui/button";
import { Label } from "@/app/Components/ui/label";
import { Loader2, Download, UploadCloud, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/Components/ui/dialog";
import { Checkbox } from "@/app/Components/ui/checkbox";

export function BackupSettings() {
    const [isBackingUp, setIsBackingUp] = useState(false);

    // Restore state
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [restoreFile, setRestoreFile] = useState(null);
    const [isRestoring, setIsRestoring] = useState(false);
    const [restoreDb, setRestoreDb] = useState(true);
    const [restoreFiles, setRestoreFiles] = useState(true);

    const handleBackup = async () => {
        setIsBackingUp(true);
        try {
            const response = await fetch("/api/settings/backup");

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Backup Stream Failed");
            }

            // Create a blob from the response stream
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `tenant_backup_${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success("Backup downloaded successfully.");

        } catch (error) {
            toast.error(error.message || "An error occurred during backup generation.");
        } finally {
            setIsBackingUp(false);
        }
    };

    const handleRestoreFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.name.endsWith(".zip")) {
            toast.error("Please upload a valid .zip backup file.");
            setRestoreFile(null);
            return;
        }
        setRestoreFile(file);
    };

    const handleRestore = async () => {
        if (!restoreFile) return;
        if (!restoreDb && !restoreFiles) {
            toast.error("Please select at least one component to restore (Database or Files).");
            return;
        }

        setIsRestoring(true);
        try {
            const formData = new FormData();
            formData.append("backupFile", restoreFile);
            formData.append("restoreDb", restoreDb);
            formData.append("restoreFiles", restoreFiles);

            const res = await fetch("/api/settings/restore", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("System restored successfully!");
                setIsRestoreModalOpen(false);
                setRestoreFile(null);
                setTimeout(() => window.location.reload(), 2000);
            } else {
                toast.error(data.error || "Restore process failed.");
            }
        } catch (error) {
            toast.error("An error occurred during the restore process.");
        } finally {
            setIsRestoring(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h3 className="text-xl font-semibold mb-1 text-slate-900 dark:text-slate-100">Backup & Restore</h3>
                <p className="text-sm text-slate-500 max-w-2xl">
                    Download a secure snapshot of your current database and uploaded files. You can safely restore from a previous backup file at any time.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* Backup Card */}
                <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mb-2">
                        <Download className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-lg">Generate Full Backup</h4>
                        <p className="text-sm text-slate-500 mt-1">Downloads a complete ZIP containing your workspace database schema and all attached media files.</p>
                    </div>
                    <Button
                        onClick={handleBackup}
                        disabled={isBackingUp}
                        className="mt-4 w-full max-w-[200px] bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isBackingUp ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Compiling...</> : <><Download className="w-4 h-4 mr-2" /> Download Dump</>}
                    </Button>
                </div>

                {/* Restore Card */}
                <div className="p-6 rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/20 flex flex-col items-center justify-center text-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center mb-2">
                        <UploadCloud className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-lg text-red-700 dark:text-red-400">Restore Workspace</h4>
                        <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">DANGER: Replaces your current workspace entirely with the uploaded zip file.</p>
                    </div>
                    <Button
                        onClick={() => setIsRestoreModalOpen(true)}
                        variant="destructive"
                        className="mt-4 w-full max-w-[200px]"
                    >
                        <UploadCloud className="w-4 h-4 mr-2" /> Upload Backup
                    </Button>
                </div>

            </div>

            {/* Restore Confirmation Modal */}
            <Dialog open={isRestoreModalOpen} onOpenChange={(open) => {
                setIsRestoreModalOpen(open);
                if (!open) setRestoreFile(null);
            }}>
                <DialogContent className="border-red-200 dark:border-red-900">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-500">
                            <AlertTriangle className="w-5 h-5" /> Workspace Restore
                        </DialogTitle>
                        <DialogDescription className="text-slate-600 dark:text-slate-400 pt-2 space-y-2">
                            <p><strong>WARNING:</strong> This action is strictly destructive! It will safely drop and overwrite your selected components based on the uploaded ZIP dump.</p>
                            <p>Any recent changes to your DB or uploaded Files since that backup was created will be permanently lost.</p>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="my-4 space-y-4">
                        <div className="p-4 border rounded-md bg-slate-50 dark:bg-slate-900">
                            <Label htmlFor="restoreFile" className="text-sm font-semibold mb-2 block">1. Select .zip Archive</Label>
                            <input
                                id="restoreFile"
                                type="file"
                                accept=".zip"
                                onChange={handleRestoreFileChange}
                                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                        </div>

                        <div className="p-4 border rounded-md bg-slate-50 dark:bg-slate-900">
                            <Label className="text-sm font-semibold mb-3 block">2. Select Components to Restore</Label>
                            <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="restoreDb" checked={restoreDb} onCheckedChange={setRestoreDb} />
                                    <div className="grid gap-1.5 leading-none">
                                        <label htmlFor="restoreDb" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            Restore Database Tables
                                        </label>
                                        <p className="text-xs text-muted-foreground">Drops current database and executes the exported SQL script.</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="restoreFiles" checked={restoreFiles} onCheckedChange={setRestoreFiles} />
                                    <div className="grid gap-1.5 leading-none">
                                        <label htmlFor="restoreFiles" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                            Restore Uploaded Files
                                        </label>
                                        <p className="text-xs text-muted-foreground">Overwrites the tenant's exact file storage snapshot.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRestoreModalOpen(false)}>Cancel Safety</Button>
                        <Button
                            variant="destructive"
                            onClick={handleRestore}
                            disabled={isRestoring || !restoreFile}
                        >
                            {isRestoring ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Overwriting...</> : "Confirm Destruction & Restore"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
