import React, { useState, useEffect } from 'react';
import { store } from '../services/store';
import { Plus, Search, Mail, Phone, MapPin, ShieldCheck, Upload, FileText, X, Loader2 } from 'lucide-react';
import { Customer, Attachment, ContactChannel } from '../types';

export const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Using a combined state for new/edit customer
  const [formData, setFormData] = useState<Partial<Customer>>({ consent: true, preferredContact: 'both', attachments: [] });
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await store.getCustomers();
      setCustomers(data);
    } catch (error) {
      console.error("Failed to load customers", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = () => {
    setEditingId(null);
    setFormData({ consent: true, attachments: [] });
    setIsModalOpen(true);
  };

  const handleEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setFormData({ ...customer });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.email) {
      setIsLoading(true);
      try {
        if (editingId) {
          await store.updateCustomer(editingId, formData);
        } else {
          await store.addCustomer(formData as Customer);
        }
        await loadData(); // Refresh list from server
        setIsModalOpen(false);
      } catch (error) {
        console.error("Failed to save customer", error);
        alert("Failed to save customer. Please try again.");
        setIsLoading(false); // Only reset if error, success resets via loadData
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert("File too large");
        return;
      }

      try {
        const base64 = await store.convertFileToBase64(file);
        const newAttachment: Attachment = {
          id: Date.now().toString(),
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          dataUrl: base64,
          uploadedAt: new Date().toISOString(),
          uploadedBy: 'Current User',
          context: 'Customer Document'
        };

        const updated = [newAttachment, ...(formData.attachments || [])];
        setFormData({ ...formData, attachments: updated });
      } catch (err) {
        console.error(err);
        alert("Failed to upload file");
      }
    }
  };

  if (isLoading && customers.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="animate-spin text-blue-600" size={32} />
          <p className="text-gray-500">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Customer Management</h1>
        <button
          onClick={handleCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={18} /> Add Customer
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preferred Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">POPIA Consent</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleEdit(c)}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold">
                      {c.name.charAt(0)}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{c.name}</div>
                      <div className="text-sm text-gray-500">ID: {c.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center text-sm text-gray-500">
                      <Mail size={14} className="mr-2" /> {c.email}
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Phone size={14} className="mr-2" /> {c.phone}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <MapPin size={14} className="mr-2" /> {c.address}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    {(!c.preferredContact || c.preferredContact === 'email' || c.preferredContact === 'both') && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-700" title="Email">
                        <Mail size={12} className="mr-1 mt-0.5" /> Email
                      </span>
                    )}
                    {(c.preferredContact === 'phone' || c.preferredContact === 'both') && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-700" title="Phone / SMS">
                        <Phone size={12} className="mr-1 mt-0.5" /> Phone
                      </span>
                    )}
                    {!c.preferredContact && (
                      <span className="text-xs text-gray-400">Not set</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {c.consent ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      <ShieldCheck size={12} className="mr-1 mt-0.5" /> Consented
                    </span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                      Pending
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {customers.length === 0 && !isLoading && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No customers found. Click "Add Customer" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Edit Customer' : 'New Customer'}</h2>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" required className="w-full border p-2 rounded" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" required className="w-full border p-2 rounded" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="text" required className="w-full border p-2 rounded" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea className="w-full border p-2 rounded" value={formData.address || ''} onChange={e => setFormData({ ...formData, address: e.target.value })} />
              </div>

              {/* Preferred Contact Channel */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Contact Channel</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'email' as ContactChannel, label: 'Email', icon: '✉️', desc: 'Email only' },
                    { value: 'phone' as ContactChannel, label: 'Phone / SMS', icon: '📱', desc: 'Phone & SMS' },
                    { value: 'both' as ContactChannel, label: 'Both', icon: '📨', desc: 'Email & Phone' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, preferredContact: opt.value })}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-center ${
                        formData.preferredContact === opt.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xl">{opt.icon}</span>
                      <span className="text-sm font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 p-3 bg-gray-50 rounded border">
                <input type="checkbox" checked={formData.consent} onChange={e => setFormData({ ...formData, consent: e.target.checked })} />
                <span className="text-sm text-gray-600">Customer consents to data processing (POPIA/GDPR)</span>
              </label>

              {/* Documents Section */}
              <div className="border-t pt-4 mt-4">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText size={18} /> Documents
                </h3>

                <div className="space-y-3">
                  {formData.attachments?.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border text-sm">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText size={16} className="text-blue-500 shrink-0" />
                        <span className="truncate">{file.fileName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const filtered = formData.attachments?.filter(a => a.id !== file.id);
                          setFormData({ ...formData, attachments: filtered });
                        }}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}

                  <label className="flex items-center justify-center gap-2 w-full p-2 border border-dashed border-blue-300 rounded text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors">
                    <Upload size={16} />
                    <span className="text-sm font-medium">Upload Document (ID, Contract)</span>
                    <input type="file" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                  {isLoading ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
