"use client";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/app/Components/ui/alert-dialog";
import { Button } from "@/app/Components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
export function ProjectDeleteButton({ projectId }) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [isDeleting, setIsDeleting] = useState(false);
    const [open, setOpen] = useState(false);
    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/projects/${projectId}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (res.ok) {
                queryClient.setQueryData(["projects"], (current = []) =>
                    Array.isArray(current) ? current.filter((project) => project.id !== projectId) : []
                );
                queryClient.invalidateQueries({ queryKey: ["projects"] });
                toast.success(data.message || "Project deleted successfully");
                router.refresh();
                router.push("/projects");
            }
            else {
                toast.error(data.message || "Failed to delete project");
                setOpen(false);
            }
        }
        catch (error) {
            toast.error("An error occurred while deleting");
        }
        finally {
            setIsDeleting(false);
        }
    };
    return (<AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4"/>
                    Delete
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the project and its data from the server.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={(e) => {
            e.preventDefault();
            handleDelete();
        }} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Delete Permanently
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>);
}
