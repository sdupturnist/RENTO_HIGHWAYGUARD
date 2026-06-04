import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { format } from "date-fns";
/**
 * Generate and download a PDF report
 * @param title - Report title
 * @param headers - Array of column headers
 * @param data - Array of data rows (arrays matching header order)
 * @param filename - Output filename (without extension)
 */
export function generateReportPDF(title, headers, data, filename) {
    const doc = new jsPDF({
        orientation: headers.length > 6 ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
    });
    // Add title
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    // Add generation date
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, 14, 22);
    // Add table
    autoTable(doc, {
        head: [headers],
        body: data,
        startY: 28,
        styles: {
            fontSize: 8,
            cellPadding: 2,
        },
        headStyles: {
            fillColor: [71, 85, 105], // slate-600
            textColor: [255, 255, 255],
            fontStyle: "bold",
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252], // slate-50
        },
        margin: { top: 28, left: 14, right: 14 },
    });
    // Add page numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
    }
    // Download
    doc.save(`${filename}.pdf`);
}
/**
 * Generate and download an Excel report
 * @param title - Report title
 * @param headers - Array of column headers
 * @param data - Array of data rows (arrays matching header order)
 * @param filename - Output filename (without extension)
 */
export function generateReportExcel(title, headers, data, filename) {
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    // Add title row and empty row
    const wsData = [
        [title],
        [`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`],
        [],
        headers,
        ...data,
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    // Set column widths
    const colWidths = headers.map((header, idx) => {
        const maxLength = Math.max(header.length, ...data.map((row) => String(row[idx] || "").length));
        return { wch: Math.min(maxLength + 2, 50) };
    });
    ws["!cols"] = colWidths;
    // Style title row (bold, larger font)
    if (ws["A1"]) {
        ws["A1"].s = {
            font: { bold: true, sz: 14 },
        };
    }
    // Style header row (bold, background color)
    headers.forEach((_, idx) => {
        const cellRef = XLSX.utils.encode_cell({ r: 3, c: idx });
        if (ws[cellRef]) {
            ws[cellRef].s = {
                font: { bold: true },
                fill: { fgColor: { rgb: "475569" } },
                alignment: { horizontal: "center" },
            };
        }
    });
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    // Download
    XLSX.writeFile(wb, `${filename}.xlsx`);
}
/**
 * Format data for export based on report type
 * Helper to convert objects to arrays matching header order
 */
export function formatDataForExport(data, columns) {
    const headers = columns.map((col) => col.header);
    const rows = data.map((item) => columns.map((col) => {
        const value = item[col.key];
        return col.format ? col.format(value) : value;
    }));
    return { headers, rows };
}
