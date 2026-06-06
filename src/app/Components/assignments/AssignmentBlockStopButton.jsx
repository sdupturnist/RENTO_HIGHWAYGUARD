"use client";

import { useState } from "react";
import { Button } from "@/app/Components/ui/button";
import { Loader2, Octagon, Ban, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/app/Components/ui/alert-dialog";

export function AssignmentBlockStopButton({ assignmentId, blockId, isStopped, assignmentStatus, endDate }) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const isPast = endDate ? new Date(endDate) < new Date() : false;
    const isCompleted = assignmentStatus === "COMPLETED" || isPast;

    if (isStopped) {
        return (
            <Button variant="outline" size="sm" disabled className="text-red-500 border-red-200 bg-red-50">
                <Ban className="mr-2 h-4 w-4" /> Stopped
            </Button>
        );
    }

    if (isCompleted) {
        return (
            <Button variant="outline" size="sm" disabled className="text-blue-600 border-blue-200 bg-blue-50">
                <CheckCircle className="mr-2 h-4 w-4" /> Completed
            </Button>
        );
    }

    const handleStop = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/assignments/${assignmentId}/blocks/${blockId}/stop`, {
                method: "POST",
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to stop block");
            }

            toast.success("Vehicle block stopped successfully");
            router.refresh();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Octagon className="mr-2 h-4 w-4" />}
                    Stop Block
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Stop Vehicle Block</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to stop this vehicle block? This will:
                        <ul className="list-disc list-inside mt-2 text-sm text-slate-500">
                            <li>Set the end date to now</li>
                            <li>Stop automatic daily time log generation</li>
                            <li>Allow the vehicle to be available for other assignments or maintenance</li>
                        </ul>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleStop} className="bg-red-600 hover:bg-red-700">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Yes, Stop Block"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
