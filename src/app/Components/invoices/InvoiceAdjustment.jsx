"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/Components/ui/button";
import { Input } from "@/app/Components/ui/input";
import { Textarea } from "@/app/Components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/Components/ui/card";
import { toast } from "sonner";
import { Label } from "@/app/Components/ui/label";
import { Edit2, Save, X } from "lucide-react";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";

export function InvoiceAdjustment({ invoiceId, initialAmount, initialNote, currency = "AED" }) {
    const router = useRouter();
    const [isEditing, setIsEditing] = useState(false);
    const [amount, setAmount] = useState(initialAmount || 0);
    const [note, setNote] = useState(initialNote || "");
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/invoices/${invoiceId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    adjustmentAmount: Number(amount),
                    adjustmentNote: note 
                })
            });

            if (res.ok) {
                toast.success("Adjustment saved successfully");
                setIsEditing(false);
                router.refresh();
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to save adjustment");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred while saving the adjustment");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isEditing) {
        return (
            <Card className="shadow-sm border-slate-200">
                <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">Invoice Adjustment</h3>
                            <div className="flex items-baseline gap-4">
                                <span className={`text-2xl font-bold flex items-center gap-1 ${Number(amount) < 0 ? 'text-green-600' : Number(amount) > 0 ? 'text-amber-600' : ''}`}>
                                    <CurrencySymbol symbol={currency} />
                                    {Math.abs(Number(amount || 0)).toFixed(2)}
                                </span>
                                {note && <span className="text-sm text-slate-500 border-l pl-4 border-slate-200">{note}</span>}
                                {!amount && !note && <span className="text-sm text-slate-400 italic">No adjustments applied to this invoice.</span>}
                            </div>
                        </div>
                        <Button variant="outline" onClick={() => setIsEditing(true)} className="group">
                            <Edit2 className="h-4 w-4 mr-2 text-slate-400 group-hover:text-amber-500 transition-colors" /> 
                            Edit Adjustment
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-sm border-amber-200 bg-amber-50/30 overflow-hidden">
            <div className="bg-amber-100/30 px-6 py-4 border-b border-amber-100">
                <CardTitle className="text-base font-medium text-amber-800 flex items-center gap-2">
                    <Edit2 className="h-4 w-4" /> 
                    Edit Invoice Adjustment
                </CardTitle>
                <CardDescription className="text-amber-700/70 mt-1">Add a positive or negative amount to adjust the final grand total.</CardDescription>
            </div>
            <CardContent className="p-6">
                <div className="grid md:grid-cols-12 gap-6">
                    <div className="space-y-2 md:col-span-4 lg:col-span-3">
                        <Label htmlFor="adjustmentAmount" className="text-amber-900/80">Amount ({currency})</Label>
                        <Input 
                            id="adjustmentAmount"
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="bg-white border-amber-200 focus-visible:ring-amber-500"
                        />
                        <p className="text-xs text-amber-700/60 mt-1">
                            Use a negative number (e.g. -500) for discounts.
                        </p>
                    </div>
                    
                    <div className="space-y-2 md:col-span-8 lg:col-span-9">
                        <Label htmlFor="adjustmentNote" className="text-amber-900/80">Description / Note</Label>
                        <Textarea 
                            id="adjustmentNote"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="e.g. Goodwill discount for late delivery"
                            className="bg-white resize-none border-amber-200 focus-visible:ring-amber-500"
                            rows={2}
                        />
                    </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-amber-100">
                    <Button variant="outline" onClick={() => {
                        setIsEditing(false);
                        setAmount(initialAmount || 0);
                        setNote(initialNote || "");
                    }} disabled={isSaving} className="border-amber-200 text-amber-800 hover:bg-amber-100/50">
                        <X className="h-4 w-4 mr-2" /> Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-amber-600 hover:bg-amber-700 text-white">
                        <Save className="h-4 w-4 mr-2" /> {isSaving ? "Saving..." : "Save Adjustment"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
