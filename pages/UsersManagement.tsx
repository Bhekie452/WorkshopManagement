import React, { useState, useEffect } from 'react';
import { Users as UsersIcon, Plus, Search, Edit2, Trash2, Eye, Shield, Mail, Phone, Building2, CheckCircle, XCircle } from 'lucide-react';
import { FirestoreService } from '../services/firestore';
import { User, UserRole, Company } from '../types';

interface UsersManagementProps {
  currentUser: User;
}

const UsersManagement: React.FC<UsersManagementProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    email: '',
    phone: '',
    role: UserRole.TECHNICIAN,
    companyId: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersData, companiesData] = await Promise.all([
        FirestoreService.getAll<User>('users'),
        FirestoreService.getAll<Company>('companies')
      ]);
      setUsers(usersData);
      setCompanies(companiesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      companyId: user.companyId || ''
    });
    setShowModal(true);
  };

  const handleView = (user: User) => {
    setSelectedUser(user);
    setShowViewModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedUser) {
        await FirestoreService.update('users', selectedUser.id, {
          ...formData,
          avatar: formData.name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=random` : selectedUser.avatar
        });
      }
      setShowModal(false);
      setSelectedUser(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const handleDelete = async (user: User) => {
    if (user.role === UserRole.SYSTEM_ADMIN) {
      alert('Cannot delete System Admin user');
      return;
    }
    if (confirm(`Are you sure you want to delete "${user.name}"? This action cannot be undone.`)) {
      try {
        await FirestoreService.delete('users', user.id);
        loadData();
      } catch (error) {
        console.error('Error deleting user:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: UserRole.TECHNICIAN,
      companyId: ''
    });
  };

  const getCompanyName = (companyId?: string) => {
    if (!companyId) return 'Unassigned';
    const company = companies.find(c => c.id === companyId);
    return company?.name || 'Unknown';
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const roleColors: Record<string, string> = {
    SYSTEM_ADMIN: 'bg-red-500 text-white',
    ADMIN: 'bg-purple-500 text-white',
    MANAGER: 'bg-blue-500 text-white',
    TECHNICIAN: 'bg-green-500 text-white',
    RECEPTIONIST: 'bg-yellow-500 text-black'
  };

  const roleStats = {
    SYSTEM_ADMIN: users.filter(u => u.role === UserRole.SYSTEM_ADMIN).length,
    ADMIN: users.filter(u => u.role === UserRole.ADMIN).length,
    MANAGER: users.filter(u => u.role === UserRole.MANAGER).length,
    TECHNICIAN: users.filter(u => u.role === UserRole.TECHNICIAN).length,
    RECEPTIONIST: users.filter(u => u.role === UserRole.RECEPTIONIST).length
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
            <UsersIcon className="w-7 h-7 text-blue-600" />
            Users Management
          </h1>
          <p className="text-gray-600 mt-1">View and manage all system users</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Shield className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-gray-500 text-xs">System Admin</p>
              <p className="text-xl font-bold text-gray-900">{roleStats.SYSTEM_ADMIN}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-gray-500 text-xs">Admins</p>
              <p className="text-xl font-bold text-gray-900">{roleStats.ADMIN}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UsersIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-gray-500 text-xs">Managers</p>
              <p className="text-xl font-bold text-gray-900">{roleStats.MANAGER}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <UsersIcon className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-gray-500 text-xs">Technicians</p>
              <p className="text-xl font-bold text-gray-900">{roleStats.TECHNICIAN}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <UsersIcon className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-gray-500 text-xs">Receptionists</p>
              <p className="text-xl font-bold text-gray-900">{roleStats.RECEPTIONIST}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        >
          <option value="all">All Roles</option>
          <option value="SYSTEM_ADMIN">System Admin</option>
          <option value="ADMIN">Admin</option>
          <option value="MANAGER">Manager</option>
          <option value="TECHNICIAN">Technician</option>
          <option value="RECEPTIONIST">Receptionist</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-4 px-6 text-gray-700 font-medium">User</th>
                <th className="text-left py-4 px-6 text-gray-700 font-medium">Contact</th>
                <th className="text-left py-4 px-6 text-gray-700 font-medium">Role</th>
                <th className="text-left py-4 px-6 text-gray-700 font-medium">Company</th>
                <th className="text-left py-4 px-6 text-gray-700 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    <UsersIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No users found</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <img
                          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`}
                          alt={user.name}
                          className="w-10 h-10 rounded-full"
                        />
                        <div>
                          <p className="text-gray-900 font-medium">{user.name}</p>
                          <p className="text-gray-500 text-sm">{user.id.substring(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-1">
                        <p className="text-gray-700 text-sm flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {user.email}
                        </p>
                        {user.phone && (
                          <p className="text-gray-500 text-sm flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {user.phone}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${roleColors[user.role] || 'bg-gray-500 text-white'}`}>
                        {user.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700 text-sm">{getCompanyName(user.companyId)}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleView(user)}
                          className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(user)}
                          className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {user.role !== UserRole.SYSTEM_ADMIN && (
                          <button
                            onClick={() => handleDelete(user)}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Edit User</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-gray-700 text-sm mb-2">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm mb-2">Email</label>
                <input
                  type="email"
                  disabled
                  value={formData.email}
                  className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>
              <div>
                <label className="block text-gray-700 text-sm mb-2">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm mb-2">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  disabled={selectedUser.role === UserRole.SYSTEM_ADMIN}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="SYSTEM_ADMIN">System Admin</option>
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="TECHNICIAN">Technician</option>
                  <option value="RECEPTIONIST">Receptionist</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-700 text-sm mb-2">Company</label>
                <select
                  value={formData.companyId}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Unassigned</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setSelectedUser(null); resetForm(); }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">User Details</h2>
              <button
                onClick={() => { setShowViewModal(false); setSelectedUser(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <img
                  src={selectedUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.name)}&background=random`}
                  alt={selectedUser.name}
                  className="w-20 h-20 rounded-full"
                />
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedUser.name}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${roleColors[selectedUser.role] || 'bg-gray-500 text-white'}`}>
                    {selectedUser.role.replace('_', ' ')}
                  </span>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-gray-500 text-sm mb-1">Email</p>
                  <p className="text-gray-900 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-500" />
                    {selectedUser.email}
                  </p>
                </div>
                {selectedUser.phone && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-gray-500 text-sm mb-1">Phone</p>
                    <p className="text-gray-900 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-green-500" />
                      {selectedUser.phone}
                    </p>
                  </div>
                )}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-gray-500 text-sm mb-1">Company</p>
                  <p className="text-gray-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-purple-500" />
                    {getCompanyName(selectedUser.companyId)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-gray-500 text-sm mb-1">User ID</p>
                  <p className="text-gray-900 font-mono text-sm">{selectedUser.id}</p>
                </div>
                {selectedUser.permissions && selectedUser.permissions.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-gray-500 text-sm mb-2">Permissions</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedUser.permissions.map((perm, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs">
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {selectedUser.createdAt && (
                <div className="text-xs text-gray-500">
                  <p>Created: {new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManagement;
