import { Vehicle, Booking } from '../types';

export interface VehicleAlert {
  id: string;
  type: 'mileage' | 'tax' | 'tires';
  severity: 'critical' | 'warning';
  title: string;
  message: string;
  details: string;
  badgeLabel: string;
  currentValue?: string;
  targetValue?: string;
}

/**
 * Format number with comma separators (e.g. 45,000)
 */
export function formatMileage(mileage?: number): string {
  if (mileage === undefined || mileage === null || isNaN(mileage)) return 'ไม่ได้ระบุ';
  return `${mileage.toLocaleString()} กม.`;
}

/**
 * Format date into Thai readable format
 */
export function formatThaiDate(dateString?: string): string {
  if (!dateString) return 'ไม่ได้ระบุ';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Format trip start and end date/time into a clear Thai string
 */
export function formatTripDateTime(startStr?: string, endStr?: string): string {
  if (!startStr) return 'ไม่ระบุวันเวลา';
  try {
    const start = new Date(startStr);
    if (isNaN(start.getTime())) return startStr;

    const dateFormatted = start.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const startTime = startStr.length >= 16 ? startStr.substring(11, 16) : '';
    const endTime = endStr && endStr.length >= 16 ? endStr.substring(11, 16) : '';

    const startDateOnly = startStr.substring(0, 10);
    const endDateOnly = endStr ? endStr.substring(0, 10) : '';

    if (!endDateOnly || startDateOnly === endDateOnly) {
      if (startTime && endTime) {
        return `${dateFormatted} (${startTime} - ${endTime} น.)`;
      } else if (startTime) {
        return `${dateFormatted} (${startTime} น.)`;
      }
      return dateFormatted;
    } else {
      const end = new Date(endStr!);
      const endDateFormatted = !isNaN(end.getTime())
        ? end.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : endDateOnly;
      return `${dateFormatted} ${startTime || ''} - ${endDateFormatted} ${endTime || ''} น.`;
    }
  } catch {
    return `${startStr} - ${endStr || ''}`;
  }
}

/**
 * Checks whether a booking belongs to the given vehicle (by vehicleId, plateNumber, or vehicleName)
 */
export function doesBookingMatchVehicle(b?: Booking | null, v?: Vehicle | null): boolean {
  if (!b || !v) return false;
  if (b.vehicleId && v.id && b.vehicleId === v.id) return true;
  const bPlate = (b.plateNumber || '').trim().toLowerCase();
  const vPlate = (v.plateNumber || '').trim().toLowerCase();
  if (bPlate && vPlate && bPlate === vPlate) return true;
  const bVehName = (b.vehicleName || '').trim().toLowerCase();
  if (bVehName && vPlate && bVehName.includes(vPlate)) return true;
  const vBrandModel = `${v.brand || ''} ${v.model || ''}`.trim().toLowerCase();
  if (bVehName && vBrandModel.length >= 3 && bVehName.startsWith(vBrandModel) && (!bPlate || !vPlate)) {
    return true;
  }
  return false;
}

/**
 * Checks whether a booking status represents an active / unfinished mission or reservation
 */
export function isBookingActiveStatus(status?: string): boolean {
  return (
    status === 'Approved' ||
    status === 'Pending' ||
    status === 'Pending_Approve2'
  );
}

/**
 * Checks whether a booking covers a target YYYY-MM-DD date.
 * Also treats unreturned active missions (status === 'Approved' or unfinished) that started on/before today as covering today.
 */
export function doesBookingCoverDate(
  b: Booking,
  targetDateStr: string,
  todayStr?: string
): boolean {
  if (!b || b.status === 'Cancelled') return false;
  const start = (b.startDate || '').substring(0, 10);
  const end = (b.endDate || '').substring(0, 10) || start;
  if (!start || !targetDateStr) return false;

  if (targetDateStr >= start && targetDateStr <= end) {
    return true;
  }

  // If the booking is an active unreturned mission (not Completed and not Cancelled)
  // that already started on or before targetDateStr, and targetDateStr is up through today,
  // the vehicle is still on an active mission until returned.
  if (
    todayStr &&
    isBookingActiveStatus(b.status) &&
    start <= targetDateStr &&
    targetDateStr <= todayStr
  ) {
    return true;
  }

  return false;
}

/**
 * Get the most relevant active or recent booking/usage for a given vehicle
 */
export function getLatestVehicleUsage(
  vehicleOrId: Vehicle | string,
  bookings: Booking[] = []
): Booking | null {
  if (!vehicleOrId || !bookings || bookings.length === 0) return null;

  const vehicleBookings = bookings.filter((b) => {
    if (!b || b.status === 'Cancelled') return false;
    if (typeof vehicleOrId === 'string') {
      return b.vehicleId === vehicleOrId;
    }
    return doesBookingMatchVehicle(b, vehicleOrId);
  });

  if (vehicleBookings.length === 0) return null;

  const statusPriority = (st: string) => {
    if (st === 'Approved') return 3;
    if (st === 'Pending_Approve2') return 2;
    if (st === 'Pending') return 1;
    return 0;
  };

  // Prioritize active missions first, then sort descending by startDate
  vehicleBookings.sort((a, b) => {
    const pDiff = statusPriority(b.status) - statusPriority(a.status);
    if (pDiff !== 0) return pDiff;
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  return vehicleBookings[0];
}

/**
 * Calculate difference in days from today/reference date to target date
 */
export function getDaysRemaining(targetDateStr?: string, referenceDate: Date = new Date()): number | null {
  if (!targetDateStr) return null;
  try {
    const target = new Date(targetDateStr);
    if (isNaN(target.getTime())) return null;
    
    // Normalize to midnight for fair day comparison
    const t = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
    const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()).getTime();
    
    const diffTime = t - ref;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

/**
 * Compute all active alerts for a vehicle
 */
export function getVehicleAlerts(vehicle: Vehicle, referenceDate: Date = new Date()): VehicleAlert[] {
  const alerts: VehicleAlert[] = [];

  // 1. Mileage Alert (การเช็คระยะ / เลขไมล์)
  if (vehicle.currentMileage !== undefined && vehicle.currentMileage > 0) {
    if (vehicle.mileageAlertThreshold !== undefined && vehicle.mileageAlertThreshold > 0) {
      const remainingKm = vehicle.mileageAlertThreshold - vehicle.currentMileage;
      
      if (remainingKm <= 0) {
        // Exceeded or reached
        alerts.push({
          id: `${vehicle.id}-mileage-critical`,
          type: 'mileage',
          severity: 'critical',
          title: '🚨 ถึงกำหนดเช็คระยะ / เปลี่ยนถ่ายของเหลว',
          message: `เลขไมล์ปัจจุบัน (${vehicle.currentMileage.toLocaleString()} กม.) ถึง/เกินกำหนดเช็คระยะแล้ว (${vehicle.mileageAlertThreshold.toLocaleString()} กม.)`,
          details: `เกินกำหนดมาแล้ว ${Math.abs(remainingKm).toLocaleString()} กม. ควรนำรถเข้าศูนย์บริการทันที`,
          badgeLabel: 'เกินกำหนดเช็คระยะ',
          currentValue: `${vehicle.currentMileage.toLocaleString()} กม.`,
          targetValue: `${vehicle.mileageAlertThreshold.toLocaleString()} กม.`,
        });
      } else if (remainingKm <= 1000) {
        // Near threshold (within 1,000 km)
        alerts.push({
          id: `${vehicle.id}-mileage-warning`,
          type: 'mileage',
          severity: 'warning',
          title: '⚠️ ใกล้ถึงรอบเช็คระยะ',
          message: `เลขไมล์ปัจจุบัน ${vehicle.currentMileage.toLocaleString()} กม. (เหลืออีก ${remainingKm.toLocaleString()} กม. ถึงรอบเช็คระยะ)`,
          details: `กำหนดเช็คระยะที่ ${vehicle.mileageAlertThreshold.toLocaleString()} กม. โปรดเตรียมนำรถเข้าตรวจเช็ค`,
          badgeLabel: `เหลือ ${remainingKm.toLocaleString()} กม.`,
          currentValue: `${vehicle.currentMileage.toLocaleString()} กม.`,
          targetValue: `${vehicle.mileageAlertThreshold.toLocaleString()} กม.`,
        });
      }
    }
  }

  // 2. Tax Expiry Alert (ภาษีประจำปี / พ.ร.บ.)
  if (vehicle.taxExpiryDate) {
    const daysRemaining = getDaysRemaining(vehicle.taxExpiryDate, referenceDate);
    const alertDaysBefore = vehicle.taxAlertDaysBefore && vehicle.taxAlertDaysBefore > 0 
      ? vehicle.taxAlertDaysBefore 
      : 30; // default 30 days before expiry

    if (daysRemaining !== null) {
      if (daysRemaining < 0) {
        // Expired
        alerts.push({
          id: `${vehicle.id}-tax-critical`,
          type: 'tax',
          severity: 'critical',
          title: '🚨 ภาษีรถยนต์หมดอายุแล้ว!',
          message: `ภาษีรถยนต์คันนี้หมดอายุเมื่อ ${formatThaiDate(vehicle.taxExpiryDate)} (เลยกำหนดมาแล้ว ${Math.abs(daysRemaining)} วัน)`,
          details: 'ห้ามนำรถที่ขาดต่อภาษีออกวิ่งบนทางสาธารณะ กรุณาดำเนินการต่อภาษีทันที',
          badgeLabel: 'ภาษีหมดอายุ',
          currentValue: formatThaiDate(vehicle.taxExpiryDate),
          targetValue: 'หมดอายุแล้ว',
        });
      } else if (daysRemaining <= alertDaysBefore) {
        // Expiring soon
        alerts.push({
          id: `${vehicle.id}-tax-warning`,
          type: 'tax',
          severity: 'warning',
          title: '⚠️ ภาษีรถยนต์ใกล้หมดอายุ',
          message: `ภาษีจะหมดอายุในวันที่ ${formatThaiDate(vehicle.taxExpiryDate)} (เหลือเวลาอีก ${daysRemaining} วัน)`,
          details: `ระบบแจ้งเตือนล่วงหน้า ${alertDaysBefore} วัน โปรดส่งเอกสารเพื่อต่อภาษีประจำปี`,
          badgeLabel: `หมดอายุใน ${daysRemaining} วัน`,
          currentValue: formatThaiDate(vehicle.taxExpiryDate),
          targetValue: `${daysRemaining} วัน`,
        });
      }
    }
  }

  // 3. Tire Alert (ยางรถยนต์ - ตรวจสอบตามเลขไมล์)
  if (vehicle.currentMileage !== undefined && vehicle.tireAlertMileage !== undefined && vehicle.tireAlertMileage > 0) {
    const remainingTireKm = vehicle.tireAlertMileage - vehicle.currentMileage;
    if (remainingTireKm <= 0) {
      alerts.push({
        id: `${vehicle.id}-tires-mileage-critical`,
        type: 'tires',
        severity: 'critical',
        title: '🚨 ถึงกำหนดเปลี่ยนยางรถยนต์ (ตามระยะทาง)',
        message: `เลขไมล์ปัจจุบัน (${vehicle.currentMileage.toLocaleString()} กม.) ถึงรอบเปลี่ยนยางแล้ว (${vehicle.tireAlertMileage.toLocaleString()} กม.)`,
        details: vehicle.tireInfo ? `ขนาดยาง: ${vehicle.tireInfo} - ควรตรวจสอบดอกยางและเปลี่ยนทันที` : 'เพื่อความปลอดภัยในการเดินทาง ควรตรวจเช็คดอกยางและเปลี่ยนทันที',
        badgeLabel: 'ถึงรอบเปลี่ยนยาง',
        currentValue: `${vehicle.currentMileage.toLocaleString()} กม.`,
        targetValue: `${vehicle.tireAlertMileage.toLocaleString()} กม.`,
      });
    } else if (remainingTireKm <= 1500) {
      alerts.push({
        id: `${vehicle.id}-tires-mileage-warning`,
        type: 'tires',
        severity: 'warning',
        title: '⚠️ ใกล้ถึงรอบเปลี่ยนยางรถยนต์',
        message: `เหลือระยะทางอีก ${remainingTireKm.toLocaleString()} กม. จะถึงกำหนดเปลี่ยนยางรอบถัดไป`,
        details: `กำหนดเปลี่ยนที่ ${vehicle.tireAlertMileage.toLocaleString()} กม. ${vehicle.tireInfo ? `(${vehicle.tireInfo})` : ''}`,
        badgeLabel: `ยางเหลือ ${remainingTireKm.toLocaleString()} กม.`,
        currentValue: `${vehicle.currentMileage.toLocaleString()} กม.`,
        targetValue: `${vehicle.tireAlertMileage.toLocaleString()} กม.`,
      });
    }
  }

  return alerts;
}
