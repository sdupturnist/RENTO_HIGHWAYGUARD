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
    if (!logoUrl)
        return null;
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
        }
        else {
            const res = await fetch(logoUrl);
            if (!res.ok)
                return null;
            const buffer = await res.arrayBuffer();
            const mime = res.headers.get("content-type") || "image/png";
            const binary = Array.from(new Uint8Array(buffer))
                .map((b) => String.fromCharCode(b))
                .join("");
            const base64 = btoa(binary);
            return `data:${mime};base64,${base64}`;
        }
    }
    catch {
        return null;
    }
}

function applyViewMode(lines, mode) {
    if (mode === "DETAILED") return lines.map(l => ({ ...l, _dateLabel: formatPDFDate(l.date, "dd MMM") }));

    const grouped = new Map();
    for (const line of lines) {
        const blockType = line.blockType || "VEHICLE";
        let key;
        if (mode === "GROUP_BY_RESOURCE") {
            if (blockType === "VEHICLE") key = `V-${line.vehicleId}`;
            else if (blockType === "OPERATOR") key = `O-${line.operatorId}`;
            else if (blockType === "MATERIAL") key = `M-${line.materialId}`;
            else key = `L-${line.labourTypeId}`;
        } else if (mode === "GROUP_BY_VEHICLE_TYPE") {
            key = `VT-${line.vehicleTypeName || "other"}`;
        } else if (mode === "GROUP_BY_OPERATOR") {
            key = `OP-${line.operatorId || "none"}`;
        } else if (mode === "GROUP_BY_DETOUR") {
            key = `DET-${line.detourBlockId || "direct"}`;
        } else if (mode === "BUNDLE_SUMMARY") {
            key = `BDL-${line.detourTemplateName || line.resourceNameSnapshot || blockType}`;
        } else {
            key = `${blockType}-${line.vehicleId || line.operatorId || line.materialId || line.labourTypeId}`;
        }

        if (!grouped.has(key)) {
            grouped.set(key, { ...line, _dates: [], regularHours: 0, overtimeHours: 0, holidayHours: 0, totalHours: 0, quantity: 0, calculatedAmount: 0 });
        }
        const entry = grouped.get(key);
        entry._dates.push(line.date);
        entry.regularHours += Number(line.regularHours || 0);
        entry.overtimeHours += Number(line.overtimeHours || 0);
        entry.holidayHours += Number(line.holidayHours || 0);
        entry.totalHours += Number(line.totalHours || 0);
        entry.quantity += Number(line.quantity || 0);
        entry.calculatedAmount += Number(line.calculatedAmount || 0);
    }

    return Array.from(grouped.values()).map(entry => {
        const timestamps = entry._dates.map(d => new Date(d).getTime()).filter(Boolean);
        const minDate = timestamps.length ? new Date(Math.min(...timestamps)) : null;
        const maxDate = timestamps.length ? new Date(Math.max(...timestamps)) : null;
        const _dateLabel = minDate && maxDate && minDate.getTime() !== maxDate.getTime()
            ? `${formatPDFDate(minDate, "dd MMM")} – ${formatPDFDate(maxDate, "dd MMM")}`
            : minDate ? formatPDFDate(minDate, "dd MMM") : "—";
        return { ...entry, _dateLabel };
    });
}

