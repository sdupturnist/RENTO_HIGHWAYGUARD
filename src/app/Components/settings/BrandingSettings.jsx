"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Textarea } from "@/app/Components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Label } from "@/app/Components/ui/label";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
export function BrandingSettings({ onDirtyStateChange }) {
    const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting, isDirty } } = useForm({
        defaultValues: {
            appName: "",
            slogan: "",
            loginBrandName: "",
            logoUrl: "",
            faviconUrl: "",
            primaryColor: "",
            metaTitle: "",
            metaDescription: "",
        }
    });
    const watchedPrimaryColor = watch("primaryColor");
    const PRESET_COLORS = [
        { label: "Cobalt Blue", value: "#4f46e5" },
        { label: "Indigo", value: "#6366f1" },
        { label: "Violet", value: "#7c3aed" },
        { label: "Sky Blue", value: "#0ea5e9" },
        { label: "Teal", value: "#0d9488" },
        { label: "Emerald", value: "#059669" },
        { label: "Rose", value: "#e11d48" },
        { label: "Amber", value: "#d97706" },
        { label: "Slate", value: "#475569" },
    ];
    // Store selected files for upload
    const [selectedLogo, setSelectedLogo] = useState(null);
    const [selectedFavicon, setSelectedFavicon] = useState(null);
    // Store preview URLs (either from DB or local object URLs)
    const [logoPreview, setLogoPreview] = useState("");
    const [faviconPreview, setFaviconPreview] = useState("");
    useEffect(() => {
        fetch("/api/settings/branding")
            .then(res => res.json())
            .then(data => {
                reset({
                    appName: data.appName || "",
                    slogan: data.slogan || "",
                    loginBrandName: data.loginBrandName || "",
                    logoUrl: data.logoUrl || "",
                    faviconUrl: data.faviconUrl || "",
                    primaryColor: data.primaryColor || "",
                    metaTitle: data.metaTitle || "",
                    metaDescription: data.metaDescription || "",
                });
                setLogoPreview(data.logoUrl || "");
                setFaviconPreview(data.faviconUrl || "");
            })
            .catch(() => toast.error("Failed to load branding settings"));
    }, [reset]);
    useEffect(() => {
        if (onDirtyStateChange) {
            // Form is dirty if react-hook-form says so OR if we have selected files pending upload
            onDirtyStateChange(isDirty || !!selectedLogo || !!selectedFavicon);
        }
    }, [isDirty, selectedLogo, selectedFavicon, onDirtyStateChange]);
    const handleFileSelect = (e, type) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const objectUrl = URL.createObjectURL(file);
        if (type === "logo") {
            setSelectedLogo(file);
            setLogoPreview(objectUrl);
            setValue("logoUrl", objectUrl, { shouldDirty: true });
        }
        else {
            setSelectedFavicon(file);
            setFaviconPreview(objectUrl);
            setValue("faviconUrl", objectUrl, { shouldDirty: true });
        }
    };
    const handleRemove = (type) => {
        if (type === "logo") {
            setSelectedLogo(null);
            setLogoPreview("");
            setValue("logoUrl", "", { shouldDirty: true });
        }
        else {
            setSelectedFavicon(null);
            setFaviconPreview("");
            setValue("faviconUrl", "", { shouldDirty: true });
        }
    };
    const uploadFile = async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "branding");
        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
            if (res.ok) {
                const { url } = await res.json();
                return url;
            }
            return null;
        }
        catch (e) {
            console.error("Upload failed", e);
            return null;
        }
    };
    const onSubmit = async (data) => {
        try {
            let finalLogoUrl = data.logoUrl;
            let finalFaviconUrl = data.faviconUrl;
            // Upload files if new ones are selected
            // Use the URLs returned from upload for the save payload
            // If no new file selected, usage existing data.logoUrl
            if (selectedLogo) {
                const url = await uploadFile(selectedLogo);
                if (url)
                    finalLogoUrl = url;
                else
                    return toast.error("Failed to upload logo");
            }
            else {
                // If selectedLogo is null, it means either no new logo was selected,
                // or the user cleared a previously selected local file.
                // In this case, we use the URL from the form data, which could be
                // the original DB URL or an empty string if it was cleared.
                // The form's `logoUrl` field will hold the current state (DB URL or local blob URL).
                // If it's a local blob URL and no file was selected, it means the user
                // selected a file, then cancelled the file input. We should revert to the original.
                // However, the current logic of `setValue("logoUrl", objectUrl, { shouldDirty: true });`
                // means `data.logoUrl` will contain the blob URL if a file was selected.
                // If the user then clears the input, `selectedLogo` becomes null, but `data.logoUrl`
                // still holds the blob URL. This needs careful handling.
                // For now, we assume if `selectedLogo` is null, `data.logoUrl` is either the original
                // URL from the DB or an empty string if the user explicitly cleared it (not supported by current UI).
            }
            if (selectedFavicon) {
                const url = await uploadFile(selectedFavicon);
                if (url)
                    finalFaviconUrl = url;
                else
                    return toast.error("Failed to upload favicon");
            }
            const payload = {
                appName: data.appName || "",
                slogan: data.slogan || "",
                loginBrandName: data.loginBrandName || "",
                logoUrl: finalLogoUrl,
                faviconUrl: finalFaviconUrl,
                primaryColor: data.primaryColor || null,
                metaTitle: data.metaTitle || "",
                metaDescription: data.metaDescription || "",
            };
            const res = await fetch("/api/settings/branding", {
                method: "POST",
                body: JSON.stringify(payload),
                headers: { "Content-Type": "application/json" }
            });
            if (res.ok) {
                toast.success("Branding settings saved successfully");
                // Clear selected files as they are now saved
                setSelectedLogo(null);
                setSelectedFavicon(null);
                // Force reload to apply changes globally
                window.location.reload();
            }
            else {
                const errorData = await res.json();
                toast.error(errorData.message || "Failed to save settings");
            }
        }
        catch (e) {
            toast.error("Error saving settings");
        }
    };
    return (<Card>
        <CardHeader>
            <CardTitle>Branding & Appearance</CardTitle>
            <CardDescription>Customize the application identity.</CardDescription>
        </CardHeader>
        <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="appName">Application Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input id="appName" {...register("appName")} placeholder="Leave empty to hide" />
                    <p className="text-xs text-muted-foreground">Appears in the browser title and sidebar. If empty, only the logo icon shows.</p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="slogan">Slogan <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input id="slogan" {...register("slogan")} placeholder="e.g. Powering your rental business" />
                    <p className="text-xs text-muted-foreground">Short tagline displayed below the app name where supported.</p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="loginBrandName">Login Page Brand Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input id="loginBrandName" {...register("loginBrandName")} placeholder="Defaults to Application Name" />
                    <p className="text-xs text-muted-foreground">Name shown on the login screen. Falls back to Application Name if empty.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label>Logo</Label>
                        <div className="flex items-center gap-4">
                            <div className="h-16 w-16 rounded border bg-slate-50 flex items-center justify-center overflow-hidden relative group">
                                {logoPreview ? (<>
                                    <img src={logoPreview} alt="Logo" className="h-full w-full object-contain" />
                                    <button type="button" onClick={() => handleRemove("logo")} className="absolute top-0.5 right-0.5 bg-destructive/90 text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-destructive" disabled={isSubmitting}>
                                        <X className="h-3 w-3" />
                                    </button>
                                </>) : (<div className="text-xs text-muted-foreground">No Logo</div>)}
                            </div>
                            <div className="flex-1 space-y-2">
                                <Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => handleFileSelect(e, "logo")} disabled={isSubmitting} className="w-full" />
                                <p className="text-xs text-muted-foreground">
                                    Upload a PNG, JPG, WEBP, or GIF image.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Favicon</Label>
                        <div className="flex items-center gap-4">
                            <div className="h-16 w-16 rounded border bg-slate-50 flex items-center justify-center overflow-hidden relative group">
                                {faviconPreview ? (<>
                                    <img src={faviconPreview} alt="Favicon" className="h-full w-full object-contain" />
                                    <button type="button" onClick={() => handleRemove("favicon")} className="absolute top-0.5 right-0.5 bg-destructive/90 text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-destructive" disabled={isSubmitting}>
                                        <X className="h-3 w-3" />
                                    </button>
                                </>) : (<div className="text-xs text-muted-foreground">No Icon</div>)}
                            </div>
                            <div className="flex-1 space-y-2">
                                <Input type="file" accept="image/x-icon,image/vnd.microsoft.icon,image/png,.ico" onChange={(e) => handleFileSelect(e, "favicon")} disabled={isSubmitting} className="w-full" />
                                <p className="text-xs text-muted-foreground">
                                    Upload an .ico or .png file.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Theme Color Picker */}
                <div className="space-y-3 border-t pt-4">
                    <div>
                        <Label>Theme Color</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Sets the primary accent color across the entire app (sidebar, buttons, badges, and glows).</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Native color picker or 'Pick color' button */}
                        <div className="relative">
                            {watchedPrimaryColor ? (
                                <input
                                    type="color"
                                    {...register("primaryColor")}
                                    className="h-10 w-16 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900"
                                    title="Pick a custom color"
                                />
                            ) : (
                                <label className="flex items-center gap-2 px-3 h-10 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 cursor-pointer text-xs text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <input
                                        type="color"
                                        {...register("primaryColor")}
                                        className="sr-only"
                                        onChange={(e) => setValue("primaryColor", e.target.value, { shouldDirty: true })}
                                    />
                                    + Custom color
                                </label>
                            )}
                        </div>
                        {/* Preset swatches */}
                        <div className="flex flex-wrap gap-2">
                            {PRESET_COLORS.map((preset) => (
                                <button
                                    key={preset.value}
                                    type="button"
                                    title={preset.label}
                                    onClick={() => setValue("primaryColor", preset.value, { shouldDirty: true })}
                                    className="h-8 w-8 rounded-full border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2"
                                    style={{
                                        backgroundColor: preset.value,
                                        borderColor: watchedPrimaryColor === preset.value ? preset.value : "transparent",
                                        boxShadow: watchedPrimaryColor === preset.value ? `0 0 0 2px white, 0 0 0 4px ${preset.value}` : "none"
                                    }}
                                />
                            ))}
                        </div>
                        {/* Current color hex display */}
                        {watchedPrimaryColor && (
                            <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">{watchedPrimaryColor}</span>
                        )}
                        {/* Reset to default — always visible */}
                        <button
                            type="button"
                            onClick={() => setValue("primaryColor", "", { shouldDirty: true })}
                            className="text-xs text-muted-foreground underline hover:text-foreground ml-auto"
                        >Reset to default</button>
                    </div>
                </div>

                {/* SEO Settings */}
                <div className="space-y-4 border-t pt-4">
                    <div>
                        <Label className="text-base">SEO Settings</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Controls the browser tab title and search engine description.</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="metaTitle">Meta Title <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input id="metaTitle" {...register("metaTitle")} placeholder="e.g. ACME Corp | Fleet ERP" />
                        <p className="text-xs text-muted-foreground">Overrides Application Name in the browser tab and search results. Keep under 60 characters.</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="metaDescription">Meta Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Textarea id="metaDescription" {...register("metaDescription")} placeholder="A short description shown in Google search snippets..." rows={3} className="resize-none" />
                        <p className="text-xs text-muted-foreground">Shown in Google search snippets. Keep under 160 characters.</p>
                    </div>
                </div>

                <div className="flex justify-end gap-4 pt-4">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isDirty || selectedLogo || selectedFavicon ? "Save Changes" : "Saved"}
                    </Button>
                </div>
            </form>
        </CardContent>
    </Card>);
}
