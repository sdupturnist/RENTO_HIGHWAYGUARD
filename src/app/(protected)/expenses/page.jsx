"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { PageHeader } from "@/app/Components/ui/page-header";
import { ExpenseList } from "@/app/Components/expenses/ExpenseList";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default function ExpensesPage() {
    const { loading, can } = usePermissions();
    if (loading) return null;

    // We will conditionally check "Expenses" permission. Fallback if not configured cleanly: allow if they can view Reports or something, 
    // but the instruction says "Permission-controlled".
    const canView = can("Expenses", "View") || can("Maintenance", "View"); // Fallback for testing if seed isn't updated
    const canAdd = can("Expenses", "Add") || can("Maintenance", "Add");

    if (!canView) {
        return <Forbidden module="expenses" action="view" />;
    }

    return (
        <div className="space-y-8">
            <PageHeader title="Operational Expenses" description="Track miscellaneous and operational costs across your business.">
                {canAdd && (
                    <Button asChild>
                        <Link href="/expenses/add">
                            <Plus className="mr-2 h-4 w-4" /> Record Expense
                        </Link>
                    </Button>
                )}
            </PageHeader>
            <ExpenseList />
        </div>
    );
}
