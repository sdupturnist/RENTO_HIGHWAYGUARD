"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/app/Components/ui/alert-dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function TimeLogDeleteButton({ logId }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();
    const queryClient = useQueryClient();

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/time-logs/${logId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                toast.success("Time log deleted successfully");
                await queryClient.refetchQueries({ queryKey: ["time-logs"], exact: false });
                router.refresh();
                router.push("/time-logs");
            } else {
                const error = await res.json();
                toast.error(error.message || "Failed to delete time log");
            }
        } catch (error) {
            toast.error("Error deleting time log");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete this time log
                        and remove it from our servers.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleDelete();
                        }}
                        className="bg-red-600 hover:bg-red-700"
                        disabled={isDeleting}
                    >
                        {isDeleting ? "Deleting..." : "Delete Permanently"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}