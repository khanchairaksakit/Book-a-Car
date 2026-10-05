import {
  User,
  UserRole,
  Booking,
  AppMenuKey,
  StandardRole,
  RolePermissionsMatrix,
  MenuPermissionSetting,
} from '../types';

export const STANDARD_ROLES: StandardRole[] = [
  'User',
  'Operator',
  'Approve 1',
  'Approve 2',
  'Admin',
];

export const MENU_DEFINITIONS: Array<{
  key: AppMenuKey;
  label: string;
  labelEn: string;
  description: string;
}> = [
  {
    key: 'calendar',
    label: 'ปฏิทินการจองรถยนต์',
    labelEn: 'Vehicle Booking Calendar',
    description: 'หน้าปฏิทินจองรถยนต์ส่วนกลาง ดูคิวรถว่าง กดจองรถ และบันทึกไมล์/คืนรถ',
  },
  {
    key: 'booking',
    label: 'ตรวจสอบสถานะ',
    labelEn: 'Check Booking Status',
    description: 'ตรวจสอบสถานะใบงาน พิจารณาอนุมัติขั้นที่ 1 / ขั้นที่ 2 และจัดการคำขอ',
  },
  {
    key: 'vehicles',
    label: 'จัดการข้อมูลรถยนต์',
    labelEn: 'Manage Vehicles',
    description: 'ข้อมูลรถยนต์ส่วนกลาง สถานะซ่อมบำรุง ภาษี เลขไมล์ และการเพิ่ม/แก้ไข/ลบรถ',
  },
  {
    key: 'report',
    label: 'รายงานสำหรับผู้ดูแลระบบ',
    labelEn: 'Admin Fleet Report',
    description: 'ตารางสรุปรายงานการใช้รถยนต์ส่วนกลาง ส่งออกไฟล์ Excel และสั่งพิมพ์เอกสาร',
  },
  {
    key: 'users',
    label: 'กำหนดผู้ใช้งาน',
    labelEn: 'User & Role Management',
    description: 'จัดการบัญชีผู้ใช้งาน แผนก ฝ่าย นำเข้า Excel และตารางกำหนดสิทธิ',
  },
];

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionsMatrix = {
  User: {
    calendar: { viewOnly: false, canEdit: true },
    booking: { viewOnly: false, canEdit: true },
    vehicles: { viewOnly: true, canEdit: false },
    report: { viewOnly: true, canEdit: false },
    users: { viewOnly: true, canEdit: false },
  },
  Operator: {
    calendar: { viewOnly: false, canEdit: true },
    booking: { viewOnly: false, canEdit: true },
    vehicles: { viewOnly: false, canEdit: true },
    report: { viewOnly: false, canEdit: true },
    users: { viewOnly: true, canEdit: false },
  },
  'Approve 1': {
    calendar: { viewOnly: false, canEdit: true },
    booking: { viewOnly: false, canEdit: true },
    vehicles: { viewOnly: true, canEdit: false },
    report: { viewOnly: true, canEdit: false },
    users: { viewOnly: true, canEdit: false },
  },
  'Approve 2': {
    calendar: { viewOnly: false, canEdit: true },
    booking: { viewOnly: false, canEdit: true },
    vehicles: { viewOnly: false, canEdit: true },
    report: { viewOnly: false, canEdit: true },
    users: { viewOnly: true, canEdit: false },
  },
  Admin: {
    calendar: { viewOnly: false, canEdit: true },
    booking: { viewOnly: false, canEdit: true },
    vehicles: { viewOnly: false, canEdit: true },
    report: { viewOnly: false, canEdit: true },
    users: { viewOnly: false, canEdit: true },
  },
};

const ROLE_PERMISSIONS_STORAGE_KEY = 'car_booking_role_permissions_v1';

export function normalizeRolePermissionsMatrix(
  raw?: Partial<RolePermissionsMatrix> | null
): RolePermissionsMatrix {
  const result: RolePermissionsMatrix = JSON.parse(
    JSON.stringify(DEFAULT_ROLE_PERMISSIONS)
  );
  if (!raw || typeof raw !== 'object') return result;

  for (const role of STANDARD_ROLES) {
    const roleObj = raw[role];
    if (roleObj && typeof roleObj === 'object') {
      for (const menu of MENU_DEFINITIONS) {
        const cell = roleObj[menu.key];
        if (cell && typeof cell === 'object') {
          const canEdit = Boolean(cell.canEdit);
          const viewOnly = canEdit ? false : Boolean(cell.viewOnly);
          result[role][menu.key] = { viewOnly, canEdit };
        }
      }
    }
  }
  return result;
}

