import { User } from '../types';

export const DEFAULT_DEPARTMENTS: string[] = [
  'บริหารงานกลางและไอที',
  'แผนกขายในประเทศ',
  'แผนกขายต่างประเทศ',
  'แผนกการตลาด',
  'แผนกสรรหาบุคลากร',
  'แผนกพัฒนาบุคลากร',
  'แผนกพัฒนาระบบ',
  'แผนกโครงสร้างพื้นฐานไอที',
  'แผนกจัดซื้อพัสดุ',
  'แผนกคลังสินค้าและโลจิสติกส์',
  'แผนกบัญชีการเงิน',
  'แผนกตรวจสอบภายใน',
  'แผนกบริหารอาคารสถานที่',
  'ฝ่ายขาย (Sales)',
  'ฝ่ายบุคคล (HR)',
  'ฝ่ายไอที (IT Support)',
  'ฝ่ายจัดซื้อ (Procurement)',
  'ฝ่ายบริหาร (Management)',
  'ฝ่ายบัญชีและการเงิน (Accounting)',
  'ฝ่ายการตลาด (Marketing)',
  'ฝ่ายปฏิบัติการ (Operations)',
];

export const DEFAULT_DIVISIONS: string[] = [
  'งานบริหารธุรกิจเครือข่ายและบริหารงานกลาง',
  'ฝ่ายพัฒนาธุรกิจและการตลาด',
  'ฝ่ายการตลาดและการขาย',
  'ฝ่ายทรัพยากรบุคคลและการจัดการ',
  'ฝ่ายเทคโนโลยีสารสนเทศและดิจิทัล',
  'ฝ่ายเทคโนโลยีสารสนเทศ',
  'ฝ่ายปฏิบัติการและการผลิต',
  'ฝ่ายการเงินและบัญชีกลาง',
  'ฝ่ายบริหารจัดการอาคารและยานพาหนะ',
  'ฝ่ายจัดซื้อและคลังสินค้า',
  'ฝ่ายอำนวยการและบริหารทั่วไป',
];

const DEPARTMENTS_STORAGE_KEY = 'car_booking_departments_v2';
const LEGACY_DEPARTMENTS_STORAGE_KEY = 'car_booking_departments';
const DIVISIONS_STORAGE_KEY = 'car_booking_divisions_v2';
const LEGACY_DIVISIONS_STORAGE_KEY = 'car_booking_divisions';
const ORG_UPDATED_AT_STORAGE_KEY = 'car_booking_org_updated_at_v2';
const ORG_VERSION_STORAGE_KEY = 'car_booking_org_version_v2';

let memoryDepartments: string[] | null = null;
let memoryDivisions: string[] | null = null;
let memoryOrgUpdatedAt = '';
let memoryOrgVersion = 0;

/**
 * Safely writes to localStorage; if QuotaExceededError occurs due to base64 photos in bookings,
 * strips base64 photos from the cached bookings in localStorage and retries immediately.
 */
export function safeLocalStorageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    try {
      const rawBookings = localStorage.getItem('car_booking_bookings');
      if (rawBookings) {
        const parsed = JSON.parse(rawBookings);
        if (Array.isArray(parsed)) {
          const stripped = parsed.map((b: any) => {
            if (!b || typeof b !== 'object') return b;
            const copy = { ...b };
            delete copy.startMileagePhoto;
            delete copy.endMileagePhoto;
            delete copy.keyReturnPhoto;
            return copy;
          });
          localStorage.setItem('car_booking_bookings', JSON.stringify(stripped));
        }
      }
      localStorage.setItem(key, value);
    } catch (err) {
      console.error(`Error writing ${key} to localStorage:`, err);
    }
  }
}

export function getStoredOrgVersion(): number {
  if (memoryOrgVersion > 0) return memoryOrgVersion;
  try {
    const raw = localStorage.getItem(ORG_VERSION_STORAGE_KEY);
    if (raw) {
      const num = parseInt(raw, 10);
      if (!isNaN(num) && num > 0) {
        memoryOrgVersion = num;
        return num;
      }
    }
  } catch {
    // ignore
  }
  return 0;
}

export function saveStoredOrgVersion(version: number): void {
  if (version > 0) {
    memoryOrgVersion = Math.max(memoryOrgVersion, version);
    safeLocalStorageSet(ORG_VERSION_STORAGE_KEY, String(memoryOrgVersion));
  }
}

