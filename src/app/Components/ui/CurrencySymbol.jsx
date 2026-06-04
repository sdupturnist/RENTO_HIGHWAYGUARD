/**
 * CurrencySymbol — Smart currency symbol renderer.
 * If the currency symbol stored in settings is "AED",
 * renders the official SVG Dirham symbol (CBUAE 2025).
 * Otherwise renders plain text symbol (e.g. $, €, £).
 *
 * Usage:
 *   <CurrencySymbol symbol={currencySymbol} />
 *   <CurrencySymbol symbol={currencySymbol} size="1.1em" />
 */
import { AedSymbol } from "@/app/Components/ui/AedSymbol";

export function CurrencySymbol({ symbol, className = "" }) {
    if (symbol === "AED") {
        return <AedSymbol className={className} />;
    }
    return (
        <span className={`inline-flex items-center self-center leading-none ${className}`}>
            {symbol}
        </span>
    );
}
