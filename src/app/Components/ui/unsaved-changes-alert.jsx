import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/app/Components/ui/alert-dialog";
export function UnsavedChangesAlert({ open, onOpenChange, onConfirm, onDiscard, title = "Unsaved Changes", description = "You have unsaved changes in this tab. If you leave now, your changes will be lost.", }) {
    return (<AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onDiscard}>Keep Editing</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm} className="bg-red-600 hover:bg-red-700">
                        Discard & Leave
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>);
}
