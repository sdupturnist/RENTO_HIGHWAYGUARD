import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/app/lib/auth";
import nodemailer from "nodemailer";
import { dbTenant } from "@/app/lib/db";
const smtpSchema = z.object({
    host: z.string().min(1, "Hostname is required"),
    port: z.string().or(z.number()).transform(val => Number(val)),
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required"),
    fromEmail: z.string().email("Invalid email address"),
    fromName: z.string().min(1, "Sender name is required"),
    secure: z.coerce.boolean().default(false),
    testEmail: z.string().email("Invalid test email address"),
});
export async function POST(request) {
    try {
        const session = await getSession();
        if (!session)
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        const body = await request.json();
        const { testEmail, ...smtpConfig } = smtpSchema.parse(body);
        // If password is placeholder or fields missing, pull stored credentials
        if (smtpConfig.password === "********" || !smtpConfig.password || !smtpConfig.host) {
            const existing = (await dbTenant("SELECT * FROM `smtp_settings` LIMIT 1"))[0][0];
            if (existing) {
                smtpConfig.host = smtpConfig.host || existing.host;
                smtpConfig.port = smtpConfig.port || Number(existing.port);
                smtpConfig.username = smtpConfig.username || existing.username;
                smtpConfig.fromEmail = smtpConfig.fromEmail || existing.fromEmail;
                smtpConfig.fromName = smtpConfig.fromName || existing.fromName;
                smtpConfig.secure = smtpConfig.secure ?? existing.secure;
                smtpConfig.password = smtpConfig.password === "********" || !smtpConfig.password
                    ? existing.password || ""
                    : smtpConfig.password;
            }
        }
        const transporter = nodemailer.createTransport({
            host: smtpConfig.host,
            port: smtpConfig.port,
            secure: smtpConfig.secure,
            auth: {
                user: smtpConfig.username,
                pass: smtpConfig.password,
            },
            family: 4, // Force IPv4 to avoid IPv6 timeout issues
            connectionTimeout: 10000, // 10 seconds timeout
            greetingTimeout: 10000,
        });
        // Verify connection config
        await transporter.verify();
        // Send test email
        await transporter.sendMail({
            from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail}>`,
            to: testEmail,
            subject: "Test Email from RentERP",
            text: "This is a test email to verify your SMTP settings in RentERP.",
            html: "<p>This is a <b>test email</b> to verify your SMTP settings in RentERP.</p>",
        });
        return NextResponse.json({ message: "Test email sent successfully" });
    }
    catch (error) {
        console.error("SMTP Test Error:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ 
                message: "Validation failed", 
                errors: error.errors.map(e => ({ path: e.path.join('.'), message: e.message })) 
            }, { status: 400 });
        }
        return NextResponse.json({ message: "Failed to send test email", error: error.message || String(error) }, { status: 400 });
    }
}
