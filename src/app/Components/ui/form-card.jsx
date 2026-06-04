import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { cn } from "@/app/lib/utils";
export function FormCard({ title, description, icon: Icon, children, className }) {
    return (<Card className={cn("animate-slide-grid", className)}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    {Icon && <Icon className="w-5 h-5 text-muted-foreground"/>}
                    {title}
                </CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent>
                {children}
            </CardContent>
        </Card>);
}
