import nodemailer from "nodemailer";
import { dbTenant } from "@/app/lib/db";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
export async function sendMail(params) {
    const settings = (await dbTenant("SELECT * FROM `smtp_settings` LIMIT 1"))[0][0];
    if (!settings) {
        throw new Error("SMTP settings are not configured");
    }
    const smtpPassword = settings.password || "";
    let html = params.html;
    if (!html && params.template) {
        const templatePath = path.join(process.cwd(), "src", "templates", "emails", params.template);
        const raw = await fs.readFile(templatePath, "utf-8");
        html = renderTemplate(raw, params.variables || {});
    }
    const transporter = nodemailer.createTransport({
        host: settings.host,
        port: Number(settings.port),
        secure: settings.secure,
        auth: {
            user: settings.username,
            pass: smtpPassword,
        },
        family: 4, // Force IPv4
        connectionTimeout: 10000,
        greetingTimeout: 10000,
    });
    await transporter.sendMail({
        from: `"${settings.fromName}" <${settings.fromEmail}>`,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html,
        attachments: params.attachments,
    });
}
function renderTemplate(raw, variables) {
    return raw.replace(/{{(.*?)}}/g, (_, key) => variables[key.trim()] ?? "");
}
const ENC_PREFIX = "enc:";
function getEncryptionKey() {
    const key = process.env.SMTP_SECRET_KEY;
    if (!key || key.length < 32) {
        throw new Error("SMTP_SECRET_KEY must be set to at least 32 characters for encryption");
    }
    return crypto.createHash("sha256").update(key).digest(); // 32 bytes
}
export function encryptSecret(value) {
    const iv = crypto.randomBytes(12);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ENC_PREFIX + Buffer.concat([iv, tag, encrypted]).toString("base64");
}
export function decryptSecret(value) {
    if (!value.startsWith(ENC_PREFIX))
        return value;
    const buf = Buffer.from(value.slice(ENC_PREFIX.length), "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
}
