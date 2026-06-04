"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { User, Shield, KeyRound, Eye, EyeOff } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, } from "@/app/Components/ui/form";
import { Input } from "@/app/Components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/app/Components/ui/select";
import { toast } from "sonner";
import { FormCard } from "@/app/Components/ui/form-card";
import { StickyFooter } from "@/app/Components/ui/sticky-footer";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const userSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    phone: z.string().optional(),
    roleId: z.string().min(1, "Role is required"),
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
    password: z.string().optional(),
    avatarUrl: z.string().optional(),
});

export function UserForm({ initialData }) {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const queryClient = useQueryClient();

    const form = useForm({
        resolver: zodResolver(userSchema),
        defaultValues: initialData ? {
            name: initialData.name,
            email: initialData.email,
            phone: initialData.phone || "",
            roleId: initialData.roleId ? String(initialData.roleId) : "",
            status: initialData.status,
            avatarUrl: initialData.avatarUrl || "",
        } : {
            name: "",
            email: "",
            phone: "",
            roleId: "",
            status: "ACTIVE",
            password: "",
            avatarUrl: "",
        },
    });

    const { data: roles = [] } = useQuery({
        queryKey: ["roles"],
        queryFn: async () => {
            const res = await fetch("/api/roles");
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        },
        staleTime: 5 * 60 * 1000,
    });

    const { mutate: saveUser, isPending: isSaving } = useMutation({
        mutationFn: async (data) => {
            const url = initialData ? `/api/users/${initialData.id}` : "/api/users";
            const method = initialData ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...data,
                    roleId: parseInt(data.roleId),
                    password: data.password || undefined,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed to save");
            }
            return res.json();
        },
        onSuccess: async () => {
            toast.success(initialData ? "User updated" : "User created");
            await queryClient.invalidateQueries({ queryKey: ["users"], refetchType: "all" });
            router.refresh();
            router.push("/users");
        },
        onError: (error) => {
            toast.error(error.message || "An error occurred");
        }
    });

    const onSubmit = (data) => {
        if (!initialData && !data.password) {
            form.setError("password", { message: "Password is required for new users" });
            return;
        }
        saveUser(data);
    };

    return (<Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-24">
            <FormCard title="Basic Information" description="Personal details and role assignment." icon={User}>
                <div className="flex flex-col md:flex-row gap-8 mb-6">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-slate-100 dark:border-slate-800">
                            {form.watch("avatarUrl") ? (<img src={form.watch("avatarUrl")} alt="Profile" className="h-full w-full object-cover" />) : (<div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                <User className="h-10 w-10 text-slate-400" />
                            </div>)}
                        </div>
                        <div className="flex items-center gap-3">
                            <label htmlFor="avatar-upload" className="cursor-pointer text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                                {initialData ? "Change Photo" : "Upload Photo"}
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
                            }} />
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
                            <FormLabel>Full Name <span className="text-red-500">*</span></FormLabel>
                            <FormControl><Input {...field} placeholder="John Doe" /></FormControl>
                            <FormMessage />
                        </FormItem>)} />

                        <FormField control={form.control} name="email" render={({ field }) => (<FormItem>
                            <FormLabel>Email <span className="text-red-500">*</span></FormLabel>
                            <FormControl><Input type="email" {...field} placeholder="john@company.com" /></FormControl>
                            <FormMessage />
                        </FormItem>)} />

                        <FormField control={form.control} name="phone" render={({ field }) => (<FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl><Input {...field} placeholder="+1234567890" /></FormControl>
                            <FormMessage />
                        </FormItem>)} />

                        <FormField control={form.control} name="roleId" render={({ field }) => (<FormItem>
                            <FormLabel>Role <span className="text-red-500">*</span></FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={initialData?.role?.isSystem || initialData?.isSystem}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {roles.map((role) => (<SelectItem key={role.id} value={String(role.id)}>
                                        {role.name}
                                    </SelectItem>))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>)} />

                        <FormField control={form.control} name="status" render={({ field }) => (<FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={initialData?.role?.isSystem || initialData?.isSystem}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>)} />
                    </div>
                </div>
            </FormCard>

            <FormCard title="Security" description="Set or update user password." icon={Shield}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="password" render={({ field }) => (<FormItem>
                        <FormLabel>
                            {initialData ? "New Password (Leave empty to keep current)" : "Password"}
                            {!initialData && <span className="text-red-500"> *</span>}
                        </FormLabel>
                        <FormControl>
                            <div className="relative">
                                <Input type={showPassword ? "text" : "password"} {...field} placeholder={initialData ? "••••••••" : "Enter password"} />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                                    title={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </FormControl>
                        <FormMessage />
                    </FormItem>)} />
                </div>
            </FormCard>

            <StickyFooter isSaving={isSaving} cancelLink="/users" />
        </form>
    </Form>);
}