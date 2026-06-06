import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

function formatPDFDate(dateVal, formatType = "dd/MM/yyyy") {
    if (!dateVal) return "-";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "-";
    const day = d.getUTCDate();
    const dayStr = String(day).padStart(2, '0');
    const month = d.getUTCMonth();
    const monthStr = String(month + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    if (formatType === "PPP") {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return `${months[month]} ${day}, ${year}`;
    }
    if (formatType === "dd MMM yyyy") {
        const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${dayStr} ${monthsShort[month]} ${year}`;
    }
    return `${dayStr}/${monthStr}/${year}`;
}
const AED_PATH = "M342.14,140.96l2.7,2.54v-7.72c0-17-11.92-30.84-26.56-30.84h-23.41C278.49,36.7,222.69,0,139.68,0c-52.86,0-59.65,0-109.71,0,0,0,15.03,12.63,15.03,52.4v52.58h-27.68c-5.38,0-10.43-2.08-14.61-6.01l-2.7-2.54v7.72c0,17.01,11.92,30.84,26.56,30.84h18.44s0,29.99,0,29.99h-27.68c-5.38,0-10.43-2.07-14.61-6.01l-2.7-2.54v7.71c0,17,11.92,30.82,26.56,30.82h18.44s0,54.89,0,54.89c0,38.65-15.03,50.06-15.03,50.06h109.71c85.62,0,139.64-36.96,155.38-104.98h32.46c5.38,0,10.43,2.07,14.61,6l2.7,2.54v-7.71c0-17-11.92-30.83-26.56-30.83h-18.9c.32-4.88.49-9.87.49-15s-.18-10.11-.51-14.99h28.17c5.37,0,10.43,2.07,14.61,6.01ZM89.96,15.01h45.86c61.7,0,97.44,27.33,108.1,89.94l-153.96.02V15.01ZM136.21,284.93h-46.26v-89.98l153.87-.02c-9.97,56.66-42.07,88.38-107.61,90ZM247.34,149.96c0,5.13-.11,10.13-.34,14.99l-157.04.02v-29.99l157.05-.02c.22,4.84.33,9.83.33,15Z";

function drawAedSymbol(doc, x, y, size, color) {
    const scale = size / 299.91;
    doc.saveGraphicsState();
    if (color) doc.setFillColor(color[0], color[1], color[2]);
    // jsPDF path uses points, and it might need manual translation if .path() is not fully SVG compatible
    // However, we can use the simplified 'm', 'l', 'c' commands if needed.
    // For simplicity, we'll use the text "AED" if the path drawing fails or looks bad, 
    // but the user wants the symbol.
    
    // Most robust way: jsPDF 2.x supports SVG paths via advanced API or plugins.
    // Since we are using raw jsPDF, we'll use a simplified version of the path.
    doc.setCurrentTransformationMatrix(new doc.Matrix(scale, 0, 0, scale, x, y - size * 0.8));
    doc.path(AED_PATH).fill();
    doc.restoreGraphicsState();
}

function hexToRgbArray(hex, fallback = [41, 128, 185]) {
    if (!hex || typeof hex !== "string") return fallback;
    const cleaned = hex.trim().replace("#", "");
    const normalized = cleaned.length === 3
        ? cleaned.split("").map((c) => c + c).join("")
        : cleaned;
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
    return [
        parseInt(normalized.slice(0, 2), 16),
        parseInt(normalized.slice(2, 4), 16),
        parseInt(normalized.slice(4, 6), 16),
    ];
}

async function loadImageData(logoUrl) {
    if (!logoUrl) return null;
    try {
        if (typeof window === "undefined") {
            const fs = await import("fs/promises");
            const path = await import("path");
            const { getUploadRootDir } = await import("@/app/lib/file-storage");
            const mimeLib = await import("mime-types");
            const mimeLookup = mimeLib.lookup || mimeLib.default?.lookup;

            let relativePath = logoUrl;
            if (relativePath.startsWith("/api/uploads/")) {
                relativePath = relativePath.replace("/api/uploads/", "");
            } else if (relativePath.startsWith("/api/storage/")) {
                relativePath = relativePath.replace("/api/storage/", "");
            } else if (relativePath.startsWith("/uploads/")) {
                relativePath = relativePath.replace("/uploads/", "");
            }

            const segments = relativePath.split("/").map(decodeURIComponent).filter(Boolean);
            const rootDir = getUploadRootDir();
            const filePath = path.join(rootDir, ...segments);

            const data = await fs.readFile(filePath);
            const base64 = data.toString("base64");
            const mime = mimeLookup ? mimeLookup(filePath) : "image/png";
            return `data:${mime};base64,${base64}`;
        } else {
            const res = await fetch(logoUrl);
            if (!res.ok) return null;
            const buffer = await res.arrayBuffer();
            const mime = res.headers.get("content-type") || "image/png";
            const binary = Array.from(new Uint8Array(buffer))
                .map((b) => String.fromCharCode(b))
                .join("");
            const base64 = btoa(binary);
            return `data:${mime};base64,${base64}`;
        }
    } catch {
        return null;
    }
}

export async function generateInvoicePDF(invoice) {
    const doc = new jsPDF();
    // Fetch Company Settings
    let companySettings = {
        companyName: "Rental Enterprise Corp",
        address: "123 Main St, City",
        phone: "555-0123",
        email: "contact@renterp.com",
        taxNumber: ""
    };
    try {
        const res = await fetch("/api/settings/company");
        if (res.ok) {
            const data = await res.json();
            if (data)
                companySettings = { ...companySettings, ...data };
        }
    }
    catch (e) {
        console.error("Failed to load company settings for PDF");
    }
    const branding = await fetch("/api/settings/branding").then((r) => r.ok ? r.json() : null).catch(() => null);
    const logoData = await loadImageData(branding?.logoUrl);
    const themeColor = hexToRgbArray(branding?.primaryColor);

    // HEADER
    if (logoData) {
        doc.addImage(logoData, "PNG", 14, 12, 22, 0);
    }
    doc.setFontSize(20);
    doc.setTextColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.text("INVOICE", 14, 20);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(companySettings.companyName, 14, 30);
    if (companySettings.address)
        doc.text(companySettings.address, 14, 35);
    if (companySettings.phone)
        doc.text(`Phone: ${companySettings.phone}`, 14, 40);
    if (companySettings.email)
        doc.text(`Email: ${companySettings.email}`, 14, 45);
    if (companySettings.taxNumber)
        doc.text(`Tax ID: ${companySettings.taxNumber}`, 14, 50);
    // INVOICE DETAILS
    doc.setFontSize(12);
    doc.text(`Invoice #: ${invoice.invoiceNumber}`, 140, 30);
    doc.text(`Date: ${formatPDFDate(invoice.date, "PPP")}`, 140, 36);
    doc.text(`Status: ${invoice.status}`, 140, 42);
    // BILL TO
    doc.setFontSize(12);
    doc.text("Bill To:", 14, 65);
    doc.setFontSize(10);
    doc.text(invoice.customer.companyName, 14, 71);
    if (invoice.customer.address)
        doc.text(invoice.customer.address, 14, 76);
    if (invoice.customer.phone)
        doc.text(`Phone: ${invoice.customer.phone}`, 14, 81);
    if (invoice.project) {
        doc.text(`Project: ${invoice.project.name}`, 14, 90);
    }
    // TABLE
    const tableColumn = ["Description", "Quantity", "Unit Price", "Total"];
    const tableRows = [];
    const currency = companySettings.currencySymbol || companySettings.currency || "AED";
    invoice.items.forEach((item) => {
        const symbolPlaceholder = currency === 'AED' ? '     ' : currency;
        const invoiceData = [
            item.description,
            item.quantity,
            `${symbolPlaceholder} ${Number(item.unitPrice).toFixed(2)}`,
            `${symbolPlaceholder} ${Number(item.total).toFixed(2)}`,
        ];
        tableRows.push(invoiceData);
    });
    // Calculate start Y roughly based on header
    const startY = 100;
    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: startY,
        headStyles: { fillColor: themeColor },
        didDrawCell: (data) => {
            if (data.section === 'body' && (data.column.index === 2 || data.column.index === 3) && currency === 'AED') {
                const fontSize = data.cell.styles.fontSize;
                const x = data.cell.x + data.cell.padding('left');
                const y = data.cell.y + data.cell.padding('top') + fontSize;
                drawAedSymbol(doc, x, y, fontSize, [0, 0, 0]);
            }
        }
    });
    // TOTAL
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    const totalAmountText = `${currency === 'AED' ? '     ' : currency} ${Number(invoice.totalAmount).toFixed(2)}`;
    doc.text(`Total Amount: `, 140, finalY);
    const textWidth = doc.getTextWidth(`Total Amount: `);
    if (currency === 'AED') {
        drawAedSymbol(doc, 140 + textWidth, finalY, 12, [0, 0, 0]);
        doc.text(Number(invoice.totalAmount).toFixed(2), 140 + textWidth + 8, finalY);
    } else {
        doc.text(`${currency} ${Number(invoice.totalAmount).toFixed(2)}`, 140 + textWidth, finalY);
    }
    // FOOTER
    doc.setFontSize(8);
    doc.text("Thank you for your business!", 14, finalY + 20);
    // Save
    doc.save(`${invoice.invoiceNumber}.pdf`);
}