function formatPDFRow(line, activeViewMode) {
    const bt = line.blockType || "VEHICLE";
    const dateLabel = line._dateLabel || formatPDFDate(line.date, "dd/MM/yyyy");

    if (activeViewMode === "GROUP_BY_DETOUR") {
        return [
            dateLabel,
            line.detourTemplateName || "Detour Service",
            "DETOUR",
            "-", "-", "-",
            (line._dates?.length || 1).toString()
        ];
    }

    if (activeViewMode === "BUNDLE_SUMMARY") {
        return [
            dateLabel,
            line.detourTemplateName || line.resourceNameSnapshot || bt,
            bt,
            "-", "-", "-",
            (line._dates?.length || line.quantity || 1).toString()
        ];
    }

    if (activeViewMode === "GROUP_BY_VEHICLE_TYPE") {
        return [
            dateLabel,
            line.vehicleTypeName || "Other Vehicles",
            "VEHICLE TYPE",
            line.regularHours?.toFixed(1) ?? "0.0",
            line.overtimeHours?.toFixed(1) ?? "0.0",
            line.holidayHours?.toFixed(1) ?? "0.0",
            line.totalHours?.toFixed(1) ?? "0.0"
        ];
    }

    if (activeViewMode === "GROUP_BY_OPERATOR") {
        const opName = line.operator?.name || line.operatorName || line.resourceNameSnapshot || "No Operator";
        return [
            dateLabel,
            opName,
            "OPERATOR",
            line.regularHours?.toFixed(1) ?? "0.0",
            line.overtimeHours?.toFixed(1) ?? "0.0",
            line.holidayHours?.toFixed(1) ?? "0.0",
            line.totalHours?.toFixed(1) ?? "0.0"
        ];
    }

    // Default detailed / group by resource
    if (bt === "MATERIAL" || bt === "LABOUR") {
        const resourceName = bt === "MATERIAL"
            ? (line.material?.name || line.materialName || line.resourceNameSnapshot || "-")
            : (line.labour?.labourType || line.labourTypeName || line.resourceNameSnapshot || "-");
        return [
            dateLabel,
            resourceName,
            bt,
            "-", "-", "-",
            line.quantity?.toString() ?? "0"
        ];
    }

    const vehicleLabel = line.vehicle
        ? `${line.vehicle.regNo || line.vehicle.vehicleCode || "-"}${line.vehicle.model?.name ? " • " + line.vehicle.model.name : ""}`
        : (line.resourceNameSnapshot || "-");
    const opLabel = line.operator?.name || line.operatorName || "-";

    return [
        dateLabel,
        vehicleLabel,
        opLabel,
        line.regularHours?.toFixed(1) ?? "0.0",
        line.overtimeHours?.toFixed(1) ?? "0.0",
        line.holidayHours?.toFixed(1) ?? "0.0",
        line.totalHours?.toFixed(1) ?? "0.0"
    ];
}

const VIEW_MODE_LABELS = {
    DETAILED: "Detailed Logs",
    GROUP_BY_RESOURCE: "Resource Summary",
    GROUP_BY_VEHICLE_TYPE: "Vehicle Type Summary",
    GROUP_BY_OPERATOR: "Operator Logs",
    GROUP_BY_DETOUR: "Detour Service Summary",
    BUNDLE_SUMMARY: "Bundle Summary Logs",
};

