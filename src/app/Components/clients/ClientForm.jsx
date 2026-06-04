"use client";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, } from "@/app/Components/ui/form";
import { Input } from "@/app/Components/ui/input";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/Components/ui/tabs";
const clientSchema = z.object({
    companyName: z.string().min(1, "Company Name is required"),
    address: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    website: z.string().optional(),
    phone: z.string().optional(),
    contacts: z.array(z.object({
        name: z.string().min(1, "Name required"),
        designation: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional(),
    })).optional(),
});
export function ClientForm({ onSuccess, initialData }) {
    const form = useForm({
        resolver: zodResolver(clientSchema),
        defaultValues: initialData || {
            companyName: "",
            address: "",
            email: "",
            website: "",
            phone: "",
            contacts: [{ name: "", designation: "", email: "", phone: "" }],
        },
    });
    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "contacts",
    });
    const onSubmit = async (data) => {
        try {
            const url = initialData ? `/api/clients/${initialData.id}` : "/api/clients";
            const method = initialData ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                toast.success(initialData ? "Client updated" : "Client created");
                onSuccess();
            }
            else {
                const err = await res.json();
                toast.error(err.message || "Failed to save");
            }
        }
        catch (error) {
            toast.error("An error occurred");
        }
    };
    return (<Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Tabs defaultValue="company">
                    <TabsList>
                        <TabsTrigger value="company">Company Info</TabsTrigger>
                        <TabsTrigger value="contacts">Contact Persons</TabsTrigger>
                    </TabsList>

                    <TabsContent value="company" className="space-y-4 pt-4">
                        <FormField control={form.control} name="companyName" render={({ field }) => (<FormItem>
                                <FormLabel>Company Name</FormLabel>
                                <FormControl><Input {...field}/></FormControl>
                                <FormMessage />
                            </FormItem>)}/>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="email" render={({ field }) => (<FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl><Input type="email" {...field}/></FormControl>
                                    <FormMessage />
                                </FormItem>)}/>
                            <FormField control={form.control} name="phone" render={({ field }) => (<FormItem>
                                    <FormLabel>Phone</FormLabel>
                                    <FormControl><Input {...field}/></FormControl>
                                    <FormMessage />
                                </FormItem>)}/>
                        </div>
                        <FormField control={form.control} name="address" render={({ field }) => (<FormItem>
                                <FormLabel>Address</FormLabel>
                                <FormControl><Input {...field}/></FormControl>
                                <FormMessage />
                            </FormItem>)}/>
                        <FormField control={form.control} name="website" render={({ field }) => (<FormItem>
                                <FormLabel>Website</FormLabel>
                                <FormControl><Input {...field}/></FormControl>
                                <FormMessage />
                            </FormItem>)}/>
                    </TabsContent>

                    <TabsContent value="contacts" className="space-y-4 pt-4">
                        <div className="flex justify-between items-center">
                            <h4 className="text-sm font-medium">Key People</h4>
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ name: "", designation: "", email: "", phone: "" })}>
                                <Plus className="mr-2 h-4 w-4"/> Add Person
                            </Button>
                        </div>
                        {fields.map((field, index) => (<div key={field.id} className="grid grid-cols-12 gap-2 items-end border p-2 rounded bg-slate-50">
                                <div className="col-span-3">
                                    <FormLabel className="text-xs">Name</FormLabel>
                                    <Input {...form.register(`contacts.${index}.name`)} className="text-xs h-8" placeholder="Name"/>
                                </div>
                                <div className="col-span-3">
                                    <FormLabel className="text-xs">Designation</FormLabel>
                                    <Input {...form.register(`contacts.${index}.designation`)} className="text-xs h-8" placeholder="Role"/>
                                </div>
                                <div className="col-span-3">
                                    <FormLabel className="text-xs">Email</FormLabel>
                                    <Input {...form.register(`contacts.${index}.email`)} className="text-xs h-8" placeholder="Email"/>
                                </div>
                                <div className="col-span-2">
                                    <FormLabel className="text-xs">Phone</FormLabel>
                                    <Input {...form.register(`contacts.${index}.phone`)} className="text-xs h-8" placeholder="Phone"/>
                                </div>
                                <div className="col-span-1">
                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                        <Trash2 className="h-4 w-4 text-red-500"/>
                                    </Button>
                                </div>
                            </div>))}
                        {fields.length === 0 && (<p className="text-sm text-muted-foreground text-center py-4">No contacts added.</p>)}
                    </TabsContent>
                </Tabs>

                <div className="flex justify-end gap-4">
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Save Client"}
                    </Button>
                </div>
            </form>
        </Form>);
}
