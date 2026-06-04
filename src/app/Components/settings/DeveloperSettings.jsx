"use client";

import { useState, useEffect } from "react";
import { Button } from "@/app/Components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Input } from "@/app/Components/ui/input";
import { Checkbox } from "@/app/Components/ui/checkbox";
import { Label } from "@/app/Components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/Components/ui/table";
import { Badge } from "@/app/Components/ui/badge";
import { toast } from "sonner";
import { Copy, Plus, RefreshCw, Key, BookOpen, ExternalLink, ShieldCheck, CheckCircle2, Trash2 } from "lucide-react";
import Link from "next/link";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/app/Components/ui/alert-dialog";

export default function DeveloperSettingsPage() {
    const [apiKeys, setApiKeys] = useState([]);
    const [availableScopes, setAvailableScopes] = useState([]);
    const [selectedScopes, setSelectedScopes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newKey, setNewKey] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [keyToDelete, setKeyToDelete] = useState(null);
    const [keyName, setKeyName] = useState(`API Key ${new Date().toLocaleDateString()}`);

    const groupedScopes = availableScopes.reduce((acc, scope) => {
        if (!acc[scope.module]) acc[scope.module] = [];
        acc[scope.module].push(scope);
        return acc;
    }, {});

    const fetchKeys = async () => {
        try {
            const res = await fetch("/api/settings/api-keys");
            if (res.ok) {
                const data = await res.json();
                setApiKeys(data.keys || []);
                setAvailableScopes(data.availableScopes || []);
            } else {
                const err = await res.json().catch(() => ({}));
                console.error("API keys fetch failed:", res.status, err);
            }
        } catch (error) {
            console.error("Failed to fetch API keys", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKeys();
    }, []);

    const generateKey = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch("/api/settings/api-keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: keyName, scopes: selectedScopes })
            });
            const data = await res.json();
            if (res.ok) {
                setNewKey(data.key); // Show raw key once
                setSelectedScopes([]);
                fetchKeys();
                toast.success("API Key generated successfully");
            } else {
                toast.error(data.message || "Failed to generate key");
            }
        } catch (error) {
            toast.error("Error generating key");
        } finally {
            setIsGenerating(false);
        }
    };

    const confirmDelete = async () => {
        if (!keyToDelete) return;
        try {
            const res = await fetch(`/api/settings/api-keys/${keyToDelete.id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                toast.success("API Key revoked successfully");
                fetchKeys();
            } else {
                toast.error("Failed to revoke key");
            }
        } catch (error) {
            toast.error("Error revoking key");
        } finally {
            setKeyToDelete(null);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    const toggleScope = (scope) => {
        setSelectedScopes((current) => {
            const exists = current.some((item) => item.module === scope.module && item.action === scope.action);
            if (exists) {
                return current.filter((item) => !(item.module === scope.module && item.action === scope.action));
            }
            return [...current, { module: scope.module, action: scope.action }];
        });
    };

    const isScopeSelected = (scope) => {
        return selectedScopes.some((item) => item.module === scope.module && item.action === scope.action);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
                        Developer API
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Manage API keys and access integration resources.
                    </p>
                </div>
                <div className="flex gap-3">
                    <Link href="/developer-guide" target="_blank">
                        <Button variant="outline" className="gap-2">
                            <BookOpen className="h-4 w-4" />
                            View API Guide
                        </Button>
                    </Link>

                    <Button onClick={generateKey} disabled={isGenerating || selectedScopes.length === 0 || !keyName.trim()} className="gap-2 shadow-lg shadow-primary/20">
                        {isGenerating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Generate New Key
                    </Button>
                </div>
            </div>

            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
                <CardHeader>
                    <CardTitle>Create Scoped API Key</CardTitle>
                    <CardDescription>
                        API keys now get only the exact permissions selected here. They no longer inherit full tenant admin access.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="api-key-name">Key Name</Label>
                        <Input
                            id="api-key-name"
                            value={keyName}
                            onChange={(e) => setKeyName(e.target.value)}
                            placeholder="e.g. Power BI read-only"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="font-medium">Permission Scopes</p>
                                <p className="text-sm text-muted-foreground">
                                    Choose the module actions this key is allowed to perform.
                                </p>
                            </div>
                            <Badge variant="outline">{selectedScopes.length} selected</Badge>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {Object.entries(groupedScopes).map(([module, scopes]) => (
                                <div key={module} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                                    <div className="font-medium text-sm">{module}</div>
                                    <div className="space-y-2">
                                        {scopes.map((scope) => (
                                            <label key={scope.key} className="flex items-center gap-3 text-sm">
                                                <Checkbox
                                                    checked={isScopeSelected(scope)}
                                                    onCheckedChange={() => toggleScope(scope)}
                                                />
                                                <span>{scope.action}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* New Key Alert */}
            {newKey && (
                <Card className="border-green-500/50 bg-green-50/50 dark:bg-green-900/10 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-green-700 dark:text-green-400 flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5" />
                            New API Key Generated
                        </CardTitle>
                        <CardDescription className="text-green-700/80 dark:text-green-400/80">
                            Please copy this key now. It will not be shown again in full.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-green-200 dark:border-green-800">
                            <Key className="h-5 w-5 text-green-600" />
                            <code className="flex-1 font-mono text-lg text-slate-800 dark:text-slate-200">
                                {newKey}
                            </code>
                            <Button size="icon" variant="ghost" onClick={() => copyToClipboard(newKey)}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-6 md:grid-cols-3">
                {/* Active Keys Section */}
                <Card className="md:col-span-2 border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                            Active API Keys
                        </CardTitle>
                        <CardDescription>
                            These keys allow external applications to access your data.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Key Prefix</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead>Last Used</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                                                Loading keys...
                                            </TableCell>
                                        </TableRow>
                                    ) : apiKeys.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                                                No active API keys found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        apiKeys.map((key) => (
                                            <TableRow key={key.id}>
                                                <TableCell className="font-medium">{key.name}</TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground">
                                                    {key.keyPreview}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {new Date(key.createdAt).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : "Never"}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={key.isActive ? "success" : "secondary"} className={key.isActive ? "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400" : ""}>
                                                        {key.isLegacyUnscoped ? "Needs Scope Review" : (key.isActive ? "Active" : "Inactive")}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => setKeyToDelete(key)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>



                {/* Resources Quick Link */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-sm h-fit">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Quick Reference</CardTitle>
                        <CardDescription>Key endpoints for integration.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <h4 className="font-medium text-sm text-foreground">Auth Header</h4>
                            <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 text-xs font-mono">
                                x-api-key: your_key_here
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-medium text-sm text-foreground">Security Notes</h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li>Each key is shown in full only once when created.</li>
                                <li>Each key now gets only the scopes you assign.</li>
                                <li>Older keys without scopes should be replaced.</li>
                            </ul>
                        </div>

                        <div className="space-y-2">
                            <h4 className="font-medium text-sm text-foreground">Common Endpoints</h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li className="flex items-center gap-2">
                                    <Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px]">GET</Badge>
                                    <span className="truncate">/api/vehicles</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px]">POST</Badge>
                                    <span className="truncate">/api/vehicles</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px]">GET</Badge>
                                    <span className="truncate">/api/invoices</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Badge variant="outline" className="h-5 px-1.5 font-mono text-[10px]">GET</Badge>
                                    <span className="truncate">/api/projects</span>
                                </li>
                            </ul>
                        </div>

                        <div className="pt-2">
                            <Link href="/developer-guide" target="_blank">
                                <Button variant="secondary" className="w-full gap-2 text-xs">
                                    <ExternalLink className="h-3 w-3" />
                                    Open Full Documentation
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <AlertDialog open={!!keyToDelete} onOpenChange={() => setKeyToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this API key? Any applications using this key will immediately lose access. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
                            Revoke Key
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
