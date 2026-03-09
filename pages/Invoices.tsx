import React, { useState, useRef, useEffect } from 'react';
import { store } from '../services/store';
import { invoiceService } from '../services/invoiceService';
import { invoicePaymentService } from '../services/invoicePaymentService';
import { Pagination, paginate } from '../components/Pagination';
import { useAuth } from '../components/AuthContext';
import { Permission } from '../services/rbac';
import { PDFService } from '../services/pdf';
import { emailService } from '../services/emailService';
import { messagingService } from '../services/messagingService';
import { payfastService } from '../services/payfastService';
import { PaymentHistory } from '../components/PaymentHistory';
import { FileText, Plus, Download, Search, X, Trash2, ArrowRight, CheckCircle, FileBadge, Car, User, Wrench, Printer, Eye, MoreVertical, Edit, Send, DollarSign, Loader2, CreditCard, Mail, SlidersHorizontal, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Invoice, InvoiceItem, JobStatus, Job, Vehicle, Priority, Customer, CompanyProfile } from '../types';
import { companyProfile as companyProfileService } from '../services/companyProfile';
import { AdvancedFilterPanel } from '../components/ui/AdvancedFilterPanel';
import { BulkActionPanel } from '../components/ui/BulkActionPanel';
import { ExportDataModal } from '../components/ui/ExportDataModal';
import { ExportColumn } from '../utils/exportUtils';

