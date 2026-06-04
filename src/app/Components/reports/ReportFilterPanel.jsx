"use client";
import { useState } from "react";
import { Button } from "@/app/Components/ui/button";
import { Card, CardContent } from "@/app/Components/ui/card";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/app/lib/utils";
export function ReportFilterPanel({ children, onClear, defaultExpanded = true, }) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    return (<Card className="mb-6 border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Filters</h3>
                </div>
                <div className="flex items-center gap-2">
                    {onClear && (<Button variant="ghost" size="sm" onClick={(e) => {
                e.stopPropagation();
                onClear();
            }} className="gap-1">
                            <X className="h-3 w-3"/>
                            Clear
                        </Button>)}
                    {isExpanded ? (<ChevronUp className="h-4 w-4 text-muted-foreground"/>) : (<ChevronDown className="h-4 w-4 text-muted-foreground"/>)}
                </div>
            </div>
            <div className={cn("transition-all duration-200 ease-in-out overflow-hidden", isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0")}>
                <CardContent className="pt-0 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {children}
                    </div>
                </CardContent>
            </div>
        </Card>);
}
