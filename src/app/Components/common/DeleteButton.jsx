"use client";
import { useState } from "react";
import { Button } from "@/app/Components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
    AlertDialogTitle, AlertDialogTrigger,
} from "@/app/Components/ui/alert-dialog";

export function DeleteButton({ apiPath, queryKey, redirectTo, entityLabel = "record" }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        setLoading(true);
        try {
            const res = await fetch(apiPath, { method: "DELETE" });
            if (!res.ok) throw new Error();
            toast.success(`${entityLabel} permanently deleted`);
            if (queryKey) await queryClient.refetchQueries({ queryKey: Array.isArray(queryKey) ? queryKey : [queryKey] });
            router.refresh();
            router.push(redirectTo);
        } catch {
            toast.error(`Error deleting ${entityLabel.toLowerCase()}`);
            setLoading(false);
        }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Delete
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the {entityLabel.toLowerCase()} and its data from the server.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                        Delete Permanently
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
