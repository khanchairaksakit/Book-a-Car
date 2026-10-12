import {
  PasswordPolicy,
  PreventReuseOption,
  PasswordExpiryDaysOption,
  User,
} from '../types';

export const PASSWORD_POLICY_STORAGE_KEY = 'car_booking_password_policy';

export const PREVENT_REUSE_OPTIONS: PreventReuseOption[] = [0, 3, 5, 7];
export const PASSWORD_EXPIRY_DAYS_OPTIONS: PasswordExpiryDaysOption[] = [0, 30, 60, 90, 180];

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  requireLowercase: true,
  requireUppercase: false,
  requireSpecialChar: false,
  requireNumber: true,
  preventReuseCount: 0,
  expiryDays: 0,
};

/**
 * Deterministic fallback password start dates per initial user ID
 * so each user has a realistic individual password usage timestamp.
 */
const DEFAULT_USER_PASSWORD_START_DATES: Record<string, string> = {
  'user-1': '2026-10-05T09:00:00.000Z', // สมชาย (Admin) - เริ่มใช้เมื่อ ~7 วันที่แล้ว
  'user-2': '2026-09-25T09:00:00.000Z', // สมศรี (Approve 1) - เริ่มใช้เมื่อ ~17 วันที่แล้ว
  'user-3': '2026-09-01T09:00:00.000Z', // วิชัย (User) - เริ่มใช้เมื่อ ~41 วันที่แล้ว (หมดอายุหากตั้ง 30 วัน)
  'user-4': '2026-08-01T09:00:00.000Z', // ณัฐพงษ์ (Approve 1) - เริ่มใช้เมื่อ ~72 วันที่แล้ว (หมดอายุหากตั้ง 30 หรือ 60 วัน)
  'user-5': '2026-09-20T09:00:00.000Z', // กิตติศักดิ์ (Approve 2) - เริ่มใช้เมื่อ ~22 วันที่แล้ว
  'user-6': '2026-03-25T09:00:00.000Z', // พิมพ์ชนก (Approve 1) - เริ่มใช้เมื่อ ~201 วันที่แล้ว (หมดอายุหากตั้ง 30, 60, 90 หรือ 180 วัน)
};

export function getDefaultUserPasswordStartDate(userId?: string): string {
  if (userId && DEFAULT_USER_PASSWORD_START_DATES[userId]) {
    return DEFAULT_USER_PASSWORD_START_DATES[userId];
  }
  return '2026-10-01T09:00:00.000Z';
}

export function normalizePasswordPolicy(raw: any): PasswordPolicy {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PASSWORD_POLICY };
  }

  const rawReuse = Number(raw.preventReuseCount);
  const preventReuseCount: PreventReuseOption = PREVENT_REUSE_OPTIONS.includes(
    rawReuse as PreventReuseOption
  )
    ? (rawReuse as PreventReuseOption)
    : 0;

  const rawExpiry = Number(raw.expiryDays);
  const expiryDays: PasswordExpiryDaysOption = PASSWORD_EXPIRY_DAYS_OPTIONS.includes(
    rawExpiry as PasswordExpiryDaysOption
  )
    ? (rawExpiry as PasswordExpiryDaysOption)
    : 0;

  return {
    requireLowercase:
      typeof raw.requireLowercase === 'boolean'
        ? raw.requireLowercase
        : DEFAULT_PASSWORD_POLICY.requireLowercase,
    requireUppercase:
      typeof raw.requireUppercase === 'boolean'
        ? raw.requireUppercase
        : DEFAULT_PASSWORD_POLICY.requireUppercase,
    requireSpecialChar:
      typeof raw.requireSpecialChar === 'boolean'
        ? raw.requireSpecialChar
        : DEFAULT_PASSWORD_POLICY.requireSpecialChar,
    requireNumber:
      typeof raw.requireNumber === 'boolean'
        ? raw.requireNumber
        : DEFAULT_PASSWORD_POLICY.requireNumber,
    preventReuseCount,
    expiryDays,
    ...(raw.updatedAt ? { updatedAt: String(raw.updatedAt) } : {}),
  };
}

