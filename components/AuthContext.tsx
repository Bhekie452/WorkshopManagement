/**
 * Auth Context – provides the current user & permission helpers app-wide.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { User, UserRole } from '../types';
import { Permission, hasPermission as checkPermission } from '../services/rbac';

interface AuthContextValue {
  user: User | null;
  /** Check if current user has a specific permission */
  can: (permission: Permission) => boolean;
  /** Check if current user has ANY of the given permissions */
  canAny: (...permissions: Permission[]) => boolean;
  /** Check if current user has ALL of the given permissions */
  canAll: (...permissions: Permission[]) => boolean;
  /** Check if user's role is one of the provided roles */
  isRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  can: () => false,
  canAny: () => false,
  canAll: () => false,
  isRole: () => false,
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  user: User | null;
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ user, children }) => {
  const value = useMemo<AuthContextValue>(() => {
    const role = user?.role ?? UserRole.TECHNICIAN;

    return {
      user,
      can: (perm: Permission) => !!user && checkPermission(role, perm),
      canAny: (...perms: Permission[]) => !!user && perms.some(p => checkPermission(role, p)),
      canAll: (...perms: Permission[]) => !!user && perms.every(p => checkPermission(role, p)),
      isRole: (...roles: UserRole[]) => !!user && roles.includes(role),
    };
  }, [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Gate component – renders children only when the user has the permission.
 * Optionally renders a fallback.
 */
export const PermissionGate: React.FC<{
  permission: Permission;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}> = ({ permission, fallback = null, children }) => {
  const { can } = useAuth();
  return can(permission) ? <>{children}</> : <>{fallback}</>;
};
