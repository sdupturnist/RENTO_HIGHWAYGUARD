"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/app/Components/ui/card";
import { Input } from "@/app/Components/ui/input";
import { Label } from "@/app/Components/ui/label";
import { Button } from "@/app/Components/ui/button";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const submit = async (e) => {
        e.preventDefault();
        if (!email) {
            toast.error("Please enter your email.");
            return;
        }
        setLoading(true);
        const res = await fetch("/api/auth/forgot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });
        if (res.ok) {
            toast.success("If that email exists, a reset link has been sent.");
            setTimeout(() => router.push("/login"), 1500);
        }
        else {
            toast.error("Unable to start password reset right now.");
        }
        setLoading(false);
    };
    return (<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6">
            <Card className="w-full max-w-md shadow-lg">
                <CardContent className="pt-6 space-y-6">
                    <div className="space-y-2 text-center">
                        <h1 className="text-2xl font-bold">Reset your password</h1>
                        <p className="text-sm text-muted-foreground">
                            Enter the email associated with your account. We’ll send you a reset link.
                        </p>
                    </div>
                    <form onSubmit={submit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <div className="relative">
                                <Mail className="h-4 w-4 text-muted-foreground absolute left-3 top-3"/>
                                <Input id="email" type="email" placeholder="you@company.com" className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} required/>
                            </div>
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? (<>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2"/>
                                    Sending...
                                </>) : ("Send reset link")}
                        </Button>
                        <Button type="button" variant="ghost" className="w-full" onClick={() => router.push("/login")}>
                            Back to sign in
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>);
}
