import { User, UserRole } from '../types';

export function getUserRoles(user?: User | null): UserRole[] {
  if (!user) return [];
  if (Array.isArray(user.roles) && user.roles.length > 0) {
    return user.roles;
  }
  if (user.role === 'Admin') return ['Admin', 'User'];
  return ['User'];
}

export function hasRole(user: User | null | undefined, role: UserRole): boolean {
  if (!user) return false;
  const roles = getUserRoles(user);
  return roles.includes(role);
}

export function isUserAdmin(user: User | null | undefined): boolean {
  return hasRole(user, 'Admin');
}

export function isUserApprover(user: User | null | undefined): boolean {
  return hasRole(user, 'Approve') || hasRole(user, 'Admin');
}

export function getRoleBadgeInfo(role: UserRole, isEn: boolean = false): {
  label: string;
  bg: string;
  text: string;
  border: string;
} {
  switch (role) {
    case 'Admin':
      return {
        label: isEn ? 'Admin' : 'ผู้ดูแลระบบ (Admin)',
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-200',
      };
    case 'Approve':
      return {
        label: isEn ? 'Approver' : 'ผู้อนุมัติ (Approve)',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
      };
    case 'User':
    default:
      return {
        label: isEn ? 'User' : 'ผู้ใช้งาน (User)',
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-200',
      };
  }
}
