import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Wrench, FileText, Car, Calendar, CreditCard, CheckCircle, Clock,
  AlertCircle, Loader2, Download, ChevronRight, User, History
} from 'lucide-react';
import { portalService, PortalData } from '../services/portalService';
import { PDFService } from '../services/pdf';

const statusColors: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-800',
  'In Progress': 'bg-blue-100 text-blue-800',
  'Awaiting Parts': 'bg-orange-100 text-orange-800',
  Completed: 'bg-green-100 text-green-800',
  Paid: 'bg-green-100 text-green-800',
  Draft: 'bg-gray-100 text-gray-800',
  Sent: 'bg-blue-100 text-blue-800',
  Overdue: 'bg-red-100 text-red-800',
  Accepted: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
  Scheduled: 'bg-blue-100 text-blue-800',
};

export const CustomerPortal: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'jobs' | 'invoices' | 'quotes' | 'appointments' | 'history' | 'book'>('jobs');
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookForm, setBookForm] = useState({ title: '', start: '', end: '', type: 'Service', vehicle_id: '' });

  useEffect(() => {
    if (!token) {
      setError('No access token provided. Please use the link sent to you by the workshop.');
      setLoading(false);
      return;
    }
    portalService
      .getMe(token)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (searchParams.get('paid') === '1' && data) {
      portalService.getMe(token!).then(setData);
    }
  }, [searchParams.get('paid')]);

  const handleAcceptQuote = async (invoiceId: string) => {
    if (!token) return;
    setAcceptingId(invoiceId);
    try {
      await portalService.acceptQuote(token, invoiceId);
      const fresh = await portalService.getMe(token);
      setData(fresh);
    } catch (err: any) {
      alert(err.message || 'Failed to accept quote');
    } finally {
      setAcceptingId(null);
    }
  };

  const handlePay = async (invoiceId: string) => {
    if (!token) return;
    try {
      const { url } = await portalService.getPaymentUrl(token, invoiceId);
      window.open(url, '_blank');
    } catch (err: any) {
      alert(err.message || 'Failed to get payment link');
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !bookForm.title || !bookForm.start || !bookForm.end) return;
    setBooking(true);
    try {
      await portalService.bookAppointment(token, {
        title: bookForm.title,
        start: bookForm.start,
        end: bookForm.end,
        type: bookForm.type,
        vehicle_id: bookForm.vehicle_id || undefined,
      });
      const fresh = await portalService.getMe(token);
      setData(fresh);
      setBookForm({ title: '', start: '', end: '', type: 'Service', vehicle_id: '' });
      setActiveTab('appointments');
    } catch (err: any) {
      alert(err.message || 'Failed to book appointment');
    } finally {
      setBooking(false);
    }
  };

  const handleDownloadInvoice = async (inv: PortalData['invoices'][0]) => {
    if (!data?.customer) return;
    const customer = data.customer as any;
    const vehicle = data.vehicles?.find((v) => v.id === (inv as any).vehicleId);
    const invWithItems = { ...inv, items: (inv as any).items || [{ description: 'Service', quantity: 1, unitPrice: inv.total, total: inv.total }] };
    try {
      await PDFService.generateInvoice(
        invWithItems as any,
        { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, address: customer.address } as any,
        vehicle as any,
        undefined
      );
    } catch (e) {
      alert('Could not generate PDF. Please try again or contact the workshop.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-blue-600" size={48} />
          <p className="text-gray-600">Loading your account...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Unable to Load</h1>
          <p className="text-gray-600">{error || 'Invalid or expired link.'}</p>
          <p className="text-sm text-gray-500 mt-4">Please contact your workshop for a new link.</p>
        </div>
      </div>
    );
  }

  const customer = data.customer;
  const jobs = data.jobs || [];
  const invoices = (data.invoices || []).filter((i) => i.type === 'Invoice');
  const quotes = (data.invoices || []).filter((i) => i.type === 'Quote');
  const appointments = data.appointments || [];
  const vehicles = data.vehicles || [];
  const serviceHistory = [...jobs].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  const tabs = [
    { id: 'jobs' as const, label: 'Job Status', icon: Wrench },
    { id: 'invoices' as const, label: 'Invoices', icon: FileText },
    { id: 'quotes' as const, label: 'Quotes', icon: FileText },
    { id: 'appointments' as const, label: 'Appointments', icon: Calendar },
    { id: 'history' as const, label: 'Service History', icon: History },
    { id: 'book' as const, label: 'Book Appointment', icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Customer Portal</h1>
              <p className="text-gray-600 mt-1">Welcome, {customer.name}</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <User size={16} />
              {customer.email}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === t.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <t.icon size={18} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {activeTab === 'jobs' && (
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Active Jobs</h2>
              {jobs.filter((j) => !['Completed', 'Paid', 'Cancelled'].includes(j.status)).length === 0 ? (
                <p className="text-gray-500">No active jobs at the moment.</p>
              ) : (
                <div className="space-y-4">
                  {jobs
                    .filter((j) => !['Completed', 'Paid', 'Cancelled'].includes(j.status))
                    .map((job) => (
                      <div key={job.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-gray-900">{job.serviceType}</p>
                            <p className="text-sm text-gray-600">{job.description}</p>
                            <span className={`inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[job.status] || 'bg-gray-100'}`}>
                              {job.status}
                            </span>
                          </div>
                          <div className="text-right text-sm">
                            {job.estimatedCost != null && <p className="font-medium">R{job.estimatedCost.toFixed(2)}</p>}
                            <p className="text-gray-500">Due: {new Date(job.dueDate).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'invoices' && (
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Invoices</h2>
              {invoices.length === 0 ? (
                <p className="text-gray-500">No invoices.</p>
              ) : (
                <div className="space-y-4">
                  {invoices.map((inv) => (
                    <div key={inv.id} className="p-4 border border-gray-200 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{inv.number}</p>
                        <p className="text-sm text-gray-600">R{inv.total.toFixed(2)} · Due {new Date(inv.dueDate).toLocaleDateString()}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[inv.status] || 'bg-gray-100'}`}>
                          {inv.status}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDownloadInvoice(inv)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="Download PDF"
                        >
                          <Download size={18} />
                        </button>
                        {inv.status !== 'Paid' && (
                          <button
                            onClick={() => handlePay(inv.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                          >
                            <CreditCard size={18} /> Pay Now
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'quotes' && (
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Quotes</h2>
              {quotes.length === 0 ? (
                <p className="text-gray-500">No pending quotes.</p>
              ) : (
                <div className="space-y-4">
                  {quotes.map((q) => (
                    <div key={q.id} className="p-4 border border-gray-200 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{q.number}</p>
                        <p className="text-sm text-gray-600">R{q.total.toFixed(2)}</p>
                        <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[q.status] || 'bg-gray-100'}`}>
                          {q.status}
                        </span>
                      </div>
                      {(q.status === 'Draft' || q.status === 'Sent') && (
                        <button
                          onClick={() => handleAcceptQuote(q.id)}
                          disabled={acceptingId === q.id}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          {acceptingId === q.id ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                          Accept Quote
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'appointments' && (
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Upcoming Appointments</h2>
              {appointments.filter((a) => new Date(a.start) >= new Date()).length === 0 ? (
                <p className="text-gray-500">No upcoming appointments.</p>
              ) : (
                <div className="space-y-4">
                  {appointments
                    .filter((a) => new Date(a.start) >= new Date())
                    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                    .map((apt) => (
                      <div key={apt.id} className="p-4 border border-gray-200 rounded-lg flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <Calendar className="text-blue-600" size={24} />
                        </div>
                        <div>
                          <p className="font-semibold">{apt.title}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(apt.start).toLocaleString()} – {new Date(apt.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[apt.status] || 'bg-gray-100'}`}>
                            {apt.type}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Service History</h2>
              {serviceHistory.length === 0 ? (
                <p className="text-gray-500">No service history yet.</p>
              ) : (
                <div className="space-y-4">
                  {serviceHistory.slice(0, 20).map((job) => (
                    <div key={job.id} className="p-4 border border-gray-200 rounded-lg flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{job.serviceType}</p>
                        <p className="text-sm text-gray-600">{job.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(job.createdAt).toLocaleDateString()} · {job.status}
                        </p>
                      </div>
                      {job.estimatedCost != null && (
                        <p className="font-medium">R{job.estimatedCost.toFixed(2)}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'book' && (
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Book an Appointment</h2>
              <form onSubmit={handleBookAppointment} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service / Description</label>
                  <input
                    type="text"
                    required
                    value={bookForm.title}
                    onChange={(e) => setBookForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. 15,000km Service"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                    <input
                      type="datetime-local"
                      required
                      value={bookForm.start}
                      onChange={(e) => setBookForm((f) => ({ ...f, start: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
                    <input
                      type="datetime-local"
                      required
                      value={bookForm.end}
                      onChange={(e) => setBookForm((f) => ({ ...f, end: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle (optional)</label>
                  <select
                    value={bookForm.vehicle_id}
                    onChange={(e) => setBookForm((f) => ({ ...f, vehicle_id: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select vehicle</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registration} – {v.make} {v.model}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={booking}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {booking ? <Loader2 size={18} className="animate-spin" /> : <Calendar size={18} />}
                  Request Appointment
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
