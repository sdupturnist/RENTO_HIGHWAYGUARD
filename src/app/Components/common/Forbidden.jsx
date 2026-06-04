import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/app/Components/ui/button";

export function Forbidden({ module = "this resource", action = "access" }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
            <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-full mb-6 border border-red-100 dark:border-red-900/30 animate-pulse">
                <ShieldAlert className="h-12 w-12 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight sm:text-4xl mb-3">
                Access Denied
            </h1>
            <p className="text-base text-muted-foreground max-w-md mb-8">
                You do not have the required permissions to {action} {module}. Please contact your administrator if you believe this is an error.
            </p>
            <Button asChild className="rounded-xl shadow-sm gap-2">
                <Link href="/">
                    <ArrowLeft className="h-4 w-4" /> Back to Dashboard
                </Link>
            </Button>
        </div>
    );
}
