import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { OperatorList } from "@/app/Components/operators/OperatorList";
import { PageHeader } from "@/app/Components/ui/page-header";
import { dbTenant } from "@/app/lib/db";
import { verifySession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";

export default async function OperatorsPage() {
    const session = await verifySession();
    const canView = await verifySessionPermission(session, "Operators", "View");
    const canAdd = (await verifySessionPermission(session, "Operators", "Add")) || (await verifySessionPermission(session, "Operators", "Edit"));

    if (!canView) {
        return <div className="p-8 text-center text-muted-foreground">You do not have permission to view operators.</div>;
    }

    const settings = (await dbTenant("SELECT * FROM `company_settings` LIMIT 1"))[0][0];
    const currencySymbol = settings?.currencySymbol || "AED";

    return (
        <div className="space-y-8">
            <PageHeader title="Operators" description="Manage your heavy equipment operators and drivers.">
                {canAdd && (
                    <Button asChild>
                        <Link href="/operators/new">
                            <Plus className="mr-2 h-4 w-4" /> Add Operator
                        </Link>
                    </Button>
                )}
            </PageHeader>

            <OperatorList currencySymbol={currencySymbol} />
        </div>
    );
}
