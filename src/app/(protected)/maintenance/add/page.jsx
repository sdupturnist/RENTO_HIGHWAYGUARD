import { dbTenant } from "@/app/lib/db";
import { MaintenanceForm } from "@/app/Components/maintenance/MaintenanceForm";
import { PageHeader } from "@/app/Components/ui/page-header";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export default async function AddMaintenancePage() {
    const session = await getSession();
    const canAdd = session ? await verifySessionPermission(session, "Maintenance", "Add") : false;
    if (!canAdd) {
        return <Forbidden module="maintenance" action="add" />;
    }

    // Fetch active vehicles with vehicle type
    const [vehicleRows] = await dbTenant(`
        SELECT v.id, v.vehicleCode, v.regNo, v.ownership, vt.name as vehicleTypeName
        FROM \`vehicles\` v
        LEFT JOIN \`vehicle_types\` vt ON vt.id = v.typeId
        WHERE v.status IN ('ACTIVE', 'UNDER_MAINTENANCE')
        ORDER BY v.vehicleCode ASC
    `);
    const vehicles = (vehicleRows || []).map(v => ({
        ...v,
        vehicleType: { name: v.vehicleTypeName || "Unknown" },
    }));

    // Fetch active maintenance types
    const [maintenanceTypeRows] = await dbTenant(
        "SELECT * FROM `maintenance_types` WHERE isActive = ? ORDER BY name ASC",
        [true]
    );
    const maintenanceTypes = maintenanceTypeRows || [];
    return (<div className="max-w-5xl mx-auto space-y-8">
            <PageHeader title="Schedule Maintenance" description="Create a new maintenance record for a vehicle."/>
            <MaintenanceForm vehicles={vehicles} maintenanceTypes={maintenanceTypes}/>
        </div>);
}
