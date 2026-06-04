import { dbTenant, dbQuery } from "@/app/lib/db";
import { PageHeader } from "@/app/Components/ui/page-header";
import { VehicleForm } from "@/app/Components/vehicles/VehicleForm";
import { notFound } from "next/navigation";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default async function EditVehiclePage(props) {
    const session = await getSession();
    const canEdit = session ? await verifySessionPermission(session, "Vehicles", "Edit") : false;
    if (!canEdit) {
        return <Forbidden module="vehicles" action="edit" />;
    }

    const params = await props.params;
    const id = parseInt(params.id);
    if (isNaN(id)) {
        notFound();
    }
    const [vRows] = await dbTenant(`SELECT * FROM \`vehicles\` WHERE id = ? LIMIT 1`, [id]);
    if (!vRows || vRows.length === 0) notFound();
    const [docs] = await dbTenant(`SELECT * FROM \`vehicle_documents\` WHERE vehicleId = ?`, [id]);
    const vehicle = { ...vRows[0], documents: docs || [] };
    if (!vehicle) {
        notFound();
    }
    const vehicleData = vehicle;
    const serializedVehicle = {
        ...vehicleData,
        baseRentAmount: vehicleData.baseRentAmount ? Number(vehicleData.baseRentAmount) : 0,
        capacity: vehicleData.capacity ? Number(vehicleData.capacity) : null,
    };
    return (<div className="max-w-5xl mx-auto">
            <PageHeader title="Edit Vehicle" description={`${vehicle.vehicleCode}${vehicle.regNo ? ` · ${vehicle.regNo}` : ""}`}/>
            <VehicleForm initialData={serializedVehicle}/>
        </div>);
}
