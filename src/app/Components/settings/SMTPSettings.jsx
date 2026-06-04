"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, } from "@/app/Components/ui/form";
import { Separator } from "@/app/Components/ui/separator";
import { Switch } from "@/app/Components/ui/switch";
const formSchema = z.object({
    host: z.string().min(1, "Hostname is required"),
    port: z.string().min(1, "Port is required"),
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
    fromEmail: z.string().email("Invalid email address"),
    fromName: z.string().min(1, "Sender name is required"),
    secure: z.coerce.boolean(),
});
export function SMTPSettings({ onDirtyStateChange }) {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testEmail, setTestEmail] = useState("");
    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            host: "",
            port: "587",
            username: "",
            password: "",
            fromEmail: "",
            fromName: "",
            secure: false,
        },
    });
    const { isDirty } = form.formState;
    useEffect(() => {
        if (onDirtyStateChange) {
            onDirtyStateChange(isDirty);
        }
    }, [isDirty, onDirtyStateChange]);
    useEffect(() => {
        async function loadSettings() {
            try {
                const response = await fetch("/api/settings/smtp");
                if (response.ok) {
                    const data = await response.json();
                    form.reset({
                        host: data.host || "",
                        port: String(data.port || "587"),
                        username: data.username || "",
                        password: data.password || "",
                        fromEmail: data.fromEmail || "",
                        fromName: data.fromName || "",
                        secure: data.secure || false,
                    });
                }
            }
            catch (error) {
                console.error("Failed to load settings:", error);
                toast.error("Failed to load settings");
            }
            finally {
                setIsLoading(false);
            }
        }
        loadSettings();
    }, []);
    async function onSubmit(values) {
        const isValid = await form.trigger();
        if (!isValid) {
            const errors = form.formState.errors;
            const firstError = Object.values(errors)[0]?.message;
            toast.error(firstError || "Please fill in all SMTP fields correctly");
            return;
        }
        setIsSaving(true);
        try {
            const response = await fetch("/api/settings/smtp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            if (!response.ok) {
                throw new Error("Failed to save settings");
            }
            const data = await response.json();
            form.reset({
                host: data.host || values.host,
                port: String(data.port ?? values.port),
                username: data.username || values.username,
                password: data.password || values.password,
                fromEmail: data.fromEmail || values.fromEmail,
                fromName: data.fromName || values.fromName,
                secure: data.secure ?? values.secure,
            }); // Reset form with saved data to clear dirty state
            toast.success("SMTP settings saved successfully");
        }
        catch (error) {
            console.error("Error saving settings:", error);
            toast.error("Failed to save settings");
        }
        finally {
            setIsSaving(false);
        }
    }
    async function handleTestConnection() {
        if (!testEmail) {
            toast.error("Please enter a test email address");
            return;
        }
        const values = form.getValues();
        // Validate required fields manually or trigger form validation
        const isValid = await form.trigger();
        if (!isValid) {
            const errors = form.formState.errors;
            const firstError = Object.values(errors)[0]?.message;
            toast.error(firstError || "Please fill in all SMTP fields correctly");
            return;
        }
        setIsTesting(true);
        try {
            const response = await fetch("/api/settings/smtp/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...values, testEmail }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || result.error || "Failed to send test email");
            }
            toast.success("Test email sent successfully!");
        }
        catch (error) {
            console.error("Test connection failed:", error);
            toast.error(`Testing failed: ${error.message}`);
        }
        finally {
            setIsTesting(false);
        }
    }
    if (isLoading) {
        return (<div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
            </div>);
    }
    return (<Card>
            <CardHeader>
                <CardTitle>SMTP Configuration</CardTitle>
                <CardDescription>
                    Configure your email server settings for sending transactional emails.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="host" render={({ field }) => (<FormItem>
                                        <FormLabel>SMTP Host</FormLabel>
                                        <FormControl>
                                            <Input placeholder="smtp.example.com" {...field}/>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>)}/>
                            <FormField control={form.control} name="port" render={({ field }) => (<FormItem>
                                        <FormLabel>Port</FormLabel>
                                        <FormControl>
                                            <Input placeholder="587" {...field}/>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>)}/>
                            <FormField control={form.control} name="username" render={({ field }) => (<FormItem>
                                        <FormLabel>Username</FormLabel>
                                        <FormControl>
                                            <Input placeholder="user@example.com" {...field}/>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>)}/>

                             
                            <FormField control={form.control} name="password" render={({ field }) => (<FormItem>
                                        <FormLabel>Password</FormLabel>
                                        <FormControl>
                                            <Input type="password" placeholder="Enter SMTP password" {...field}/>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>)}/>
                            <FormField control={form.control} name="fromEmail" render={({ field }) => (<FormItem>
                                        <FormLabel>From Email</FormLabel>
                                        <FormControl>
                                            <Input placeholder="noreply@example.com" {...field}/>
                                        </FormControl>
                                        <FormDescription>The email address that will appear as sender.</FormDescription>
                                        <FormMessage />
                                    </FormItem>)}/>
                            <FormField control={form.control} name="fromName" render={({ field }) => (<FormItem>
                                        <FormLabel>From Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="RentERP Notifications" {...field}/>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>)}/>
                            <FormField control={form.control} name="secure" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                            <FormLabel className="text-base">Secure Connection (SSL/TLS)</FormLabel>
                                            <FormDescription>
                                                Enable if your SMTP server requires a secure connection (usually port 465).
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch checked={field.value} onCheckedChange={field.onChange}/>
                                        </FormControl>
                                    </FormItem>)}/>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">Test Connection</h3>
                            <div className="flex gap-4 items-end">
                                <div className="grid w-full max-w-sm items-center gap-1.5">
                                    <FormLabel htmlFor="testEmail">Send Test Email To</FormLabel>
                                    <Input type="email" id="testEmail" placeholder="your-email@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)}/>
                                </div>
                                <Button type="button" variant="secondary" onClick={handleTestConnection} disabled={isTesting || !testEmail}>
                                    {isTesting ? (<>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                            Testing...
                                        </>) : (<>
                                            <Mail className="mr-2 h-4 w-4"/>
                                            Send Test Email
                                        </>)}
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => form.reset()} disabled={isSaving || !isDirty}>
                                Reset
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? (<>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                        Saving...
                                    </>) : (isDirty ? "Save Changes" : "Saved")}
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>);
}
