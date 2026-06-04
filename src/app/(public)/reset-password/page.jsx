import { Suspense } from "react";
import { ResetPasswordForm } from "@/app/Components/auth/ResetPasswordForm";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export default function ResetPasswordPage() {
    return (<Suspense fallback={null}>
            <ResetPasswordForm />
        </Suspense>);
}
