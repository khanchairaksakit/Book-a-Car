import { User, UserRole, Booking } from '../types';

export function getUserRoles(user?: User | null): UserRole[] {
  if (!user) return [];
  if (Array.isArray(user.roles) && user.roles.length > 0) {
    // Map legacy 'Approve' to 'Approve 1'
    return user.roles.map((r) => (r === 'Approve' ? 'Approve 1' : r));
  }
  if (user.role === 'Admin') return ['Admin', 'User'];
  return ['User'];
}

export function hasRole(user: User | null | undefined, role: UserRole): boolean {
  if (!user) return false;
  const roles = getUserRoles(user);
  if (role === 'Approve 1') {
    return roles.includes('Approve 1') || roles.includes('Approve' as any);
  }
  if (role === 'Approve' as any) {
    return roles.includes('Approve 1') || roles.includes('Approve' as any);
  }
  return roles.includes(role);
}

export function isUserAdmin(user: User | null | undefined): boolean {
  return hasRole(user, 'Admin');
}

export function isUserApprover1(user: User | null | undefined): boolean {
  return hasRole(user, 'Approve 1');
}

export function isUserApprover2(user: User | null | undefined): boolean {
  return hasRole(user, 'Approve 2');
}

export function isUserApprover(user: User | null | undefined): boolean {
  return isUserApprover1(user) || isUserApprover2(user);
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
 * Resolves the division of a booking, falling back to looking up the booking's user.
 */
export function getBookingDivision(booking: Booking, allUsers?: User[]): string {
  if (booking.userDivision && booking.userDivision.trim()) {
    return booking.userDivision.trim();
  }
  if (allUsers && booking.userId) {
    const matched = allUsers.find((u) => u.id === booking.userId);
    if (matched?.division) {
      return matched.division.trim();
    }
  }
  return '';
}

/**
 * Retrieves eligible Approver 1 candidates.
 * Rule: Must strictly possess 'Approve 1' permission (ตามสิทธิที่ได้รับในกำหนดผู้ใช้งานและบทบาทหน้าที่).
 */
export function getEligibleStage1Approvers(users: User[], currentUser?: User | null): User[] {
  const allApprover1Users = users.filter((u) => isUserApprover1(u));
  if (!currentUser) return allApprover1Users;

  const currentDept = (currentUser.department || '').trim().toLowerCase();
  const currentDiv = (currentUser.division || '').trim().toLowerCase();

  return [...allApprover1Users].sort((a, b) => {
    const aDept = (a.department || '').trim().toLowerCase();
    const bDept = (b.department || '').trim().toLowerCase();
    const aDiv = (a.division || '').trim().toLowerCase();
    const bDiv = (b.division || '').trim().toLowerCase();

    const aScore = (currentDept && aDept === currentDept ? 2 : 0) + (currentDiv && aDiv === currentDiv ? 1 : 0);
    const bScore = (currentDept && bDept === currentDept ? 2 : 0) + (currentDiv && bDiv === currentDiv ? 1 : 0);
    return bScore - aScore;
  });
}

/**
 * Retrieves eligible Approver 2 candidates.
 * Rule: Must strictly possess 'Approve 2' permission (ตามสิทธิที่ได้รับในกำหนดผู้ใช้งานและบทบาทหน้าที่).
 * Prioritizes Approve 2 in the same department/division if currentUser is provided.
 */
export function getEligibleStage2Approvers(users: User[], currentUser?: User | null): User[] {
  const allApprover2Users = users.filter((u) => isUserApprover2(u));
  if (!currentUser) return allApprover2Users;

  const currentDept = (currentUser.department || '').trim().toLowerCase();
  const currentDiv = (currentUser.division || '').trim().toLowerCase();

  return [...allApprover2Users].sort((a, b) => {
    const aDept = (a.department || '').trim().toLowerCase();
    const bDept = (b.department || '').trim().toLowerCase();
    const aDiv = (a.division || '').trim().toLowerCase();
    const bDiv = (b.division || '').trim().toLowerCase();

    const aScore = (currentDept && aDept === currentDept ? 2 : 0) + (currentDiv && aDiv === currentDiv ? 1 : 0);
    const bScore = (currentDept && bDept === currentDept ? 2 : 0) + (currentDiv && bDiv === currentDiv ? 1 : 0);
    return bScore - aScore;
  });
}

/**
 * Checks whether the current user is permitted to approve/reject the given booking:
 * - Stage 1 (Pending): ONLY the designated Approve 1 user (or Admin) can approve.
 * - Stage 2 (Pending_Approve2): Any user with Approve 2 role (or Admin) can approve.
 */
export function canUserApproveBooking(
  booking: Booking,
  currentUser: User | null | undefined,
  allUsers?: User[]
): boolean {
  if (!currentUser) return false;
  if (isUserAdmin(currentUser)) return true;

  // Stage 1: Waiting for Approve 1
  if (booking.status === 'Pending') {
    if (booking.assignedApproverId) {
      return currentUser.id === booking.assignedApproverId;
    }
    // Fallback: any Approve 1 in same division
    if (isUserApprover1(currentUser)) {
      const userDiv = (currentUser.division || currentUser.department || '').trim().toLowerCase();
      const bookingDiv = (getBookingDivision(booking, allUsers) || getBookingDepartment(booking, allUsers)).toLowerCase();
      return Boolean(userDiv && bookingDiv && userDiv === bookingDiv);
    }
    return false;
  }

  // Stage 2: Waiting for Approve 2
  if (booking.status === 'Pending_Approve2') {
    return isUserApprover2(currentUser);
  }

  return false;
}

/**
 * Checks whether a booking is visible to the given user based on strict role policy:
 * - Admin: Sees all bookings across all departments/divisions
 * - Requester: Always sees their own bookings
 * - Stage 1: Designated Approve 1 user can see and approve
 * - Stage 2: Approve 2 users can see and approve
 * - Approved / Completed: Approvers (Stage 1 & 2), Requester, and same division staff
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

  // 3. Stage 1 (Pending): designated Approve 1 user
  if (booking.status === 'Pending') {
    if (booking.assignedApproverId) {
      return currentUser.id === booking.assignedApproverId;
    }
    if (isUserApprover1(currentUser)) {
      const currentDiv = (currentUser.division || currentUser.department || '').trim().toLowerCase();
      const bookingDiv = (getBookingDivision(booking, allUsers) || getBookingDepartment(booking, allUsers)).toLowerCase();
      return Boolean(currentDiv && bookingDiv && currentDiv === bookingDiv);
    }
  }

  // 4. Stage 2 (Pending_Approve2): all Approve 2 users
  if (booking.status === 'Pending_Approve2') {
    if (isUserApprover2(currentUser)) {
      return true;
    }
  }

  // 5. Approved / Completed: Approvers who participated, or same division approvers
  if (booking.status === 'Approved' || booking.status === 'Completed') {
    if (currentUser.id === booking.assignedApproverId) return true;
    if (isUserApprover2(currentUser)) return true;
    if (isUserApprover1(currentUser)) {
      const currentDiv = (currentUser.division || currentUser.department || '').trim().toLowerCase();
      const bookingDiv = (getBookingDivision(booking, allUsers) || getBookingDepartment(booking, allUsers)).toLowerCase();
      if (currentDiv && bookingDiv && currentDiv === bookingDiv) return true;
    }
  }

  return false;
}

/**
 * Filters a list of bookings based on the logged-in user's role and visibility.
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
    case 'Approve 2':
      return {
        label: isEn ? 'Approve 2' : 'ผู้อนุมัติขั้นที่ 2 (Approve 2)',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
      };
    case 'Approve 1':
    case 'Approve':
      return {
        label: isEn ? 'Approve 1' : 'ผู้อนุมัติขั้นที่ 1 (Approve 1)',
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