export function getStoredRolePermissions(): RolePermissionsMatrix {
  if (typeof window === 'undefined') return DEFAULT_ROLE_PERMISSIONS;
  try {
    const saved = localStorage.getItem(ROLE_PERMISSIONS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return normalizeRolePermissionsMatrix(parsed);
    }
  } catch (e) {
    console.error('Failed to read role permissions from localStorage:', e);
  }
  return DEFAULT_ROLE_PERMISSIONS;
}

export function saveStoredRolePermissions(matrix: RolePermissionsMatrix): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      ROLE_PERMISSIONS_STORAGE_KEY,
      JSON.stringify(normalizeRolePermissionsMatrix(matrix))
    );
  } catch (e) {
    console.error('Failed to save role permissions to localStorage:', e);
  }
}

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
  if (role === ('Approve' as any)) {
    return roles.includes('Approve 1') || roles.includes('Approve' as any);
  }
  return roles.includes(role);
}

export function isUserAdmin(user: User | null | undefined): boolean {
  return hasRole(user, 'Admin');
}

export function isUserOperator(user: User | null | undefined): boolean {
  return hasRole(user, 'Operator');
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
 * Resolves the effective menu permission (ดูได้อย่างเดียว vs แก้ไขได้) for a user on a specific menu
 * based on the configured RolePermissionsMatrix.
 */
export function getUserEffectiveMenuPermission(
  user: User | null | undefined,
  menuKey: AppMenuKey,
  matrix: RolePermissionsMatrix = DEFAULT_ROLE_PERMISSIONS
): {
  canView: boolean;
  viewOnly: boolean;
  canEdit: boolean;
  appliedRoles: StandardRole[];
} {
  if (!user) {
    return { canView: false, viewOnly: false, canEdit: false, appliedRoles: [] };
  }

  const rawRoles = getUserRoles(user).map((r) =>
    r === 'Approve' ? 'Approve 1' : r
  ) as StandardRole[];

  // Determine which role(s) govern the user's menu permission:
  // - If user has 'Admin', use 'Admin'
  // - Else if user has specialized role(s) ('Operator', 'Approve 1', 'Approve 2'), use those specialized roles
  //   so that default 'User' role doesn't override restrictions configured for that specialized role
  // - Else use ['User']
  let effectiveRoles: StandardRole[] = ['User'];
  if (rawRoles.includes('Admin')) {
    effectiveRoles = ['Admin'];
  } else {
    const specialized = rawRoles.filter(
      (r): r is StandardRole =>
        r === 'Operator' || r === 'Approve 1' || r === 'Approve 2'
    );
    if (specialized.length > 0) {
      effectiveRoles = specialized;
    } else {
      effectiveRoles = ['User'];
    }
  }

  let canEdit = false;
  let viewOnly = false;

  for (const role of effectiveRoles) {
    const perm: MenuPermissionSetting | undefined = matrix[role]?.[menuKey];
    if (perm?.canEdit) {
      canEdit = true;
    } else if (perm?.viewOnly) {
      viewOnly = true;
    }
  }

  if (canEdit) {
    viewOnly = false;
  }

  return {
    canView: canEdit || viewOnly,
    viewOnly,
    canEdit,
    appliedRoles: effectiveRoles,
  };
}

export function normalizeOrgUnit(val?: string): string {
  if (!val) return '';
  const trimmed = val.trim().toLowerCase();
  if (trimmed === '-' || trimmed === 'ไม่ระบุ' || trimmed === 'n/a') return '';
  return trimmed;
}

export function stripOrgPrefix(val?: string): string {
  const norm = normalizeOrgUnit(val);
  if (!norm) return '';
  return norm
    .replace(/^(แผนก|ฝ่าย|ส่วนงาน|กลุ่มงาน)\s*/g, '')
    .replace(/\([^)]*\)/g, '')
    .trim();
}

/**
 * Checks whether two users/records belong to the same Department (แผนก) or Division (ฝ่าย)
 */
