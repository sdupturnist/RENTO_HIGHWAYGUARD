"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail, Loader2, Truck, Clock, ArrowRight, Wallet, Eye, EyeOff } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Label } from "@/app/Components/ui/label";
import { Card, CardContent } from "@/app/Components/ui/card";
import Link from "next/link";

export default function LoginClient({ branding }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isPasswordChanged = searchParams.get("changed") === "password";
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            if (res.ok) {
                const data = await res.json();
                // Full page navigation to ensure store re-initializes with fresh session
                window.location.href = data?.requiresPasswordChange ? "/profile?passwordChange=required" : "/";
            } else {
                const data = await res.json();
                setError(data.message || "Something went wrong");
                setLoading(false);
            }
        } catch {
            setError("An unexpected error occurred");
            setLoading(false);
        }
    };

    const initials = branding?.appName
        ? branding.appName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
        : null;

    const appYear = new Date().getFullYear();
    const loginBrandName = branding?.loginBrandName || branding?.appName || "";

    return (
        <div className="flex min-h-screen w-full bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <div className="hidden lg:flex w-1/2 relative overflow-hidden flex-col p-12 justify-center">
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none opacity-60">
                    <div className="absolute -top-[25%] -left-[15%] w-[75%] h-[75%] rounded-full bg-primary/15 blur-3xl" />
                    <div className="absolute bottom-[5%] -right-[15%] w-[70%] h-[70%] rounded-full bg-accent/20 blur-3xl" />
                </div>

                <div className="absolute top-12 left-12 z-20 flex items-center gap-3 h-10">
                    {branding?.logoUrl ? (
                        <img src={branding.logoUrl} alt={branding.appName || "Logo"} className="h-10 w-auto object-contain" />
                    ) : initials ? (
                        <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-lg">
                            {initials}
                        </div>
                    ) : null}
                    {branding?.appName && (
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">{branding.appName}</span>
                    )}
                </div>

                <div className="relative z-10 max-w-xl mx-auto space-y-8">
                    <div className="space-y-6">
                        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                            Welcome to {loginBrandName} <br />
                            <span className="text-primary">Fleet Operations System</span>
                        </h1>
                        <p className="text-lg text-slate-600 dark:text-slate-300 max-w-lg">
                            Manage fleet operations, assignments, time logs, and billing from one secure platform.
                        </p>
                    </div>

                    <div className="space-y-5">
                        <div className="flex gap-5 items-center bg-white/70 dark:bg-slate-800/60 p-4 rounded-2xl backdrop-blur-xl border border-border/60 shadow-sm transition-all hover:shadow-md">
                            <div className="h-12 w-12 shrink-0 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                                <Truck className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-lg">Fleet &amp; Assignment Control</h3>
                            </div>
                        </div>

                        <div className="flex gap-5 items-center bg-white/70 dark:bg-slate-800/60 p-4 rounded-2xl backdrop-blur-xl border border-border/60 shadow-sm transition-all hover:shadow-md">
                            <div className="h-12 w-12 shrink-0 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <Clock className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-lg">Time Logs &amp; Timesheets</h3>
                            </div>
                        </div>

                        <div className="flex gap-5 items-center bg-white/70 dark:bg-slate-800/60 p-4 rounded-2xl backdrop-blur-xl border border-border/60 shadow-sm transition-all hover:shadow-md">
                            <div className="h-12 w-12 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <Wallet className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-lg">Billing &amp; Invoicing</h3>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-12 left-12 text-sm text-slate-400">© {appYear} UPTURNIST. Authorized access only.</div>
            </div>

            <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 relative">
                <div className="lg:hidden absolute top-8 left-8 flex items-center gap-2 h-8">
                    {branding?.logoUrl ? (
                        <img src={branding.logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
                    ) : initials ? (
                        <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold text-sm">
                            {initials}
                        </div>
                    ) : null}
                    {branding?.appName && <span className="font-bold text-lg text-slate-900 dark:text-white">{branding.appName}</span>}
                </div>

                <div className="w-full max-w-md space-y-8">
                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Sign in to your account</h2>
                    </div>

                    <Card className="border-none shadow-none bg-transparent">
                        <CardContent className="p-0">
                            <form onSubmit={handleLogin} className="space-y-6">
                                {isPasswordChanged && (
                                    <div className="p-4 text-sm font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-100 dark:border-emerald-900/50 animate-in fade-in slide-in-from-top-1">
                                        Password changed successfully. Please sign in with your new password.
                                    </div>
                                )}

                                {error && (
                                    <div className="p-4 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/50 animate-in fade-in slide-in-from-top-1">
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-slate-600 dark:text-slate-400 font-medium">Email Address</Label>
                                    <div className="relative group">
                                        <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                                        <Input id="email" type="email" placeholder="name@company.com" className="pl-10 h-12 bg-white/70 dark:bg-slate-900/60 border-border/70 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all rounded-xl backdrop-blur" value={email} onChange={(e) => setEmail(e.target.value)} required />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="password" className="text-slate-600 dark:text-slate-400 font-medium">Password</Label>
                                        <Link href="/forgot" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">Forgot password?</Link>
                                    </div>
                                    <div className="relative group">
                                        <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                                        <Input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Type your password"
                                            className="pl-10 pr-11 h-12 bg-white/70 dark:bg-slate-900/60 border-border/70 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all rounded-xl backdrop-blur"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((v) => !v)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                            aria-label={showPassword ? "Hide password" : "Show password"}
                                        >
                                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                        </button>
                                    </div>
                                </div>

                                <Button type="submit" className="w-full h-12 rounded-xl" disabled={loading}>
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Signing in...
                                        </>
                                    ) : (
                                        <span className="flex items-center justify-center gap-2">
                                            Sign In <ArrowRight className="h-4 w-4" />
                                        </span>
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8">
                        Protected login. Unauthorized access attempts are monitored and logged.
                    </p>

                    <div className="lg:hidden text-center text-xs text-slate-400 mt-12 pb-4">© {appYear} UPTURNIST. Authorized access only.</div>
                </div>
            </div>
        </div>
    );
}
