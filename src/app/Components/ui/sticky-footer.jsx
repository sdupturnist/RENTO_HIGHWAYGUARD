import { Button } from "@/app/Components/ui/button";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/app/lib/utils";
import { Card, CardFooter } from "@/app/Components/ui/card";
export function StickyFooter({ isLoading, isSaving, onCancel, cancelLink, saveLabel = "Save Changes", hideCancel = false, className, formId, onSave }) {
    return (<Card className={cn("fixed bottom-0 left-64 right-0 z-10 rounded-none border-t shadow-md bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60", className)}>
            <CardFooter className="flex justify-end gap-4 p-4 max-w-7xl mx-auto w-full">
                {!hideCancel && (cancelLink ? (<Button variant="ghost" asChild disabled={isSaving || isLoading}>
                            <Link href={cancelLink}>Cancel</Link>
                        </Button>) : (<Button variant="ghost" onClick={onCancel} disabled={isSaving || isLoading}>
                            Cancel
                        </Button>))}

                <Button
                    type={onSave ? "button" : "submit"}
                    form={onSave ? undefined : formId}
                    onClick={onSave}
                    disabled={isSaving || isLoading}
                >
                    {(isSaving || isLoading) && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}
                    {isSaving ? "Saving..." : saveLabel}
                </Button>
            </CardFooter>
        </Card>);
}
