import React, { useState, useEffect } from 'react';
import { store } from '../services/store';
import { Part } from '../types';
import { Plus, Search, AlertTriangle, Package, Edit, Trash2 } from 'lucide-react';

export const Inventory: React.FC = () => {
  const [parts, setParts] = useState<Part[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [formData, setFormData] = useState<Partial<Part>>({});

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setParts(store.getParts());
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

  const filteredParts = parts.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

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
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
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
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search by Name, SKU, or Category..." 
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
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
              {filteredParts.map((part) => (
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
    </div>
  );
};