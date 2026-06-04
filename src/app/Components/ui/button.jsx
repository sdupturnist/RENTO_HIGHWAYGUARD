import * as React from "react";
import { cva } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/app/lib/utils";
const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-tight transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive shadow-[0_12px_30px_-18px_rgba(15,23,42,0.45)]", {
    variants: {
        variant: {
            default: "bg-gradient-to-r from-primary via-primary/95 to-indigo-500 text-primary-foreground hover:brightness-105 hover:shadow-[0_18px_38px_-20px_rgba(79,70,229,0.55)] border border-primary/20",
            destructive: "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/70 border border-destructive/30",
            outline: "border border-border/80 bg-white/70 dark:bg-input/40 text-foreground shadow-[0_10px_30px_-22px_rgba(15,23,42,0.45)] hover:bg-accent/60 hover:text-accent-foreground dark:hover:bg-input/60 backdrop-blur",
            secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/60",
            ghost: "hover:bg-accent/60 hover:text-accent-foreground text-foreground/80 dark:hover:bg-accent/30",
            link: "text-primary underline-offset-4 hover:underline font-semibold",
        },
        size: {
            default: "h-10 px-5 py-2 has-[>svg]:px-4",
            xs: "h-7 gap-1 rounded-lg px-2.5 text-xs has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3",
            sm: "h-9 rounded-lg gap-1.5 px-4 has-[>svg]:px-3",
            lg: "h-11 rounded-xl px-7 has-[>svg]:px-5 text-base",
            icon: "size-10",
            "icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3",
            "icon-sm": "size-9",
            "icon-lg": "size-12",
        },
    },
    defaultVariants: {
        variant: "default",
        size: "default",
    },
});
function Button({ className, variant = "default", size = "default", asChild = false, ...props }) {
    const Comp = asChild ? Slot.Root : "button";
    return (<Comp data-slot="button" data-variant={variant} data-size={size} className={cn(buttonVariants({ variant, size, className }))} {...props}/>);
}
export { Button, buttonVariants };
