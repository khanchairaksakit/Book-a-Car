import { User, UserRole, Booking } from '../types';

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

/**
 * Resolves the department of a booking, falling back to looking up the booking's user.
 */
export function getBookingDepartment(booking: Booking, allUsers?: User[]): string {
  if (booking.userDepartment && booking.userDepartment.trim()) {
    return booking.userDepartment.trim();
  }
  if (allUsers && booking.userId) {
    const matched = allUsers.find((u) => u.id === booking.userId);
    if (matched?.department) {
      return matched.department.trim();
    }
  }
  return '';
}

/**
 * Retrieves all users who possess the 'Approve' permission (or Admin with approve rights).
 */
export function getEligibleApprovers(users: User[]): User[] {
  return users.filter((u) => hasRole(u, 'Approve') || isUserAdmin(u));
}

/**
 * Checks whether the current user is permitted to approve/reject the given booking:
 * - If booking specifies `assignedApproverId`: ONLY that designated user (or Admin) can approve.
 * - Otherwise: Department-level approver (or Admin).
 */
export function canUserApproveBooking(
  booking: Booking,
  currentUser: User | null | undefined,
  allUsers?: User[]
): boolean {
  if (!currentUser) return false;
  if (isUserAdmin(currentUser)) return true;

  if (booking.assignedApproverId) {
    return currentUser.id === booking.assignedApproverId;
  }

  if (hasRole(currentUser, 'Approve')) {
    const currentDept = (currentUser.department || '').trim().toLowerCase();
    const bookingDept = getBookingDepartment(booking, allUsers).toLowerCase();
    return Boolean(currentDept && bookingDept && currentDept === bookingDept);
  }

  return false;
}

/**
 * Checks whether a booking is visible to the given user based on strict role policy:
 * - Admin: Sees all bookings across all departments
 * - Requester: Always sees their own bookings
 * - Assigned Approver: When an approver is chosen, ONLY that designated user can see and approve it
 * - Approver (legacy bookings): Sees bookings within their own department
 * - User (regular staff): Sees ONLY their own bookings (cannot view other users' bookings)
 */
export function canUserViewBooking(
  booking: Booking,
  currentUser: User | null | undefined,
  allUsers?: User[]
): boolean {
  if (!currentUser) return false;

  // 1. Admin has global visibility
  if (isUserAdmin(currentUser)) {
    return true;
  }

  // 2. The requester always sees their own booking
  if (booking.userId === currentUser.id) {
    return true;
  }

  // 3. If an approver is explicitly designated: ONLY that chosen user can view it as the sole approver
  if (booking.assignedApproverId) {
    return currentUser.id === booking.assignedApproverId;
  }

  // 4. Legacy fallback: Approver strictly limited to their own department
  if (hasRole(currentUser, 'Approve')) {
    const currentDept = (currentUser.department || '').trim().toLowerCase();
    const bookingDept = getBookingDepartment(booking, allUsers).toLowerCase();
    return Boolean(currentDept && bookingDept && currentDept === bookingDept);
  }

  // 5. Regular user: strictly limited to their own bookings
  return false;
}

/**
 * Filters a list of bookings based on the logged-in user's role and department.
 */
export function filterBookingsForUser(
  bookings: Booking[],
  currentUser: User | null | undefined,
  allUsers?: User[]
): Booking[] {
  if (!currentUser) return [];
  return bookings.filter((b) => canUserViewBooking(b, currentUser, allUsers));
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
