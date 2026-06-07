"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/app/Components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/app/Components/ui/select";
import { toast } from "sonner";
import { FormattedDatePicker } from "@/app/Components/ui/formatted-date-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/app/Components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/Components/ui/card";
import { Label } from "@/app/Components/ui/label";
import { CurrencySymbol } from "@/app/Components/ui/CurrencySymbol";
import { useSettings } from "@/app/Components/providers/SettingsProvider";
export function InvoiceGenerator({ onSuccess }) {
    const [customerId, setCustomerId] = useState("");
    const [projectId, setProjectId] = useState("");
    const [startDate, setStartDate] = useState();
    const [endDate, setEndDate] = useState();
    const [items, setItems] = useState([]);
    const [dataSummary, setDataSummary] = useState({});
    const [loading, setLoading] = useState(false);
    const { currencySymbol } = useSettings();
    const [generating, setGenerating] = useState(false);

    const { data: customers = [] } = useQuery({
        queryKey: ["clients"],
        queryFn: async () => {
            const res = await fetch("/api/clients");
            return res.json();
        },
    });

    const { data: projects = [] } = useQuery({
        queryKey: ["projects-for-customer", customerId],
        queryFn: async () => {
            const res = await fetch(`/api/projects?customerId=${customerId}`);
            return res.json();
        },
        enabled: !!customerId,
    });

    const handlePreview = async () => {
        if (!customerId || !startDate || !endDate) {
            toast.error("Please select customer and date range.");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/invoices/preview", {
                method: "POST",
                body: JSON.stringify({
                    customerId: parseInt(customerId),
                    projectId: projectId ? parseInt(projectId) : null,
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                })
            });
            const data = await res.json();
            setItems(data.items || []);
            setDataSummary(data);
            if (data.items?.length === 0) {
                toast.info("No billable items found for this period.");
            }
        }
        catch (error) {
            toast.error("Failed to generate preview");
        }
        finally {
            setLoading(false);
        }
    };
    const handleCreate = async () => {
        if (items.length === 0)
            return;
        setGenerating(true);
        try {
            const res = await fetch("/api/invoices", {
                method: "POST",
                body: JSON.stringify({
                    customerId: parseInt(customerId),
                    projectId: projectId ? parseInt(projectId) : null,
                    date: new Date().toISOString(),
                    status: "GENERATED",
                    items: items.map(item => ({
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        regularHours: item.regularHours || 0,
                        overtimeHours: item.overtimeHours || 0,
                        holidayHours: item.holidayHours || 0,
                        days: item.days || 0,
                    }))
                })
            });
            if (res.ok) {
                toast.success("Invoice generated successfully!");
                setItems([]);
                setDataSummary({});
                onSuccess();
            }
            else {
                toast.error("Failed to create invoice.");
            }
        }
        catch (error) {
            toast.error("Error creating invoice.");
        }
        finally {
            setGenerating(false);
        }
    };
    return (<div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Customer</Label>
                    <Select onValueChange={setCustomerId} value={customerId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Customer"/>
                        </SelectTrigger>
                        <SelectContent>
                            {customers.map(c => (<SelectItem key={c.id} value={String(c.id)}>{c.companyName}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Project (Optional)</Label>
                    <Select onValueChange={setProjectId} value={projectId} disabled={!projects.length}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Project"/>
                        </SelectTrigger>
                        <SelectContent>
                            {projects.map(p => (<SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2 flex flex-col">
                <Label>From Date</Label>
                <FormattedDatePicker value={startDate} onChange={setStartDate} placeholder="Pick start date"/>
            </div>
            <div className="space-y-2 flex flex-col">
                <Label>To Date</Label>
                <FormattedDatePicker value={endDate} onChange={setEndDate} placeholder="Pick end date" minDate={startDate}/>
            </div>

            <Button onClick={handlePreview} disabled={loading} className="w-full">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Preview Invoice"}
            </Button>

            {items.length > 0 && (<Card>
                    <CardHeader>
                        <CardTitle>Invoice Preview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead className="text-right">Day</TableHead>
                                    <TableHead className="text-right">Unit Price</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item, idx) => (<TableRow key={idx}>
                                        <TableCell>{item.description}</TableCell>
                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                        <TableCell className="text-right">{item.days || 0}</TableCell>
                                        <TableCell className="text-right">
                                            <span className="inline-flex justify-end items-center gap-1">
                                                <CurrencySymbol symbol={currencySymbol} />
                                                {item.unitPrice}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            <span className="inline-flex justify-end items-center gap-1">
                                                <CurrencySymbol symbol={currencySymbol} />
                                                {item.total}
                                            </span>
                                        </TableCell>
                                    </TableRow>))}
                                <TableRow>
                                    <TableCell colSpan={4} className="text-right font-bold">Total Amount</TableCell>
                                    <TableCell className="text-right font-bold text-lg">
                                        <span className="inline-flex justify-end items-center gap-1">
                                            <CurrencySymbol symbol={currencySymbol} />
                                            {dataSummary.subtotal?.toFixed(2) || '0.00'}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>

                        <div className="text-xs text-muted-foreground/70 italic mt-2">
                            * Important: For Detour blocks with bundle billing disabled, vehicles & operators are billed at hourly rates, whereas materials & labours are billed at daily rates.
                        </div>

                        <div className="flex flex-col items-end gap-2 pt-4 border-t">
                            <div className="flex justify-between w-64 text-sm">
                                <span className="text-muted-foreground">Subtotal:</span>
                                <span className="font-medium flex items-center gap-1">
                                    <CurrencySymbol symbol={currencySymbol} />
                                    {dataSummary.subtotal?.toFixed(2) || '0.00'}
                                </span>
                            </div>
                            {dataSummary.vatEnabled && (<div className="flex justify-between w-64 text-sm">
                                    <span className="text-muted-foreground">VAT ({dataSummary.vatPercentage}%):</span>
                                    <span className="font-medium flex items-center gap-1">
                                        <CurrencySymbol symbol={currencySymbol} />
                                        {dataSummary.vatAmount?.toFixed(2) || '0.00'}
                                    </span>
                                </div>)}
                            <div className="flex justify-between w-64 text-base font-bold border-t pt-2 mt-1">
                                <span>Total Due:</span>
                                <span className="flex items-center gap-1">
                                    <CurrencySymbol symbol={currencySymbol} />
                                    {dataSummary.grandTotal?.toFixed(2) || '0.00'}
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 mt-6">
                            <Button variant="outline" onClick={() => { setItems([]); setDataSummary({}); }}>Cancel</Button>
                            <Button onClick={handleCreate} disabled={generating}>
                                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <><Save className="mr-2 h-4 w-4"/> Save Invoice</>}
                            </Button>
                        </div>
                    </CardContent>
                </Card>)}
        </div>);
}
