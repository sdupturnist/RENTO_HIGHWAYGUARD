"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent } from "@/app/Components/ui/card";
import { Input } from "@/app/Components/ui/input";
import { Label } from "@/app/Components/ui/label";
import { Button } from "@/app/Components/ui/button";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
export function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token") || "";
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const submit = async (e) => {
        e.preventDefault();
        if (!token) {
            toast.error("Reset link is missing or invalid.");
            return;
        }
        if (password !== confirm) {
            toast.error("Passwords do not match.");
            return;
        }
        setLoading(true);
        const res = await fetch("/api/auth/reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, password }),
        });
        if (res.ok) {
            toast.success("Password reset successful. Redirecting to sign in...");
            setTimeout(() => router.push("/login"), 1500);
        }
        else {
            const data = await res.json().catch(() => ({}));
            toast.error(data?.message || "Unable to reset password.");
        }
        setLoading(false);
    };
    return (<div className="flex min-h-screen w-full bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <div className="flex w-full items-center justify-center p-6">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                            Reset your password
                        </h2>
                        <p className="text-sm text-muted-foreground">Enter a new password to regain access.</p>
                    </div>

                    <Card className="border-none shadow-none bg-transparent">
                        <CardContent className="p-0">
                            <form className="space-y-6" onSubmit={submit}>
                                <div className="space-y-2">
                                    <Label htmlFor="password" className="text-slate-600 dark:text-slate-400 font-medium">New password</Label>
                                    <div className="relative group">
                                        <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors"/>
                                        <Input id="password" type="password" placeholder="••••••••" className="pl-10 h-12 bg-white/70 dark:bg-slate-900/60 border-border/70 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all rounded-xl backdrop-blur" value={password} onChange={(e) => setPassword(e.target.value)} required/>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="confirm" className="text-slate-600 dark:text-slate-400 font-medium">Confirm password</Label>
                                    <div className="relative group">
                                        <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors"/>
                                        <Input id="confirm" type="password" placeholder="••••••••" className="pl-10 h-12 bg-white/70 dark:bg-slate-900/60 border-border/70 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all rounded-xl backdrop-blur" value={confirm} onChange={(e) => setConfirm(e.target.value)} required/>
                                    </div>
                                </div>

                                <Button type="submit" className="w-full h-12 rounded-xl" disabled={loading}>
                                    {loading ? (<>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin"/>
                                            Saving...
                                        </>) : ("Reset password")}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>);
}
