"use client";
import { useState } from "react";
import { Button } from "@/app/Components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/app/Components/ui/alert-dialog";
export function MaintenanceDeleteButton({ maintenanceId }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const handleDelete = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/maintenance/${maintenanceId}`, {
                method: "DELETE",
            });
            if (!res.ok)
                throw new Error("Failed to delete maintenance record");
            toast.success("Maintenance record permanently deleted");
            router.refresh();
            router.push("/maintenance");
        }
        catch (error) {
            toast.error("Error deleting maintenance record");
        }
        finally {
            setLoading(false);
        }
    };
    return (<AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>}
                    Delete
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the maintenance record and its data from the server.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                        Delete Permanently
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>);
}
