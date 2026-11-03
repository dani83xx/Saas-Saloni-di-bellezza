import type { SalonAccessRole, StaffAccessRole } from '../types';

/** owner resta il default: le righe vecchie di salon_users spesso non hanno ruolo. */
export function normalizeAccessRole(role: string | null | undefined): SalonAccessRole {
  if (role === 'admin') return 'admin';
  if (role === 'operator' || role === 'staff') return 'operator';
  return 'owner';
}

export function normalizeStaffAccessRole(role: string | null | undefined): StaffAccessRole {
  return role === 'admin' ? 'admin' : 'operator';
}

export function accessRoleLabel(role: SalonAccessRole): string {
  if (role === 'admin') return 'Admin salone';
  if (role === 'operator') return 'Operatore';
  return 'Titolare';
}
