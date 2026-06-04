"use client";
import { useTransition } from "react";
import { Button } from "@/app/Components/ui/button";
import { Send } from "lucide-react";
import { toast } from "sonner";
export function AssignmentSendButton({ assignmentId }) {
    const [pending, startTransition] = useTransition();
    const handleSend = () => {
        startTransition(async () => {
            try {
                const res = await fetch(`/api/assignments/${assignmentId}/send`, { method: "POST" });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.message || "Failed to send email");
                }
                toast.success("Assignment emailed");
            }
            catch (err) {
                toast.error(err.message || "Failed to send email");
            }
        });
    };
    return (<Button variant="outline" size="sm" onClick={handleSend} disabled={pending}>
            <Send className={`mr-2 h-4 w-4 ${pending ? "animate-pulse" : ""}`}/>
            {pending ? "Sending..." : "Send Email"}
        </Button>);
}
