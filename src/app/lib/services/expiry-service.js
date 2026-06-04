import { startOfDay, differenceInDays } from "date-fns";

/**
 * Utility to determine if a specific item hits the closest valid threshold for labeling
 */
export function getUrgency(daysRemaining, thresholds) {
    if (daysRemaining < 0) return "expired";
    if (daysRemaining <= 7) return "urgent";

    // Sort thresholds ascending
    const sorted = [...thresholds].sort((a, b) => a - b);
    for (const t of sorted) {
        if (daysRemaining <= t) return `due-in-${t}`;
    }
    return "upcoming";
}

/**
 * Fetches and models expiry items for a specific tenant given their configured thresholds.
 * @param {import("@dbQuery/client").PrismaClient} dbQuery - The tenant's Db client instance.
 * @param {Object} settings - The NotificationSettings for the tenant.
 * @returns {Promise<Array>} List of expiry items
 */
export async function getExpiryItemsForTenant(dbQuery, settings) {
    // Ensure thresholds are numbers
    const vehicleThresholds = Array.isArray(settings.vehicleExpiryThresholds) ? settings.vehicleExpiryThresholds.map(Number) : [7, 14, 30];
    const operatorThresholds = Array.isArray(settings.operatorExpiryThresholds) ? settings.operatorExpiryThresholds.map(Number) : [7, 14, 30];
    const maxVehicleThreshold = vehicleThresholds.length > 0 ? Math.max(...vehicleThresholds) : 0;
    const maxOperatorThreshold = operatorThresholds.length > 0 ? Math.max(...operatorThresholds) : 0;

    const today = startOfDay(new Date());
    const items = [];

    // 1. Fetch Vehicles & Vehicle Documents
    if (maxVehicleThreshold > 0) {
        const vehicles = await dbQuery.vehicle.findMany({
            where: {
                status: 'ACTIVE'
            },
            include: {
                documents: true,
                brand: true,
            }
        });

        vehicles.forEach(vehicle => {
            // Vehicle Registration Expiry
            if (vehicle.registrationExpiry) {
                const daysRemaining = differenceInDays(new Date(vehicle.registrationExpiry), today);
                if (daysRemaining <= maxVehicleThreshold) {
                    items.push({
                        id: `v-reg-${vehicle.id}`,
                        type: "Vehicle Registration",
                        entityId: vehicle.id,
                        entityName: vehicle.regNo || vehicle.registrationNumber || "Unknown Registration",
                        reference: vehicle.brand?.name || "Unknown Brand",
                        expiryDate: vehicle.registrationExpiry,
                        daysRemaining,
                        urgency: getUrgency(daysRemaining, vehicleThresholds),
                        link: `/vehicles/${vehicle.id}`,
                        category: "vehicle"
                    });
                }
            }

            // Vehicle Documents
            if (vehicle.documents && Array.isArray(vehicle.documents)) {
                vehicle.documents.forEach(doc => {
                    if (doc.expiryDate) {
                        const daysRemaining = differenceInDays(new Date(doc.expiryDate), today);
                        if (daysRemaining <= maxVehicleThreshold) {
                            items.push({
                                id: `v-doc-${doc.id}`,
                                type: "Vehicle Document",
                                entityId: vehicle.id,
                                entityName: doc.title || doc.name || "Vehicle Document",
                                reference: vehicle.regNo || vehicle.registrationNumber || "Unknown Registration",
                                expiryDate: doc.expiryDate,
                                daysRemaining,
                                urgency: getUrgency(daysRemaining, vehicleThresholds),
                                link: `/vehicles/${vehicle.id}`,
                                category: "document"
                            });
                        }
                    }
                });
            }
        });
    }

    // 2. Fetch Operators & Operator Documents
    if (maxOperatorThreshold > 0) {
        const operators = await dbQuery.operator.findMany({
            where: { status: 'ACTIVE' },
            include: { documents: true },
        });

        operators.forEach(operator => {
            // Operator License Expiry
            if (operator.licenseExpiry) {
                const daysRemaining = differenceInDays(new Date(operator.licenseExpiry), today);
                if (daysRemaining <= maxOperatorThreshold) {
                    items.push({
                        id: `o-lic-${operator.id}`,
                        type: "Operator License",
                        entityId: operator.id,
                        entityName: operator.name || "Unknown Operator",
                        reference: operator.licenseNumber || "N/A",
                        expiryDate: operator.licenseExpiry,
                        daysRemaining,
                        urgency: getUrgency(daysRemaining, operatorThresholds),
                        link: `/operators/${operator.id}`,
                        category: "operator"
                    });
                }
            }

            // Operator Documents
            if (operator.documents && Array.isArray(operator.documents)) {
                operator.documents.forEach(doc => {
                    if (doc.expiryDate) {
                        const daysRemaining = differenceInDays(new Date(doc.expiryDate), today);
                        if (daysRemaining <= maxOperatorThreshold) {
                            items.push({
                                id: `o-doc-${doc.id}`,
                                type: "Operator Document",
                                entityId: operator.id,
                                entityName: doc.title || doc.name || "Operator Document",
                                reference: operator.name || "Unknown Operator",
                                expiryDate: doc.expiryDate,
                                daysRemaining,
                                urgency: getUrgency(daysRemaining, operatorThresholds),
                                link: `/operators/${operator.id}`,
                                category: "document"
                            });
                        }
                    }
                });
            }
        });
    }

    // Sort items by urgency (days remaining) ascending (most urgent first)
    items.sort((a, b) => a.daysRemaining - b.daysRemaining);

    return items;
}
