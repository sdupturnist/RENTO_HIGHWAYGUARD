"use client";
import { useState } from "react";
import { Button } from "@/app/Components/ui/button";
import { Edit } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { MaterialForm } from "./MaterialForm";

export function MaterialEditButton({ material, currencySymbol }) {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const queryClient = useQueryClient();

    return (
        <>
            <Button variant="outline" onClick={() => setOpen(true)}>
                <Edit className="mr-2 h-4 w-4" /> Edit
            </Button>
            <MaterialForm
                open={open}
                onOpenChange={setOpen}
                material={material}
                currencySymbol={currencySymbol}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ["materials"] });
                    setOpen(false);
                    router.refresh();
                }}
            />
        </>
    );
}
