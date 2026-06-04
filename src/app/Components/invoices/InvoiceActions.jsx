"use client";
import { Button } from "@/app/Components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/app/Components/ui/alert-dialog";
import { Printer, Trash2, RefreshCw, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useState } from "react";
import { PermissionGate } from "@/app/Components/auth/PermissionGate";
import { PERMISSIONS } from "@/app/lib/permissions-constants";
export function InvoiceActions({ invoiceId }) {
    const router = useRouter();
    const [recalculating, setRecalculating] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [showRecalculate, setShowRecalculate] = useState(false);
    const handlePrint = () => {
        window.print();
    };
    const handleDelete = async () => {
        try {
            const response = await fetch(`/api/invoices/${invoiceId}`, {
                method: "DELETE",
            });
            if (response.ok) {
                toast.success("Invoice deleted and timesheet unlocked");
                router.refresh();
                router.push("/invoices");
            }
            else {
                const error = await response.json();
                toast.error(error.error || "Failed to delete invoice");
            }
        }
        catch (error) {
            console.error(error);
            toast.error("Failed to delete invoice");
        }
        finally {
            setShowDelete(false);
        }
    };
    const handleRecalculate = async () => {
        setRecalculating(true);
        setShowRecalculate(false);
        try {
            const response = await fetch(`/api/invoices/${invoiceId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            if (response.ok) {
                toast.success("Invoice tax recalculated");
                router.refresh();
            }
            else {
                const error = await response.json();
                toast.error(error.error || "Failed to recalculate");
            }
        }
        catch (error) {
            console.error(error);
            toast.error("Failed to recalculate");
        }
        finally {
            setRecalculating(false);
        }
    };
    return (<>
        <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" /> Print / PDF
        </Button>

        <PermissionGate module="Invoices" action="Edit">
            <Button variant="outline" onClick={() => setShowRecalculate(true)} disabled={recalculating} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
                Recalculate Tax
            </Button>
        </PermissionGate>

        <PermissionGate module="Invoices" action="Delete">
            <Button variant="destructive" onClick={() => setShowDelete(true)} className="gap-2">
                <Trash2 className="h-4 w-4" /> Delete & Unlock
            </Button>
        </PermissionGate>

        <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the invoice and UNLOCK the linked timesheet (it will revert to EXPORTED and can be edited/deleted). This action cannot be undone.
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

        <AlertDialog open={showRecalculate} onOpenChange={setShowRecalculate}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Recalculate Tax?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will update the invoice totals based on the <strong>current company tax settings</strong>. Any previous tax amounts will be overwritten.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRecalculate}>
                        Yes, Recalculate
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>);
}
