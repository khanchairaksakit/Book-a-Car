/**
 * Date helper utilities for real-time calendar and strict anti-past-booking validation ("ห้ามจองย้อนหลัง")
 */

/**
 * Returns today's date formatted as YYYY-MM-DD based on local time
 */
export function getRealTodayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks whether a YYYY-MM-DD date is strictly in the past (before today)
 */
export function isDateInPast(dateStr: string): boolean {
  if (!dateStr) return false;
  const todayStr = getRealTodayStr();
  const cleanDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.substring(0, 10);
  return cleanDateStr < todayStr;
}

/**
 * Checks whether a YYYY-MM-DD date is today
 */
export function isDateToday(dateStr: string): boolean {
  if (!dateStr) return false;
  const todayStr = getRealTodayStr();
  const cleanDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.substring(0, 10);
  return cleanDateStr === todayStr;
}

/**
 * Validates whether a booking start date and end date are acceptable (no past bookings allowed)
 */
export function validateBookingDates(startDateStr: string, endDateStr: string): {
  isValid: boolean;
  errorMessage?: string;
} {
  const todayStr = getRealTodayStr();
  const cleanStart = startDateStr.includes('T') ? startDateStr.split('T')[0] : startDateStr.substring(0, 10);
  const cleanEnd = endDateStr.includes('T') ? endDateStr.split('T')[0] : endDateStr.substring(0, 10);

  if (!cleanStart) {
    return { isValid: false, errorMessage: 'กรุณาระบุวันที่เริ่มใช้รถ' };
  }

  // Strict anti-past-booking rule ("ห้ามจองย้อนหลัง")
  if (cleanStart < todayStr) {
    return {
      isValid: false,
      errorMessage: `ไม่อนุญาตให้จองรถย้อนหลัง (วันที่เลือก: ${cleanStart} เป็นวันที่ผ่านมาแล้ว กรุณาเลือกตั้งแต่วันที่ ${todayStr} เป็นต้นไป)`,
    };
  }

  if (cleanEnd && cleanEnd < cleanStart) {
    return {
      isValid: false,
      errorMessage: 'วันที่คืนรถต้องไม่น้อยกว่าวันที่เริ่มใช้รถ',
    };
  }

  return { isValid: true };
}
