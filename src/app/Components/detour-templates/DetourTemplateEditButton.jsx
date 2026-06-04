"use client";
import { Button } from "@/app/Components/ui/button";
import { Edit } from "lucide-react";
import Link from "next/link";

export function DetourTemplateEditButton({ template }) {
    return (
        <Button variant="outline" asChild>
            <Link href={`/detour-services/${template.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> Edit
            </Link>
        </Button>
    );
}