export const Sales: React.FC = () => {
  const { can } = useAuth();
  const [salesDocs, setSalesDocs] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workshopProfile, setWorkshopProfile] = useState<CompanyProfile | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'Invoice' | 'Quote'>('Invoice');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<Invoice | null>(null);
  const [viewModalTab, setViewModalTab] = useState<'preview' | 'history' | 'actions'>('preview');
  const [reminderLoading, setReminderLoading] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false );
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Dropdown menu state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<Partial<Invoice>>({
    type: 'Invoice',
    items: [],
    status: 'Draft',
    taxAmount: 0,
    subtotal: 0,
    total: 0,
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
  });

  // Data Loading
  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load synchronous store data immediately
      setSalesDocs(store.getInvoices());
      setCustomers(store.getCustomers());
      setVehicles(store.getVehicles());
      setJobs(store.getJobs());
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setIsLoading(false);
    }
    // Load Firestore profile in background (don't block page render)
    companyProfileService.getProfile()
      .then(profile => { if (profile) setWorkshopProfile(profile); })
      .catch(() => {});
  };

  useEffect(() => {
    loadData();
  }, []);

  const refreshData = () => {
    loadData();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (docId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (openDropdown === docId) {
      setOpenDropdown(null);
      setDropdownPosition(null);
    } else {
      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        right: window.innerWidth - rect.right
      });
      setOpenDropdown(docId);
    }
  };

  const handleDownloadPDF = async (doc: Invoice) => {
    const customer = customers.find(c => c.id === doc.customerId);
    const vehicle = vehicles.find(v => v.id === doc.vehicleId);

    if (customer) {
      await PDFService.generateInvoice(doc, customer, vehicle, workshopProfile ?? undefined);
    } else {
      alert('Cannot generate PDF: Customer details not found.');
    }
  };

  const handleMarkAsPaid = (doc: Invoice) => {
    store.updateInvoice(doc.id, { status: 'Paid' });
    
    // Send payment confirmation SMS + Email
    const customer = customers.find(c => c.id === doc.customerId);
    if (customer?.phone) {
      messagingService.sendTemplatedMessage(customer.phone, 'payment_confirmed', {
        customerName: customer.name,
        invoiceNumber: doc.number,
        totalCost: String(doc.total),
        workshopName: workshopProfile?.name || 'Workshop',
      }).catch(err => console.error('[SMS] Payment confirmation failed:', err));
    }
    if (customer?.email) {
      emailService.sendPaymentConfirmation(customer.email, customer.name, doc.number, doc.total, 'Manual')
        .catch(err => console.error('[Email] Payment confirmation failed:', err));
    }
    
    refreshData();
    setOpenDropdown(null);
  };

  const handleMarkAsSent = async (doc: Invoice) => {
    const customer = customers.find(c => c.id === doc.customerId);
    if (customer?.email) {
      try {
        const isQuote = doc.type === 'Quote';
        const result = await emailService.sendInvoice(
          customer.email,
          customer.name,
          doc.number,
          doc.total,
          doc.dueDate,
          isQuote
        );
        if (result.success) {
          alert(`✅ ${doc.type} ${doc.number} sent to ${customer.email}`);
        } else {
          console.warn('Email delivery issue:', result.error);
          alert(`⚠️ ${doc.type} marked as Sent, but email delivery failed: ${result.error || 'Unknown error'}.\nPlease verify your SendGrid sender email is verified.`);
        }
      } catch (err: any) {
        console.error('Email send failed:', err);
        alert(`⚠️ ${doc.type} marked as Sent, but email could not be delivered.\n${err.message || 'Server error'}`);
      }
    } else {
      alert(`⚠️ No email on file for ${customer?.name || 'this customer'}. ${doc.type} marked as Sent without email.`);
    }
    store.updateInvoice(doc.id, { status: 'Sent' });
    
    // Also send SMS notification about the invoice
    if (customer?.phone) {
      messagingService.sendTemplatedMessage(customer.phone, 'payment_reminder', {
        customerName: customer.name,
        invoiceNumber: doc.number,
        totalCost: String(doc.total),
        dueDate: doc.dueDate,
        workshopName: workshopProfile?.name || 'Workshop',
      }).catch(err => console.error('[SMS] Invoice sent notification failed:', err));
    }
    
    refreshData();
    setOpenDropdown(null);
  };

  const handleSendPaymentLink = async (doc: Invoice) => {
    const customer = customers.find(c => c.id === doc.customerId);
    if (!customer) { alert('Customer not found'); return; }
    if (!payfastService.isConfigured()) { alert('PayFast is not configured. Add credentials to .env.local'); return; }
    try {
      const baseUrl = window.location.origin;
      const payUrl = await payfastService.createInvoicePayment(
        doc.number, doc.total, customer.email, customer.name, baseUrl
      );
      window.open(payUrl, '_blank');
    } catch (err) {
      console.error('PayFast error:', err);
      alert('Failed to generate payment link');
    }
    setOpenDropdown(null);
  };

  const handleDelete = async (doc: Invoice) => {
    if (confirm(`Are you sure you want to delete ${doc.number}?`)) {
      try {
        store.deleteInvoice(doc.id);
        refreshData();
      } catch (error) {
        console.error('Failed to delete invoice', error);
        alert('Failed to delete invoice.');
      }
      setOpenDropdown(null);
    }
  };

  const handleChangeToInvoice = async (quote: Invoice) => {
    const newInvoiceNumber = `INV-${Math.floor(1000 + Math.random() * 9000)}`;
    const updatedDoc: Partial<Invoice> = {
      type: 'Invoice',
      number: newInvoiceNumber,
      status: 'Draft',
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString()
    };
    await store.updateInvoice(quote.id, updatedDoc);
    refreshData();
    setOpenDropdown(null);
    alert(`Quote ${quote.number} changed to Invoice ${newInvoiceNumber}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid': return 'bg-green-100 text-green-800';
      case 'Accepted': return 'bg-green-100 text-green-800';
      case 'Sent': return 'bg-blue-100 text-blue-800';
      case 'Converted': return 'bg-purple-100 text-purple-800';
      case 'Overdue': return 'bg-red-100 text-red-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`Are you sure you want to delete ${selectedDocIds.length} items?`)) {
      selectedDocIds.forEach(id => store.deleteInvoice(id));
      setSelectedDocIds([]);
      refreshData();
    }
  };

  const handleBulkStatusChange = (status: string) => {
    if (confirm(`Change status of ${selectedDocIds.length} items to ${status}?`)) {
      selectedDocIds.forEach(id => {
        const doc = salesDocs.find(d => d.id === id);
        if (doc) store.updateInvoice(id, { status: status as any });
      });
      setSelectedDocIds([]);
      refreshData();
    }
  };

  const handleBulkSendEmail = async () => {
    if (selectedDocIds.length === 0) return;

    if (
      !confirm(
        `Send ${activeTab === 'Invoice' ? 'invoices' : 'quotes'} via email for ${selectedDocIds.length} selected documents and mark them as Sent?`
      )
    ) {
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    for (const id of selectedDocIds) {
      const doc = salesDocs.find(d => d.id === id);
      if (!doc) continue;
      const customer = customers.find(c => c.id === doc.customerId);

      if (!customer?.email) {
        failureCount++;
        continue;
      }

      try {
        const isQuote = doc.type === 'Quote';
        const result = await emailService.sendInvoice(
          customer.email,
          customer.name,
          doc.number,
          doc.total,
          doc.dueDate,
          isQuote
        );
        if (result.success) {
          successCount++;
          store.updateInvoice(doc.id, { status: 'Sent' });
        } else {
          failureCount++;
        }
      } catch {
        failureCount++;
      }
    }

    setSelectedDocIds([]);
    refreshData();

    alert(
      `Bulk email complete.\nSuccessfully sent: ${successCount}\nFailed or skipped (no email): ${failureCount}`
    );
  };

  const handleBulkDownloadPDFs = async () => {
    if (selectedDocIds.length === 0) return;

    if (!confirm(`Download PDFs for ${selectedDocIds.length} selected documents?`)) return;

    for (const id of selectedDocIds) {
      const doc = salesDocs.find(d => d.id === id);
      if (doc) {
        await handleDownloadPDF(doc);
      }
    }
  };

  const handleCreate = (type: 'Invoice' | 'Quote' = activeTab) => {
    const prefix = type === 'Invoice' ? 'INV' : 'QT';
    setFormData({
      type: type,
      number: `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + (type === 'Quote' ? 30 : 7) * 86400000).toISOString().split('T')[0],
      status: 'Draft',
      items: [{ id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, total: 0 }],
      subtotal: 0,
      taxAmount: 0,
      total: 0,
      customerId: '',
      jobId: '',
      vehicleId: ''
    });
    setIsModalOpen(true);
  };

  const handleView = async (doc: Invoice) => {
    try {
      // Try to load items from backend API; fall back to in-memory items if API fails
      const { invoiceService } = await import('../services/invoiceService');
      const items = await invoiceService.listInvoiceItems(doc.id);
      setViewingDoc({ ...doc, items });
    } catch (err) {
      console.warn('Failed to load items from API, using local data', err);
      setViewingDoc(doc);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendReminder = async () => {
    if (!viewingDoc) return;
    
    setReminderLoading(true);
    try {
      const result = await invoicePaymentService.sendPaymentReminder(viewingDoc.id);
      
      if (result.success) {
        let message = 'Reminder sent successfully';
        if (result.email_sent && result.sms_sent) {
          message = 'Reminder sent via email and SMS';
        } else if (result.email_sent) {
          message = 'Reminder sent via email';
        } else if (result.sms_sent) {
          message = 'Reminder sent via SMS';
        }
        setToastMessage({ text: message, type: 'success' });
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        setToastMessage({ 
          text: result.message || 'Failed to send reminder', 
          type: 'error' 
        });
      }
    } catch (error) {
      setToastMessage({ 
        text: error instanceof Error ? error.message : 'Failed to send reminder', 
        type: 'error' 
      });
    } finally {
      setReminderLoading(false);
    }
  };

  const handleRefundPayment = async () => {
    if (!viewingDoc) return;
    
    const refundReason = prompt(
      'Enter refund reason (optional):',
      'Customer requested refund'
    );
    if (refundReason === null) return; // User cancelled
    
    setRefundLoading(true);
    try {
      const result = await invoicePaymentService.refundPayment(
        viewingDoc.id,
        viewingDoc.total,
        refundReason || undefined
      );
      
      if (result.success) {
        setToastMessage({ 
          text: 'Payment refunded successfully', 
          type: 'success' 
        });
        setTimeout(() => {
          setViewingDoc(null);
          refreshData();
          setToastMessage(null);
        }, 2000);
      } else {
        setToastMessage({ 
          text: result.message || 'Failed to refund payment', 
          type: 'error' 
        });
      }
    } catch (error) {
      setToastMessage({ 
        text: error instanceof Error ? error.message : 'Failed to refund payment', 
        type: 'error' 
      });
    } finally {
      setRefundLoading(false);
    }
  };

  const handleAddItem = () => {
    const newItems = [...(formData.items || []), {
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0
    }];
    calculateTotals(newItems);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...(formData.items || [])];
    newItems.splice(index, 1);
    calculateTotals(newItems);
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...(formData.items || [])];
    const item = { ...newItems[index], [field]: value };

    // Recalculate item total
    if (field === 'quantity' || field === 'unitPrice') {
      item.total = Number(item.quantity) * Number(item.unitPrice);
    }

    newItems[index] = item;
    calculateTotals(newItems);
  };

  const calculateTotals = (items: InvoiceItem[]) => {
    const sub = items.reduce((acc, item) => acc + item.total, 0);
    const tax = sub * 0.15; // 15% VAT
    const tot = sub + tax;

    setFormData({
      ...formData,
      items,
      subtotal: sub,
      taxAmount: tax,
      total: tot
    });
  };

  const handleJobSelect = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      // Auto-populate from job
      const items = [{
        id: Date.now().toString(),
        description: `${job.serviceType} - ${job.description}`,
        quantity: 1,
        unitPrice: job.estimatedCost,
        total: job.estimatedCost
      }];

      calculateTotals(items);
      setFormData(prev => ({
        ...prev,
        jobId,
        customerId: job.customerId,
        vehicleId: job.vehicleId,
        items,
        subtotal: job.estimatedCost,
        taxAmount: job.estimatedCost * 0.15,
        total: job.estimatedCost * 1.15
      }));
    } else {
      setFormData(prev => ({ ...prev, jobId }));
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    setFormData({ ...formData, customerId, vehicleId: '' }); // Reset vehicle on customer change
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerId || !formData.items?.length) return;

    try {
      // Create invoice first
      const createdInvoice = await store.addInvoice(formData as Invoice);
      
      // Sync items to backend API (so they persist in DB)
      if (createdInvoice && formData.items.length > 0) {
        for (const item of formData.items) {
          try {
            await invoiceService.createInvoiceItem(createdInvoice.id, {
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice
            });
          } catch (err) {
            console.warn(`Failed to sync item ${item.id} to API:`, err);
            // Don't fail the whole save; item stays in local store as fallback
          }
        }
      }
      
      setIsModalOpen(false);
      refreshData();
    } catch (error) {
      console.error('Failed to save invoice', error);
      alert('Failed to save invoice. Please try again.');
    }
  };

  const convertQuoteToInvoice = async (quote: Invoice) => {
    const newInvoice: Omit<Invoice, 'id'> = {
      ...quote,
      id: undefined, // ensure id is generated
      type: 'Invoice',
      number: `INV-${Math.floor(Math.random() * 10000)}`,
      issueDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: 'Draft',
      notes: `Converted from Quote ${quote.number}`
    } as any; // Cast as any because we strip ID

    // Store implementation handles removing ID if needed, 
    // but here we just pass object properties except ID will be overwritten/ignored by create.

    store.addInvoice(newInvoice as Invoice);

    // Update quote status
    store.updateInvoice(quote.id, { status: 'Converted' });

    setActiveTab('Invoice');
    refreshData();
    alert(`Quote converted to Invoice`);
  };

  const convertQuoteToJob = async (quote: Invoice) => {
    // Create new Job
    const newJob: Omit<Job, 'id'> = {
      customerId: quote.customerId,
      vehicleId: quote.vehicleId || '', // Should ensure vehicle exists
      status: JobStatus.PENDING,
      priority: Priority.MEDIUM,
      serviceType: 'From Quote',
      description: quote.items.map(i => i.description).join(', '),
      notes: `Created from Quote ${quote.number}`,
      estimatedCost: quote.subtotal,
      estimatedHours: 0,
      actualHours: 0,
      timeVariance: 0,
      createdAt: new Date().toISOString(),
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      tasks: [],
      partsUsed: [],
      laborLog: [],
      activityLog: [],
      notifications: [],
      warranties: [], // Added missing prop
      attachments: [] // Added missing prop
    };

    if (!newJob.vehicleId) {
      alert("Please assign a vehicle to this quote before converting to a job.");
      return;
    }

    store.addJob(newJob as Job);
    store.updateInvoice(quote.id, { status: 'Accepted' });
    refreshData();
    alert("Quote converted to Job successfully!");
  };

  const filteredDocs = salesDocs.filter(doc => {
    const matchesType = doc.type === activeTab;
    const matchesSearch = !search || 
      doc.number.toLowerCase().includes(search.toLowerCase()) ||
      (customers.find(c => c.id === doc.customerId)?.name.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = filterStatus === 'ALL' || doc.status === filterStatus;
    return matchesType && matchesSearch && matchesStatus;
  });

  const invoiceStatuses = ['Draft', 'Sent', 'Paid', 'Overdue'];
  const quoteStatuses = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Converted'];
  const statusOptions = activeTab === 'Invoice' ? invoiceStatuses : quoteStatuses;
  const activeFilterCount = [filterStatus !== 'ALL', search !== ''].filter(Boolean).length;

  const clearFilters = () => {
    setSearch('');
    setFilterStatus('ALL');
    setFilterDateFrom('');
    setFilterDateTo('');
    setCurrentPage(1);
    setSelectedDocIds([]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="animate-spin text-blue-600" size={32} />
          <p className="text-gray-500">Loading sales data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ExportDataModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        data={filteredDocs}
        availableColumns={[
          { header: 'Invoice Number', key: 'number' },
          { header: 'Type', key: 'type' },
          { header: 'Status', key: 'status' },
          { header: 'Customer', key: 'customerId', format: (id) => customers.find(c => c.id === id)?.name || id },
          { header: 'Vehicle', key: 'vehicleId', format: (id) => { const v = vehicles.find(v => v.id === id); return v ? `${v.registration}` : 'None'; } },
          { header: 'Issue Date', key: 'issueDate', format: (d) => new Date(d).toLocaleDateString() },
          { header: 'Due Date', key: 'dueDate', format: (d) => new Date(d).toLocaleDateString() },
          { header: 'Subtotal', key: 'subtotal' },
          { header: 'Tax', key: 'taxAmount' },
          { header: 'Total', key: 'total' }
        ]}
        filename={`${activeTab.toLowerCase()}s_export`}
        defaultExportType="excel"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales & Quotes</h1>
          <p className="text-sm text-gray-500">Manage invoicing, quotations, and sales history</p>
        </div>
        <div className="flex items-center gap-2">
            <button
                onClick={() => setIsExportModalOpen(true)}
                className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
            >
                <Download size={20} /> Export
            </button>
            <button
            onClick={() => handleCreate(activeTab)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!can(Permission.MANAGE_INVOICES)}
            title={!can(Permission.MANAGE_INVOICES) ? 'You do not have permission' : ''}
            >
            <Plus size={20} /> Create {activeTab}
            </button>
        </div>
      </div>

      <BulkActionPanel 
        selectedCount={selectedDocIds.length}
        onClearSelection={() => setSelectedDocIds([])}
        actions={[
          { label: 'Mark Sent', icon: <Send size={16} />, onClick: () => handleBulkStatusChange('Sent'), variant: 'primary' },
          { label: 'Mark Paid/Accepted', icon: <CheckCircle2 size={16} />, onClick: () => handleBulkStatusChange(activeTab === 'Invoice' ? 'Paid' : 'Accepted'), variant: 'primary' },
          { label: 'Send Email', icon: <Mail size={16} />, onClick: handleBulkSendEmail, variant: 'primary' },
          { label: 'Download PDFs', icon: <Download size={16} />, onClick: handleBulkDownloadPDFs, variant: 'secondary' },
          { label: 'Delete', icon: <Trash2 size={16} />, onClick: handleBulkDelete, variant: 'danger' }
        ]}
      />

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => { setActiveTab('Invoice'); setCurrentPage(1); setFilterStatus('ALL'); }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'Invoice' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Invoices
        </button>
        <button
          onClick={() => { setActiveTab('Quote'); setCurrentPage(1); setFilterStatus('ALL'); }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'Quote' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Quotations
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {activeTab === 'Invoice' ? (
          <>
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Outstanding Invoices</p>
              <h3 className="text-2xl font-bold text-red-600">
                R{salesDocs.filter(i => i.type === 'Invoice' && (i.status === 'Overdue' || i.status === 'Sent')).reduce((acc, i) => acc + i.total, 0).toFixed(2)}
              </h3>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Paid (This Month)</p>
              <h3 className="text-2xl font-bold text-green-600">
                R{salesDocs.filter(i => i.type === 'Invoice' && i.status === 'Paid').reduce((acc, i) => acc + i.total, 0).toFixed(2)}
              </h3>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Open Quotes</p>
              <h3 className="text-2xl font-bold text-blue-600">
                R{salesDocs.filter(i => i.type === 'Quote' && i.status === 'Sent').reduce((acc, i) => acc + i.total, 0).toFixed(2)}
              </h3>
              <p className="text-xs text-gray-400 mt-1">{salesDocs.filter(i => i.type === 'Quote' && i.status === 'Sent').length} sent</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <p className="text-sm font-medium text-gray-500">Conversion Rate</p>
              <h3 className="text-2xl font-bold text-gray-900">
                {(() => {
                  const quotes = salesDocs.filter(i => i.type === 'Quote');
                  if (quotes.length === 0) return '0%';
                  const converted = quotes.filter(i => i.status === 'Accepted' || i.status === 'Converted').length;
                  return Math.round((converted / quotes.length) * 100) + '%';
                })()}
              </h3>
            </div>
          </>
        )}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Draft Value</p>
          <h3 className="text-2xl font-bold text-gray-600">
            R{salesDocs.filter(i => i.type === activeTab && i.status === 'Draft').reduce((acc, i) => acc + i.total, 0).toFixed(2)}
          </h3>
        </div>
      </div>
      
      <AdvancedFilterPanel
        searchTerm={search}
        onSearchChange={(v) => { setSearch(v); setCurrentPage(1); }}
        onClearFilters={clearFilters}
        placeholder={`Search ${activeTab} # or Customer...`}
        filters={[
          {
            id: 'status',
            label: 'Status',
            value: filterStatus,
            onChange: (v) => { setFilterStatus(v); setCurrentPage(1); },
            options: [
              { label: 'All Statuses', value: 'ALL' },
              ...statusOptions.map(status => ({ label: status, value: status }))
            ]
          }
        ]}
        presets={[
          { label: 'Overdue / Rejected', active: filterStatus === 'Overdue' || filterStatus === 'Rejected', onClick: () => { setFilterStatus(activeTab === 'Invoice' ? 'Overdue' : 'Rejected'); setCurrentPage(1); } },
          { label: 'Paid / Accepted', active: filterStatus === 'Paid' || filterStatus === 'Accepted', onClick: () => { setFilterStatus(activeTab === 'Invoice' ? 'Paid' : 'Accepted'); setCurrentPage(1); } }
        ]}
      />

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-center w-12">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedDocIds.length === filteredDocs.length && filteredDocs.length > 0}
                    ref={input => { if (input) input.indeterminate = selectedDocIds.length > 0 && selectedDocIds.length < filteredDocs.length; }}
                    onChange={e => {
                      if (e.target.checked) setSelectedDocIds(filteredDocs.map(d => d.id));
                      else setSelectedDocIds([]);
                    }}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer / Vehicle</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginate<Invoice>(filteredDocs, currentPage, pageSize).map(doc => {
                const customer = customers.find(c => c.id === doc.customerId);
                const vehicle = vehicles.find(v => v.id === doc.vehicleId);
                return (
                  <tr key={doc.id} className={`hover:bg-blue-50/50 transition-colors ${selectedDocIds.includes(doc.id) ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-6 py-4 text-center">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedDocIds.includes(doc.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedDocIds([...selectedDocIds, doc.id]);
                          else setSelectedDocIds(selectedDocIds.filter(id => id !== doc.id));
                        }}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600 cursor-pointer" onClick={() => handleView(doc)}>{doc.number}</td>
                    <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => handleView(doc)}>
                      <div className="text-sm font-medium text-gray-900">{customer?.name || 'Unknown'}</div>
                      {vehicle && <div className="text-xs text-gray-500">{vehicle.make} {vehicle.model} ({vehicle.registration})</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(doc.issueDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">R{doc.total.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(doc.status)}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="relative inline-block">
                        <button
                          data-dropdown={doc.id}
                          onClick={(e) => toggleDropdown(doc.id, e)}
                          className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
                          title="More actions"
                        >
                          <MoreVertical size={18} />
                        </button>

                        {/* Dropdown Menu */}
                        {openDropdown === doc.id && dropdownPosition && (
                          <div
                            ref={dropdownRef}
                            className="fixed w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-[100] py-1"
                            style={{
                              top: `${dropdownPosition.top + 8}px`,
                              right: `${dropdownPosition.right}px`
                            }}
                          >
                            <button
                              onClick={() => {
                                handleView(doc);
                                setOpenDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                            >
                              <Eye size={16} />
                              View Details
                            </button>

                            <button
                              onClick={() => {
                                handleDownloadPDF(doc);
                                setOpenDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                            >
                              <Download size={16} />
                              Download PDF
                            </button>

                            {activeTab === 'Invoice' && doc.status !== 'Paid' && (
                              <>
                                <div className="border-t border-gray-100 my-1"></div>
                                <button
                                  onClick={() => handleMarkAsSent(doc)}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                                >
                                  <Mail size={16} />
                                  Send via Email
                                </button>
                                <button
                                  onClick={() => handleSendPaymentLink(doc)}
                                  className="w-full text-left px-4 py-2 text-sm text-teal-600 hover:bg-teal-50 flex items-center gap-3"
                                >
                                  <CreditCard size={16} />
                                  PayFast Payment Link
                                </button>
                                <button
                                  onClick={() => handleMarkAsPaid(doc)}
                                  className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center gap-3"
                                >
                                  <DollarSign size={16} />
                                  Mark as Paid
                                </button>
                              </>
                            )}

                            {activeTab === 'Quote' && (doc.status === 'Sent' || doc.status === 'Accepted') && (
                              <>
                                <div className="border-t border-gray-100 my-1"></div>
                                <button
                                  onClick={() => {
                                    convertQuoteToInvoice(doc);
                                    setOpenDropdown(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center gap-3"
                                >
                                  <FileBadge size={16} />
                                  Convert to Invoice
                                </button>
                                <button
                                  onClick={() => {
                                    convertQuoteToJob(doc);
                                    setOpenDropdown(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-3"
                                >
                                  <Wrench size={16} />
                                  Convert to Job
                                </button>
                                <button
                                  onClick={() => handleChangeToInvoice(doc)}
                                  className="w-full text-left px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 flex items-center gap-3"
                                >
                                  <ArrowRight size={16} />
                                  Change to Invoice
                                </button>
                              </>
                            )}

                            {activeTab === 'Quote' && doc.status === 'Draft' && (
                              <>
                                <div className="border-t border-gray-100 my-1"></div>
                                <button
                                  onClick={() => handleMarkAsSent(doc)}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                                >
                                  <Send size={16} />
                                  Send Quote
                                </button>
                                <button
                                  onClick={() => handleChangeToInvoice(doc)}
                                  className="w-full text-left px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 flex items-center gap-3"
                                >
                                  <ArrowRight size={16} />
                                  Change to Invoice
                                </button>
                              </>
                            )}

                            <div className="border-t border-gray-100 my-1"></div>
                            {can(Permission.MANAGE_INVOICES) && <button
                              onClick={() => handleDelete(doc)}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                            >
                              <Trash2 size={16} />
                              Delete
                            </button>}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No documents found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={filteredDocs.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* === CREATE MODAL === */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">

            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">New {formData.type}</h3>
                  <p className="text-xs text-gray-500">{formData.number}</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 p-6 space-y-8">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                      <button type="button" onClick={() => setFormData({ ...formData, type: 'Invoice' })} className={`flex-1 py-1 text-sm font-medium rounded ${formData.type === 'Invoice' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Invoice</button>
                      <button type="button" onClick={() => setFormData({ ...formData, type: 'Quote' })} className={`flex-1 py-1 text-sm font-medium rounded ${formData.type === 'Quote' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Quote</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                    <select
                      required
                      className="w-full border rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500"
                      value={formData.customerId}
                      onChange={e => handleCustomerSelect(e.target.value)}
                    >
                      <option value="">Select Customer</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label>
                    <select
                      className="w-full border rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500"
                      value={formData.vehicleId || ''}
                      onChange={e => setFormData({ ...formData, vehicleId: e.target.value })}
                      disabled={!formData.customerId}
                    >
                      <option value="">Select Vehicle (Optional)</option>
                      {vehicles
                        .filter(v => v.ownerId === formData.customerId)
                        .map(v => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} - {v.registration}</option>)
                      }
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Link to Job (Optional)</label>
                    <select
                      className="w-full border rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500"
                      value={formData.jobId}
                      onChange={e => handleJobSelect(e.target.value)}
                    >
                      <option value="">Select Job Card</option>
                      {jobs
                        .filter(j => !formData.customerId || j.customerId === formData.customerId)
                        .map(j => (
                          <option key={j.id} value={j.id}>
                            {j.id} - {j.serviceType} ({j.status})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
                    <input
                      type="date"
                      required
                      className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                      value={formData.issueDate}
                      onChange={e => setFormData({ ...formData, issueDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{formData.type === 'Quote' ? 'Expiry Date' : 'Due Date'}</label>
                    <input
                      type="date"
                      required
                      className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500"
                      value={formData.dueDate}
                      onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <div className="w-full border rounded-lg p-2.5 bg-gray-50 text-gray-600 flex items-center gap-2">
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-200 text-gray-700">Draft</span>
                      <span className="text-xs text-gray-400">Auto-assigned on creation</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Line Items</label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    <Plus size={16} /> Add Item
                  </button>
                </div>

                <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-1/2">Description</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">Qty</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">Price (R)</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-32">Total (R)</th>
                        <th className="px-4 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {formData.items?.map((item, index) => (
                        <tr key={item.id}>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              required
                              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                              placeholder="e.g. Brake pad replacement"
                              value={item.description}
                              onChange={e => handleItemChange(index, 'description', e.target.value)}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              min="1"
                              required
                              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                              value={item.quantity}
                              onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 1)}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                              placeholder="0.00"
                              value={item.unitPrice || ''}
                              onChange={e => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-gray-700">
                            {item.total.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(!formData.items || formData.items.length === 0) && (
                    <div className="p-8 text-center text-gray-400 text-sm">
                      No items added. Click "Add Item" to start.
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Remarks (Optional)</label>
                <textarea
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="e.g. Payment terms, warranty info, special instructions..."
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              {/* Footer Totals */}
              <div className="flex flex-col sm:flex-row justify-between items-end gap-6 pt-4 border-t border-gray-100">
                <div className="w-full sm:w-auto"></div>
                <div className="w-full sm:w-1/3 space-y-3">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal</span>
                    <span>R{(formData.subtotal || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>VAT (15%)</span>
                    <span>R{(formData.taxAmount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-gray-900 pt-3 border-t border-gray-200">
                    <span>Total</span>
                    <span>R{(formData.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2"
                >
                  <FileText size={18} /> Save {formData.type}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* === DOCUMENT VIEWER / PRINT MODAL === */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-70 backdrop-blur-sm">
          <div className="bg-gray-100 rounded-lg max-h-[95vh] overflow-hidden flex flex-col w-full max-w-5xl">
            {/* Toolbar with Tabs */}
            <div className="bg-gray-800 text-white px-6 py-3 flex justify-between items-center shadow-lg shrink-0 print:hidden">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-lg">{viewingDoc.type} Preview</h3>
                <span className="text-gray-400 text-sm">{viewingDoc.number}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewModalTab('preview')}
                  className={`px-3 py-2 rounded text-sm font-medium transition ${
                    viewModalTab === 'preview'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setViewModalTab('history')}
                  className={`px-3 py-2 rounded text-sm font-medium transition ${
                    viewModalTab === 'history'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Payment History
                </button>
                <button
                  onClick={() => setViewModalTab('actions')}
                  className={`px-3 py-2 rounded text-sm font-medium transition ${
                    viewModalTab === 'actions'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Actions
                </button>
              </div>
            </div>

            {/* Toast Message */}
            {toastMessage && (
              <div className={`px-6 py-3 ${toastMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                <p className="text-sm font-medium">{toastMessage.text}</p>
              </div>
            )}

            {/* Modal Content - Tab based */}
            <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-gray-200">
              {/* Preview Tab */}
              {viewModalTab === 'preview' && (
                <div id="invoice-print-area" className="bg-white shadow-2xl w-[210mm] min-h-[297mm] p-[15mm] relative text-gray-800">

                {/* Header */}
                <div className="flex justify-between items-start mb-10 pb-6 border-b-2 border-gray-100">
                  <div>
                    {/* Replace with actual Logo */}
                    <div className="h-16 w-48 bg-slate-900 flex items-center justify-center text-white font-bold text-xl mb-4">
                      {workshopProfile?.name?.substring(0, 10).toUpperCase() ?? 'WORKSHOP'}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p className="font-bold text-gray-900">{workshopProfile?.name ?? 'My Workshop'}</p>
                      <p>{workshopProfile ? `${workshopProfile.address.street}, ${workshopProfile.address.city}` : ''}</p>
                      <p>Phone: {workshopProfile?.contact.phone ?? ''}</p>
                      <p>Email: {workshopProfile?.contact.email ?? ''}</p>
                      {workshopProfile?.vatNumber && <p>VAT Reg: {workshopProfile.vatNumber}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <h1 className="text-4xl font-light text-gray-300 uppercase tracking-widest mb-4">{viewingDoc.type}</h1>
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between gap-8">
                        <span className="text-gray-500">Number:</span>
                        <span className="font-bold">{viewingDoc.number}</span>
                      </div>
                      <div className="flex justify-between gap-8">
                        <span className="text-gray-500">Date:</span>
                        <span className="font-bold">{new Date(viewingDoc.issueDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between gap-8">
                        <span className="text-gray-500">{viewingDoc.type === 'Quote' ? 'Valid Until' : 'Due Date'}:</span>
                        <span className="font-bold">{new Date(viewingDoc.dueDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between gap-8 mt-2 pt-2 border-t border-gray-100">
                        <span className="text-gray-500">Status:</span>
                        <span className={`font-bold px-2 py-0.5 rounded text-xs uppercase ${getStatusColor(viewingDoc.status)}`}>{viewingDoc.status}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Client & Vehicle */}
                <div className="flex justify-between mb-12">
                  <div className="w-1/2 pr-8">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Bill To</h3>
                    {(() => {
                      const c = customers.find(cust => cust.id === viewingDoc.customerId);
                      return c ? (
                        <div className="text-sm space-y-1">
                          <p className="font-bold text-lg text-gray-900">{c.name}</p>
                          <p className="text-gray-600 whitespace-pre-wrap">{c.address}</p>
                          <p className="text-gray-600">{c.email}</p>
                          <p className="text-gray-600">{c.phone}</p>
                        </div>
                      ) : <p className="text-red-500">Unknown Customer</p>;
                    })()}
                  </div>
                  <div className="w-1/2 pl-8 border-l border-gray-100">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Vehicle Details</h3>
                    {(() => {
                      const v = vehicles.find(veh => veh.id === viewingDoc.vehicleId);
                      return v ? (
                        <div className="text-sm space-y-1">
                          <p className="font-bold text-gray-900">{v.year} {v.make} {v.model}</p>
                          <p className="text-gray-600">Reg: {v.registration}</p>
                          <p className="text-gray-600">VIN: {v.vin}</p>
                          <p className="text-gray-600">Mileage: {v.mileage.toLocaleString()} km</p>
                        </div>
                      ) : <p className="text-gray-400 italic">No vehicle linked</p>;
                    })()}
                  </div>
                </div>

                {/* Line Items */}
                <div className="mb-8">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-800 text-left">
                        <th className="py-2 text-gray-600 font-bold uppercase text-xs w-1/2">Description</th>
                        <th className="py-2 text-gray-600 font-bold uppercase text-xs text-center">Qty</th>
                        <th className="py-2 text-gray-600 font-bold uppercase text-xs text-right">Unit Price</th>
                        <th className="py-2 text-gray-600 font-bold uppercase text-xs text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {viewingDoc.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-3 pr-4">
                            <p className="font-medium text-gray-900">{item.description}</p>
                          </td>
                          <td className="py-3 text-center">{item.quantity}</td>
                          <td className="py-3 text-right">R{item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="py-3 text-right font-bold">R{item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="flex justify-end mb-12">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal</span>
                      <span>R{viewingDoc.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 border-b border-gray-200 pb-2">
                      <span>VAT (15%)</span>
                      <span>R{viewingDoc.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-gray-900 pt-1">
                      <span>Total</span>
                      <span>R{viewingDoc.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                {/* Footer / Banking */}
                <div className="border-t-2 border-gray-100 pt-6">
                  <div className="grid grid-cols-2 gap-8 text-xs text-gray-500">
                    <div>
                      <h4 className="font-bold text-gray-900 mb-1">Banking Details</h4>
                      <p>Bank: {workshopProfile?.banking.bankName ?? ''}</p>
                      <p>Account Name: {workshopProfile?.banking.accountName ?? workshopProfile?.name ?? ''}</p>
                      <p>Account Number: {workshopProfile?.banking.accountNumber ?? ''}</p>
                      <p>Branch Code: {workshopProfile?.banking.branchCode ?? ''}</p>
                      <p className="mt-2 text-blue-600">Please use Invoice #{viewingDoc.number} as reference.</p>
                    </div>
                    <div className="text-right">
                      <h4 className="font-bold text-gray-900 mb-1">Terms & Conditions</h4>
                      <p>Payment is due within 7 days of invoice date.</p>
                      <p>Goods remain the property of {workshopProfile?.name ?? 'the workshop'} until paid in full.</p>
                      <p className="mt-4 font-bold text-lg text-gray-300">THANK YOU FOR YOUR BUSINESS</p>
                    </div>
                  </div>
                </div>

              </div>
              )}

              {/* Payment History Tab */}
              {viewModalTab === 'history' && (
                <div className="w-full max-w-2xl bg-white rounded-lg shadow-sm p-6">
                  <PaymentHistory invoiceId={viewingDoc.id} />
                </div>
              )}

              {/* Actions Tab */}
              {viewModalTab === 'actions' && (
                <div className="w-full max-w-2xl bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">Invoice Actions</h3>
                  <div className="space-y-4">
                    {/* Download PDF Button */}
                    <button
                      onClick={() => viewingDoc && handleDownloadPDF(viewingDoc)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded flex items-center gap-3 transition-colors font-medium"
                    >
                      <Download size={20} />
                      Download PDF
                    </button>

                    {/* Print Button */}
                    <button
                      onClick={handlePrint}
                      className="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-3 rounded flex items-center gap-3 transition-colors font-medium"
                    >
                      <Printer size={20} />
                      Print
                    </button>

                    {/* Send Reminder Button */}
                    <button
                      onClick={handleSendReminder}
                      disabled={reminderLoading}
                      className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-3 rounded flex items-center justify-center gap-3 transition-colors font-medium"
                    >
                      {reminderLoading ? (
                        <>
                          <Loader2 size={20} className="animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail size={20} />
                          Send Payment Reminder
                        </>
                      )}
                    </button>

                    {/* Refund Button */}
                    {viewingDoc.status === 'Paid' && (
                      <button
                        onClick={handleRefundPayment}
                        disabled={refundLoading}
                        className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-3 rounded flex items-center justify-center gap-3 transition-colors font-medium"
                      >
                        {refundLoading ? (
                          <>
                            <Loader2 size={20} className="animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <RefreshCw size={20} />
                            Refund Payment
                          </>
                        )}
                      </button>
                    )}

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                      <div className="flex gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-900">
                          <p className="font-semibold">Invoice Details</p>
                          <p className="mt-1">Status: <span className="font-bold">{viewingDoc.status}</span></p>
                          <p>Amount: <span className="font-bold">R{viewingDoc.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></p>
                          <p>Due Date: <span className="font-bold">{new Date(viewingDoc.dueDate).toLocaleDateString()}</span></p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with action buttons - only in preview mode */}
            {viewModalTab === 'preview' && (
              <div className="bg-gray-800 text-white px-6 py-3 flex justify-between items-center shadow-lg shrink-0 print:hidden">
                <div></div>
                <div className="flex items-center gap-3">
                  <button onClick={() => viewingDoc && handleDownloadPDF(viewingDoc)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2 transition-colors">
                    <Download size={18} /> Download PDF
                  </button>
                  <button onClick={handlePrint} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded flex items-center gap-2 transition-colors">
                    <Printer size={18} /> Print
                  </button>
                  <button onClick={() => setViewingDoc(null)} className="text-gray-400 hover:text-white p-2">
                    <X size={24} />
                  </button>
                </div>
              </div>
            )}

            {viewModalTab !== 'preview' && (
              <div className="bg-gray-800 text-white px-6 py-3 flex justify-end shadow-lg shrink-0">
                <button onClick={() => setViewingDoc(null)} className="text-gray-400 hover:text-white p-2">
                  <X size={24} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
