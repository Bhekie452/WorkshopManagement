/**
 * RBAC Service Tests
 */

import { describe, it, expect } from 'vitest';
import { UserRole } from '../types';
import {
  Permission,
  hasPermission,
  getPermissions,
  ROLE_LABELS,
  ROLE_COLORS,
  ROLE_DESCRIPTIONS,
} from '../services/rbac';

describe('RBAC Service', () => {
  describe('hasPermission', () => {
    it('SYSTEM_ADMIN has all permissions', () => {
      expect(hasPermission(UserRole.SYSTEM_ADMIN, Permission.MANAGE_SYSTEM)).toBe(true);
      expect(hasPermission(UserRole.SYSTEM_ADMIN, Permission.VIEW_JOBS)).toBe(true);
      expect(hasPermission(UserRole.SYSTEM_ADMIN, Permission.MANAGE_TEAM)).toBe(true);
    });

    it('ADMIN has all permissions except MANAGE_SYSTEM', () => {
      expect(hasPermission(UserRole.ADMIN, Permission.MANAGE_SYSTEM)).toBe(false);
      expect(hasPermission(UserRole.ADMIN, Permission.VIEW_JOBS)).toBe(true);
      expect(hasPermission(UserRole.ADMIN, Permission.MANAGE_TEAM)).toBe(true);
    });

    it('TECHNICIAN has limited permissions', () => {
      expect(hasPermission(UserRole.TECHNICIAN, Permission.VIEW_JOBS)).toBe(true);
      expect(hasPermission(UserRole.TECHNICIAN, Permission.CREATE_JOB)).toBe(true);
      expect(hasPermission(UserRole.TECHNICIAN, Permission.DELETE_JOB)).toBe(false);
      expect(hasPermission(UserRole.TECHNICIAN, Permission.MANAGE_INVOICES)).toBe(false);
      expect(hasPermission(UserRole.TECHNICIAN, Permission.RUN_DIAGNOSTICS)).toBe(true);
    });

    it('RECEPTIONIST can manage customers and scheduling', () => {
      expect(hasPermission(UserRole.RECEPTIONIST, Permission.MANAGE_CUSTOMERS)).toBe(true);
      expect(hasPermission(UserRole.RECEPTIONIST, Permission.MANAGE_SCHEDULE)).toBe(true);
      expect(hasPermission(UserRole.RECEPTIONIST, Permission.DELETE_JOB)).toBe(false);
      expect(hasPermission(UserRole.RECEPTIONIST, Permission.RUN_DIAGNOSTICS)).toBe(false);
    });

    it('MANAGER has most permissions but cannot manage team', () => {
      expect(hasPermission(UserRole.MANAGER, Permission.DELETE_JOB)).toBe(true);
      expect(hasPermission(UserRole.MANAGER, Permission.MANAGE_INVENTORY)).toBe(true);
      expect(hasPermission(UserRole.MANAGER, Permission.MANAGE_TEAM)).toBe(false);
    });
  });

  describe('getPermissions', () => {
    it('returns array of permissions for role', () => {
      const techPermissions = getPermissions(UserRole.TECHNICIAN);
      expect(Array.isArray(techPermissions)).toBe(true);
      expect(techPermissions.length).toBeGreaterThan(0);
      expect(techPermissions).toContain(Permission.VIEW_JOBS);
    });

    it('SYSTEM_ADMIN has most permissions', () => {
      const adminPerms = getPermissions(UserRole.SYSTEM_ADMIN);
      const totalPerms = Object.values(Permission).length;
      expect(adminPerms.length).toBe(totalPerms);
    });

    it('returns empty array for unknown role', () => {
      const perms = getPermissions('UNKNOWN_ROLE' as UserRole);
      expect(perms).toEqual([]);
    });
  });

  describe('Role metadata', () => {
    it('ROLE_LABELS has entry for every role', () => {
      expect(ROLE_LABELS[UserRole.SYSTEM_ADMIN]).toBe('System Admin');
      expect(ROLE_LABELS[UserRole.ADMIN]).toBe('Admin');
      expect(ROLE_LABELS[UserRole.MANAGER]).toBe('Manager');
      expect(ROLE_LABELS[UserRole.TECHNICIAN]).toBe('Technician');
      expect(ROLE_LABELS[UserRole.RECEPTIONIST]).toBe('Receptionist');
    });

    it('ROLE_COLORS has styling for every role', () => {
      Object.values(UserRole).forEach(role => {
        const colors = ROLE_COLORS[role];
        expect(colors).toBeDefined();
        expect(colors.bg).toBeDefined();
        expect(colors.text).toBeDefined();
        expect(colors.border).toBeDefined();
      });
    });

    it('ROLE_DESCRIPTIONS provides description for every role', () => {
      Object.values(UserRole).forEach(role => {
        expect(ROLE_DESCRIPTIONS[role]).toBeDefined();
        expect(ROLE_DESCRIPTIONS[role].length).toBeGreaterThan(10);
      });
    });
  });
});
