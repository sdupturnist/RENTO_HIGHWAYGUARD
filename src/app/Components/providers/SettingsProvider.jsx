"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/app/lib/store/useAppStore";

const SettingsContext = createContext(undefined);

export function SettingsProvider({ children }) {
    const pathname = usePathname();
    const { companySettings: settings, isLoading, refreshSettings } = useAppStore();

    const value = {
        settings,
        isLoading,
        refreshSettings,
        dateFormat: settings?.dateFormat || "DD/MM/YYYY",
        currencySymbol: settings?.currencySymbol || "AED",
        currencyPosition: settings?.currencyPosition || "BEFORE",
    };

    return (<SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>);
}
export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error("useSettings must be used within a SettingsProvider");
    }
    return context;
}
