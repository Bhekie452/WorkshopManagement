import React, { useState } from 'react';
import { X, Download } from 'lucide-react';
import { ExportColumn, exportToCSV, exportToExcel, exportToPDF } from '../../utils/exportUtils';

interface ExportDataModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: any[];
    availableColumns: ExportColumn[];
    filename: string;
    pdfTitle?: string;
    defaultExportType?: 'csv' | 'excel' | 'pdf';
}

export const ExportDataModal: React.FC<ExportDataModalProps> = ({
    isOpen,
    onClose,
    data,
    availableColumns,
    filename,
    pdfTitle = 'Data Export',
    defaultExportType = 'csv'
}) => {
    const [selectedColumns, setSelectedColumns] = useState<string[]>(availableColumns.map(c => c.key));
    const [exportType, setExportType] = useState<'csv' | 'excel' | 'pdf'>(defaultExportType);

    if (!isOpen) return null;

    const toggleColumn = (key: string) => {
        if (selectedColumns.includes(key)) {
            setSelectedColumns(selectedColumns.filter(c => c !== key));
        } else {
            setSelectedColumns([...selectedColumns, key]);
        }
    };

    const handleExport = () => {
        const columnsToExport = availableColumns.filter(c => selectedColumns.includes(c.key));
        
        switch (exportType) {
            case 'csv':
                exportToCSV(data, columnsToExport, filename);
                break;
            case 'excel':
                exportToExcel(data, columnsToExport, filename);
                break;
            case 'pdf':
                exportToPDF(data, columnsToExport, filename, pdfTitle);
                break;
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-900">Export Data</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
                        <div className="flex gap-2">
                            {['csv', 'excel', 'pdf'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setExportType(type as any)}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg border focus:outline-none transition-colors capitalize ${
                                        exportType === type 
                                            ? 'bg-blue-50 border-blue-500 text-blue-700' 
                                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex justify-between items-center">
                            <span>Select Columns to Export</span>
                            <span className="text-xs text-blue-600 cursor-pointer font-normal" onClick={() => setSelectedColumns(availableColumns.map(c => c.key))}>
                                Select All
                            </span>
                        </label>
                        <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto p-2 bg-gray-50">
                            {availableColumns.map(col => (
                                <label key={col.key} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        checked={selectedColumns.includes(col.key)}
                                        onChange={() => toggleColumn(col.key)}
                                    />
                                    <span className="text-sm text-gray-700">{col.header}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors">
                        Cancel
                    </button>
                    <button 
                        onClick={handleExport}
                        disabled={selectedColumns.length === 0}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        <Download size={18} /> Export
                    </button>
                </div>
            </div>
        </div>
    );
};
