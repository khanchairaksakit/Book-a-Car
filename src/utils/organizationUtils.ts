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

const DEPARTMENTS_STORAGE_KEY = 'car_booking_departments';
const DIVISIONS_STORAGE_KEY = 'car_booking_divisions';
const ORG_UPDATED_AT_STORAGE_KEY = 'car_booking_org_updated_at';

export function getStoredOrgUpdatedAt(): string {
  try {
    return localStorage.getItem(ORG_UPDATED_AT_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveStoredOrgUpdatedAt(updatedAt: string): void {
  try {
    if (updatedAt) {
      localStorage.setItem(ORG_UPDATED_AT_STORAGE_KEY, updatedAt);
    }
  } catch {
    // ignore
  }
}

/**
 * Retrieves the stored departments without resurrecting renamed/deleted items from existingUsers
 */
export function getStoredDepartments(_existingUsers?: User[]): string[] {
  try {
    const raw = localStorage.getItem(DEPARTMENTS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const list = parsed
          .filter((item) => typeof item === 'string' && item.trim().length > 0)
          .map((d) => d.trim());
        return Array.from(new Set(list));
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
export function saveStoredDepartments(departments: string[], updatedAt?: string): void {
  try {
    const cleanList = Array.from(new Set(departments.map((d) => (d || '').trim()).filter(Boolean)));
    localStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(cleanList));
    if (updatedAt) {
      localStorage.setItem(ORG_UPDATED_AT_STORAGE_KEY, updatedAt);
    }
  } catch (e) {
    console.error('Error saving departments:', e);
  }
}

/**
 * Retrieves the stored divisions without resurrecting renamed/deleted items from existingUsers
 */
export function getStoredDivisions(_existingUsers?: User[]): string[] {
  try {
    const raw = localStorage.getItem(DIVISIONS_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const list = parsed
          .filter((item) => typeof item === 'string' && item.trim().length > 0)
          .map((d) => d.trim());
        return Array.from(new Set(list));
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
export function saveStoredDivisions(divisions: string[], updatedAt?: string): void {
  try {
    const cleanList = Array.from(new Set(divisions.map((d) => (d || '').trim()).filter(Boolean)));
    localStorage.setItem(DIVISIONS_STORAGE_KEY, JSON.stringify(cleanList));
    if (updatedAt) {
      localStorage.setItem(ORG_UPDATED_AT_STORAGE_KEY, updatedAt);
    }
  } catch (e) {
    console.error('Error saving divisions:', e);
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
