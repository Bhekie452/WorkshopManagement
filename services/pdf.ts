import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, Customer, Vehicle, CompanyProfile } from '../types';

// Fallback workshop details when no profile is loaded
const DEFAULT_WORKSHOP = {
    name: 'My Workshop',
    address: '123 Main Street, Johannesburg, 2000',
    phone: '011 555 0000',
    email: 'info@workshop.co.za',
    vatNumber: '',
    bankName: 'First National Bank',
    accountName: 'My Workshop',
    accountNumber: '1234567890',
    branchCode: '250655',
};

// Local currency formatter if import fails
const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR'
    }).format(amount);
};

export class PDFService {
    static async generateInvoice(invoice: Invoice, customer: Customer, vehicle: Vehicle | undefined, profile?: CompanyProfile): Promise<void> {
        const doc = new jsPDF();

        // Resolve company details from profile or fallback
        const company = profile ? {
            name: profile.name,
            address: `${profile.address.street}, ${profile.address.city}, ${profile.address.province} ${profile.address.postalCode}`,
            phone: profile.contact.phone,
            email: profile.contact.email,
            vatNumber: profile.vatNumber ?? '',
            bankName: profile.banking.bankName,
            accountName: profile.banking.accountName,
            accountNumber: profile.banking.accountNumber,
            branchCode: profile.banking.branchCode,
        } : DEFAULT_WORKSHOP;

        const taxRate = profile?.defaultTaxRate ?? 15;

        // --- Header ---
        doc.setFontSize(22);
        doc.setTextColor(40, 40, 40);
        doc.text(company.name, 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(company.address, 14, 26);
        doc.text(`Tel: ${company.phone} | Email: ${company.email}`, 14, 31);
        if (company.vatNumber) {
            doc.text(`VAT No: ${company.vatNumber}`, 14, 36);
        }

        // --- Invoice Details ---
        doc.setFontSize(16);
        doc.setTextColor(0, 0, 0);
        doc.text(invoice.type.toUpperCase(), 140, 20, { align: 'right' });

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`#${invoice.number}`, 140, 26, { align: 'right' });
        doc.text(`Date: ${new Date(invoice.issueDate).toLocaleDateString()}`, 140, 31, { align: 'right' });
        doc.text(`Due: ${new Date(invoice.dueDate).toLocaleDateString()}`, 140, 36, { align: 'right' });
        doc.text(`Status: ${invoice.status}`, 140, 41, { align: 'right' });

        // --- Customer & Vehicle ---
        doc.line(14, 45, 196, 45); // Horizontal line

        doc.setFontSize(11);
        doc.setTextColor(40, 40, 40);
        doc.text('Bill To:', 14, 55);
        doc.text('Vehicle Details:', 110, 55);

        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);

        // Customer Info
        doc.text(customer.name, 14, 61);
        doc.text(customer.address || '', 14, 66);
        doc.text(customer.email, 14, 71);
        doc.text(customer.phone, 14, 76);

        // Vehicle Info
        doc.text(`${vehicle.year} ${vehicle.make} ${vehicle.model}`, 110, 61);
        doc.text(`Reg: ${vehicle.registration}`, 110, 66);
        doc.text(`VIN: ${vehicle.vin || 'N/A'}`, 110, 71);
        doc.text(`Mileage: ${vehicle.mileage} km`, 110, 76);

        // --- Items Table ---
        const tableRows = invoice.items.map(item => [
            item.description,
            item.quantity,
            formatMoney(item.unitPrice),
            formatMoney(item.total)
        ]);

        autoTable(doc, {
            startY: 85,
            head: [['Description', 'Qty', 'Unit Price', 'Total']],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] }, // Blue header
            styles: { fontSize: 10 },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 20, halign: 'center' },
                2: { cellWidth: 30, halign: 'right' },
                3: { cellWidth: 30, halign: 'right' }
            }
        });

        // --- Totals ---
        const finalY = (doc as any).lastAutoTable.finalY + 10;

        doc.setFontSize(10);
        doc.text('Subtotal:', 140, finalY, { align: 'right' });
        doc.text(formatMoney(invoice.subtotal), 190, finalY, { align: 'right' });

        doc.text(`Tax (${taxRate}%):`, 140, finalY + 6, { align: 'right' });
        doc.text(formatMoney(invoice.taxAmount), 190, finalY + 6, { align: 'right' });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Total:', 140, finalY + 14, { align: 'right' });
        doc.text(formatMoney(invoice.total), 190, finalY + 14, { align: 'right' });

        // --- Footer ---
        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150, 150, 150);
        doc.text('Thank you for your business!', 105, pageHeight - 20, { align: 'center' });
        doc.text(`Bank: ${company.bankName} | Account: ${company.accountName} | Acc No: ${company.accountNumber} | Branch: ${company.branchCode}`, 105, pageHeight - 15, { align: 'center' });

        // Save
        doc.save(`Invoice_${invoice.number}.pdf`);
    }
}
