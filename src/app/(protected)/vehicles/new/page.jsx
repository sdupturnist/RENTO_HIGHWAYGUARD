"use client";
import { PageHeader } from "@/app/Components/ui/page-header";
import { VehicleForm } from "@/app/Components/vehicles/VehicleForm";
import { usePermissions } from "@/app/Components/auth/PermissionsProvider";
import { Forbidden } from "@/app/Components/common/Forbidden";

export default function NewVehiclePage() {
    const { can, loading } = usePermissions();

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
    }

    if (!can("Vehicles", "Add")) {
        return <Forbidden module="vehicles" action="add" />;
    }

    return (<div className="max-w-5xl mx-auto">
            <PageHeader title="Add New Vehicle" description="Register a new vehicle into the fleet."/>
            <VehicleForm />
        </div>);
}
