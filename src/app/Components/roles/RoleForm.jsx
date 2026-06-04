"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Shield, Lock } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription, } from "@/app/Components/ui/form";
import { Input } from "@/app/Components/ui/input";
import { Textarea } from "@/app/Components/ui/textarea";
import { Checkbox } from "@/app/Components/ui/checkbox";
import { toast } from "sonner";
import { FormCard } from "@/app/Components/ui/form-card";
import { StickyFooter } from "@/app/Components/ui/sticky-footer";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
const roleSchema = z.object({
    name: z.string().min(1, "Role name is required"),
    description: z.string().optional(),
    permissionIds: z.array(z.number()).min(1, "Select at least one permission"),
});
const formatActionLabel = (module, action) => {
    if (module === "Assignment" && action === "View")
        return "List View";
    return action;
};
export function RoleForm({ initialData }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [isSaving, setIsSaving] = useState(false);
    const form = useForm({
        resolver: zodResolver(roleSchema),
        defaultValues: initialData ? {
            name: initialData.name,
            description: initialData.description || "",
            permissionIds: initialData.permissions?.map((p) => p.permissionId || p.id) || [],
        } : {
            name: "",
            description: "",
            permissionIds: [],
        },
    });

    const { data: permissionsData, isLoading: loadingPermissions } = useQuery({
        queryKey: ["all-permissions"],
        queryFn: async () => {
            const res = await fetch("/api/permissions");
            if (!res.ok) throw new Error("Failed to fetch permissions");
            return res.json();
        },
    });

    const permissions = permissionsData?.permissions || [];
    const groupedPermissions = permissionsData?.groupedPermissions || {};
    const onSubmit = async (data) => {
        if (initialData?.isSystem) {
            toast.error("Cannot modify system roles");
            return;
        }
        setIsSaving(true);
        try {
            const url = initialData ? `/api/roles/${initialData.id}` : "/api/roles";
            const method = initialData ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                await queryClient.invalidateQueries({ queryKey: ["roles"], refetchType: "all" });
                toast.success(initialData ? "Role updated" : "Role created");
                router.refresh();
                router.push("/users/roles");
            }
            else {
                const err = await res.json();
                toast.error(err.message || "Failed to save");
            }
        }
        catch (error) {
            toast.error("An error occurred");
        }
        finally {
            setIsSaving(false);
        }
    };
    const toggleModulePermissions = (module, checked) => {
        if (initialData?.isSystem)
            return;
        const modulePermissions = groupedPermissions[module] || [];
        const currentPermissions = form.getValues("permissionIds") || [];
        if (checked) {
            const newPermissions = [...currentPermissions];
            modulePermissions.forEach((perm) => {
                if (!newPermissions.includes(perm.id)) {
                    newPermissions.push(perm.id);
                }
            });
            form.setValue("permissionIds", newPermissions, { shouldDirty: true });
        }
        else {
            const permissionIdsToRemove = modulePermissions.map((p) => p.id);
            form.setValue("permissionIds", currentPermissions.filter((id) => !permissionIdsToRemove.includes(id)), { shouldDirty: true });
        }
    };
    const isSystemRole = initialData?.isSystem;
    return (<Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-24">
                <FormCard title="Role Details" description="Basic information about the role." icon={Shield}>
                    <div className="grid gap-6">
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem>
                                <FormLabel>Role Name <span className="text-red-500">*</span></FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="e.g. Finance Manager" disabled={isSystemRole}/>
                                </FormControl>
                                {isSystemRole ? <FormDescription>System roles cannot be renamed.</FormDescription> : null}
                                <FormMessage />
                            </FormItem>)}/>

                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                    <Textarea {...field} placeholder="Describe the role responsibilities..." disabled={isSystemRole}/>
                                </FormControl>
                                <FormMessage />
                            </FormItem>)}/>
                            
                    </div>
                </FormCard>

                <FormCard title="Permissions" description="Select the modules and actions this role can access." icon={Lock}>
                    {loadingPermissions ? (<div className="flex justify-center p-8">Loading permissions...</div>) : (
                        <div className="space-y-6">
                            {isSystemRole ? (
                                <div className="bg-blue-50 text-blue-800 p-4 rounded-md mb-4 text-sm">
                                    This is a system role. Permissions cannot be modified.
                                </div> ) : null}

                            {!isSystemRole && (<div className="flex justify-end mb-4">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox id="select-all" checked={permissions.length > 0 && form.watch("permissionIds")?.length === permissions.length} onCheckedChange={(checked) => {
                    if (checked) {
                        form.setValue("permissionIds", permissions.map(p => p.id), { shouldDirty: true });
                    }
                    else {
                        form.setValue("permissionIds", [], { shouldDirty: true });
                    }
                }}/>
                                        <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                                            Select All Permissions
                                        </label>
                                    </div>
                                </div>)}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {Object.entries(groupedPermissions).map(([module, perms]) => {
                const selectedPermissions = form.watch("permissionIds") || [];
                const allModuleSelected = perms.every((p) => selectedPermissions.includes(p.id));
                return (<div key={module} className="border rounded-lg p-4 bg-card">
                                            <div className="flex items-center space-x-2 font-medium mb-3 pb-2 border-b">
                                                <Checkbox checked={allModuleSelected} onCheckedChange={(checked) => toggleModulePermissions(module, checked)} disabled={isSystemRole}/>
                                                <label className="text-sm font-bold">{module}</label>
                                            </div>
                                            <div className="space-y-2">
                                                {perms.map((permission) => (<FormField key={permission.id} control={form.control} name="permissionIds" render={({ field }) => (<FormItem className="flex items-center space-x-2 space-y-0">
                                                                <FormControl>
                                                                    <Checkbox checked={field.value?.includes(permission.id)} onCheckedChange={(checked) => {
                                return checked
                                    ? field.onChange([...field.value, permission.id])
                                    : field.onChange(field.value?.filter((value) => value !== permission.id));
                            }} disabled={isSystemRole}/>
                                                                </FormControl>
                                                                <FormLabel className="text-sm font-normal cursor-pointer leading-none">
                                                                    {formatActionLabel(module, permission.action)}
                                                                </FormLabel>
                                                            </FormItem>)}/>))}
                                            </div>
                                        </div>);
            })}
                            </div>
                        </div>)}
                </FormCard>

                {!isSystemRole && (<StickyFooter isSaving={isSaving} cancelLink="/users/roles"/>)}
            </form>
        </Form>);
}
