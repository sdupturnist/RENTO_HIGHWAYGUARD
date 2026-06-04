import { dbTenant, dbQuery } from "@/app/lib/db";
import { PageHeader } from "@/app/Components/ui/page-header";
import { OperatorForm } from "@/app/Components/operators/OperatorForm";
import { notFound } from "next/navigation";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

function toPlainOperator(operator) {
    return {
        ...operator,
        hourlyRate: operator.hourlyRate != null ? Number(operator.hourlyRate) : 0,
        experienceYears: operator.experienceYears != null ? Number(operator.experienceYears) : null,
        documents: (operator.documents || []).map((doc) => ({
            ...doc,
        })),
    };
}

export default async function EditOperatorPage(props) {
    const session = await getSession();
    const canEdit = session ? await verifySessionPermission(session, "Operators", "Edit") : false;
    if (!canEdit) {
        return <Forbidden module="operators" action="edit" />;
    }

    const params = await props.params;
    const id = parseInt(params.id);
    if (isNaN(id)) {
        notFound();
    }
    const [opRows] = await dbTenant(`
        SELECT o.*
        FROM \`operators\` o
        WHERE o.id = ? LIMIT 1
    `, [id]);

    if (!opRows || opRows.length === 0) {
        notFound();
    }
    
    const op = opRows[0];
    
    const [docs] = await dbTenant(`
        SELECT od.*
        FROM \`operator_documents\` od
        WHERE od.operatorId = ?
    `, [id]);
    
    const operator = {
        ...op,
        documents: docs || [],
    };
    if (!operator) {
        notFound();
    }
    const plainOperator = toPlainOperator(operator);
    return (<div className="max-w-5xl mx-auto">
            <PageHeader title="Edit Operator" description={`${plainOperator.operatorCode} · ${plainOperator.name}`}/>
            <OperatorForm initialData={plainOperator}/>
        </div>);
}
