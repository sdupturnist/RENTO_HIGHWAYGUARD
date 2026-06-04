import * as React from "react";
import { cn } from "@/app/lib/utils";
function Textarea({ className, ...props }) {
    return (<textarea data-slot="textarea" className={cn("border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/40 flex min-h-16 w-full rounded-xl border bg-white/70 px-3.5 py-2 text-base shadow-[0_8px_24px_-18px_rgba(15,23,42,0.4)] transition-[color,box-shadow,border] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm backdrop-blur", className)} {...props}/>);
}
export { Textarea };
