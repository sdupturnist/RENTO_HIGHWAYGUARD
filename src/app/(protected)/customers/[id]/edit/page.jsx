import { dbTenant, dbQuery } from "@/app/lib/db";
import { PageHeader } from "@/app/Components/ui/page-header";
import { CustomerForm } from "@/app/Components/customers/CustomerForm";
import { notFound } from "next/navigation";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default async function EditCustomerPage(props) {
    const session = await getSession();
    const canEdit = session ? await verifySessionPermission(session, "Customers", "Edit") : false;
    if (!canEdit) {
        return <Forbidden module="customers" action="edit" />;
    }

    const params = await props.params;
    const searchParams = await props.searchParams;
    const id = parseInt(params.id);
    if (isNaN(id)) {
        notFound();
    }
    const [cRows] = await dbTenant(`SELECT * FROM \`customers\` WHERE id = ? LIMIT 1`, [id]);
    if (!cRows || cRows.length === 0) notFound();
    
    const [contacts] = await dbTenant(`SELECT * FROM \`contact_persons\` WHERE customerId = ?`, [id]);
    const [documents] = await dbTenant(`SELECT * FROM \`customer_documents\` WHERE customerId = ?`, [id]);

    const customer = {
        ...cRows[0],
        contacts: contacts || [],
        documents: documents || [],
    };
    if (!customer) {
        notFound();
    }
    return (<div className="max-w-5xl mx-auto">
            <PageHeader title="Edit Customer" description={`${customer.customerCode} · ${customer.companyName}`}/>
            <CustomerForm initialData={customer}/>
        </div>);
}