export async function generateInvoicePDFBuffer(invoice, companySettingsParams, brandingParams) {
    const doc = new jsPDF();

    const companySettings = companySettingsParams || {};
    const branding = brandingParams || {};
    const logoUrl = companySettings.pdfLogoUrl || branding.logoUrl;
    const logoData = await loadImageData(logoUrl);
    const themeColor = hexToRgbArray(companySettings.pdfThemeColor || branding.primaryColor);
    const currency = companySettings.currencySymbol || "AED";
    const isAed = currency === "AED";
    const currencyPrefix = isAed ? "AED " : `${currency} `;

    let y = 14;

    // === HEADER ===
    if (logoData) {
        doc.addImage(logoData, "PNG", 14, y, 28, 0);
        y += 20;
    }

    // Company Info (left)
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text(companySettings.companyName || branding.appName || "Company", 14, y);
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    y += 5;
    if (companySettings.address) { doc.text(companySettings.address, 14, y); y += 4; }
    const cityCountry = [companySettings.city, companySettings.country].filter(Boolean).join(", ");
    if (cityCountry) { doc.text(cityCountry, 14, y); y += 4; }
    if (companySettings.phone) { doc.text(`Phone: ${companySettings.phone}`, 14, y); y += 4; }
    if (companySettings.companyEmail || companySettings.email) { doc.text(`Email: ${companySettings.companyEmail || companySettings.email}`, 14, y); y += 4; }
    if (companySettings.taxNumber) { doc.text(`TRN: ${companySettings.taxNumber}`, 14, y); y += 4; }

    // Invoice title + details (right)
    const invoiceTitle = invoice.vatEnabled ? "TAX INVOICE" : "INVOICE";
    doc.setFontSize(22);
    doc.setTextColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.text(invoiceTitle, 196, 20, { align: "right" });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.text(`Invoice #:  ${invoice.invoiceNumber}`, 196, 28, { align: "right" });
    doc.text(`Date:  ${formatPDFDate(invoice.date, "dd MMM yyyy")}`, 196, 33, { align: "right" });
    if (invoice.dueDate) doc.text(`Due Date:  ${formatPDFDate(invoice.dueDate, "dd MMM yyyy")}`, 196, 38, { align: "right" });
    if (invoice.reference) doc.text(`Reference:  ${invoice.reference}`, 196, 43, { align: "right" });

    // === BILL TO / PROJECT ===
    y = Math.max(y, 55) + 6;
    doc.setDrawColor(200, 200, 200);
    doc.line(14, y, 196, y);
    y += 8;

    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text("BILL TO", 14, y);
    doc.text("PROJECT DETAILS", 196, y, { align: "right" });
    y += 5;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text(invoice.customer?.companyName || "-", 14, y);
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.text(invoice.project?.name || "General Project", 196, y, { align: "right" });
    y += 5;
    if (invoice.customer?.address) { doc.text(invoice.customer.address, 14, y); y += 4; }
    if (invoice.customer?.email) { doc.text(invoice.customer.email, 14, y); y += 4; }

    // Period on right
    const periodY = y - 4;
    if (invoice.periodStart && invoice.periodEnd) {
        doc.text(`Period: ${formatPDFDate(invoice.periodStart, "dd MMM yyyy")} - ${formatPDFDate(invoice.periodEnd, "dd MMM yyyy")}`, 196, periodY, { align: "right" });
    }
    if (invoice.timesheet?.timesheetCode) {
        doc.text(`Timesheet: ${invoice.timesheet.timesheetCode}`, 196, periodY + 4, { align: "right" });
    }

    y += 4;
    doc.line(14, y, 196, y);
    y += 8;

    // === TABLE ===
    const tableColumn = ["Description", "Regular", "OT", "Holiday", "Rate", "Amount"];
    const tableRows = (invoice.items || []).map((item) => [
        item.description || "-",
        Number(item.regularHours || 0) > 0 ? Number(item.regularHours).toFixed(1) : "-",
        Number(item.overtimeHours || 0) > 0 ? Number(item.overtimeHours).toFixed(1) : "-",
        Number(item.holidayHours || 0) > 0 ? Number(item.holidayHours).toFixed(1) : "-",
        Number(item.unitPrice || 0).toFixed(2),
        Number(item.total || 0).toFixed(2),
    ]);

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: y,
        headStyles: { fillColor: themeColor, textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
            0: { cellWidth: 70 },
            1: { halign: "center", cellWidth: 20 },
            2: { halign: "center", cellWidth: 18 },
            3: { halign: "center", cellWidth: 20 },
            4: { halign: "right", cellWidth: 30 },
            5: { halign: "right", cellWidth: 30, fontStyle: "bold" },
        },
        margin: { left: 14, right: 14 },
    });

    // === TOTALS ===
    let totalsY = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(9);

    const subtotal = Number(invoice.subtotal || invoice.totalAmount || 0);
    doc.text("Subtotal", 150, totalsY, { align: "right" });
    doc.setFont(undefined, "bold");
    doc.text(`${currencyPrefix}${subtotal.toFixed(2)}`, 196, totalsY, { align: "right" });
    doc.setFont(undefined, "normal");
    totalsY += 6;

    if (invoice.vatEnabled) {
        doc.text(`VAT (${invoice.vatPercentage || 5}%)`, 150, totalsY, { align: "right" });
        doc.text(`${currencyPrefix}${Number(invoice.vatAmount || 0).toFixed(2)}`, 196, totalsY, { align: "right" });
        totalsY += 6;
    }

    if (invoice.adjustmentAmount && Number(invoice.adjustmentAmount) !== 0) {
        doc.text("Adjustment", 150, totalsY, { align: "right" });
        doc.text(`${currencyPrefix}${Number(invoice.adjustmentAmount).toFixed(2)}`, 196, totalsY, { align: "right" });
        totalsY += 6;
    }

    doc.setDrawColor(50, 50, 50);
    doc.line(130, totalsY, 196, totalsY);
    totalsY += 6;
    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("Total Due", 150, totalsY, { align: "right" });
    doc.text(`${currencyPrefix}${Number(invoice.grandTotal || invoice.totalAmount || 0).toFixed(2)}`, 196, totalsY, { align: "right" });
    doc.setFont(undefined, "normal");

    // === FOOTER ===
    totalsY += 20;
    doc.setDrawColor(200, 200, 200);
    doc.line(14, totalsY, 196, totalsY);
    totalsY += 8;
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.text("Terms & Conditions", 14, totalsY);
    doc.setFont(undefined, "normal");
    totalsY += 5;
    doc.setFontSize(8);
    doc.text("Payment is due within 30 days.", 14, totalsY);
    totalsY += 4;
    doc.text("Please include invoice number on your payment.", 14, totalsY);

    if (invoice.notes) {
        totalsY += 8;
        doc.setFont(undefined, "bold");
        doc.text("Notes", 14, totalsY);
        doc.setFont(undefined, "normal");
        totalsY += 4;
        doc.text(invoice.notes, 14, totalsY, { maxWidth: 100 });
    }

    // Signature area (right)
    const sigY = totalsY - 4;
    doc.line(140, sigY + 10, 196, sigY + 10);
    doc.setFontSize(8);
    doc.text("Authorized Signature", 168, sigY + 15, { align: "center" });
    doc.text(companySettings.companyName || "", 168, sigY + 19, { align: "center" });

    // Bottom note
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("Use this invoice for all official tax and accounting purposes.", 105, pageHeight - 10, { align: "center" });

    const buffer = Buffer.from(doc.output("arraybuffer"));
    return buffer;
}
