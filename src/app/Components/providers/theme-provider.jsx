"use client";
import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
export function ThemeProvider({ children, ...props }) {
    // Lock the app to light mode and ignore system preference.
    return (<NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light" {...props}>
            {children}
        </NextThemesProvider>);
}