export function getStoredPasswordPolicy(): PasswordPolicy {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_PASSWORD_POLICY };
  }
  try {
    const raw = localStorage.getItem(PASSWORD_POLICY_STORAGE_KEY);
    if (raw) {
      return normalizePasswordPolicy(JSON.parse(raw));
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_PASSWORD_POLICY };
}

export function saveStoredPasswordPolicy(policy: PasswordPolicy): void {
  if (typeof window === 'undefined') return;
  try {
    const normalized = normalizePasswordPolicy(policy);
    localStorage.setItem(PASSWORD_POLICY_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore
  }
}

/**
 * Returns the ordered password history for a user (most recent first, starting with current password).
 */
export function getUserPasswordHistoryList(user?: Partial<User> | null): string[] {
  if (!user) return [];
  const rawList = Array.isArray(user.passwordHistory)
    ? user.passwordHistory.filter((p): p is string => typeof p === 'string' && p.length > 0)
    : [];
  const currentPass = (user.password || '').trim();
  if (currentPass && rawList[0] !== currentPass) {
    return [currentPass, ...rawList];
  }
  return rawList;
}

export interface PasswordRuleCheckResult {
  key: string;
  label: string;
  passed: boolean;
}

export interface PasswordValidationSummary {
  isValid: boolean;
  errors: string[];
  checks: PasswordRuleCheckResult[];
}

/**
 * Validates a candidate password against the active PasswordPolicy.
 * @param password Candidate password string
 * @param policy Active PasswordPolicy
 * @param user Optional user object for checking password reuse history
 * @param checkReuseHistory Whether to check preventReuseCount (true when setting a new/changed password)
 */
export function validatePasswordAgainstPolicy(
  password: string,
  policy: PasswordPolicy,
  user?: Partial<User> | null,
  checkReuseHistory: boolean = true
): PasswordValidationSummary {
  const checks: PasswordRuleCheckResult[] = [];
  const errors: string[] = [];

  const noWhitespaceAndNonEmpty = Boolean(password) && password.length > 0 && !/\s/.test(password);
  checks.push({
    key: 'no_space',
    label: 'ห้ามเว้นวรรค (ช่องว่าง) และต้องไม่เป็นค่าว่าง',
    passed: noWhitespaceAndNonEmpty,
  });
  if (!noWhitespaceAndNonEmpty) {
    errors.push('รหัสผ่านต้องไม่เป็นค่าว่าง และห้ามมีเว้นวรรค (ช่องว่าง)');
  }

  if (policy.requireLowercase) {
    const hasLower = /[a-z]/.test(password);
    checks.push({
      key: 'lowercase',
      label: 'ตัวอักษรอังกฤษ ตัวเล็ก (a-z)',
      passed: hasLower,
    });
    if (!hasLower) {
      errors.push('รหัสผ่านต้องมี ตัวอักษรอังกฤษ ตัวเล็ก (a-z) อย่างน้อย 1 ตัว');
    }
  }

  if (policy.requireUppercase) {
    const hasUpper = /[A-Z]/.test(password);
    checks.push({
      key: 'uppercase',
      label: 'ตัวอักษรอังกฤษ ตัวใหญ่ (A-Z)',
      passed: hasUpper,
    });
    if (!hasUpper) {
      errors.push('รหัสผ่านต้องมี ตัวอักษรอังกฤษ ตัวใหญ่ (A-Z) อย่างน้อย 1 ตัว');
    }
  }

  if (policy.requireSpecialChar) {
    const hasSpecial = /[^a-zA-Z0-9\s]/.test(password);
    checks.push({
      key: 'special',
      label: 'อักขระพิเศษ (เช่น !@#$%^&*_-+=)',
      passed: hasSpecial,
    });
    if (!hasSpecial) {
      errors.push('รหัสผ่านต้องมี อักขระพิเศษ (เช่น !@#$%^&*_-+=) อย่างน้อย 1 ตัว');
    }
  }

  if (policy.requireNumber) {
    const hasNumber = /[0-9]/.test(password);
    checks.push({
      key: 'number',
      label: 'ตัวเลข (0-9)',
      passed: hasNumber,
    });
    if (!hasNumber) {
      errors.push('รหัสผ่านต้องมี ตัวเลข (0-9) อย่างน้อย 1 ตัว');
    }
  }

  if (policy.preventReuseCount > 0 && checkReuseHistory) {
    const recentHistory = getUserPasswordHistoryList(user).slice(0, policy.preventReuseCount);
    const isNotReused = !password || !recentHistory.includes(password);
    checks.push({
      key: 'prevent_reuse',
      label: `ห้ามซ้ำกับรหัสผ่านเดิม ${policy.preventReuseCount} ครั้งล่าสุด`,
      passed: isNotReused,
    });
    if (!isNotReused) {
      errors.push(
        `รหัสผ่านใหม่ห้ามซ้ำกับรหัสผ่านเดิมที่เคยใช้ย้อนหลัง ${policy.preventReuseCount} ครั้งล่าสุด`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    checks,
  };
}

/**
 * Generates a password that is guaranteed to comply with all selected rules in PasswordPolicy
 * and does not collide with the user's recent password history.
 */
export function generatePasswordForPolicy(
  policy: PasswordPolicy,
  user?: Partial<User> | null,
  attemptOffset: number = 0
): string {
  const recentHistory =
    policy.preventReuseCount > 0
      ? getUserPasswordHistoryList(user).slice(0, policy.preventReuseCount)
      : [];

  for (let i = attemptOffset; i < attemptOffset + 30; i++) {
    const numSuffix = i === 0 ? '123' : String(123 + i * 7);
    const lowerPart = i === 0 ? 'password' : `pass${String.fromCharCode(97 + (i % 20))}word`;
    const upperPart = i === 0 ? 'P' : String.fromCharCode(65 + ((i + 15) % 24));
    const specialChars = ['@', '#', '!', '$', '%', '&', '*'];
    const specialPart = specialChars[i % specialChars.length];

    let candidate = '';

    if (
      !policy.requireLowercase &&
      !policy.requireUppercase &&
      !policy.requireSpecialChar &&
      !policy.requireNumber
    ) {
      candidate = i === 0 ? 'password123' : `password${numSuffix}`;
    } else {
      if (policy.requireUppercase && policy.requireLowercase) {
        candidate += upperPart + lowerPart.slice(1);
      } else if (policy.requireUppercase) {
        candidate += upperPart + 'ASSWORD';
      } else if (policy.requireLowercase) {
        candidate += lowerPart;
      }

      if (policy.requireSpecialChar) {
        candidate += specialPart;
      }

      if (policy.requireNumber) {
        candidate += numSuffix;
      }

      // Ensure minimum readable length if only 1 character class was selected
      if (candidate.length < 6) {
        if (policy.requireNumber && !policy.requireLowercase && !policy.requireUppercase) {
          candidate = i === 0 ? `123456${policy.requireSpecialChar ? '@' : ''}` : `${100000 + i * 137}${policy.requireSpecialChar ? specialPart : ''}`;
        } else if (policy.requireSpecialChar && !policy.requireLowercase && !policy.requireUppercase && !policy.requireNumber) {
          candidate = i === 0 ? '@#$%!&' : `@#$%!${specialPart}`;
        }
      }
    }

    if (!recentHistory.includes(candidate)) {
      const check = validatePasswordAgainstPolicy(candidate, policy, user, true);
      if (check.isValid) {
        return candidate;
      }
    }
  }

  return `Pass@${Math.floor(1000 + Math.random() * 8999)}`;
}

/**
 * Returns updated user password fields (`password`, `passwordUpdatedAt`, `passwordHistory`)
 * when a user's password is created or changed.
 */
export function applyNewPasswordToUser(
  existingUser: Partial<User> | null | undefined,
  newPassword: string,
  customUpdatedAt?: string
): {
  password: string;
  passwordUpdatedAt: string;
  passwordHistory: string[];
} {
  const cleanPass = newPassword.trim();
  const prevHistory = getUserPasswordHistoryList(existingUser);
  const nextHistory = [cleanPass, ...prevHistory].slice(0, 15);
  return {
    password: cleanPass,
    passwordUpdatedAt: customUpdatedAt || new Date().toISOString(),
    passwordHistory: nextHistory,
  };
}

export interface UserPasswordExpiryInfo {
  neverExpires: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  expiryDays: PasswordExpiryDaysOption;
  startDate: Date;
  startDateIso: string;
  expiryDate: Date | null;
  expiryDateIso: string | null;
  daysElapsed: number;
  daysRemaining: number | null;
}

/**
 * Computes password expiration status for a specific user based on their own `passwordUpdatedAt`
 * and the global `policy.expiryDays`.
 */
export function getUserPasswordExpiryInfo(
  user: Partial<User> | null | undefined,
  policy: PasswordPolicy,
  nowMs: number = Date.now()
): UserPasswordExpiryInfo {
  const rawStart = user?.passwordUpdatedAt || getDefaultUserPasswordStartDate(user?.id);
  const parsedStart = new Date(rawStart);
  const startDate = isNaN(parsedStart.getTime())
    ? new Date('2026-10-01T09:00:00.000Z')
    : parsedStart;
  const startDateIso = startDate.toISOString();
  const daysElapsed = Math.max(0, Math.floor((nowMs - startDate.getTime()) / 86400000));

  if (!policy || policy.expiryDays === 0) {
    return {
      neverExpires: true,
      isExpired: false,
      isExpiringSoon: false,
      expiryDays: 0,
      startDate,
      startDateIso,
      expiryDate: null,
      expiryDateIso: null,
      daysElapsed,
      daysRemaining: null,
    };
  }

  const expiryMs = startDate.getTime() + policy.expiryDays * 86400000;
  const expiryDate = new Date(expiryMs);
  const diffMs = expiryMs - nowMs;
  const daysRemaining = Math.ceil(diffMs / 86400000);
  const isExpired = diffMs <= 0;
  const isExpiringSoon = !isExpired && daysRemaining <= 7;

  return {
    neverExpires: false,
    isExpired,
    isExpiringSoon,
    expiryDays: policy.expiryDays,
    startDate,
    startDateIso,
    expiryDate,
    expiryDateIso: expiryDate.toISOString(),
    daysElapsed,
    daysRemaining,
  };
}

export function formatThaiDateShort(dateOrIso?: Date | string | null): string {
  if (!dateOrIso) return '-';
  try {
    const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

export function getPasswordPolicySummaryBadges(policy: PasswordPolicy): string[] {
  const badges: string[] = [];
  if (policy.requireLowercase) badges.push('ตัวอักษรอังกฤษ ตัวเล็ก (a-z)');
  if (policy.requireUppercase) badges.push('ตัวอักษรอังกฤษ ตัวใหญ่ (A-Z)');
  if (policy.requireSpecialChar) badges.push('อักขระพิเศษ (!@#$%)');
  if (policy.requireNumber) badges.push('ตัวเลข (0-9)');
  badges.push(
    policy.preventReuseCount > 0
      ? `ห้ามซ้ำ ${policy.preventReuseCount} ครั้ง`
      : 'ตั้งรหัสซ้ำกันได้เสมอ (0 ครั้ง)'
  );
  badges.push(
    policy.expiryDays > 0
      ? `หมดอายุ ${policy.expiryDays} วัน`
      : 'ไม่มีวันหมดอายุ (0 วัน)'
  );
  return badges;
}
