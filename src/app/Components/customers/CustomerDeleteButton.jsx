"use client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/app/Components/ui/alert-dialog";
import { Button } from "@/app/Components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function CustomerDeleteButton({ customerId }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [isDeleting, setIsDeleting] = useState(false);
    const [open, setOpen] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/clients/${customerId}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message || "Customer deleted successfully");
                await queryClient.refetchQueries({ queryKey: ["customers"], exact: false });
                router.refresh();
                router.push("/customers");
            } else {
                toast.error(data.message || "Failed to delete customer");
                setOpen(false);
            }
        } catch (error) {
            toast.error("An error occurred while deleting");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the customer
                        and all associated data (contacts, documents).
                        <br /><br />
                        If there are linked projects, assignments, or invoices, you will receive a warning
                        summary after deletion, but the deletion will proceed.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleDelete();
                        }}
                        disabled={isDeleting}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isDeleting ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}