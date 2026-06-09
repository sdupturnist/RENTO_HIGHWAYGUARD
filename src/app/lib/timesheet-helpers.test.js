import { describe, it, expect } from "vitest";
import { aggregateLogsIntoLines } from "./timesheet-helpers";

describe("timesheet helpers - aggregateLogsIntoLines", () => {
    const defaultSettings = {
        fullDayHours: 8,
        overtimeStartsAfter: 10,
        overtimeMultiplier: 1.5,
        holidayMultiplier: 2.0
    };

    it("should calculate vehicle daily billing: 3 hours bills exactly 1 day, operator bills actual 3 hours", () => {
        const logs = [
            {
                blockType: "VEHICLE",
                date: "2026-06-08",
                vehicleId: 1,
                operatorId: 101,
                workedHours: 3,
                isHoliday: false,
                isWeekend: false,
                baseRentAmount: 800, // base rent for daily billing
                baseRentType: "DAILY",
                defaultRentCycle: "DAILY",
                block_billingCycle: "DAILY",
                hourlyRate: 50,
                operator_name: "John Doe",
                vehicle_regNo: "V-1234"
            }
        ];

        const results = aggregateLogsIntoLines(logs, defaultSettings);

        // Should return 2 entries: 1 for vehicle (V-2026-06-08-1-0) and 1 for operator (O-2026-06-08-101)
        expect(results).toHaveLength(2);

        const vehicle = results.find(r => r.blockType === "VEHICLE");
        const operator = results.find(r => r.blockType === "OPERATOR");

        // Vehicle cost: workedHours (3) <= fullDayHours (8), so bills flat daily rent of 800
        expect(vehicle.calculatedAmount).toBe(800);

        // Operator: bills 3 regular hours at operator rate (50) = 150. No overtime.
        expect(operator.regularHours).toBe(3);
        expect(operator.overtimeHours).toBe(0);
        expect(operator.calculatedAmount).toBe(150);
    });

    it("should calculate vehicle daily billing: 11 hours bills 1 day + 3 extra hours, operator bills 10 regular + 1 overtime", () => {
        const logs = [
            {
                blockType: "VEHICLE",
                date: "2026-06-08",
                vehicleId: 1,
                operatorId: 101,
                workedHours: 11,
                isHoliday: false,
                isWeekend: false,
                baseRentAmount: 800,
                baseRentType: "DAILY",
                defaultRentCycle: "DAILY",
                block_billingCycle: "DAILY",
                hourlyRate: 50,
                operator_name: "John Doe",
                vehicle_regNo: "V-1234"
            }
        ];

        const results = aggregateLogsIntoLines(logs, defaultSettings);

        expect(results).toHaveLength(2);

        const vehicle = results.find(r => r.blockType === "VEHICLE");
        const operator = results.find(r => r.blockType === "OPERATOR");

        // Vehicle cost: 11 hours (1 day + 3 extra hours). Hourly rate = 800 / 8 = 100.
        // Cost = 800 + (11 - 8) * 100 = 800 + 300 = 1100.
        expect(vehicle.calculatedAmount).toBe(1100);

        // Operator: overtime starts after 10 hours.
        // 10 regular hours + 1 overtime hour.
        // Cost = 10 * 50 + 1 * 50 * 1.5 = 500 + 75 = 575.
        expect(operator.regularHours).toBe(10);
        expect(operator.overtimeHours).toBe(1);
        expect(operator.calculatedAmount).toBe(575);
    });

    it("should calculate vehicle hourly billing: 12 hours bills flat hourly rate for vehicle, operator bills 10 regular + 2 overtime", () => {
        const logs = [
            {
                blockType: "VEHICLE",
                date: "2026-06-08",
                vehicleId: 1,
                operatorId: 101,
                workedHours: 12,
                isHoliday: false,
                isWeekend: false,
                baseRentAmount: 100, // hourly rate
                baseRentType: "HOURLY",
                defaultRentCycle: "HOURLY",
                block_billingCycle: "HOURLY",
                hourlyRate: 50,
                operator_name: "John Doe",
                vehicle_regNo: "V-1234"
            }
        ];

        const results = aggregateLogsIntoLines(logs, defaultSettings);

        expect(results).toHaveLength(2);

        const vehicle = results.find(r => r.blockType === "VEHICLE");
        const operator = results.find(r => r.blockType === "OPERATOR");

        // Vehicle hourly cost = 12 * 100 = 1200
        expect(vehicle.calculatedAmount).toBe(1200);

        // Operator: 10 regular + 2 overtime.
        // Cost = 10 * 50 + 2 * 50 * 1.5 = 500 + 150 = 650.
        expect(operator.regularHours).toBe(10);
        expect(operator.overtimeHours).toBe(2);
        expect(operator.calculatedAmount).toBe(650);
    });

    it("should calculate based on project overrides: 12 hours bills 9 hours regular and 3 hours extra for vehicle, operator bills 11 regular + 1 overtime", () => {
        const projectSettings = {
            fullDayHours: 9,
            overtimeStartsAfter: 11,
            overtimeMultiplier: 1.5,
            holidayMultiplier: 2.0
        };

        const logs = [
            {
                blockType: "VEHICLE",
                date: "2026-06-08",
                vehicleId: 1,
                operatorId: 101,
                workedHours: 12,
                isHoliday: false,
                isWeekend: false,
                baseRentAmount: 900,
                baseRentType: "DAILY",
                defaultRentCycle: "DAILY",
                block_billingCycle: "DAILY",
                hourlyRate: 50,
                operator_name: "John Doe",
                vehicle_regNo: "V-1234"
            }
        ];

        const results = aggregateLogsIntoLines(logs, projectSettings);

        expect(results).toHaveLength(2);

        const vehicle = results.find(r => r.blockType === "VEHICLE");
        const operator = results.find(r => r.blockType === "OPERATOR");

        // Vehicle cost: 12 hours (1 day of 9 hours + 3 extra hours). Hourly rate = 900 / 9 = 100.
        // Cost = 900 + (12 - 9) * 100 = 900 + 300 = 1200.
        expect(vehicle.calculatedAmount).toBe(1200);

        // Operator: overtime starts after 11 hours.
        // 11 regular hours + 1 overtime hour.
        // Cost = 11 * 50 + 1 * 50 * 1.5 = 550 + 75 = 625.
        expect(operator.regularHours).toBe(11);
        expect(operator.overtimeHours).toBe(1);
        expect(operator.calculatedAmount).toBe(625);
    });
});
