"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Edit, Trash2, ArrowLeft, Receipt, ExternalLink, CheckCircle, Undo, Paperclip } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Badge } from "@/app/Components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { Forbidden } from "@/app/Components/common/Forbidden";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/app/Components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/Components/ui/tabs";
import { ActivityLogList } from "@/app/Components/common/ActivityLogList";
import { OverviewPage, OverviewSection, InfoGrid, InfoField } from "@/app/Components/common/Overview";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";
import { useSettings } from "@/app/Components/providers/SettingsProvider";

export default function ExpenseDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [deleteOpen, setDeleteOpen] = useState(false);

    const { can, loading: permsLoading } = usePermissions();
    const queryClient = useQueryClient();
    const canEdit = can("Expenses", "Edit") || can("Maintenance", "Edit");
    const canDelete = can("Expenses", "Delete") || can("Maintenance", "Delete");
    const [statusUpdating, setStatusUpdating] = useState(false);
    const { currencySymbol } = useSettings();

    const { data: expense, isLoading: loading, refetch } = useQuery({
        queryKey: ["expense", params.id],
        queryFn: async () => {
            const res = await fetch(`/api/expenses/${params.id}`);
            if (!res.ok) throw new Error("Failed to fetch expense");
            return res.json();
        },
        enabled: !!params.id && !permsLoading && (can("Expenses", "View") || can("Maintenance", "View")),
    });

    const handleDelete = async () => {
        try {
            const res = await fetch(`/api/expenses/${params.id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Expense deleted successfully");
                await queryClient.invalidateQueries({ queryKey: ["expenses"], refetchType: "all" });
                router.push("/expenses");
            } else {
                toast.error("Failed to delete expense");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setDeleteOpen(false);
        }
    };

    if (permsLoading || loading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

    if (!can("Expenses", "View") && !can("Maintenance", "View")) {
        return <Forbidden module="expenses" action="view" />;
    }

    if (!expense) return <div className="p-8 text-center text-muted-foreground">Expense not found</div>;

    const isConfirmed = expense.status === "CONFIRMED";

   const toggleStatus = async () => {
    const newStatus = isConfirmed ? "DRAFT" : "CONFIRMED";

    try {
        setStatusUpdating(true);

        const res = await fetch(`/api/expenses/${params.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus })
        });

        if (res.ok) {
            toast.success(`Expense marked as ${newStatus}`);

            // Refetch all expense list queries
            await queryClient.refetchQueries({
                queryKey: ["expenses"],
                exact: false,
            });

            // Refetch current expense detail
            await queryClient.refetchQueries({
                queryKey: ["expense", params.id],
            });

            // Optional local refresh
            await refetch();
        } else {
            toast.error("Failed to update status");
        }
    } catch (error) {
        toast.error("An error occurred");
    } finally {
        setStatusUpdating(false);
    }
};

    const getStatusColor = (status) => {
        switch (status) {
            case "DRAFT": return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";
            case "CONFIRMED": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
            default: return "bg-slate-100 text-slate-800";
        }
    };

    return (
        <>
            <OverviewPage
                title={
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" asChild>
                            <Link href="/expenses">
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </Button>
                        <span>Expense {expense.expenseCode}</span>
                        <Badge className={getStatusColor(expense.status)} variant="outline">
                            {expense.status}
                        </Badge>
                    </div>
                }
                description={`Recorded on ${format(new Date(expense.createdAt), 'PPp')}`}
                actions={
                    <>
                        {canEdit && (
                            <Button
                                variant="outline"
                                className="gap-2"
                                onClick={toggleStatus}
                                disabled={statusUpdating}
                            >
                                {statusUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                                {!statusUpdating && (isConfirmed ? <Undo className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />)}
                                {isConfirmed ? "Revert to Draft" : "Confirm"}
                            </Button>
                        )}
                        {canEdit && (
                            <Button variant="outline" className="gap-2" asChild>
                                <Link href={`/expenses/edit/${expense.id}`}>
                                    <Edit className="h-4 w-4" /> Edit
                                </Link>
                            </Button>
                        )}
                        {canDelete && (
                            <Button variant="destructive" className="gap-2" onClick={() => setDeleteOpen(true)}>
                                <Trash2 className="h-4 w-4" /> Delete
                            </Button>
                        )}
                    </>
                }
            >
                <Tabs defaultValue="overview" className="space-y-4">
                    <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-2 w-fit">
                        <TabsList>
                            <TabsTrigger className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30" value="overview">Overview</TabsTrigger>
                            <TabsTrigger className="px-4 py-2.5 text-sm font-medium rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:dark:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200/60 data-[state=active]:dark:border-slate-700/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30" value="activity">Activity Log</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="overview" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <OverviewSection title="Expense Details">
                                <InfoGrid>
                                    <InfoField label="Type" value={expense.expenseType?.name || "N/A"} />
                                    <InfoField label="Amount" value={<span className="inline-flex items-center gap-1"><CurrencySymbol symbol={currencySymbol} /> {Number(expense.amount).toFixed(2)}</span>} />
                                    <InfoField label="Transaction Date" value={format(new Date(expense.date), 'PPPP')} />
                                    <InfoField label="Last Updated" value={format(new Date(expense.updatedAt), 'PPp')} />
                                </InfoGrid>
                            </OverviewSection>

                            <OverviewSection title="Associations">
                                <InfoGrid>
                                    <InfoField
                                        label="Vehicle"
                                        value={expense.vehicle ? (
                                            <Link href={`/vehicles/${expense.vehicleId}`} className="text-sm font-medium text-primary hover:underline">
                                                {expense.vehicle.vehicleCode}
                                            </Link>
                                        ) : "-"}
                                    />
                                    <InfoField
                                        label="Operator"
                                        value={expense.operator ? (
                                            <Link href={`/operators/${expense.operatorId}`} className="text-sm font-medium text-primary hover:underline">
                                                {expense.operator.operatorCode} - {expense.operator.name}
                                            </Link>
                                        ) : "-"}
                                    />
                                    <InfoField
                                        label="Project"
                                        value={expense.project ? (
                                            <Link href={`/projects/${expense.projectId}`} className="text-sm font-medium text-primary hover:underline">
                                                {expense.project.projectCode} - {expense.project.name}
                                            </Link>
                                        ) : "-"}
                                    />
                                    <InfoField
                                        label="Assignment"
                                        value={expense.assignment ? (
                                            <Link href={`/assignments/${expense.assignmentId}`} className="text-sm font-medium text-primary hover:underline">
                                                {expense.assignment.assignmentCode}
                                            </Link>
                                        ) : "-"}
                                    />
                                </InfoGrid>
                            </OverviewSection>

                            {(expense.description || expense.attachmentUrl) && (
                                <OverviewSection title="Description & Attachments" className="md:col-span-2">
                                    <div className="text-sm bg-muted/50 p-3 rounded-md min-h-[80px] whitespace-pre-wrap">
                                        {expense.description || "No description provided."}
                                    </div>
                                    {expense.attachmentUrl && (
                                        <div className="mt-4">
                                            <a
                                                href={expense.attachmentUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 text-sm border rounded-md px-3 py-2 hover:bg-muted/50 transition-colors"
                                            >
                                                <Paperclip className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-primary font-medium">
                                                    {expense.attachmentUrl.split("/").pop()}
                                                </span>
                                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                            </a>
                                        </div>
                                    )}
                                </OverviewSection>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="activity">
                        <OverviewSection title="Activity History" description="Recent actions and changes performed on this expense record.">
                            <ActivityLogList entityType="EXPENSES" entityId={expense.id} />
                        </OverviewSection>
                    </TabsContent>
                </Tabs>
            </OverviewPage>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete expense {expense.expenseCode}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            Delete Permanently
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
