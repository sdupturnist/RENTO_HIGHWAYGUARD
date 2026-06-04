"use client";
import * as React from "react";
import { cn } from "@/app/lib/utils";
function Table({ className, ...props }) {
    return (<div data-slot="table-container" className="relative w-full overflow-x-auto rounded-2xl border border-border/70 bg-card/70 backdrop-blur-xl shadow-[0_18px_45px_-28px_rgba(15,23,42,0.45)]">
      <table data-slot="table" className={cn("w-full caption-bottom text-sm", className)} {...props}/>
    </div>);
}
function TableHeader({ className, ...props }) {
    return (<thead data-slot="table-header" className={cn("[&_tr]:border-b bg-muted/60 text-foreground", className)} {...props}/>);
}
function TableBody({ className, ...props }) {
    return (<tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props}/>);
}
function TableFooter({ className, ...props }) {
    return (<tfoot data-slot="table-footer" className={cn("bg-muted/50 border-t font-medium [&>tr]:last:border-b-0", className)} {...props}/>);
}
function TableRow({ className, ...props }) {
    return (<tr data-slot="table-row" className={cn("hover:bg-muted/60 data-[state=selected]:bg-muted border-b transition-colors", className)} {...props}/>);
}
function TableHead({ className, ...props }) {
    return (<th data-slot="table-head" className={cn("text-foreground h-11 px-3 text-left align-middle font-semibold whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]", className)} {...props}/>);
}
function TableCell({ className, ...props }) {
    return (<td data-slot="table-cell" className={cn("p-3 align-middle whitespace-nowrap text-sm text-foreground/90 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]", className)} {...props}/>);
}
function TableCaption({ className, ...props }) {
    return (<caption data-slot="table-caption" className={cn("text-muted-foreground mt-4 text-sm", className)} {...props}/>);
}
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption, };
