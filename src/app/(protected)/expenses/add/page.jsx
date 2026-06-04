"use client";
import { PageHeader } from "@/app/Components/ui/page-header";
import { ExpenseForm } from "@/app/Components/expenses/ExpenseForm";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default function AddExpensePage() {
    const { can, loading } = usePermissions();

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
    }

    if (!can("Expenses", "Add")) {
        return <Forbidden module="expenses" action="add" />;
    }

    return (
        <div className="space-y-8">
            <PageHeader
                title="Record Expense"
                description="Add a new operational or miscellaneous expense."
                backLink="/expenses"
            />
            <ExpenseForm />
        </div>
    );
}
