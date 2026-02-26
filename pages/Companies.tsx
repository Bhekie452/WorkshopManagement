import React, { useState, useEffect } from 'react';
import { Building2, Plus, Search, Edit2, Trash2, Eye, Users, CheckCircle, XCircle, Mail, Phone, MapPin } from 'lucide-react';
import { FirestoreService } from '../services/firestore';
import { Company, User } from '../types';

interface CompaniesProps {
  currentUser: User;
}

const Companies: React.FC<CompaniesProps> = ({ currentUser }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState<Partial<Company>>({
    name: '',
    email: '',
    phone: '',
    address: '',
    industry: '',
    subscription: 'free',
    maxUsers: 5,
    isActive: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [companiesData, usersData] = await Promise.all([
        FirestoreService.getAll<Company>('companies'),
        FirestoreService.getAll<User>('users')
      ]);
      setCompanies(companiesData);
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedCompany) {
        await FirestoreService.update('companies', selectedCompany.id, {
          ...formData,
          updatedAt: new Date().toISOString()
        });
      } else {
        await FirestoreService.create('companies', {
          ...formData,
          createdAt: new Date().toISOString(),
          isActive: true
        });
      }
      setShowModal(false);
      setSelectedCompany(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving company:', error);
    }
  };

  const handleEdit = (company: Company) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name,
      email: company.email,
      phone: company.phone,
      address: company.address,
      industry: company.industry || '',
      subscription: company.subscription || 'free',
      maxUsers: company.maxUsers || 5,
      isActive: company.isActive
    });
    setShowModal(true);
  };

  const handleView = (company: Company) => {
    setSelectedCompany(company);
    setShowViewModal(true);
  };

  const handleDelete = async (company: Company) => {
    if (confirm(`Are you sure you want to delete "${company.name}"? This action cannot be undone.`)) {
      try {
        await FirestoreService.delete('companies', company.id);
        loadData();
      } catch (error) {
        console.error('Error deleting company:', error);
      }
    }
  };

  const toggleStatus = async (company: Company) => {
    try {
      await FirestoreService.update('companies', company.id, {
        isActive: !company.isActive,
        updatedAt: new Date().toISOString()
      });
      loadData();
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      industry: '',
      subscription: 'free',
      maxUsers: 5,
      isActive: true
    });
  };

  const getCompanyUsers = (companyId: string) => {
    return users.filter(u => u.companyId === companyId);
  };

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const subscriptionColors: Record<string, string> = {
    free: 'bg-gray-500',
    basic: 'bg-blue-500',
    premium: 'bg-purple-500',
    enterprise: 'bg-yellow-500'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-blue-600" />
            Companies Management
          </h1>
          <p className="text-gray-600 mt-1">Manage registered companies and their subscriptions</p>
        </div>
        <button
          onClick={() => { resetForm(); setSelectedCompany(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Register Company
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Total Companies</p>
              <p className="text-2xl font-bold text-gray-900">{companies.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Active</p>
              <p className="text-2xl font-bold text-gray-900">{companies.filter(c => c.isActive).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Inactive</p>
              <p className="text-2xl font-bold text-gray-900">{companies.filter(c => !c.isActive).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-gray-500 text-sm">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{users.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search companies..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        />
      </div>

      {/* Companies Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-4 px-6 text-gray-700 font-medium">Company</th>
                <th className="text-left py-4 px-6 text-gray-700 font-medium">Contact</th>
                <th className="text-left py-4 px-6 text-gray-700 font-medium">Subscription</th>
                <th className="text-left py-4 px-6 text-gray-700 font-medium">Users</th>
                <th className="text-left py-4 px-6 text-gray-700 font-medium">Status</th>
                <th className="text-left py-4 px-6 text-gray-700 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No companies found</p>
                    <p className="text-sm mt-1">Register your first company to get started</p>
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((company) => (
                  <tr key={company.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                          <span className="text-white font-bold">{company.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-gray-900 font-medium">{company.name}</p>
                          <p className="text-gray-500 text-sm">{company.industry || 'Workshop'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-1">
                        <p className="text-gray-700 text-sm flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {company.email}
                        </p>
                        <p className="text-gray-500 text-sm flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {company.phone}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${subscriptionColors[company.subscription || 'free']}`}>
                        {(company.subscription || 'free').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900">{getCompanyUsers(company.id).length}</span>
                        <span className="text-gray-500">/ {company.maxUsers || 5}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => toggleStatus(company)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          company.isActive
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {company.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleView(company)}
                          className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(company)}
                          className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(company)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedCompany ? 'Edit Company' : 'Register New Company'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-gray-700 text-sm mb-2">Company Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter company name"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm mb-2">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="company@example.com"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm mb-2">Phone *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+27 12 345 6789"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm mb-2">Address *</label>
                <textarea
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter full address"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm mb-2">Industry</label>
                <input
                  type="text"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Auto Repair, Fleet Management"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 text-sm mb-2">Subscription</label>
                  <select
                    value={formData.subscription}
                    onChange={(e) => setFormData({ ...formData, subscription: e.target.value as any })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="free">Free</option>
                    <option value="basic">Basic</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 text-sm mb-2">Max Users</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.maxUsers}
                    onChange={(e) => setFormData({ ...formData, maxUsers: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 bg-gray-50 text-blue-500 focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-gray-700">Company is active</label>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setSelectedCompany(null); resetForm(); }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {selectedCompany ? 'Update Company' : 'Register Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedCompany && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Company Details</h2>
              <button
                onClick={() => { setShowViewModal(false); setSelectedCompany(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">{selectedCompany.name.charAt(0)}</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedCompany.name}</h3>
                  <p className="text-gray-500">{selectedCompany.industry || 'Workshop'}</p>
                </div>
                <span className={`ml-auto px-3 py-1 rounded-full text-sm font-medium ${
                  selectedCompany.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {selectedCompany.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-gray-500 text-sm mb-1">Email</p>
                  <p className="text-gray-900 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-600" />
                    {selectedCompany.email}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-gray-500 text-sm mb-1">Phone</p>
                  <p className="text-gray-900 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-green-600" />
                    {selectedCompany.phone}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 col-span-2">
                  <p className="text-gray-500 text-sm mb-1">Address</p>
                  <p className="text-gray-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-red-600" />
                    {selectedCompany.address}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-gray-500 text-sm mb-1">Subscription</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${subscriptionColors[selectedCompany.subscription || 'free']}`}>
                    {(selectedCompany.subscription || 'free').toUpperCase()}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-gray-500 text-sm mb-1">Users</p>
                  <p className="text-gray-900">{getCompanyUsers(selectedCompany.id).length} / {selectedCompany.maxUsers || 5}</p>
                </div>
              </div>

              <div>
                <h4 className="text-gray-900 font-medium mb-3">Company Users</h4>
                <div className="space-y-2">
                  {getCompanyUsers(selectedCompany.id).length === 0 ? (
                    <p className="text-gray-500 text-sm">No users assigned to this company</p>
                  ) : (
                    getCompanyUsers(selectedCompany.id).map(user => (
                      <div key={user.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                        <img
                          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`}
                          alt={user.name}
                          className="w-8 h-8 rounded-full"
                        />
                        <div className="flex-1">
                          <p className="text-gray-900 text-sm">{user.name}</p>
                          <p className="text-gray-500 text-xs">{user.email}</p>
                        </div>
                        <span className="text-xs text-gray-600 bg-gray-200 px-2 py-1 rounded">{user.role}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-500">
                <p>Created: {new Date(selectedCompany.createdAt).toLocaleDateString()}</p>
                {selectedCompany.updatedAt && (
                  <p>Last Updated: {new Date(selectedCompany.updatedAt).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Companies;
