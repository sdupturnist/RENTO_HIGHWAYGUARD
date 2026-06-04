"use client";
import { useParams } from "next/navigation";
import { PageHeader } from "@/app/Components/ui/page-header";
import { ExpenseForm } from "@/app/Components/expenses/ExpenseForm";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default function EditExpensePage() {
    const params = useParams();
    const { can, loading: permsLoading } = usePermissions();

    const { data: expense, isLoading: loading } = useQuery({
        queryKey: ["expense", params.id],
        queryFn: async () => {
            const res = await fetch(`/api/expenses/${params.id}`);
            if (!res.ok) throw new Error("Failed to fetch expense");
            return res.json();
        },
        enabled: !!params.id && !permsLoading && can("Expenses", "Edit"),
    });

    if (permsLoading || loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }

    if (!can("Expenses", "Edit")) {
        return <Forbidden module="expenses" action="edit" />;
    }

    if (!expense) {
        return <div className="p-8 text-center text-muted-foreground">Expense not found.</div>;
    }

    return (
        <div className="space-y-8">
            <PageHeader
                title={`Edit Expense ${expense.expenseCode}`}
                description="Modify existing expense details."
                backLink="/expenses"
            />
            <ExpenseForm initialData={expense} isEdit={true} />
        </div>
    );
}