export async function generateTimesheetPDF(timesheet, viewModeOverride = null) {
    const doc = new jsPDF();
    const activeViewMode = viewModeOverride || timesheet.viewMode || "DETAILED";
    const rawLines = Array.isArray(timesheet.lines) ? timesheet.lines : [];
    const lines = applyViewMode(rawLines, activeViewMode);

    const totalVehicles = timesheet.totalVehicles ?? new Set(rawLines.map((l) => l.vehicleId)).size;
    const totalOperators = timesheet.totalOperators ?? new Set(rawLines.map((l) => l.operatorId).filter(Boolean)).size;
    const company = timesheet.companySettings || {};
    const branding = timesheet.branding
        || await fetch("/api/settings/branding").then((r) => r.ok ? r.json() : null).catch(() => null)
        || {};
    const pdfLogoUrl = company.pdfLogoUrl || branding.logoUrl;
    const pdfThemeColor = hexToRgbArray(company.pdfThemeColor || branding.primaryColor);
    const logoDataUrl = await loadImageData(pdfLogoUrl);
    // HEADER
    const headerTop = 15;
    const logoWidth = 55;
    if (logoDataUrl) {
        // height 0 keeps aspect ratio
        doc.addImage(logoDataUrl, "PNG", 14, headerTop - 2, logoWidth, 0);
    }
    // Removed large title text as per requirement
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const headerRightX = 200;
    const line1 = `Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`;
    const line2 = `Period: ${formatPDFDate(timesheet.periodStart, "dd MMM yyyy")} - ${formatPDFDate(timesheet.periodEnd, "dd MMM yyyy")}`;
    const line3 = `Timesheet: ${timesheet.timesheetCode}`;
    doc.text(line1, headerRightX, headerTop + 0, { align: "right" });
    doc.text(line2, headerRightX, headerTop + 6, { align: "right" });
    doc.text(line3, headerRightX, headerTop + 12, { align: "right" });
    // Company block
    let companyY = logoDataUrl ? (headerTop + 26) : (headerTop + 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(company.companyName || branding.appName || "Company", 14, companyY);
    doc.setFont("helvetica", "normal");
    companyY += 5;
    if (company.address) {
        doc.text(company.address, 14, companyY);
        companyY += 5;
    }
    const cityLine = [company.city, company.state, company.country].filter(Boolean).join(", ");
    if (cityLine) {
        doc.text(cityLine, 14, companyY);
        companyY += 5;
    }
    if (company.email) {
        doc.text(`Email: ${company.email}`, 14, companyY);
        companyY += 5;
    }
    if (company.phone) {
        doc.text(`Contact: ${company.phone}`, 14, companyY);
        companyY += 5;
    }
    if (company.taxNumber) {
        doc.text(`Tax/VAT: ${company.taxNumber}`, 14, companyY);
        companyY += 5;
    }
    const headerBottom = companyY + 2;
    doc.setLineWidth(0.6);
    doc.line(14, headerBottom, 196, headerBottom);
    // PARTY BLOCKS
    const partiesStartY = headerBottom + 8;
    doc.setFont("helvetica", "bold");
    doc.text("Customer", 14, partiesStartY);
    doc.text("Project", 110, partiesStartY);
    doc.setFont("helvetica", "normal");
    doc.text(timesheet.customer?.companyName || "-", 14, partiesStartY + 6);
    const customerLines = [
        timesheet.customer?.address,
        timesheet.customer?.email ? `Email: ${timesheet.customer.email}` : null,
        timesheet.customer?.phone ? `Phone: ${timesheet.customer.phone}` : null,
    ].filter(Boolean);
    customerLines.forEach((line, idx) => doc.text(line, 14, partiesStartY + 12 + idx * 5));
    doc.text(timesheet.project?.name || "-", 110, partiesStartY + 6);
    const projectLines = [
        timesheet.lpoNumber ? `LPO Ref: ${timesheet.lpoNumber}` : null
    ].filter(Boolean);
    projectLines.forEach((line, idx) => doc.text(line, 110, partiesStartY + 12 + idx * 5));
    const customerBlockBottom = partiesStartY + 12 + customerLines.length * 5;
    const projectBlockBottom = partiesStartY + 12 + projectLines.length * 5;
    const summaryStartY = Math.max(customerBlockBottom, projectBlockBottom) + 10;
    // SUMMARY
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 14, summaryStartY);
    doc.setLineWidth(0.5);
    doc.line(14, summaryStartY + 2, 196, summaryStartY + 2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const summaryData = [
        ["Total Hours", (timesheet.totalHours ?? 0).toFixed(1)],
        ["Total Vehicles", totalVehicles.toString()],
        ["Total Operators", totalOperators.toString()],
    ];
    autoTable(doc, {
        startY: summaryStartY + 5,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'plain',
        tableWidth: 90,
        styles: { fontSize: 10, cellPadding: 2 },
    });
    // DETAILED LINES
    const linesStartY = doc.lastAutoTable.finalY + 14;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    const headingText = VIEW_MODE_LABELS[activeViewMode] || "Detailed Logs";
    doc.text(headingText, 14, linesStartY - 4);
    
    const tableRows = lines.map((line) => formatPDFRow(line, activeViewMode));
    
    const tableHeaders = activeViewMode === "GROUP_BY_DETOUR" || activeViewMode === "BUNDLE_SUMMARY"
        ? [['Date', 'Description', 'Type', 'Normal', 'OT', 'Hol', 'Days']]
        : [['Date', 'Vehicle/Resource', 'Operator/Type', 'Normal', 'OT', 'Hol', 'Total/Qty']];

    autoTable(doc, {
        startY: linesStartY,
        head: tableHeaders,
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: pdfThemeColor },
        styles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 28 } }
    });
    // NOTES
    let notesBottom = doc.lastAutoTable.finalY + 10;
    if (timesheet.notes) {
        const noteLines = doc.splitTextToSize(timesheet.notes, 175);
        const notesHeight = 6 + noteLines.length * 5;
        if (notesBottom + notesHeight > 270) {
            doc.addPage();
            notesBottom = 20;
        }
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Notes", 14, notesBottom);
        doc.setFont("helvetica", "normal");
        doc.text(noteLines, 14, notesBottom + 6);
        notesBottom = notesBottom + notesHeight;
    }
    // FOOTER SIGNATURES
    const finalY = notesBottom + 14;
    doc.setFontSize(10);
    doc.text("Authorized Signature:", 14, finalY);
    doc.line(60, finalY, 110, finalY);
    doc.text("Customer Signature:", 120, finalY);
    doc.line(170, finalY, 200, finalY);
    doc.save(`${timesheet.timesheetCode}.pdf`);
}