export function isSameDeptOrDiv(
  dept1?: string,
  div1?: string,
  dept2?: string,
  div2?: string
): boolean {
  const d1 = normalizeOrgUnit(dept1);
  const v1 = normalizeOrgUnit(div1);
  const d2 = normalizeOrgUnit(dept2);
  const v2 = normalizeOrgUnit(div2);

  if (d1 && d2 && d1 === d2) return true;
  if (v1 && v2 && v1 === v2) return true;
  if (d1 && v2 && d1 === v2) return true;
  if (v1 && d2 && v1 === d2) return true;

  // Core keyword match if exact strings differ slightly (e.g. "แผนกคลังสินค้าและโลจิสติกส์" vs "แผนกคลังสินค้า")
  const coreD1 = stripOrgPrefix(dept1);
  const coreD2 = stripOrgPrefix(dept2);
  if (coreD1 && coreD2 && coreD1.length >= 2 && coreD2.length >= 2) {
    if (coreD1.includes(coreD2) || coreD2.includes(coreD1)) return true;
  }

  const coreV1 = stripOrgPrefix(div1);
  const coreV2 = stripOrgPrefix(div2);
  if (coreV1 && coreV2 && coreV1.length >= 2 && coreV2.length >= 2) {
    if (coreV1.includes(coreV2) || coreV2.includes(coreV1)) return true;
  }

  return false;
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
 * Retrieves eligible Approver 1 candidates for the given requester.
 * STRICT RULE: เมื่อ user ในแผนกขอจองรถ ผู้อนุมัติในแผนกหรือฝ่ายเดียวกันเท่านั้นที่อนุมัติได้
 * - Priority 1: If there are Approve 1 users in the exact same Department (แผนกเดียวกัน), return ONLY those.
 * - Priority 2: Otherwise, return ONLY Approve 1 users in the same Division (ฝ่ายเดียวกัน).
 * - Never returns Approve 1 users from other unrelated departments or divisions.
 */
export function getEligibleStage1Approvers(
  users: User[],
  currentUser?: User | null
): User[] {
  const allApprover1Users = users.filter((u) => isUserApprover1(u));
  if (!currentUser) return [];

  const currentDept = normalizeOrgUnit(currentUser.department);
  const currentDiv = normalizeOrgUnit(currentUser.division);
  const coreCurrentDept = stripOrgPrefix(currentUser.department);
  const coreCurrentDiv = stripOrgPrefix(currentUser.division);

  // 1. Check exact Department match first (แผนกเดียวกัน)
  if (currentDept) {
    const exactDeptMatches = allApprover1Users.filter((u) => {
      const uDept = normalizeOrgUnit(u.department);
      const uDiv = normalizeOrgUnit(u.division);
      if (uDept && uDept === currentDept) return true;
      if (uDiv && uDiv === currentDept) return true;
      const coreUDept = stripOrgPrefix(u.department);
      if (
        coreCurrentDept &&
        coreUDept &&
        coreCurrentDept.length >= 2 &&
        coreUDept.length >= 2 &&
        (coreCurrentDept.includes(coreUDept) || coreUDept.includes(coreCurrentDept))
      ) {
        return true;
      }
      return false;
    });

    if (exactDeptMatches.length > 0) {
      return exactDeptMatches;
    }
  }

  // 2. Fallback to same Division match (ฝ่ายเดียวกัน) when the requester's specific แผนก has no dedicated Approve 1
  if (currentDiv) {
    const sameDivMatches = allApprover1Users.filter((u) => {
      const uDiv = normalizeOrgUnit(u.division);
      const uDept = normalizeOrgUnit(u.department);
      if (uDiv && uDiv === currentDiv) return true;
      if (uDept && uDept === currentDiv) return true;
      const coreUDiv = stripOrgPrefix(u.division);
      if (
        coreCurrentDiv &&
        coreUDiv &&
        coreCurrentDiv.length >= 2 &&
        coreUDiv.length >= 2 &&
        (coreCurrentDiv.includes(coreUDiv) || coreUDiv.includes(coreCurrentDiv))
      ) {
        return true;
      }
      return false;
    });

    if (sameDivMatches.length > 0) {
      return sameDivMatches;
    }
  }

  return [];
}

/**
 * Retrieves eligible Approver 2 candidates.
 * Rule: Must strictly possess 'Approve 2' permission.
 */
export function getEligibleStage2Approvers(
  users: User[],
  currentUser?: User | null
): User[] {
  const allApprover2Users = users.filter((u) => isUserApprover2(u));
  if (!currentUser) return allApprover2Users;

  const currentDept = normalizeOrgUnit(currentUser.department);
  const currentDiv = normalizeOrgUnit(currentUser.division);

  return [...allApprover2Users].sort((a, b) => {
    const aDept = normalizeOrgUnit(a.department);
    const bDept = normalizeOrgUnit(b.department);
    const aDiv = normalizeOrgUnit(a.division);
    const bDiv = normalizeOrgUnit(b.division);

    const aScore =
      (currentDept && aDept === currentDept ? 2 : 0) +
      (currentDiv && aDiv === currentDiv ? 1 : 0);
    const bScore =
      (currentDept && bDept === currentDept ? 2 : 0) +
      (currentDiv && bDiv === currentDiv ? 1 : 0);
    return bScore - aScore;
  });
}

/**
 * Checks whether the current user is permitted to approve/reject the given booking:
 * - Stage 1 (Pending): ONLY Approve 1 in the same department or division as the requester (or Admin) can approve.
 * - Stage 2 (Pending_Approve2): Any user with Approve 2 role (or Admin) can approve.
 */
export function canUserApproveBooking(
  booking: Booking,
  currentUser: User | null | undefined,
  allUsers?: User[]
): boolean {
  if (!currentUser) return false;
  if (isUserAdmin(currentUser)) return true;

  // Stage 1: Waiting for Approve 1 (Must be Approve 1 in same department or division)
  if (booking.status === 'Pending') {
    if (!isUserApprover1(currentUser)) return false;

    const bookingDept = getBookingDepartment(booking, allUsers);
    const bookingDiv = getBookingDivision(booking, allUsers);
    const isSameOrg = isSameDeptOrDiv(
      currentUser.department,
      currentUser.division,
      bookingDept,
      bookingDiv
    );

    if (booking.assignedApproverId) {
      return currentUser.id === booking.assignedApproverId && isSameOrg;
    }
    return isSameOrg;
  }

  // Stage 2: Waiting for Approve 2
  if (booking.status === 'Pending_Approve2') {
    return isUserApprover2(currentUser);
  }

  return false;
}

/**
 * Checks whether a booking is visible to the given user based on strict role policy:
 * - Admin & Operator: Sees all bookings across all departments/divisions
 * - Requester: Always sees their own bookings
 * - Stage 1: Approve 1 user in the same department/division can see and approve
 * - Stage 2: Approve 2 users can see and approve
 * - Approved / Completed: Approvers (Stage 1 in same dept/div & Stage 2), Requester, Admin, Operator
 */
export function canUserViewBooking(
  booking: Booking,
  currentUser: User | null | undefined,
  allUsers?: User[]
): boolean {
  if (!currentUser) return false;

  // 1. Admin & Operator have global visibility for monitoring and reporting
  if (isUserAdmin(currentUser) || isUserOperator(currentUser)) {
    return true;
  }

  // 2. The requester always sees their own booking
  if (booking.userId === currentUser.id) {
    return true;
  }

  const bookingDept = getBookingDepartment(booking, allUsers);
  const bookingDiv = getBookingDivision(booking, allUsers);
  const isSameOrg = isSameDeptOrDiv(
    currentUser.department,
    currentUser.division,
    bookingDept,
    bookingDiv
  );

  // 3. Stage 1 (Pending): ONLY Approve 1 in the same department/division
  if (booking.status === 'Pending') {
    if (!isUserApprover1(currentUser)) return false;
    if (booking.assignedApproverId) {
      return currentUser.id === booking.assignedApproverId && isSameOrg;
    }
    return isSameOrg;
  }

  // 4. Stage 2 (Pending_Approve2): Approve 2 users (or Stage 1 approver who approved it)
  if (booking.status === 'Pending_Approve2') {
    if (isUserApprover2(currentUser)) return true;
    if (isUserApprover1(currentUser) && currentUser.id === booking.assignedApproverId && isSameOrg) {
      return true;
    }
  }

  // 5. Approved / Completed / Cancelled: Approvers who participated or same dept/div Approve 1
  if (
    booking.status === 'Approved' ||
    booking.status === 'Completed' ||
    booking.status === 'Cancelled'
  ) {
    if (currentUser.id === booking.assignedApproverId && isSameOrg) return true;
    if (isUserApprover2(currentUser)) return true;
    if (isUserApprover1(currentUser) && isSameOrg) return true;
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

export function getRoleBadgeInfo(
  role: UserRole,
  isEn: boolean = false
): {
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
    case 'Operator':
      return {
        label: isEn ? 'Operator' : 'เจ้าหน้าที่ดูแลรถ (Operator)',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
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
