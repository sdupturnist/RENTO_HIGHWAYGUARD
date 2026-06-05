import { NextResponse } from "next/server";
import { dbTenant, withTenantTransaction } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import { z } from "zod";
import { autoCompleteMaintenances } from "@/app/lib/maintenance-utils";
import { checkEntityUsage, buildUsageError } from "@/app/lib/entity-usage";
import { ensureVehicleDocumentsSchema } from "@/app/lib/vehicle-documents-schema";
import { revalidatePath } from "next/cache";

const vehicleSchema = z.object({
    typeId: z.number(),
    brandId: z.number().optional().nullable(),
    modelId: z.number().optional().nullable(),
    manufacturingYear: z.number().min(1900),
    regNo: z.string().optional().nullable(),
    registrationDate: z.string().optional().nullable(),
    registrationExpiry: z.string().optional().nullable(),
    registrationAuthorityId: z.number().optional().nullable(),
    countryOfRegistration: z.string().default("UAE"),
    status: z.enum(["ACTIVE", "UNDER_MAINTENANCE", "EXPIRED_REGISTRATION", "INACTIVE"]).optional().default("ACTIVE"),
    ownership: z.enum(["OWN", "THIRD_PARTY"]).default("OWN"),
    thirdPartyOwnerName: z.string().optional().nullable().or(z.literal("")),
    thirdPartyOwnerCompany: z.string().optional().nullable().or(z.literal("")),
    thirdPartyContact: z.string().optional().nullable().or(z.literal("")),
    thirdPartyEmail: z.string().email().optional().nullable().or(z.literal("")),
    thirdPartyAgreementName: z.string().optional().nullable().or(z.literal("")),
    thirdPartyContractStart: z.string().optional().nullable(),
    thirdPartyContractEnd: z.string().optional().nullable(),
    baseRentType: z.enum(["HOURLY", "DAILY", "MONTHLY"]).default("DAILY"),
    baseRentAmount: z.number().min(0),
    defaultRentCycle: z.enum(["HOURLY", "DAILY"]).default("DAILY"),
    fuelType: z.string().optional().nullable(),
    capacity: z.number().optional().nullable(),
    remarks: z.string().optional().nullable(),
    documents: z.array(z.object({
        documentTypeId: z.coerce.number().min(1, "Document Type is required"),
        name: z.string().optional().nullable(),
        url: z.string(),
        expiryDate: z.string().optional().nullable(),
    })).optional(),
});

async function fetchVehicleById(id) {
    await ensureVehicleDocumentsSchema();
    const [rows] = await dbTenant(
        `SELECT v.*,
                vt.name as vehicleType_name, vt.id as vehicleType_id,
                b.name as brand_name, b.id as brand_id,
                m.name as model_name, m.id as model_id,
                ra.name as registrationAuthority_name, ra.id as registrationAuthority_id
         FROM \`vehicles\` v
         LEFT JOIN \`vehicle_types\` vt ON vt.id = v.typeId
         LEFT JOIN \`vehicle_brands\` b ON b.id = v.brandId
         LEFT JOIN \`vehicle_models\` m ON m.id = v.modelId
         LEFT JOIN \`registration_authorities\` ra ON ra.id = v.registrationAuthorityId
         WHERE v.id = ? LIMIT 1`,
        [id]
    );
    const v = rows?.[0];
    if (!v) return null;
    const [docs] = await dbTenant(`
        SELECT vd.*, dt.name as documentTypeName
        FROM \`vehicle_documents\` vd
        LEFT JOIN \`document_types\` dt ON dt.id = vd.documentTypeId
        WHERE vd.vehicleId = ?
    `, [id]);
    return {
        ...v,
        vehicleType: { id: v.vehicleType_id, name: v.vehicleType_name },
        brand: { id: v.brand_id, name: v.brand_name },
        model: { id: v.model_id, name: v.model_name },
        registrationAuthority: { id: v.registrationAuthority_id, name: v.registrationAuthority_name },
        documents: docs || [],
    };
}

