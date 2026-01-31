import { UserRole } from '@/lib/supabase/client';

export const canCreate = (role: UserRole): boolean => {
  return ['ADMIN', 'MANAGER', 'SALES_REP'].includes(role);
};

export const canUpdate = (role: UserRole, ownerId?: string, userId?: string): boolean => {
  if (role === 'ADMIN' || role === 'MANAGER') return true;
  if (role === 'SALES_REP' && ownerId === userId) return true;
  return false;
};

export const canDelete = (role: UserRole): boolean => {
  return role === 'ADMIN';
};

export const canViewAll = (role: UserRole): boolean => {
  return ['ADMIN', 'MANAGER'].includes(role);
};

export const canReassignOwner = (role: UserRole): boolean => {
  return ['ADMIN', 'MANAGER'].includes(role);
};

export const canManageUsers = (role: UserRole): boolean => {
  return role === 'ADMIN';
};

export const isReadOnly = (role: UserRole): boolean => {
  return role === 'READ_ONLY';
};
