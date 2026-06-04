import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
export function truncateString(str, num = 20) {
    if (!str)
        return "";
    if (str.length <= num) {
        return str;
    }
    return str.slice(0, num) + "...";
}
