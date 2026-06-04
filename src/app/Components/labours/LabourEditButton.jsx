"use client";
import { useState } from "react";
import { Button } from "@/app/Components/ui/button";
import { Edit } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LabourForm } from "./LabourForm";

export function LabourEditButton({ labour, currencySymbol }) {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const queryClient = useQueryClient();

    return (
        <>
            <Button variant="outline" onClick={() => setOpen(true)}>
                <Edit className="mr-2 h-4 w-4" /> Edit
            </Button>
            <LabourForm
                open={open}
                onOpenChange={setOpen}
                labour={labour}
                currencySymbol={currencySymbol}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["labours"] });
                    setOpen(false);
                    router.refresh();
                }}
            />
        </>
    );
}
