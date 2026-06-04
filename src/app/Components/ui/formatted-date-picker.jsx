"use client";
import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { Button } from "@/app/Components/ui/button";
import { Calendar } from "@/app/Components/ui/calendar";
import { Input } from "@/app/Components/ui/input";
import { Popover, PopoverContent, PopoverTrigger, } from "@/app/Components/ui/popover";
import { useSettings } from "@/app/Components/providers/SettingsProvider";
export function FormattedDatePicker({ value, onChange, disabled = false, placeholder = "Pick a date", id, minDate, maxDate, dateFormat: propDateFormat, }) {
    const [open, setOpen] = React.useState(false);
    const { dateFormat: globalDateFormat } = useSettings();
    // Use prop if provided, otherwise global, otherwise default
    const displayFormat = propDateFormat || globalDateFormat || "dd/MM/yyyy";
    // Map user-friendly formats to date-fns formats if necessary
    // Example: "DD/MM/YYYY" -> "dd/MM/yyyy"
    const mapFormat = (fmt) => {
        return fmt
            .replace("DD", "dd")
            .replace("YYYY", "yyyy")
            .replace("MM", "MM"); // Ensure MM is uppercase for months
    };
    const finalFormat = mapFormat(displayFormat);

    const parseSafeDate = (val) => {
        if (val === null || val === undefined || val === "") return null;
        const d = new Date(val);
        return isValid(d) ? d : null;
    };

    const dateValue = parseSafeDate(value);
    const min = parseSafeDate(minDate);
    const max = parseSafeDate(maxDate);

    const [inputValue, setInputValue] = React.useState("");
    const [isFocused, setIsFocused] = React.useState(false);
    // Update input value when value prop changes, BUT NOT when user is typing (focused)
    // unless the value is significantly different (e.g. selected from calendar)
    React.useEffect(() => {
        if (!isFocused && dateValue) {
            setInputValue(format(dateValue, finalFormat));
        }
        else if (!isFocused && !dateValue) {
            setInputValue("");
        }
    }, [dateValue, finalFormat, isFocused]);

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInputValue(val);
        if (val.trim() === "") {
            onChange(undefined);
            return;
        }
        // Only try to parse and update parent if the input length reaches the format length
        // This prevents e.g. "10/02/2" being parsed as year 0002 and glitching the UI
        if (val.length < finalFormat.length) {
            return;
        }
        const parsedDate = parse(val, finalFormat, new Date());
        if (isValid(parsedDate)) {
            // Normalize to Noon
            parsedDate.setHours(12, 0, 0, 0);
            // Check range
            let isOutOfRange = false;
            if (min) {
                const minCompare = new Date(min);
                minCompare.setHours(0, 0, 0, 0);
                if (parsedDate < minCompare)
                    isOutOfRange = true;
            }
            if (max) {
                const maxCompare = new Date(max);
                maxCompare.setHours(23, 59, 59, 999);
                if (parsedDate > maxCompare)
                    isOutOfRange = true;
            }
            if (!isOutOfRange) {
                onChange(parsedDate);
            }
        }
    };

    const isDateOutOfRange = (date) => {
        if (min) {
            const minCompare = new Date(min);
            minCompare.setHours(0, 0, 0, 0);
            if (date < minCompare)
                return true;
        }
        if (max) {
            const maxCompare = new Date(max);
            maxCompare.setHours(23, 59, 59, 999);
            if (date > maxCompare)
                return true;
        }
        return false;
    };

    return (<div className="relative w-full">
            <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                    <Input id={id} type="text" value={inputValue} onChange={handleInputChange} onFocus={() => setIsFocused(true)} onBlur={() => {
            setIsFocused(false);
            // Revert to current prop value on blur if input is invalid or out of range
            // This is handled by useEffect strictly speaking, but useEffect only runs on prop change.
            // If user typed invalid date and clicked away, inputValue might stay invalid.
            // We should reset it.
            if (dateValue) {
                setInputValue(format(dateValue, finalFormat));
            }
            else {
                if (inputValue.trim() !== "") {
                    setInputValue(""); // Clear invalid text
                }
            }
        }} placeholder={placeholder !== "Pick a date" ? placeholder : finalFormat.toUpperCase()} disabled={disabled} className={cn("w-full pr-10", !dateValue && "text-muted-foreground")} autoComplete="off"/>
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground" disabled={disabled}>
                                <CalendarIcon className="h-4 w-4"/>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end" side="bottom" avoidCollisions={false}>
                            <Calendar mode="single" selected={dateValue || undefined} onSelect={(date) => {
            if (date) {
                const adjustedDate = new Date(date);
                adjustedDate.setHours(12, 0, 0, 0);
                onChange(adjustedDate);
                setInputValue(format(adjustedDate, finalFormat));
            }
            else {
                onChange(undefined);
                setInputValue("");
            }
            setOpen(false);
        }} initialFocus disabled={(date) => isDateOutOfRange(date) || date < new Date("1900-01-01")}/>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </div>);
}
