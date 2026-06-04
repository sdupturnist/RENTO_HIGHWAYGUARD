import { db } from '@/app/lib/db';

let cachedBranding = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10000; // 10 seconds in milliseconds

export async function getAppBranding() {
    const now = Date.now();
    if (cachedBranding && (now - cacheTimestamp < CACHE_TTL)) {
        return cachedBranding;
    }

    try {
        const [rows] = await db("SELECT * FROM `branding_settings` LIMIT 1");
        const b = rows?.[0];
        cachedBranding = {
            appName:        b?.appName         || "",
            slogan:         b?.slogan          || "",
            loginBrandName: b?.loginBrandName  || b?.appName || "",
            logoUrl:        b?.logoUrl         || "",
            faviconUrl:     b?.faviconUrl      || "",
            primaryColor:   b?.primaryColor    || null,
            seoTitle:       b?.metaTitle       || b?.appName || "",
            seoDescription: b?.metaDescription || "",
        };
        cacheTimestamp = now;
        return cachedBranding;
    } catch {
        return {
            appName: "", slogan: "", loginBrandName: "",
            logoUrl: "", faviconUrl: "", primaryColor: null,
            seoTitle: "", seoDescription: "",
        };
    }
}

export const getResolvedTenantBranding = () => getAppBranding();
export const getMasterBranding = () => getAppBranding();
