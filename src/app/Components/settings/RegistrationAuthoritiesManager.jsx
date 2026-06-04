"use client";
import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/app/Components/ui/table";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, } from "@/app/Components/ui/dialog";
import { Label } from "@/app/Components/ui/label";
export function RegistrationAuthoritiesManager() {
    const [authorities, setAuthorities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState("");
    const [open, setOpen] = useState(false);
    const fetchAuthorities = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/config/authorities");
            if (res.ok)
                setAuthorities(await res.json());
        }
        catch (error) {
            toast.error("Failed to load authorities");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => { fetchAuthorities(); }, []);
    const handleAdd = async () => {
        if (!newName)
            return;
        try {
            const res = await fetch("/api/config/authorities", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName }),
            });
            if (res.ok) {
                toast.success("Authority added");
                setNewName("");
                setOpen(false);
                fetchAuthorities();
            }
            else {
                toast.error("Failed to add authority");
            }
        }
        catch (error) {
            toast.error("Error adding authority");
        }
    };
    return (<div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Registration Authorities</h3>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm"><Plus className="h-4 w-4 mr-2"/> Add Authority</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Add Registration Authority</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Authority Name</Label>
                                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. RTA"/>
                            </div>
                            <Button onClick={handleAdd} className="w-full">Save Authority</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (<TableRow><TableCell colSpan={2} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>) : authorities.length === 0 ? (<TableRow><TableCell colSpan={2} className="text-center h-24 text-muted-foreground">No authorities found.</TableCell></TableRow>) : (authorities.map((item) => (<TableRow key={item.id}>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    </TableCell>
                                </TableRow>)))}
                    </TableBody>
                </Table>
            </div>
        </div>);
}
