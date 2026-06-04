"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/Components/ui/card";
import { cn } from "@/app/lib/utils";
export function OverviewPage({ title, description, actions, children, }) {
    return (<div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>);
}
export function OverviewSection({ title, description, children, className, }) {
    return (<Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>);
}
export function InfoGrid({ children, cols = 2 }) {
    const gridClass = cols === 3 ? "md:grid-cols-2 lg:grid-cols-3" : cols === 2 ? "md:grid-cols-2" : "";
    return <div className={cn("grid gap-3", gridClass)}>{children}</div>;
}
export function InfoField({ label, value, muted, }) {
    if (value === undefined || value === null || value === "")
        return null;
    return (<div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 bg-white/40 dark:bg-slate-900/40">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium text-right", muted && "text-muted-foreground")}>{value}</span>
    </div>);
}
export function SectionGrid({ children }) {
    return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
export function FileList({ files }) {
    if (!files || files.length === 0)
        return <div className="text-center py-6 text-muted-foreground">No documents attached.</div>;
    return (<div className="rounded-xl border border-border/70 divide-y">
      {files.map((f, idx) => (<div key={f.id ?? idx} className="flex items-center justify-between p-4 hover:bg-muted/40">
          <div>
            <p className="font-medium text-sm">{f.name}</p>
            {f.expiryDate && (<p className="text-xs text-muted-foreground">Expires: {new Date(f.expiryDate).toLocaleDateString()}</p>)}
          </div>
          <a className="text-sm font-medium text-primary hover:underline" href={f.url} target="_blank" rel="noopener noreferrer">
            View
          </a>
        </div>))}
    </div>);
}
