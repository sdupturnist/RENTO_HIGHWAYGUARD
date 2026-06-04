import { NextResponse } from "next/server";
import { dbTenant } from "@/app/lib/db";
import { z } from "zod";
import { getSession } from "@/app/lib/auth";
import { encryptSecret } from "@/app/lib/email";
import { logActivity } from "@/app/lib/logger";

const smtpSchema = z.object({
    host: z.string().min(1, "Hostname is required"),
    port: z.string().or(z.number()).transform(val => Number(val)),
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
    fromEmail: z.string().email("Invalid email address"),
    fromName: z.string().min(1, "Sender name is required"),
    secure: z.coerce.boolean().default(false),
});

const defaults = {
    host: "",
    port: 587,
    username: "",
    password: "",
    fromEmail: "",
    fromName: "",
    secure: false
};

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const [rows] = await dbTenant("SELECT * FROM `smtp_settings` LIMIT 1");
        const settings = rows?.[0];

        if (!settings) return NextResponse.json(defaults);

        return NextResponse.json(settings);
    } catch (error) {
        console.error("Error loading SMTP settings:", error);
        return NextResponse.json({ message: "Error loading settings" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const body = await request.json();
        const parsed = smtpSchema.parse(body);

        const [existingRows] = await dbTenant("SELECT * FROM `smtp_settings` LIMIT 1");
        const existing = existingRows?.[0];

        let passwordToSave = parsed.password;
        if (parsed.password === "********" && existing?.password) {
            passwordToSave = existing.password;
        }

        if (existing) {
            await dbTenant(`
                UPDATE \`smtp_settings\` SET
                    host = ?, port = ?, username = ?, password = ?, fromEmail = ?, fromName = ?, secure = ?, updatedAt = NOW()
                WHERE id = ?
            `, [parsed.host, parsed.port, parsed.username, passwordToSave, parsed.fromEmail, parsed.fromName, parsed.secure ? 1 : 0, existing.id]);
        } else {
            await dbTenant(`
                INSERT INTO \`smtp_settings\` (
                    host, port, username, password, fromEmail, fromName, secure, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            `, [parsed.host, parsed.port, parsed.username, passwordToSave, parsed.fromEmail, parsed.fromName, parsed.secure ? 1 : 0]);
        }

        const [updRows] = await dbTenant("SELECT * FROM `smtp_settings` LIMIT 1");
        await logActivity("SETTINGS", 0, "UPDATE", "SMTP settings updated");
        return NextResponse.json(updRows[0]);
    } catch (error) {
        console.error("Error saving SMTP settings:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ message: "Validation error", errors: error.errors }, { status: 400 });
        }
        return NextResponse.json({ message: "Error saving settings" }, { status: 500 });
    }
}
