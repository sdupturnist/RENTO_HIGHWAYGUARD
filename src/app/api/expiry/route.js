import { NextResponse } from "next/server";
import { getTenantPool } from "@/app/lib/db";
import { getSession } from "@/app/lib/auth";

const FALLBACK_DAYS = 90;

function getDaysLeft(expiry) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const exp = new Date(expiry);
    exp.setHours(0, 0, 0, 0);
    return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
}

function getUrgency(daysLeft) {
    if (daysLeft < 0) return "expired";
    if (daysLeft <= 7) return "critical";
    if (daysLeft <= 30) return "warning";
    return "upcoming";
}

function parseHorizons(raw, fallback) {
    try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed) && parsed.length > 0) return Math.max(...parsed, fallback);
    } catch { }
    return fallback;
}

const fmt = (d) => d.toISOString().slice(0, 19).replace("T", " ");

export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const pool = getTenantPool();

        // Load notification settings
        const [notifRows] = await pool.query(`SELECT * FROM \`notification_settings\` LIMIT 1`);
        const notifSettings = notifRows?.[0] || null;

        const enabled = notifSettings?.enableExpiryNotifications ?? true;
        if (!enabled) {
            return NextResponse.json({ groups: [], totalCount: 0, urgentCount: 0, disabled: true });
        }

        const vehicleCutoffDays = parseHorizons(notifSettings?.vehicleExpiryThresholds, FALLBACK_DAYS);
        const operatorCutoffDays = parseHorizons(notifSettings?.operatorExpiryThresholds, FALLBACK_DAYS);

        const vehicleCutoff = new Date();
        vehicleCutoff.setDate(vehicleCutoff.getDate() + vehicleCutoffDays);
        const operatorCutoff = new Date();
        operatorCutoff.setDate(operatorCutoff.getDate() + operatorCutoffDays);

        // 1. Vehicle registrations expiring
        const [vehicles] = await pool.query(
            `SELECT v.id, v.vehicleCode, v.registrationExpiry,
                    vb.name as brandName, vm.name as modelName
             FROM \`vehicles\` v
             LEFT JOIN \`vehicle_brands\` vb ON vb.id = v.brandId
             LEFT JOIN \`vehicle_models\` vm ON vm.id = v.modelId
             WHERE v.registrationExpiry IS NOT NULL
               AND v.registrationExpiry <= ?
               AND v.status != 'INACTIVE'
             ORDER BY v.registrationExpiry ASC`,
            [fmt(vehicleCutoff)]
        );

        const vehicleRegItems = (vehicles || []).map((v) => {
            const daysLeft = getDaysLeft(v.registrationExpiry);
            return {
                id: v.id, code: v.vehicleCode,
                name: [v.brandName, v.modelName].filter(Boolean).join(" ") || v.vehicleCode,
                expiry: v.registrationExpiry, daysLeft, urgency: getUrgency(daysLeft),
                href: `/vehicles/${v.id}`, type: "Vehicle Registration",
            };
        });

        // 2. Vehicle documents expiring
        const [vehicleDocs] = await pool.query(
            `SELECT vd.id, vd.name, vd.expiryDate,
                    v.id as vehicleId, v.vehicleCode,
                    vb.name as brandName, vm.name as modelName
             FROM \`vehicle_documents\` vd
             JOIN \`vehicles\` v ON v.id = vd.vehicleId
             LEFT JOIN \`vehicle_brands\` vb ON vb.id = v.brandId
             LEFT JOIN \`vehicle_models\` vm ON vm.id = v.modelId
             WHERE vd.expiryDate IS NOT NULL
               AND vd.expiryDate <= ?
               AND v.status != 'INACTIVE'
             ORDER BY vd.expiryDate ASC`,
            [fmt(vehicleCutoff)]
        );

        const vehicleDocsItems = (vehicleDocs || []).map((d) => {
            const daysLeft = getDaysLeft(d.expiryDate);
            return {
                id: d.id, code: d.vehicleCode,
                name: d.name || "Document",
                subLabel: [d.brandName, d.modelName].filter(Boolean).join(" ") || d.vehicleCode,
                expiry: d.expiryDate, daysLeft, urgency: getUrgency(daysLeft),
                href: `/vehicles/${d.vehicleId}`, type: "Vehicle Document",
            };
        });

        // 3. Operator license expiring
        const [operators] = await pool.query(
            `SELECT id, operatorCode, name, licenseExpiry
             FROM \`operators\`
             WHERE licenseExpiry IS NOT NULL
               AND licenseExpiry <= ?
               AND status != 'INACTIVE'
             ORDER BY licenseExpiry ASC`,
            [fmt(operatorCutoff)]
        );

        const opLicenseItems = (operators || []).map((o) => {
            const daysLeft = getDaysLeft(o.licenseExpiry);
            return {
                id: o.id, code: o.operatorCode,
                name: o.name,
                expiry: o.licenseExpiry, daysLeft, urgency: getUrgency(daysLeft),
                href: `/operators/${o.id}`, type: "Operator License",
            };
        });

        // 4. Operator documents expiring
        const [operatorDocs] = await pool.query(
            `SELECT od.id, od.name, od.expiryDate,
                    o.id as operatorId, o.operatorCode, o.name as operatorName,
                    dt.name as documentTypeName
             FROM \`operator_documents\` od
             JOIN \`operators\` o ON o.id = od.operatorId
             LEFT JOIN \`operator_document_types\` dt ON dt.id = od.documentTypeId
             WHERE od.expiryDate IS NOT NULL
               AND od.expiryDate <= ?
               AND o.status != 'INACTIVE'
             ORDER BY od.expiryDate ASC`,
            [fmt(operatorCutoff)]
        );

        const opDocsItems = (operatorDocs || []).map((d) => {
            const daysLeft = getDaysLeft(d.expiryDate);
            return {
                id: d.id, code: d.operatorCode,
                name: d.name || d.documentTypeName || "Document",
                subLabel: d.operatorName,
                expiry: d.expiryDate, daysLeft, urgency: getUrgency(daysLeft),
                href: `/operators/${d.operatorId}`, type: "Operator Document",
            };
        });

        const buildGroup = (id, label, icon, items) => ({
            id, label, icon, count: items.length,
            urgentCount: items.filter((i) => ["expired", "critical", "warning"].includes(i.urgency)).length,
            items,
        });

        const groups = [
            buildGroup("vehicle-registration", "Vehicle Registration", "Truck", vehicleRegItems),
            buildGroup("vehicle-documents", "Vehicle Documents", "FileText", vehicleDocsItems),
            buildGroup("operator-license", "Operator License", "IdCard", opLicenseItems),
            buildGroup("operator-documents", "Operator Documents", "File", opDocsItems),
        ].filter((g) => g.count > 0);

        const totalCount = groups.reduce((s, g) => s + g.count, 0);
        const urgentCount = groups.reduce((s, g) => s + g.urgentCount, 0);

        return NextResponse.json({ groups, totalCount, urgentCount, disabled: false });
    } catch (error) {
        console.error("Error fetching expiry data:", error);
        return NextResponse.json({ message: "Error fetching expiry data", error: String(error) }, { status: 500 });
    }
}
