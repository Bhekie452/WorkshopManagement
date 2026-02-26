import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, Customer, Vehicle, CompanyProfile } from '../types';

const fmt = (amount: number) =>
    'R ' + amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export class PDFService {
    static async generateInvoice(
        invoice: Invoice,
        customer: Customer,
        vehicle: Vehicle | undefined,
        profile?: CompanyProfile
    ): Promise<void> {
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const pw = doc.internal.pageSize.getWidth();   // 210
        const ph = doc.internal.pageSize.getHeight();   // 297
        const ml = 15, mr = 15;                         // margins
        const cw = pw - ml - mr;                        // content width
        const right = pw - mr;
        const taxRate = profile?.defaultTaxRate ?? 15;

        const companyName = profile?.name ?? 'My Workshop';
        const companyAddr = profile
            ? `${profile.address.street}, ${profile.address.city}, ${profile.address.province} ${profile.address.postalCode}`
            : '';
        const companyPhone = profile?.contact.phone ?? '';
        const companyEmail = profile?.contact.email ?? '';
        const vatNumber = (profile as any)?.vatNumber ?? '';

        // =============================================
        //  HEADER AREA
        // =============================================

        // Dark logo block (matches the UI slate-900 block)
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(ml, 12, 52, 16, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(companyName.substring(0, 12).toUpperCase(), ml + 26, 22, { align: 'center' });

        // Company details under logo
        let hy = 34;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text(companyName, ml, hy);
        hy += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 100, 100);
        if (companyAddr) { doc.text(companyAddr, ml, hy); hy += 4; }
        if (companyPhone) { doc.text(`Phone: ${companyPhone}`, ml, hy); hy += 4; }
        if (companyEmail) { doc.text(`Email: ${companyEmail}`, ml, hy); hy += 4; }
        if (vatNumber) { doc.text(`VAT Reg: ${vatNumber}`, ml, hy); hy += 4; }

        // Document type — large faded text on right
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(28);
        doc.setTextColor(210, 210, 210);
        doc.text(invoice.type.toUpperCase(), right, 22, { align: 'right' });

        // Doc details (right column)
        let dy = 32;
        const labelX = pw - 70, valX = right;
        doc.setFontSize(8.5);
        const detailRow = (label: string, value: string, bold = false) => {
            doc.setTextColor(130, 130, 130);
            doc.setFont('helvetica', 'normal');
            doc.text(label, labelX, dy);
            doc.setTextColor(30, 30, 30);
            doc.setFont('helvetica', bold ? 'bold' : 'normal');
            doc.text(value, valX, dy, { align: 'right' });
            dy += 5;
        };
        detailRow('Number:', `${invoice.number}`, true);
        detailRow('Date:', new Date(invoice.issueDate).toLocaleDateString());
        detailRow(invoice.type === 'Quote' ? 'Valid Until:' : 'Due Date:', new Date(invoice.dueDate).toLocaleDateString());
        // Status with coloured badge
        doc.setTextColor(130, 130, 130);
        doc.setFont('helvetica', 'normal');
        doc.text('Status:', labelX, dy);
        const statusColors: Record<string, [number, number, number]> = {
            'Draft': [107, 114, 128],
            'Sent': [37, 99, 235],
            'Paid': [22, 163, 74],
            'Overdue': [220, 38, 38],
            'Accepted': [22, 163, 74],
            'Converted': [147, 51, 234],
            'Rejected': [220, 38, 38],
        };
        const sc = statusColors[invoice.status] ?? [107, 114, 128];
        doc.setTextColor(sc[0], sc[1], sc[2]);
        doc.setFont('helvetica', 'bold');
        doc.text(invoice.status.toUpperCase(), valX, dy, { align: 'right' });
        dy += 5;

        // Divider line
        const divY = Math.max(hy, dy) + 3;
        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(0.5);
        doc.line(ml, divY, right, divY);

        // =============================================
        //  BILL TO & VEHICLE DETAILS
        // =============================================

        const secY = divY + 7;
        const midX = ml + cw / 2;

        // Section headers
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(160, 160, 160);
        doc.text('BILL TO', ml, secY);
        doc.text('VEHICLE DETAILS', midX + 8, secY);

        // Vertical separator
        doc.setDrawColor(240, 240, 240);
        doc.line(midX + 2, secY - 3, midX + 2, secY + 28);

        // Customer info
        let cy = secY + 6;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text(customer.name, ml, cy);
        cy += 5;
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        if (customer.address) {
            // Wrap long addresses
            const addrLines = doc.splitTextToSize(customer.address, cw / 2 - 8);
            addrLines.forEach((line: string) => { doc.text(line, ml, cy); cy += 4; });
        }
        if (customer.email) { doc.text(customer.email, ml, cy); cy += 4; }
        if (customer.phone) { doc.text(customer.phone, ml, cy); cy += 4; }

        // Vehicle info
        let vy = secY + 6;
        const vx = midX + 8;
        if (vehicle) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 30, 30);
            doc.text(`${vehicle.year} ${vehicle.make} ${vehicle.model}`, vx, vy);
            vy += 5;
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(`Reg: ${vehicle.registration}`, vx, vy); vy += 4;
            doc.text(`VIN: ${vehicle.vin || 'N/A'}`, vx, vy); vy += 4;
            doc.text(`Mileage: ${vehicle.mileage.toLocaleString()} km`, vx, vy); vy += 4;
        } else {
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(150, 150, 150);
            doc.text('No vehicle linked', vx, vy);
        }

        // =============================================
        //  LINE ITEMS TABLE
        // =============================================

        const tableY = Math.max(cy, vy) + 8;

        const tableRows = invoice.items.map(item => [
            item.description,
            String(item.quantity),
            fmt(item.unitPrice),
            fmt(item.total)
        ]);

        autoTable(doc, {
            startY: tableY,
            margin: { left: ml, right: mr },
            head: [['Description', 'Qty', 'Unit Price', 'Total']],
            body: tableRows,
            theme: 'plain',
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: [100, 100, 100],
                fontStyle: 'bold',
                fontSize: 7.5,
                cellPadding: { top: 2, bottom: 3, left: 2, right: 2 },
            },
            styles: {
                fontSize: 9,
                textColor: [30, 30, 30],
                cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
                lineColor: [240, 240, 240],
                lineWidth: 0.3,
            },
            columnStyles: {
                0: { cellWidth: 'auto', fontStyle: 'bold' },
                1: { cellWidth: 18, halign: 'center' },
                2: { cellWidth: 30, halign: 'right' },
                3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
            },
            didDrawPage: (data: any) => {
                // Draw thick top border on head row
                const head = data.table.head;
                if (head.length > 0) {
                    doc.setDrawColor(30, 30, 30);
                    doc.setLineWidth(0.6);
                    doc.line(ml, head[0].y, right, head[0].y);
                }
            }
        });

        // =============================================
        //  TOTALS
        // =============================================

        const ftY = (doc as any).lastAutoTable.finalY + 8;
        const totLabelX = pw - 75;
        const totValX = right;
        let ty = ftY;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('Subtotal', totLabelX, ty);
        doc.text(fmt(invoice.subtotal), totValX, ty, { align: 'right' });
        ty += 6;

        doc.text(`VAT (${taxRate}%)`, totLabelX, ty);
        doc.text(fmt(invoice.taxAmount), totValX, ty, { align: 'right' });
        ty += 2;

        // Separator line
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(totLabelX, ty, right, ty);
        ty += 5;

        // Total
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text('Total', totLabelX, ty);
        doc.text(fmt(invoice.total), totValX, ty, { align: 'right' });

        // =============================================
        //  NOTES (if any)
        // =============================================

        if (invoice.notes) {
            ty += 12;
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(160, 160, 160);
            doc.text('NOTES', ml, ty);
            ty += 5;
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            const noteLines = doc.splitTextToSize(invoice.notes, cw);
            noteLines.forEach((line: string) => { doc.text(line, ml, ty); ty += 4; });
        }

        // =============================================
        //  FOOTER: BANKING + TERMS
        // =============================================

        // Position footer at bottom of page (or below content)
        const footerTop = Math.max(ty + 15, ph - 60);

        // Divider
        doc.setDrawColor(240, 240, 240);
        doc.setLineWidth(0.5);
        doc.line(ml, footerTop, right, footerTop);

        // Banking details (left)
        let fy = footerTop + 7;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text('Banking Details', ml, fy);
        fy += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 100, 100);
        if (profile?.banking) {
            doc.text(`Bank: ${profile.banking.bankName}`, ml, fy); fy += 3.5;
            doc.text(`Account Name: ${profile.banking.accountName}`, ml, fy); fy += 3.5;
            doc.text(`Account Number: ${profile.banking.accountNumber}`, ml, fy); fy += 3.5;
            doc.text(`Branch Code: ${profile.banking.branchCode}`, ml, fy); fy += 5;
        }
        doc.setTextColor(37, 99, 235);
        doc.text(`Please use ${invoice.type} #${invoice.number} as reference.`, ml, fy);

        // Terms & Conditions (right)
        let tryY = footerTop + 7;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text('Terms & Conditions', right, tryY, { align: 'right' });
        tryY += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 100, 100);
        const payDays = profile?.defaultPaymentTerms ?? 7;
        doc.text(`Payment is due within ${payDays} days of ${invoice.type.toLowerCase()} date.`, right, tryY, { align: 'right' });
        tryY += 3.5;
        doc.text(`Goods remain the property of ${companyName} until paid in full.`, right, tryY, { align: 'right' });

        // THANK YOU
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 220, 220);
        doc.text('THANK YOU FOR YOUR BUSINESS', right, tryY + 14, { align: 'right' });

        // =============================================
        //  SAVE
        // =============================================

        doc.save(`${invoice.type}_${invoice.number}.pdf`);
    }
}
