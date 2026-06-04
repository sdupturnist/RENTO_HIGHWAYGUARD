"use client";
import { X, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/app/Components/ui/badge";
import { Button } from "@/app/Components/ui/button";

export function DayInspector({ date, events, fleetTotals, onClose, onViewAssignment, onAddAssignment, canAdd, canView }) {
    if (!date) return null;

    // ── Counts for summary cards ──────────────────────────────────────────────
    const vehicleCount = new Set(
        events.filter(e => e.blockType === 'VEHICLE').map(e => e.vehicleId).filter(Boolean)
    ).size;
    const operatorCount = new Set([
        ...events.filter(e => e.blockType === 'VEHICLE' && e.withOperator && e.operatorId).map(e => e.operatorId),
        ...events.filter(e => e.blockType === 'OPERATOR' && e.operatorId).map(e => e.operatorId),
    ]).size;
    const detourCount = events.filter(e => e.blockType === 'DETOUR').length;
    const materialCount = events.filter(e => e.blockType === 'MATERIAL').length;

    // ── Grouped blocks ────────────────────────────────────────────────────────
    const detourParents = events.filter(e => e.blockType === 'DETOUR');
    const childBlocks = events.filter(e => e.detourBlockId);
    const standaloneVehicles = events.filter(e => e.blockType === 'VEHICLE' && !e.detourBlockId);
    const standaloneOperators = events.filter(e => e.blockType === 'OPERATOR' && !e.detourBlockId);
    const standaloneMaterials = events.filter(e => e.blockType === 'MATERIAL' && !e.detourBlockId);

    // Build detour groups: parent + its children
    const detourGroups = detourParents.map(parent => ({
        parent,
        children: childBlocks.filter(c => c.detourBlockId === parent.id),
    }));

    // ── Helpers ───────────────────────────────────────────────────────────────
    const customerLabel = (e) => e.isInternal ? "Internal" : (e.customer || "—");
    const projectLabel = (e) => e.project || "—";

    return (
        <div className="fixed inset-y-0 right-0 w-96 bg-background border-l shadow-xl z-50 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between bg-muted/50 shrink-0">
                <div>
                    <h3 className="font-semibold text-lg">{format(date, "EEEE")}</h3>
                    <p className="text-sm text-muted-foreground">{format(date, "MMMM d, yyyy")}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-5">

                    {/* ── Section 1: Summary cards ─────────────────────────────── */}
                    <div className="grid grid-cols-2 gap-2">
                        <SummaryCard label="Vehicles" value={vehicleCount} total={fleetTotals.totalVehicles} color="blue" />
                        <SummaryCard label="Operators" value={operatorCount} total={fleetTotals.totalOperators} color="emerald" />
                        <SummaryCard label="Detours" value={detourCount} color="amber" />
                        <SummaryCard label="Materials" value={materialCount} color="violet" />
                    </div>

                    {/* ── Section 2: Detour Services ───────────────────────────── */}
                    {detourGroups.length > 0 && (
                        <Section title="🚧 Detour Services" count={detourGroups.length}>
                            {detourGroups.map(({ parent, children }) => {
                                const childVehicles = children.filter(c => c.blockType === 'VEHICLE');
                                const childOperators = children.filter(c => c.blockType === 'OPERATOR' ||
                                    (c.blockType === 'VEHICLE' && c.withOperator));
                                const childMaterials = children.filter(c => c.blockType === 'MATERIAL');
                                return (
                                    <div key={parent.id} className="bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/40 rounded-lg p-3 text-sm space-y-1.5">
                                        <div className="font-semibold text-amber-900 dark:text-amber-200">
                                            {parent.detourTemplate?.name || "Detour Service"}
                                        </div>
                                        <div className="text-xs text-muted-foreground space-y-0.5">
                                            <div>{customerLabel(parent)} {parent.project ? `• ${parent.project}` : ""}</div>
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                {childVehicles.length > 0 && <span className="flex items-center gap-1">🚚 {childVehicles.length}</span>}
                                                {childOperators.length > 0 && <span className="flex items-center gap-1">👷 {childOperators.length}</span>}
                                                {childMaterials.map(m => (
                                                    <span key={m.id} className="flex items-center gap-1">
                                                        🧱 {m.material?.name || "Material"} ×{m.quantity ?? 1}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        {canView && (
                                            <ViewButton onClick={() => onViewAssignment(parent.assignmentId)} />
                                        )}
                                    </div>
                                );
                            })}
                        </Section>
                    )}

                    {/* ── Section 3: Vehicle Deployments ───────────────────────── */}
                    {standaloneVehicles.length > 0 && (
                        <Section title="🚚 Vehicles" count={standaloneVehicles.length}>
                            {standaloneVehicles.map(e => (
                                <div key={e.id} className="bg-card border rounded-lg p-3 text-sm space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold">{e.vehicle?.code || "—"}</span>
                                        {e.vehicle?.type && (
                                            <Badge variant="outline" className="text-[10px]">{e.vehicle.type}</Badge>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground space-y-0.5">
                                        {e.operator && <div>👷 {e.operator.name}</div>}
                                        <div>{customerLabel(e)} {e.project ? `• ${e.project}` : ""}</div>
                                    </div>
                                    {canView && (
                                        <ViewButton onClick={() => onViewAssignment(e.assignmentId)} />
                                    )}
                                </div>
                            ))}
                        </Section>
                    )}

                    {/* ── Section 4: Operator-only Deployments ─────────────────── */}
                    {standaloneOperators.length > 0 && (
                        <Section title="👷 Operators (Standalone)" count={standaloneOperators.length}>
                            {standaloneOperators.map(e => (
                                <div key={e.id} className="bg-card border rounded-lg p-3 text-sm space-y-1">
                                    <div className="font-semibold">{e.operator?.name || "—"}</div>
                                    <div className="text-xs text-muted-foreground space-y-0.5">
                                        {e.workType && <div>{e.workType}</div>}
                                        <div>{customerLabel(e)} {e.project ? `• ${e.project}` : ""}</div>
                                    </div>
                                    {canView && (
                                        <ViewButton onClick={() => onViewAssignment(e.assignmentId)} />
                                    )}
                                </div>
                            ))}
                        </Section>
                    )}

                    {/* ── Section 5: Material Deployments ─────────────────────── */}
                    {standaloneMaterials.length > 0 && (
                        <Section title="🧱 Materials" count={standaloneMaterials.length}>
                            {standaloneMaterials.map(e => (
                                <div key={e.id} className="bg-card border rounded-lg p-3 text-sm space-y-1">
                                    <div className="font-semibold">{e.material?.name || "Material"}</div>
                                    <div className="text-xs text-muted-foreground space-y-0.5">
                                        <div>Qty: {e.quantity ?? "—"}</div>
                                        <div>{customerLabel(e)} {e.project ? `• ${e.project}` : ""}</div>
                                    </div>
                                    {canView && (
                                        <ViewButton onClick={() => onViewAssignment(e.assignmentId)} />
                                    )}
                                </div>
                            ))}
                        </Section>
                    )}

                    {/* Empty state */}
                    {detourGroups.length === 0 && standaloneVehicles.length === 0 &&
                     standaloneOperators.length === 0 && standaloneMaterials.length === 0 && (
                        <p className="text-sm text-muted-foreground italic text-center py-8">
                            No deployments on this day.
                        </p>
                    )}
                </div>
            </div>

            {/* Footer */}
            {canAdd && (
                <div className="p-4 border-t bg-background shrink-0">
                    <Button className="w-full" onClick={() => onAddAssignment(date)}>
                        Add Assignment for {format(date, "MMM d")}
                    </Button>
                </div>
            )}
        </div>
    );
}

function SummaryCard({ label, value, total, color }) {
    const colors = {
        blue: "bg-blue-50/70 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400",
        emerald: "bg-emerald-50/70 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400",
        amber: "bg-amber-50/70 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800 text-amber-600 dark:text-amber-400",
        violet: "bg-violet-50/70 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800 text-violet-600 dark:text-violet-400",
    };
    return (
        <div className={`rounded-lg border p-3 ${colors[color]}`}>
            <div className="text-xs font-medium opacity-80">{label}</div>
            <div className="text-2xl font-bold mt-0.5">
                {value}
                {total != null && <span className="text-sm font-normal opacity-60"> / {total}</span>}
            </div>
        </div>
    );
}

function Section({ title, count, children }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold">{title}</h4>
                <Badge variant="secondary" className="text-xs">{count}</Badge>
            </div>
            <div className="space-y-2">{children}</div>
        </div>
    );
}

function ViewButton({ onClick }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-1 text-[11px] text-primary hover:underline mt-1"
        >
            <ExternalLink className="h-3 w-3" /> View Assignment
        </button>
    );
}
