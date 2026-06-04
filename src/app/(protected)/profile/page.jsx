"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProfileForm } from "@/app/Components/profile/ProfileForm";
import { ChangePasswordForm } from "@/app/Components/profile/ChangePasswordForm";
import { PageHeader } from "@/app/Components/ui/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/app/Components/ui/alert";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAppStore } from "@/app/lib/store/useAppStore";

export default function ProfilePage() {
    const searchParams = useSearchParams();
    const { profile: user, isLoading: loading } = useAppStore();
    if (loading) {
        return (<div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
            </div>);
    }
    if (!user) {
        return <div className="p-8">Failed to load profile.</div>;
    }
    const passwordChangeRequired = searchParams.get("passwordChange") === "required";
    return (<div className="max-w-5xl mx-auto space-y-8">
            <PageHeader title="My Account" description="Manage your profile and security settings"/>

            {passwordChangeRequired && (
                <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Password update required</AlertTitle>
                    <AlertDescription>
                        Your password was reset by client master. Please set a new password before continuing to other pages.
                    </AlertDescription>
                </Alert>
            )}

            <ProfileForm initialData={user}/>
            <ChangePasswordForm />
        </div>);
}