export async function generateTimesheetPDFBuffer(timesheet) {
    const doc = new jsPDF();
    const activeViewMode = timesheet.viewMode || "DETAILED";
    const rawLines = Array.isArray(timesheet.lines) ? timesheet.lines : [];
    const lines = applyViewMode(rawLines, activeViewMode);

    const totalVehicles = timesheet.totalVehicles ?? new Set(rawLines.map((l) => l.vehicleId)).size;
    const totalOperators = timesheet.totalOperators ?? new Set(rawLines.map((l) => l.operatorId).filter(Boolean)).size;
    const company = timesheet.companySettings || {};
    const branding = timesheet.branding || {};
    const pdfLogoUrl = company.pdfLogoUrl || branding.logoUrl;
    const pdfThemeColor = hexToRgbArray(company.pdfThemeColor || branding.primaryColor);
    const logoDataUrl = await loadImageData(pdfLogoUrl);
    // HEADER
    const headerTop = 15;
    const logoWidth = 55;
    if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", 14, headerTop - 2, logoWidth, 0);
    }
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const headerRightX = 200;
    doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, headerRightX, headerTop + 0, { align: "right" });
    doc.text(`Period: ${formatPDFDate(timesheet.periodStart, "dd MMM yyyy")} - ${formatPDFDate(timesheet.periodEnd, "dd MMM yyyy")}`, headerRightX, headerTop + 6, { align: "right" });
    doc.text(`Timesheet: ${timesheet.timesheetCode}`, headerRightX, headerTop + 12, { align: "right" });
    // Company block
    let companyY = logoDataUrl ? (headerTop + 26) : (headerTop + 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(company.companyName || branding.appName || "Company", 14, companyY);
    doc.setFont("helvetica", "normal");
    companyY += 5;
    if (company.address) {
        doc.text(company.address, 14, companyY);
        companyY += 5;
    }
    const cityLine = [company.city, company.state, company.country].filter(Boolean).join(", ");
    if (cityLine) {
        doc.text(cityLine, 14, companyY);
        companyY += 5;
    }
    if (company.email) {
        doc.text(`Email: ${company.email}`, 14, companyY);
        companyY += 5;
    }
    if (company.phone) {
        doc.text(`Contact: ${company.phone}`, 14, companyY);
        companyY += 5;
    }
    if (company.taxNumber) {
        doc.text(`Tax/VAT: ${company.taxNumber}`, 14, companyY);
        companyY += 5;
    }
    const headerBottom = companyY + 2;
    doc.setLineWidth(0.6);
    doc.line(14, headerBottom, 196, headerBottom);
    // PARTY BLOCKS
    const partiesStartY = headerBottom + 8;
    doc.setFont("helvetica", "bold");
    doc.text("Customer", 14, partiesStartY);
    doc.text("Project", 110, partiesStartY);
    doc.setFont("helvetica", "normal");
    doc.text(timesheet.customer?.companyName || "-", 14, partiesStartY + 6);
    const customerLines2 = [
        timesheet.customer?.address,
        timesheet.customer?.email ? `Email: ${timesheet.customer.email}` : null,
        timesheet.customer?.phone ? `Phone: ${timesheet.customer.phone}` : null,
    ].filter(Boolean);
    customerLines2.forEach((line, idx) => doc.text(line, 14, partiesStartY + 12 + idx * 5));
    doc.text(timesheet.project?.name || "-", 110, partiesStartY + 6);
    const projectLines2 = [
        timesheet.lpoNumber ? `LPO Ref: ${timesheet.lpoNumber}` : null
    ].filter(Boolean);
    projectLines2.forEach((line, idx) => doc.text(line, 110, partiesStartY + 12 + idx * 5));
    const customerBlockBottom = partiesStartY + 12 + customerLines2.length * 5;
    const projectBlockBottom = partiesStartY + 12 + projectLines2.length * 5;
    const summaryStartY = Math.max(customerBlockBottom, projectBlockBottom) + 10;
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 14, summaryStartY);
    doc.setLineWidth(0.5);
    doc.line(14, summaryStartY + 2, 196, summaryStartY + 2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const summaryData = [
        ["Total Hours", (timesheet.totalHours ?? 0).toFixed(1)],
        ["Total Vehicles", String(totalVehicles)],
        ["Total Operators", String(totalOperators)],
    ];
    autoTable(doc, {
        startY: summaryStartY + 5,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'plain',
        tableWidth: 90,
        styles: { fontSize: 10, cellPadding: 2 },
    });
    const linesStartY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    const headingText = VIEW_MODE_LABELS[activeViewMode] || "Detailed Logs";
    doc.text(headingText, 14, linesStartY - 5);
    
    const tableRows = lines.map((line) => formatPDFRow(line, activeViewMode));
    
    const tableHeaders = activeViewMode === "GROUP_BY_DETOUR" || activeViewMode === "BUNDLE_SUMMARY"
        ? [['Date', 'Description', 'Type', 'Normal', 'OT', 'Hol', 'Days']]
        : [['Date', 'Vehicle/Resource', 'Operator/Type', 'Normal', 'OT', 'Hol', 'Total/Qty']];

    autoTable(doc, {
        startY: linesStartY,
        head: tableHeaders,
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: pdfThemeColor },
        styles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 28 } }
    });
    // NOTES
    let notesBottom = doc.lastAutoTable.finalY + 10;
    if (timesheet.notes) {
        const noteLines = doc.splitTextToSize(timesheet.notes, 175);
        const notesHeight = 6 + noteLines.length * 5;
        if (notesBottom + notesHeight > 270) {
            doc.addPage();
            notesBottom = 20;
        }
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Notes", 14, notesBottom);
        doc.setFont("helvetica", "normal");
        doc.text(noteLines, 14, notesBottom + 6);
        notesBottom = notesBottom + notesHeight;
    }
    const finalY = notesBottom + 14;
    if (finalY < 270) {
        doc.setFontSize(10);
        doc.text("Authorized Signature:", 14, finalY);
        doc.line(50, finalY, 100, finalY);
        doc.text("Customer Signature:", 120, finalY);
        doc.line(155, finalY, 200, finalY);
    }
    const buffer = Buffer.from(doc.output("arraybuffer"));
    return buffer;
}
