/**
 * Role-Based Access Control (RBAC) Service
 * Defines permissions per role and provides helper utilities.
 */
import { UserRole } from '../types';

// ── Permission identifiers ──────────────────────────────────────
export enum Permission {
  // Jobs
  VIEW_JOBS        = 'view_jobs',
  CREATE_JOB       = 'create_job',
  EDIT_JOB         = 'edit_job',
  DELETE_JOB       = 'delete_job',

  // Customers
  VIEW_CUSTOMERS   = 'view_customers',
  MANAGE_CUSTOMERS = 'manage_customers',  // create / edit / delete

  // Vehicles
  VIEW_VEHICLES    = 'view_vehicles',
  MANAGE_VEHICLES  = 'manage_vehicles',

  // Inventory
  VIEW_INVENTORY   = 'view_inventory',
  MANAGE_INVENTORY = 'manage_inventory',

  // Invoices / Quotes
  VIEW_INVOICES    = 'view_invoices',
  MANAGE_INVOICES  = 'manage_invoices',

  // Diagnostics
  RUN_DIAGNOSTICS  = 'run_diagnostics',

  // Analytics / Reports
  VIEW_REPORTS     = 'view_reports',

  // Schedule
  VIEW_SCHEDULE    = 'view_schedule',
  MANAGE_SCHEDULE  = 'manage_schedule',

  // EV Fleet
  VIEW_EV_FLEET    = 'view_ev_fleet',

  // Settings
  VIEW_SETTINGS    = 'view_settings',
  MANAGE_TEAM      = 'manage_team',  // change other users' roles
}

// ── Role → Permission mapping ───────────────────────────────────
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: Object.values(Permission),   // all permissions

  [UserRole.MANAGER]: [
    Permission.VIEW_JOBS,       Permission.CREATE_JOB,    Permission.EDIT_JOB,   Permission.DELETE_JOB,
    Permission.VIEW_CUSTOMERS,  Permission.MANAGE_CUSTOMERS,
    Permission.VIEW_VEHICLES,   Permission.MANAGE_VEHICLES,
    Permission.VIEW_INVENTORY,  Permission.MANAGE_INVENTORY,
    Permission.VIEW_INVOICES,   Permission.MANAGE_INVOICES,
    Permission.RUN_DIAGNOSTICS,
    Permission.VIEW_REPORTS,
    Permission.VIEW_SCHEDULE,   Permission.MANAGE_SCHEDULE,
    Permission.VIEW_EV_FLEET,
    Permission.VIEW_SETTINGS,
    // Manager cannot manage_team (change roles)
  ],

  [UserRole.TECHNICIAN]: [
    Permission.VIEW_JOBS,       Permission.CREATE_JOB,    Permission.EDIT_JOB,
    Permission.VIEW_CUSTOMERS,
    Permission.VIEW_VEHICLES,
    Permission.VIEW_INVENTORY,
    Permission.RUN_DIAGNOSTICS,
    Permission.VIEW_SCHEDULE,
    Permission.VIEW_SETTINGS,
  ],

  [UserRole.RECEPTIONIST]: [
    Permission.VIEW_JOBS,       Permission.CREATE_JOB,
    Permission.VIEW_CUSTOMERS,  Permission.MANAGE_CUSTOMERS,
    Permission.VIEW_VEHICLES,
    Permission.VIEW_INVOICES,   Permission.MANAGE_INVOICES,
    Permission.VIEW_SCHEDULE,   Permission.MANAGE_SCHEDULE,
    Permission.VIEW_SETTINGS,
  ],
};

// ── Helper functions ────────────────────────────────────────────
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/** Human-readable label for each role */
export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]:        'Admin',
  [UserRole.MANAGER]:      'Manager',
  [UserRole.TECHNICIAN]:   'Technician',
  [UserRole.RECEPTIONIST]: 'Receptionist',
};

/** Color scheme for role badges */
export const ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  [UserRole.ADMIN]:        { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200' },
  [UserRole.MANAGER]:      { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  [UserRole.TECHNICIAN]:   { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200' },
  [UserRole.RECEPTIONIST]: { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200' },
};

/** Description of what each role can do (for UI tooltips) */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  [UserRole.ADMIN]:        'Full access to all features, team management, and system settings.',
  [UserRole.MANAGER]:      'Can manage jobs, customers, inventory, invoices, and view reports.',
  [UserRole.TECHNICIAN]:   'Can view and work on jobs, run diagnostics, and view inventory.',
  [UserRole.RECEPTIONIST]: 'Can manage customers, create jobs, handle invoices and scheduling.',
};
