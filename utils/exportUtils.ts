import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn {
  header: string;
  key: string;
  format?: (val: any) => string;
}

export const exportToCSV = (data: any[], columns: ExportColumn[], filename: string) => {
  if (!data || !data.length) return;

  const headers = columns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',');
  const rows = data.map(item => {
    return columns.map(c => {
      let val = item[c.key];
      if (c.format) {
        val = c.format(val);
      }
      if (val === null || val === undefined) val = '';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',');
  });

  const csvContent = [headers, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const exportToExcel = (data: any[], columns: ExportColumn[], filename: string) => {
  if (!data || !data.length) return;

  const formattedData = data.map(item => {
    const row: Record<string, any> = {};
    columns.forEach(c => {
      let val = item[c.key];
      if (c.format) val = c.format(val);
      row[c.header] = val;
    });
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export const exportToPDF = (data: any[], columns: ExportColumn[], filename: string, title: string) => {
  if (!data || !data.length) return;

  const doc = new jsPDF();
  
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

  const head = [columns.map(c => c.header)];
  const body = data.map(item => {
    return columns.map(c => {
      let val = item[c.key];
      if (c.format) val = c.format(val);
      if (val === null || val === undefined) val = '';
      return String(val);
    });
  });

  autoTable(doc, {
    head,
    body,
    startY: 28,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] }, // blue-500
  });

  doc.save(`${filename}.pdf`);
};
