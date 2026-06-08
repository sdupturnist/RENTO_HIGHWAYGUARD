"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, } from "@/app/Components/ui/form";
import { Input } from "@/app/Components/ui/input";
import { toast } from "sonner";
import { FormCard } from "@/app/Components/ui/form-card";
const passwordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(1, "New password is required"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});
export function ChangePasswordForm() {
    const [isSaving, setIsSaving] = useState(false);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const form = useForm({
        resolver: zodResolver(passwordSchema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
        },
    });
    const onSubmit = async (data) => {
        setIsSaving(true);
        try {
            const res = await fetch("/api/profile/password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currentPassword: data.currentPassword,
                    newPassword: data.newPassword,
                }),
            });
            if (res.ok) {
                toast.success("Password updated successfully. Signing out...");
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login?changed=password";
            }
            else {
                const err = await res.json();
                toast.error(err.message || "Failed to update password");
            }
        }
        catch (error) {
            toast.error("An error occurred");
        }
        finally {
            setIsSaving(false);
        }
    };
    return (<Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-8">
                <FormCard title="Change Password" description="Update your security credentials." icon={Lock}>
                    <div className="space-y-4">
                        <FormField control={form.control} name="currentPassword" render={({ field }) => (<FormItem>
                                <FormLabel>Current Password</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Input type={showCurrent ? "text" : "password"} placeholder="Enter current password" {...field}/>
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrent(!showCurrent)}
                                            className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                                            title={showCurrent ? "Hide password" : "Show password"}
                                        >
                                            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>)}/>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="newPassword" render={({ field }) => (<FormItem>
                                    <FormLabel>New Password</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input type={showNew ? "text" : "password"} placeholder="Enter new password" {...field}/>
                                            <button
                                                type="button"
                                                onClick={() => setShowNew(!showNew)}
                                                className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                                                title={showNew ? "Hide password" : "Show password"}
                                            >
                                                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>)}/>

                            <FormField control={form.control} name="confirmPassword" render={({ field }) => (<FormItem>
                                    <FormLabel>Confirm New Password</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input type={showConfirm ? "text" : "password"} placeholder="Confirm new password" {...field}/>
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirm(!showConfirm)}
                                                className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                                                title={showConfirm ? "Hide password" : "Show password"}
                                            >
                                                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>)}/>
                        </div>
                    </div>
                </FormCard>

                <div className="flex justify-end">
                    <Button type="submit" disabled={isSaving} className="min-w-[120px]">
                        {isSaving ? "Updating..." : "Change Password"}
                    </Button>
                </div>
            </form>
        </Form>);
}
