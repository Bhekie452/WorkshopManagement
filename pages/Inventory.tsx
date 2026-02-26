import React, { useState, useEffect } from 'react';
import { store } from '../services/store';
import { Pagination, paginate } from '../components/Pagination';
import { useAuth } from '../components/AuthContext';
import { Permission } from '../services/rbac';
import { Part } from '../types';
import { Plus, Search, AlertTriangle, Package, Edit, Trash2, SlidersHorizontal, X, History } from 'lucide-react';

import { Job } from '../types';

export const Inventory: React.FC = () => {
  const { can } = useAuth();
  const [parts, setParts] = useState<Part[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [formData, setFormData] = useState<Partial<Part>>({});
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyPart, setHistoryPart] = useState<Part | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStock, setFilterStock] = useState<string>('ALL');

  useEffect(() => {
    refreshData();
    // Load jobs for usage history
    setJobs(store.getJobs ? store.getJobs() : []);
  }, []);

  const refreshData = () => {
    setParts(store.getParts());
    if (store.getJobs) setJobs(store.getJobs());
  };

  const handleCreate = () => {
    setEditingPart(null);
    setFormData({
      quantity: 0,
      minLevel: 5,
      costPrice: 0,
      sellingPrice: 0
    });
    setIsModalOpen(true);
  };

  const handleEdit = (part: Part) => {
    setEditingPart(part);
    setFormData({ ...part });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPart) {
      store.updatePart({ ...editingPart, ...formData } as Part);
    } else {
      store.addPart(formData as Part);
    }
    setIsModalOpen(false);
    refreshData();
  };

  const filteredParts = parts.filter(p => {
    const matchesSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === 'ALL' || p.category === filterCategory;
    const matchesStock = filterStock === 'ALL' ||
      (filterStock === 'Low' ? p.quantity <= p.minLevel : p.quantity > p.minLevel);
    return matchesSearch && matchesCategory && matchesStock;
  });

  const categories = [...new Set(parts.map(p => p.category))].sort();
  const activeFilterCount = [filterCategory !== 'ALL', filterStock !== 'ALL', search !== ''].filter(Boolean).length;

  const clearFilters = () => {
    setSearch('');
    setFilterCategory('ALL');
    setFilterStock('ALL');
    setCurrentPage(1);
  };

  const lowStockCount = parts.filter(p => p.quantity <= p.minLevel).length;
  const totalValue = parts.reduce((acc, p) => acc + (p.quantity * p.costPrice), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage parts, stock levels, and suppliers</p>
        </div>
        <button 
          onClick={handleCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!can(Permission.MANAGE_INVENTORY)}
          title={!can(Permission.MANAGE_INVENTORY) ? 'You do not have permission' : ''}
        >
          <Plus size={20} /> Add Part
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
           <div>
             <p className="text-sm font-medium text-gray-500">Total Items</p>
             <p className="text-2xl font-bold text-gray-900">{parts.length}</p>
           </div>
           <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
             <Package size={24} />
           </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
           <div>
             <p className="text-sm font-medium text-gray-500">Inventory Value</p>
             <p className="text-2xl font-bold text-gray-900">R{totalValue.toLocaleString()}</p>
           </div>
           <div className="p-3 bg-green-100 text-green-600 rounded-full">
             <span className="font-bold text-xl">R</span>
           </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
           <div>
             <p className="text-sm font-medium text-gray-500">Low Stock Alerts</p>
             <p className="text-2xl font-bold text-red-600">{lowStockCount}</p>
           </div>
           <div className="p-3 bg-red-100 text-red-600 rounded-full">
             <AlertTriangle size={24} />
           </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search by Name, SKU, or Category..." 
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-blue-300 outline-none transition-all"
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>
            {/* Filter Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm text-gray-500 mr-1">
                <SlidersHorizontal size={16} />
                <span className="hidden sm:inline font-medium">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="bg-blue-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{activeFilterCount}</span>
                )}
              </div>
              {/* Category Filter */}
              {categories.length > 0 && (
                <select
                  value={filterCategory}
                  onChange={e => { setFilterCategory(e.target.value); setCurrentPage(1); }}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all appearance-none cursor-pointer pr-8 bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat ${
                    filterCategory !== 'ALL'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <option value="ALL">All Categories</option>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              )}
              {/* Stock Level Filter */}
              <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 p-0.5">
                {['ALL', 'Low', 'Normal'].map(val => (
                  <button
                    key={val}
                    onClick={() => { setFilterStock(val); setCurrentPage(1); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      filterStock === val
                        ? 'bg-white shadow-sm border ' + (val === 'Low' ? 'text-red-700 border-red-200' : val === 'Normal' ? 'text-green-700 border-green-200' : 'text-blue-700 border-blue-200')
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {val === 'ALL' ? 'All Stock' : val === 'Low' ? '⚠ Low Stock' : '✓ In Stock'}
                  </button>
                ))}
              </div>
              {/* Clear Filters */}
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X size={14} /> Clear
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price (Sell)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginate<Part>(filteredParts, currentPage, pageSize).map((part) => (
                <tr key={part.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">{part.name}</span>
                      <span className="text-xs text-gray-500">{part.sku}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {part.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                     <div className="flex items-center">
                       <span className={`text-sm font-bold mr-2 ${part.quantity <= part.minLevel ? 'text-red-600' : 'text-gray-900'}`}>
                         {part.quantity}
                       </span>
                       {part.quantity <= part.minLevel && (
                         <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                           Low
                         </span>
                       )}
                     </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    R{part.sellingPrice.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {part.location}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => { setHistoryPart(part); setIsHistoryOpen(true); }}
                      className="text-gray-500 hover:text-blue-600 mr-2"
                      title="View Usage History"
                    >
                      <History size={18} />
                    </button>
                    {can(Permission.MANAGE_INVENTORY) && <>
                    <button onClick={() => handleEdit(part)} className="text-blue-600 hover:text-blue-900 mr-3">
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete part "${part.name}"? This cannot be undone.`)) {
                          store.deletePart(part.id);
                          refreshData();
                        }
                      }}
                      className="text-red-600 hover:text-red-900"
                      title="Delete part"
                    >
                      <Trash2 size={18} />
                    </button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination
        currentPage={currentPage}
        totalItems={filteredParts.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">
                {editingPart ? 'Edit Part' : 'Add New Part'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Part Name</label>
                <input required type="text" className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input required type="text" className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={formData.sku || ''} onChange={e => setFormData({...formData, sku: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input required type="text" className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={formData.category || ''} onChange={e => setFormData({...formData, category: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input required type="number" className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Level (Reorder Point)</label>
                <input required type="number" className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={formData.minLevel} onChange={e => setFormData({...formData, minLevel: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price</label>
                <input required type="number" step="0.01" className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={formData.costPrice} onChange={e => setFormData({...formData, costPrice: parseFloat(e.target.value)})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price</label>
                <input required type="number" step="0.01" className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={formData.sellingPrice} onChange={e => setFormData({...formData, sellingPrice: parseFloat(e.target.value)})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input type="text" className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={formData.location || ''} onChange={e => setFormData({...formData, location: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <input type="text" className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" value={formData.supplier || ''} onChange={e => setFormData({...formData, supplier: e.target.value})} />
              </div>
              
              <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Save Part</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Usage History Modal */}
      {isHistoryOpen && historyPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">
                Usage History: {historyPart.name}
              </h3>
              <button onClick={() => setIsHistoryOpen(false)} className="text-gray-400 hover:text-gray-600">
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <div className="p-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Job ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Used In</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {jobs
                    .filter(job => (job.partsUsed || []).some(pu => pu.partId === historyPart.id))
                    .flatMap(job => (job.partsUsed || [])
                      .filter(pu => pu.partId === historyPart.id)
                      .map(pu => ({ job, pu })))
                    .map(({ job, pu }, idx) => (
                      <tr key={job.id + '-' + idx}>
                        <td className="px-4 py-2 font-mono text-blue-700">{job.id}</td>
                        <td className="px-4 py-2 text-sm">{job.createdAt ? new Date(job.createdAt).toLocaleDateString() : '-'}</td>
                        <td className="px-4 py-2 text-sm">{pu.quantity}</td>
                        <td className="px-4 py-2 text-sm">{job.description || '-'}</td>
                      </tr>
                    ))
                  }
                  {/* If no usage */}
                  {jobs.filter(job => (job.partsUsed || []).some(pu => pu.partId === historyPart.id)).length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-gray-400">No usage history for this part.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};