export async function PUT(request, props) {
    try {
        const params = await props.params;
        const session = await getSession();
        if (!session)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canEdit = await verifySessionPermission(session, "Vehicles", "Edit");
        if (!canEdit)
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const id = parseInt(params.id);
        const body = await request.json();
        const data = vehicleSchema.parse(body);

        // Get existing status to detect changes
        const [existingRows] = await dbTenant(`SELECT status FROM \`vehicles\` WHERE id = ? LIMIT 1`, [id]);
        const existingVehicle = existingRows?.[0] || null;

        await withTenantTransaction(async (tx) => {
            await tx.execute(
                `UPDATE \`vehicles\` SET
                    typeId = ?, brandId = ?, modelId = ?, manufacturingYear = ?,
                    regNo = ?, registrationDate = ?, registrationExpiry = ?,
                    registrationAuthorityId = ?, countryOfRegistration = ?,
                    status = ?, ownership = ?,
                    thirdPartyOwnerName = ?, thirdPartyOwnerCompany = ?,
                    thirdPartyContact = ?, thirdPartyEmail = ?,
                    thirdPartyAgreementName = ?,
                    thirdPartyContractStart = ?, thirdPartyContractEnd = ?,
                    baseRentType = ?, baseRentAmount = ?, defaultRentCycle = ?,
                    fuelType = ?, capacity = ?, remarks = ?,
                    updatedAt = NOW()
                 WHERE id = ?`,
                [
                    data.typeId, data.brandId || null, data.modelId || null, data.manufacturingYear,
                    data.regNo || null,
                    data.registrationDate ? new Date(data.registrationDate) : null,
                    data.registrationExpiry ? new Date(data.registrationExpiry) : null,
                    data.registrationAuthorityId || null, data.countryOfRegistration,
                    data.status, data.ownership,
                    data.thirdPartyOwnerName || null, data.thirdPartyOwnerCompany || null,
                    data.thirdPartyContact || null,
                    data.thirdPartyEmail === "" ? null : data.thirdPartyEmail,
                    data.thirdPartyAgreementName || null,
                    data.thirdPartyContractStart ? new Date(data.thirdPartyContractStart) : null,
                    data.thirdPartyContractEnd ? new Date(data.thirdPartyContractEnd) : null,
                    data.baseRentType, data.baseRentAmount, data.defaultRentCycle,
                    data.fuelType || null, data.capacity || null, data.remarks || null,
                    id,
                ]
            );

            // Replace documents
            await tx.execute(`DELETE FROM \`vehicle_documents\` WHERE vehicleId = ?`, [id]);
            if (data.documents?.length > 0) {
                for (const d of data.documents) {
                    await tx.execute(
                        `INSERT INTO \`vehicle_documents\` (documentTypeId, name, url, expiryDate, vehicleId, createdAt) VALUES (?, ?, ?, ?, ?, NOW())`,
                        [d.documentTypeId, d.name || null, d.url, d.expiryDate ? new Date(d.expiryDate) : null, id]
                    );
                }
            }
        });

        // Auto-complete maintenances if reactivated
        if (existingVehicle?.status === "UNDER_MAINTENANCE" && data.status === "ACTIVE") {
            const completedCount = await autoCompleteMaintenances(id);
            if (completedCount > 0) {
                await logActivity("MAINTENANCE", id, "AUTO_COMPLETE", `Auto-completed ${completedCount} maintenance(s) when vehicle reactivated`);
            }
        }

        await logActivity("VEHICLE", id, "UPDATE", `Updated vehicle ID: ${id}`);

        const updated = await fetchVehicleById(id);
        revalidatePath("/vehicles");
        revalidatePath(`/vehicles/${id}`);
        return NextResponse.json(updated);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ message: "Validation failed", errors: error.errors }, { status: 400 });
        }
        console.error("Error updating vehicle:", error);
        return NextResponse.json({ message: "Error updating vehicle" }, { status: 500 });
    }
}

export async function DELETE(request, props) {
    const params = await props.params;
    try {
        const session = await getSession();
        if (!session)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canDelete = await verifySessionPermission(session, "Vehicles", "Delete");
        if (!canDelete)
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        const id = parseInt(params.id);
        if (isNaN(id))
            return NextResponse.json({ message: "Invalid ID" }, { status: 400 });

        const [vehicleRows] = await dbTenant(`SELECT * FROM \`vehicles\` WHERE id = ? LIMIT 1`, [id]);
        const vehicle = vehicleRows?.[0];
        if (!vehicle)
            return NextResponse.json({ message: "Vehicle not found" }, { status: 404 });

        const { inUse, usedIn, counts } = await checkEntityUsage("vehicle", id);
        if (inUse)
            return NextResponse.json({ message: buildUsageError(usedIn, counts) }, { status: 409 });

        await withTenantTransaction(async (tx) => {
            await tx.execute(`DELETE FROM \`vehicle_documents\` WHERE vehicleId = ?`, [id]);
            await tx.execute(`DELETE FROM \`vehicles\` WHERE id = ?`, [id]);
        });

        await logActivity("VEHICLE", id, "DELETE", `Deleted vehicle ${vehicle.vehicleCode}`);
        revalidatePath("/vehicles");
        revalidatePath(`/vehicles/${id}`);
        return NextResponse.json({ message: "Vehicle deleted" });
    } catch (error) {
        console.error("Error deleting vehicle:", error);
        return NextResponse.json({ message: "Error deleting vehicle. It may have active dependencies." }, { status: 500 });
    }
}
