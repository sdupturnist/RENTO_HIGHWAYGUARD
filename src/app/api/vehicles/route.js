import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";
import { verifySessionPermission } from "@/app/lib/permissions";
import { logActivity } from "@/app/lib/logger";
import { z } from "zod";
import { reserveSequentialCode } from "@/app/lib/sequential-code";
import { ensureVehicleDocumentsSchema } from "@/app/lib/vehicle-documents-schema";
import { revalidatePath } from "next/cache";

const vehicleSchema = z.object({
    prefixRuleId: z.number().optional(),
    typeId: z.number(),
    brandId: z.number().optional(),
    modelId: z.number().optional(),
    manufacturingYear: z.number().min(1900),
    regNo: z.string().optional(),
    registrationDate: z.string().optional().nullable(),
    registrationExpiry: z.string().optional().nullable(),
    registrationAuthorityId: z.number().optional(),
    countryOfRegistration: z.string().default("UAE"),
    status: z.enum(["ACTIVE", "MAINTENANCE", "INACTIVE"]).optional().default("ACTIVE"), // EXPIRED is derived
    ownership: z.enum(["OWN", "THIRD_PARTY"]).default("OWN"),
    // Third Party
    thirdPartyOwnerName: z.string().optional().nullable().or(z.literal("")),
    thirdPartyOwnerCompany: z.string().optional().nullable().or(z.literal("")),
    thirdPartyContact: z.string().optional().nullable().or(z.literal("")),
    thirdPartyEmail: z.string().email().optional().nullable().or(z.literal("")),
    thirdPartyAgreementName: z.string().optional().nullable().or(z.literal("")),
    thirdPartyContractStart: z.string().optional().nullable(),
    thirdPartyContractEnd: z.string().optional().nullable(),
    // Rent
    baseRentType: z.enum(["HOURLY", "DAILY", "MONTHLY"]).default("DAILY"),
    baseRentAmount: z.number().min(0),
    defaultRentCycle: z.enum(["HOURLY", "DAILY"]).default("DAILY"),
    // Operational
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
export async function GET(req) {
    try {
        await ensureVehicleDocumentsSchema();
        const session = await getSession();
        if (!session)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canView = await verifySessionPermission(session, "Vehicles", "View");
        if (!canView) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const [vehicles] = await dbTenant(`
            SELECT v.*, 
                   vt.name as vehicleType_name, vt.id as vehicleType_id,
                   b.name as brand_name, b.id as brand_id,
                   m.name as model_name, m.id as model_id,
                   ra.name as registrationAuthority_name, ra.id as registrationAuthority_id
            FROM \`vehicles\` v
            LEFT JOIN \`vehicle_types\` vt ON v.typeId = vt.id
            LEFT JOIN \`vehicle_brands\` b ON v.brandId = b.id
            LEFT JOIN \`vehicle_models\` m ON v.modelId = m.id
            LEFT JOIN \`registration_authorities\` ra ON v.registrationAuthorityId = ra.id
            ORDER BY v.createdAt DESC, v.id DESC
        `);

        const vehicleIds = (vehicles || []).map((v) => v.id);
        const docsByVehicle = {};
        if (vehicleIds.length > 0) {
            const placeholders = vehicleIds.map(() => "?").join(",");
            const [allDocs] = await dbTenant(`
                SELECT vd.*, dt.name as documentTypeName
                FROM \`vehicle_documents\` vd
                LEFT JOIN \`document_types\` dt ON dt.id = vd.documentTypeId
                WHERE vd.vehicleId IN (${placeholders})
            `, vehicleIds);
            for (const doc of allDocs) {
                if (!docsByVehicle[doc.vehicleId]) docsByVehicle[doc.vehicleId] = [];
                docsByVehicle[doc.vehicleId].push(doc);
            }
        }

        const enriched = (vehicles || []).map((v) => {
            const isExpired = v.registrationExpiry && new Date(v.registrationExpiry) < new Date();
            return {
                ...v,
                status: isExpired ? "EXPIRED_REGISTRATION" : v.status,
                originalStatus: v.status,
                vehicleType: { id: v.vehicleType_id, name: v.vehicleType_name },
                brand: { id: v.brand_id, name: v.brand_name },
                model: { id: v.model_id, name: v.model_name },
                registrationAuthority: { id: v.registrationAuthority_id, name: v.registrationAuthority_name },
                documents: docsByVehicle[v.id] || [],
            };
        });

        return NextResponse.json(enriched);
    }
    catch (error) {
        console.error("Error fetching vehicles:", error);
        return NextResponse.json({ message: "Error fetching vehicles", error: String(error) }, { status: 500 });
    }
}

async function generateVehicleCode(tx, prefixRuleId) {
    const { code } = await reserveSequentialCode(tx, {
        tableName: "vehicle_code_rules",
        recordId: prefixRuleId || undefined,
        createSql: prefixRuleId ? null : "INSERT INTO `vehicle_code_rules` (prefix, startingNumber, padding, updatedAt) VALUES (?, ?, ?, NOW())",
        createParams: ["VEH", 1001, 4],
        separator: "-",
        entityTableName: "vehicles",
        entityCodeField: "vehicleCode",
    });
    return code;
}

export async function POST(req) {
    try {
        await ensureVehicleDocumentsSchema();
        const session = await getSession();
        if (!session)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const canEdit = await verifySessionPermission(session, "Vehicles", "Edit");
        if (!canEdit) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
        

        const body = await req.json();
        const data = vehicleSchema.parse(body);

        // Duplicate regNo check
        if (data.regNo) {
            const [existingRows] = await dbTenant("SELECT id, vehicleCode FROM `vehicles` WHERE `regNo` = ? LIMIT 1", [data.regNo]);
            if (existingRows.length > 0) {
                return NextResponse.json({ message: `A vehicle with registration number "${data.regNo}" already exists (${existingRows[0].vehicleCode}).` }, { status: 409 });
            }
        }

        const { withTenantTransaction } = await import("@/app/lib/db");
        const vehicleId = await withTenantTransaction(async (tx) => {
            const vehicleCode = await generateVehicleCode(tx, data.prefixRuleId);
            const nullable = (value) => value ?? null;

            const [result] = await tx.execute(`
                INSERT INTO \`vehicles\` 
                (vehicleCode, typeId, brandId, modelId, manufacturingYear, regNo, registrationDate, registrationExpiry, registrationAuthorityId, countryOfRegistration, status, ownership, thirdPartyOwnerName, thirdPartyOwnerCompany, thirdPartyContact, thirdPartyEmail, thirdPartyAgreementName, thirdPartyContractStart, thirdPartyContractEnd, baseRentType, baseRentAmount, defaultRentCycle, fuelType, capacity, remarks, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
                vehicleCode, data.typeId, nullable(data.brandId), nullable(data.modelId), data.manufacturingYear, nullable(data.regNo),
                data.registrationDate ? new Date(data.registrationDate) : null,
                data.registrationExpiry ? new Date(data.registrationExpiry) : null,
                nullable(data.registrationAuthorityId), data.countryOfRegistration, data.status, data.ownership,
                nullable(data.thirdPartyOwnerName), nullable(data.thirdPartyOwnerCompany), nullable(data.thirdPartyContact), nullable(data.thirdPartyEmail),
                nullable(data.thirdPartyAgreementName),
                data.thirdPartyContractStart ? new Date(data.thirdPartyContractStart) : null,
                data.thirdPartyContractEnd ? new Date(data.thirdPartyContractEnd) : null,
                data.baseRentType, data.baseRentAmount, data.defaultRentCycle, nullable(data.fuelType), nullable(data.capacity), nullable(data.remarks)
            ]);

            const newId = result.insertId;

            if (data.documents?.length > 0) {
                for (const d of data.documents) {
                    await tx.execute(
                        "INSERT INTO `vehicle_documents` (documentTypeId, name, url, expiryDate, vehicleId, createdAt) VALUES (?, ?, ?, ?, ?, NOW())",
                        [d.documentTypeId, d.name || null, d.url, d.expiryDate ? new Date(d.expiryDate) : null, newId]
                    );
                }
            }
            return newId;
        });

        await logActivity("VEHICLE", vehicleId, "CREATE", `Created vehicle ID: ${vehicleId}`);
        revalidatePath("/vehicles");
        return NextResponse.json({ id: vehicleId, success: true });
    }
    catch (error) {
        console.error("POST vehicle error:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ message: "Validation failed", errors: error.errors }, { status: 400 });
        }
        return NextResponse.json({ message: "Error creating vehicle", error: error.message }, { status: 500 });
    }
}
