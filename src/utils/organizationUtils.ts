import { User } from '../types';

export const DEFAULT_DEPARTMENTS: string[] = [
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
  'ฝ่ายพัฒนาธุรกิจและการตลาด',
  'ฝ่ายทรัพยากรบุคคลและการจัดการ',
  'ฝ่ายเทคโนโลยีสารสนเทศและดิจิทัล',
  'ฝ่ายปฏิบัติการและการผลิต',
  'ฝ่ายการเงินและบัญชีกลาง',
  'ฝ่ายบริหารจัดการอาคารและยานพาหนะ',
  'ฝ่ายจัดซื้อและคลังสินค้า',
  'ฝ่ายอำนวยการและบริหารทั่วไป',
];

const DEPARTMENTS_STORAGE_KEY = 'car_booking_departments';
const DIVISIONS_STORAGE_KEY = 'car_booking_divisions';

/**
 * Retrieves the stored departments, merged with any custom departments already used by existing users
 */
export function getStoredDepartments(existingUsers?: User[]): string[] {
  let list: string[] = [];
  try {
    const raw = localStorage.getItem(DEPARTMENTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        list = parsed.filter((item) => typeof item === 'string' && item.trim().length > 0);
      }
    }
  } catch (e) {
    console.error('Error loading stored departments:', e);
  }

  if (list.length === 0) {
    list = [...DEFAULT_DEPARTMENTS];
  }

  // Merge any distinct departments from existing users
  if (existingUsers && Array.isArray(existingUsers)) {
    existingUsers.forEach((u) => {
      const dept = (u.department || '').trim();
      if (dept && dept !== '-' && !list.includes(dept)) {
        list.push(dept);
      }
    });
  }

  // Deduplicate and trim
  const cleanSet = new Set(list.map((d) => d.trim()).filter(Boolean));
  return Array.from(cleanSet);
}

/**
 * Persists the list of custom departments
 */
export function saveStoredDepartments(departments: string[]): void {
  try {
    const cleanList = Array.from(new Set(departments.map((d) => d.trim()).filter(Boolean)));
    localStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(cleanList));
  } catch (e) {
    console.error('Error saving departments:', e);
  }
}

/**
 * Retrieves the stored divisions, merged with any custom divisions already used by existing users
 */
export function getStoredDivisions(existingUsers?: User[]): string[] {
  let list: string[] = [];
  try {
    const raw = localStorage.getItem(DIVISIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        list = parsed.filter((item) => typeof item === 'string' && item.trim().length > 0);
      }
    }
  } catch (e) {
    console.error('Error loading stored divisions:', e);
  }

  if (list.length === 0) {
    list = [...DEFAULT_DIVISIONS];
  }

  // Merge any distinct divisions from existing users
  if (existingUsers && Array.isArray(existingUsers)) {
    existingUsers.forEach((u) => {
      const div = (u.division || '').trim();
      if (div && div !== '-' && !list.includes(div)) {
        list.push(div);
      }
    });
  }

  // Deduplicate and trim
  const cleanSet = new Set(list.map((d) => d.trim()).filter(Boolean));
  return Array.from(cleanSet);
}

/**
 * Persists the list of custom divisions
 */
export function saveStoredDivisions(divisions: string[]): void {
  try {
    const cleanList = Array.from(new Set(divisions.map((d) => d.trim()).filter(Boolean)));
    localStorage.setItem(DIVISIONS_STORAGE_KEY, JSON.stringify(cleanList));
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
  saveStoredDepartments(updated);
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
  saveStoredDivisions(updated);
  return updated;
}
