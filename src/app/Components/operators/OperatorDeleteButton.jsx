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

export function OperatorDeleteButton({ operatorId }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/operators/${operatorId}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.message || "Failed to delete operator");
                setLoading(false);
                return;
            }
            toast.success("Operator permanently deleted");
            await queryClient.refetchQueries({ queryKey: ["operators"], exact: false });
            router.refresh();
            router.push("/operators");
        } catch (error) {
            toast.error("Error deleting operator");
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
                        This action cannot be undone. This will permanently delete the operator and their data from the server.
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