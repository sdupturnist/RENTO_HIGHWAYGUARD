import { cn } from "@/app/lib/utils";
export function PageHeader({ title, description, children, className }) {
    return (<div className={cn("animate-slide-header flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6", className)}>
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                {description && (<p className="text-muted-foreground mt-1">
                        {description}
                    </p>)}
            </div>
            {children && (<div className="flex items-center gap-2">
                    {children}
                </div>)}
        </div>);
}
