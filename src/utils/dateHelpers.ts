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

/**
 * Extracts YYYYMMDD from an ISO date string (or returns today's YYYYMMDD)
 */
function extractDateStamp(dateStr?: string): string {
  if (dateStr && dateStr.length >= 10) {
    const clean = dateStr.substring(0, 10).replace(/-/g, '');
    if (/^\d{8}$/.test(clean)) return clean;
  }
  return getRealTodayStr().replace(/-/g, '');
}

/**
 * Generates the next sequential Job Number (หมายเลขใบงาน) for a new booking, e.g. AX-20261005-001
 */
export function generateNextJobNumber(
  existingBookings: Array<{ id?: string; jobNumber?: string; createdAt?: string; startDate?: string }>,
  createdAtIso?: string
): string {
  const dateStamp = extractDateStamp(createdAtIso || getRealTodayStr());
  const prefixAx = `AX-${dateStamp}-`;
  const prefixJob = `JOB-${dateStamp}-`;

  let maxSeq = 0;
  let sameDayCount = 0;

  for (const b of existingBookings) {
    if (b.jobNumber && (b.jobNumber.startsWith(prefixAx) || b.jobNumber.startsWith(prefixJob))) {
      const rawSeq = b.jobNumber.startsWith(prefixAx)
        ? b.jobNumber.slice(prefixAx.length)
        : b.jobNumber.slice(prefixJob.length);
      const seqPart = parseInt(rawSeq, 10);
      if (!isNaN(seqPart) && seqPart > maxSeq) {
        maxSeq = seqPart;
      }
    } else {
      const bStamp = extractDateStamp(b.createdAt || b.startDate);
      if (bStamp === dateStamp) {
        sameDayCount += 1;
      }
    }
  }

  const nextSeq = Math.max(maxSeq, sameDayCount) + 1;
  return `${prefixAx}${String(nextSeq).padStart(3, '0')}`;
}

/**
 * Returns the formatted Job Number (หมายเลขใบงาน) for any booking.
 * Uses booking.jobNumber if already stored, or derives a consistent AX-YYYYMMDD-XXX identifier.
 */
export function getBookingJobNumber(booking: {
  id: string;
  jobNumber?: string;
  createdAt?: string;
  startDate?: string;
}): string {
  if (booking.jobNumber && booking.jobNumber.trim()) {
    return booking.jobNumber.trim().replace(/^JOB-/i, 'AX-');
  }
  const dateStamp = extractDateStamp(booking.createdAt || booking.startDate);
  const digitsOnly = (booking.id || '').replace(/\D/g, '');
  const suffix = digitsOnly.length >= 3 ? digitsOnly.slice(-3) : (booking.id || '001').slice(-3).toUpperCase();
  return `AX-${dateStamp}-${suffix.padStart(3, '0')}`;
}