export function getStoredOrgUpdatedAt(): string {
  if (memoryOrgUpdatedAt) return memoryOrgUpdatedAt;
  try {
    const stored = localStorage.getItem(ORG_UPDATED_AT_STORAGE_KEY) || '';
    if (stored) memoryOrgUpdatedAt = stored;
    return stored;
  } catch {
    return '';
  }
}

export function saveStoredOrgUpdatedAt(updatedAt: string): void {
  if (updatedAt) {
    memoryOrgUpdatedAt = updatedAt;
    safeLocalStorageSet(ORG_UPDATED_AT_STORAGE_KEY, updatedAt);
  }
}

/**
 * Retrieves the stored departments without resurrecting renamed/deleted items from existingUsers
 */
export function getStoredDepartments(_existingUsers?: User[]): string[] {
  if (memoryDepartments !== null) {
    return [...memoryDepartments];
  }
  try {
    const raw =
      localStorage.getItem(DEPARTMENTS_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_DEPARTMENTS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const list = Array.from(
          new Set(
            parsed
              .filter((item) => typeof item === 'string' && item.trim().length > 0)
              .map((d) => d.trim())
          )
        );
        memoryDepartments = list;
        return [...list];
      }
    }
  } catch (e) {
    console.error('Error loading stored departments:', e);
  }

  return [...DEFAULT_DEPARTMENTS];
}

/**
 * Persists the list of custom departments
 */
export function saveStoredDepartments(
  departments: string[],
  updatedAt?: string,
  version?: number
): void {
  const cleanList = Array.from(new Set(departments.map((d) => (d || '').trim()).filter(Boolean)));
  memoryDepartments = cleanList;
  safeLocalStorageSet(DEPARTMENTS_STORAGE_KEY, JSON.stringify(cleanList));
  safeLocalStorageSet(LEGACY_DEPARTMENTS_STORAGE_KEY, JSON.stringify(cleanList));
  if (updatedAt) {
    saveStoredOrgUpdatedAt(updatedAt);
  }
  if (typeof version === 'number' && version > 0) {
    saveStoredOrgVersion(version);
  }
}

/**
 * Retrieves the stored divisions without resurrecting renamed/deleted items from existingUsers
 */
export function getStoredDivisions(_existingUsers?: User[]): string[] {
  if (memoryDivisions !== null) {
    return [...memoryDivisions];
  }
  try {
    const raw =
      localStorage.getItem(DIVISIONS_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_DIVISIONS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const list = Array.from(
          new Set(
            parsed
              .filter((item) => typeof item === 'string' && item.trim().length > 0)
              .map((d) => d.trim())
          )
        );
        memoryDivisions = list;
        return [...list];
      }
    }
  } catch (e) {
    console.error('Error loading stored divisions:', e);
  }

  return [...DEFAULT_DIVISIONS];
}

/**
 * Persists the list of custom divisions
 */
export function saveStoredDivisions(
  divisions: string[],
  updatedAt?: string,
  version?: number
): void {
  const cleanList = Array.from(new Set(divisions.map((d) => (d || '').trim()).filter(Boolean)));
  memoryDivisions = cleanList;
  safeLocalStorageSet(DIVISIONS_STORAGE_KEY, JSON.stringify(cleanList));
  safeLocalStorageSet(LEGACY_DIVISIONS_STORAGE_KEY, JSON.stringify(cleanList));
  if (updatedAt) {
    saveStoredOrgUpdatedAt(updatedAt);
  }
  if (typeof version === 'number' && version > 0) {
    saveStoredOrgVersion(version);
  }
}

/**
 * Adds a new department to storage and returns updated list
 */
export function addCustomDepartment(newDept: string, currentList: string[]): string[] {
  const trimmed = newDept.trim();
  if (!trimmed) return currentList;
  if (currentList.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
    return currentList;
  }
  const updated = [...currentList, trimmed];
  saveStoredDepartments(updated, new Date().toISOString());
  return updated;
}

/**
 * Adds a new division to storage and returns updated list
 */
export function addCustomDivision(newDiv: string, currentList: string[]): string[] {
  const trimmed = newDiv.trim();
  if (!trimmed) return currentList;
  if (currentList.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
    return currentList;
  }
  const updated = [...currentList, trimmed];
  saveStoredDivisions(updated, new Date().toISOString());
  return updated;
}
