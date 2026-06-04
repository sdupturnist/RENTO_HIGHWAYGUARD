"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { User, Loader2 } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription, } from "@/app/Components/ui/form";
import { Input } from "@/app/Components/ui/input";
import { toast } from "sonner";
import { FormCard } from "@/app/Components/ui/form-card";
import { useRouter } from "next/navigation";
const profileSchema = z.object({
    name: z.string().min(1, "Full Name is required"),
    phone: z.string().optional(),
    email: z.string().email().optional(), // Read-only but included in form
    role: z.string().optional(), // Read-only
    avatarUrl: z.string().optional(),
});
export function ProfileForm({ initialData }) {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const form = useForm({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            name: initialData.name,
            phone: initialData.phone || "",
            email: initialData.email,
            role: initialData.role?.name || "N/A",
            avatarUrl: initialData.avatarUrl || "",
        },
    });
    const { isDirty } = form.formState;
    const onSubmit = async (data) => {
        setIsSaving(true);
        try {
            const res = await fetch("/api/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: data.name,
                    phone: data.phone,
                    avatarUrl: data.avatarUrl,
                }),
            });
            if (res.ok) {
                const updatedUser = await res.json();
                toast.success("Profile updated successfully");
                form.reset({
                    name: updatedUser.name,
                    phone: updatedUser.phone || "",
                    email: updatedUser.email,
                    role: updatedUser.role?.name || "N/A",
                    avatarUrl: updatedUser.avatarUrl || "",
                });
                window.dispatchEvent(new CustomEvent("user-profile-updated", { detail: { avatarUrl: updatedUser.avatarUrl || "" } }));
                router.refresh();
            }
            else {
                const err = await res.json();
                toast.error(err.message || "Failed to update profile");
            }
        }
        catch (error) {
            toast.error("An error occurred");
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleCancel = () => {
        form.reset({
            name: initialData.name,
            phone: initialData.phone || "",
            email: initialData.email,
            role: initialData.role?.name || "N/A",
        });
        toast.info("Changes cancelled");
    };
    return (<Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormCard title="Profile Information" description="Manage your profile and contact details." icon={User}>
                    <div className="flex flex-col md:flex-row gap-8 mb-6">
                        <div className="flex flex-col items-center gap-4">
                            <div className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-slate-100 dark:border-slate-800">
                                {form.watch("avatarUrl") ? (<img src={form.watch("avatarUrl")} alt="Profile" className="h-full w-full object-cover"/>) : (<div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <User className="h-10 w-10 text-slate-400"/>
                                    </div>)}
                            </div>
                            <div className="flex items-center gap-3">
                                <label htmlFor="avatar-upload" className="cursor-pointer text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                                    Change Photo
                                </label>
                                <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
                const formData = new FormData();
                formData.append("file", file);
                formData.append("folder", "user/profile");
                try {
                    const res = await fetch("/api/upload", {
                        method: "POST",
                        body: formData,
                    });
                    if (res.ok) {
                        const data = await res.json();
                        form.setValue("avatarUrl", data.url, { shouldDirty: true });
                    }
                    else {
                        toast.error("Failed to upload image");
                    }
                }
                catch (err) {
                    toast.error("Upload error");
                }
            }
        }}/>
                                {form.watch("avatarUrl") && (
                                    <button
                                        type="button"
                                        onClick={() => form.setValue("avatarUrl", "", { shouldDirty: true })}
                                        className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                                    >
                                        Remove Photo
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem>
                                    <FormLabel>Full Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="John Doe"/>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>)}/>

                            <FormField control={form.control} name="email" render={({ field }) => (<FormItem>
                                    <FormLabel>Email Address</FormLabel>
                                    <FormControl>
                                        <Input {...field} disabled className="bg-muted"/>
                                    </FormControl>
                                    <FormDescription>Email cannot be changed</FormDescription>
                                </FormItem>)}/>

                            <FormField control={form.control} name="phone" render={({ field }) => (<FormItem>
                                    <FormLabel>Phone Number</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="+1 (555) 000-0000"/>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>)}/>

                            <FormField control={form.control} name="role" render={({ field }) => (<FormItem>
                                    <FormLabel>Role</FormLabel>
                                    <FormControl>
                                        <Input {...field} disabled className="bg-muted"/>
                                    </FormControl>
                                </FormItem>)}/>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4">
                        <Button type="button" variant="ghost" onClick={handleCancel} disabled={isSaving || !isDirty}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            {isDirty ? "Save Changes" : "Saved"}
                        </Button>
                    </div>
                </FormCard>
            </form>
        </Form>);
}
