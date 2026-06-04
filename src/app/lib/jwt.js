import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

// JWT_SECRET is required. We intentionally do not provide a fallback so that
// a misconfigured deployment fails fast instead of silently signing tokens
// with a publicly-known string.
function getKey() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error(
            "JWT_SECRET environment variable is required and must be at least 32 characters"
        );
    }
    return new TextEncoder().encode(secret);
}

export async function signToken(payload) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("24h")
        .sign(getKey());
}

export async function verifyToken(token) {
    try {
        const { payload } = await jwtVerify(token, getKey(), {
            algorithms: ["HS256"],
        });
        return payload;
    } catch (error) {
        return null;
    }
}
