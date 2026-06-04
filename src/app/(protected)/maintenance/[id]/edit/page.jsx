import { notFound } from "next/navigation";
import { dbTenant, dbQuery } from "@/app/lib/db";
import { MaintenanceForm } from "@/app/Components/maintenance/MaintenanceForm";
import { PageHeader } from "@/app/Components/ui/page-header";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default async function EditMaintenancePage({ params, }) {
    const session = await getSession();
    const canEdit = session ? await verifySessionPermission(session, "Maintenance", "Edit") : false;
    if (!canEdit) {
        return <Forbidden module="maintenance" action="edit" />;
    }

    const { id } = await params;
    const [mRows] = await dbTenant(`SELECT * FROM \`maintenances\` WHERE id = ? LIMIT 1`, [parseInt(id)]);
    if (!mRows || mRows.length === 0) {
        notFound();
    }
    const maintenance = mRows[0];
    const maintenancePlain = {
        ...maintenance,
        amount: maintenance.amount ? Number(maintenance.amount) : null,
    };
    // Fetch vehicles (we need the assigned vehicle even if it's not active anymore)
    const [vehicleRows] = await dbTenant(`
        SELECT v.id, v.vehicleCode, v.regNo, v.ownership, vt.name as vehicleType_name
        FROM \`vehicles\` v
        LEFT JOIN \`vehicle_types\` vt ON vt.id = v.typeId
        ORDER BY v.vehicleCode ASC
    `, []);
    const vehicles = (vehicleRows || []).map(v => ({
        id: v.id, vehicleCode: v.vehicleCode, regNo: v.regNo, ownership: v.ownership,
        vehicleType: { name: v.vehicleType_name }
    }));
    // Fetch all maintenance types
    const [mtRows] = await dbTenant(`SELECT * FROM \`maintenance_types\` ORDER BY name ASC`, []);
    const maintenanceTypes = mtRows || [];
    return (<div className="max-w-5xl mx-auto space-y-8">
            <PageHeader title="Edit Maintenance" description={`Edit maintenance record ${maintenancePlain.maintenanceCode}.`}/>
            <MaintenanceForm initialData={maintenancePlain} vehicles={vehicles} maintenanceTypes={maintenanceTypes}/>
        </div>);
}
