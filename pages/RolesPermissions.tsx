import React, { useState } from 'react';
import { Shield, Users, Eye, Edit2, Trash2, FileText, Calendar, Car, Package, Settings, BarChart3, Wrench, CheckCircle2 } from 'lucide-react';
import { UserRole, Permission, Role } from '../types';

const RolesPermissions: React.FC = () => {
  // Define all available permissions
  const allPermissions: Permission[] = [
    // Dashboard
    { id: 'dashboard.view', name: 'View Dashboard', description: 'Access main dashboard', category: 'Dashboard' },
    { id: 'dashboard.analytics', name: 'View Analytics', description: 'Access analytics and reports', category: 'Dashboard' },
    
    // Jobs
    { id: 'jobs.view', name: 'View Jobs', description: 'View job listings', category: 'Jobs' },
    { id: 'jobs.create', name: 'Create Jobs', description: 'Create new jobs', category: 'Jobs' },
    { id: 'jobs.edit', name: 'Edit Jobs', description: 'Modify existing jobs', category: 'Jobs' },
    { id: 'jobs.delete', name: 'Delete Jobs', description: 'Remove jobs', category: 'Jobs' },
    { id: 'jobs.assign', name: 'Assign Jobs', description: 'Assign jobs to technicians', category: 'Jobs' },
    
    // Schedule
    { id: 'schedule.view', name: 'View Schedule', description: 'View appointments', category: 'Schedule' },
    { id: 'schedule.create', name: 'Create Appointments', description: 'Book appointments', category: 'Schedule' },
    { id: 'schedule.edit', name: 'Edit Appointments', description: 'Modify appointments', category: 'Schedule' },
    { id: 'schedule.delete', name: 'Delete Appointments', description: 'Cancel appointments', category: 'Schedule' },
    
    // Customers
    { id: 'customers.view', name: 'View Customers', description: 'View customer list', category: 'Customers' },
    { id: 'customers.create', name: 'Create Customers', description: 'Add new customers', category: 'Customers' },
    { id: 'customers.edit', name: 'Edit Customers', description: 'Modify customer details', category: 'Customers' },
    { id: 'customers.delete', name: 'Delete Customers', description: 'Remove customers', category: 'Customers' },
    
    // Vehicles
    { id: 'vehicles.view', name: 'View Vehicles', description: 'View vehicle records', category: 'Vehicles' },
    { id: 'vehicles.create', name: 'Create Vehicles', description: 'Add new vehicles', category: 'Vehicles' },
    { id: 'vehicles.edit', name: 'Edit Vehicles', description: 'Modify vehicle details', category: 'Vehicles' },
    { id: 'vehicles.delete', name: 'Delete Vehicles', description: 'Remove vehicles', category: 'Vehicles' },
    
    // Inventory
    { id: 'inventory.view', name: 'View Inventory', description: 'View parts inventory', category: 'Inventory' },
    { id: 'inventory.create', name: 'Add Parts', description: 'Add new parts', category: 'Inventory' },
    { id: 'inventory.edit', name: 'Edit Parts', description: 'Modify part details', category: 'Inventory' },
    { id: 'inventory.delete', name: 'Delete Parts', description: 'Remove parts', category: 'Inventory' },
    { id: 'inventory.adjust', name: 'Adjust Stock', description: 'Modify stock levels', category: 'Inventory' },
    
    // Invoices
    { id: 'invoices.view', name: 'View Invoices', description: 'View invoices', category: 'Invoices' },
    { id: 'invoices.create', name: 'Create Invoices', description: 'Generate invoices', category: 'Invoices' },
    { id: 'invoices.edit', name: 'Edit Invoices', description: 'Modify invoices', category: 'Invoices' },
    { id: 'invoices.delete', name: 'Delete Invoices', description: 'Remove invoices', category: 'Invoices' },
    { id: 'invoices.void', name: 'Void Invoices', description: 'Void invoices', category: 'Invoices' },
    
    // Settings
    { id: 'settings.view', name: 'View Settings', description: 'View system settings', category: 'Settings' },
    { id: 'settings.edit', name: 'Edit Settings', description: 'Modify settings', category: 'Settings' },
    
    // Admin
    { id: 'admin.users', name: 'Manage Users', description: 'Manage user accounts', category: 'Administration' },
    { id: 'admin.roles', name: 'Manage Roles', description: 'Manage roles and permissions', category: 'Administration' },
    { id: 'admin.companies', name: 'Manage Companies', description: 'Manage company accounts', category: 'Administration' },
    { id: 'admin.billing', name: 'Manage Billing', description: 'Access billing information', category: 'Administration' },
  ];

  // Define roles with their permissions
  const roles: Role[] = [
    {
      id: 'SYSTEM_ADMIN',
      name: 'System Administrator',
      description: 'Full access to all system features including multi-company management',
      permissions: allPermissions.map(p => p.id),
      color: '#ef4444',
      isSystem: true
    },
    {
      id: 'ADMIN',
      name: 'Company Administrator',
      description: 'Full access within their company',
      permissions: allPermissions.filter(p => !p.category.includes('Administration') || p.id === 'admin.users').map(p => p.id),
      color: '#8b5cf6',
      isSystem: true
    },
    {
      id: 'MANAGER',
      name: 'Manager',
      description: 'Manage operations, staff scheduling, and view reports',
      permissions: [
        'dashboard.view', 'dashboard.analytics',
        'jobs.view', 'jobs.create', 'jobs.edit', 'jobs.assign',
        'schedule.view', 'schedule.create', 'schedule.edit', 'schedule.delete',
        'customers.view', 'customers.create', 'customers.edit',
        'vehicles.view', 'vehicles.create', 'vehicles.edit',
        'inventory.view', 'inventory.adjust',
        'invoices.view', 'invoices.create', 'invoices.edit',
        'settings.view'
      ],
      color: '#3b82f6',
      isSystem: true
    },
    {
      id: 'TECHNICIAN',
      name: 'Technician',
      description: 'View assigned jobs and update job status',
      permissions: [
        'dashboard.view',
        'jobs.view', 'jobs.edit',
        'schedule.view',
        'customers.view',
        'vehicles.view',
        'inventory.view'
      ],
      color: '#22c55e',
      isSystem: true
    },
    {
      id: 'RECEPTIONIST',
      name: 'Receptionist',
      description: 'Manage appointments and customer interactions',
      permissions: [
        'dashboard.view',
        'jobs.view', 'jobs.create',
        'schedule.view', 'schedule.create', 'schedule.edit', 'schedule.delete',
        'customers.view', 'customers.create', 'customers.edit',
        'vehicles.view', 'vehicles.create', 'vehicles.edit',
        'invoices.view', 'invoices.create'
      ],
      color: '#eab308',
      isSystem: true
    }
  ];

  const [selectedRole, setSelectedRole] = useState<Role>(roles[0]);

  const categories = [...new Set(allPermissions.map(p => p.category))];

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      'Dashboard': <BarChart3 className="w-5 h-5" />,
      'Jobs': <Wrench className="w-5 h-5" />,
      'Schedule': <Calendar className="w-5 h-5" />,
      'Customers': <Users className="w-5 h-5" />,
      'Vehicles': <Car className="w-5 h-5" />,
      'Inventory': <Package className="w-5 h-5" />,
      'Invoices': <FileText className="w-5 h-5" />,
      'Settings': <Settings className="w-5 h-5" />,
      'Administration': <Shield className="w-5 h-5" />
    };
    return icons[category] || <Shield className="w-5 h-5" />;
  };

  const hasPermission = (role: Role, permissionId: string) => {
    return role.permissions.includes(permissionId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-7 h-7 text-purple-600" />
          Roles & Permissions
        </h1>
        <p className="text-gray-600 mt-1">View system roles and their associated permissions</p>
      </div>

      {/* Roles Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {roles.map(role => (
          <button
            key={role.id}
            onClick={() => setSelectedRole(role)}
            className={`p-4 rounded-xl border transition-all text-left ${
              selectedRole.id === role.id
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: role.color }}
              />
              <span className="font-medium text-gray-900">{role.name}</span>
            </div>
            <p className="text-gray-500 text-xs">{role.permissions.length} permissions</p>
          </button>
        ))}
      </div>

      {/* Selected Role Details */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${selectedRole.color}20` }}
            >
              <Shield className="w-6 h-6" style={{ color: selectedRole.color }} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{selectedRole.name}</h2>
              <p className="text-gray-500 text-sm">{selectedRole.description}</p>
            </div>
            {selectedRole.isSystem && (
              <span className="ml-auto px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-xs">
                System Role
              </span>
            )}
          </div>
        </div>

        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Permissions by Category</h3>
          <div className="space-y-6">
            {categories.map(category => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-gray-600">{getCategoryIcon(category)}</div>
                  <h4 className="font-medium text-gray-800">{category}</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ml-7">
                  {allPermissions
                    .filter(p => p.category === category)
                    .map(permission => {
                      const has = hasPermission(selectedRole, permission.id);
                      return (
                        <div
                          key={permission.id}
                          className={`p-3 rounded-lg border ${
                            has
                              ? 'bg-white border-gray-300'
                              : 'bg-gray-100 border-gray-200 opacity-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {has ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-gray-400 flex-shrink-0" />
                            )}
                            <span className={`text-sm ${has ? 'text-gray-900' : 'text-gray-500'}`}>
                              {permission.name}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 ml-6">{permission.description}</p>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Permissions Matrix */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900">Permissions Matrix</h2>
          <p className="text-gray-500 text-sm">Compare permissions across all roles</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 text-gray-700 font-medium sticky left-0 bg-gray-50">Permission</th>
                {roles.map(role => (
                  <th key={role.id} className="py-3 px-4 text-center min-w-[100px]">
                    <div className="flex items-center justify-center gap-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: role.color }}
                      />
                      <span className="text-gray-700 text-sm">{role.id === 'SYSTEM_ADMIN' ? 'SysAdmin' : role.name.split(' ')[0]}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map(category => (
                <React.Fragment key={category}>
                  <tr className="bg-gray-100">
                    <td colSpan={roles.length + 1} className="py-2 px-4 text-gray-600 text-xs font-medium uppercase tracking-wider">
                      {category}
                    </td>
                  </tr>
                  {allPermissions
                    .filter(p => p.category === category)
                    .map(permission => (
                      <tr key={permission.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-4 text-gray-800 text-sm sticky left-0 bg-white">
                          {permission.name}
                        </td>
                        {roles.map(role => (
                          <td key={role.id} className="py-2 px-4 text-center bg-white">
                            {hasPermission(role, permission.id) ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
                            ) : (
                              <div className="w-5 h-5 rounded-full border border-gray-300 mx-auto" />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RolesPermissions;
