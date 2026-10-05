import { Booking, User } from '../types';
import { getBookingJobNumber } from './dateHelpers';

export const LINE_MODULE_STORAGE_KEY = 'car_booking_line_module_enabled';
const DEFAULT_SHARED_APP_URL =
  'https://ais-pre-mlfwobw4wmpyzxvnmmwv5v-416326471534.asia-southeast1.run.app';

/**
 * Savepoint & Modular Toggle for LINE Integration:
 * Allows enabling/disabling the entire LINE request & approval module cleanly
 * without affecting any core fleet, calendar, user, or department/division data.
 */
export function getLineModuleEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem(LINE_MODULE_STORAGE_KEY);
  if (saved === null) return true;
  return saved === 'true';
}

export function setLineModuleEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LINE_MODULE_STORAGE_KEY, String(enabled));
}

export function formatThaiDateTimeForLine(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const datePart = d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${datePart} เวลา ${timePart} น.`;
  } catch {
    return isoString;
  }
}

export function getAppBaseUrl(): string {
  if (typeof window === 'undefined') {
    return `${DEFAULT_SHARED_APP_URL}/`;
  }
  const publicOrigin = window.location.origin.replace('://ais-dev-', '://ais-pre-');
  return `${publicOrigin}${window.location.pathname}`;
}

export function buildLineDeepLinks(
  bookingId: string,
  stage: 1 | 2,
  approverId?: string
): {
  approvalUrl: string;
  rejectUrl: string;
  reviewUrl: string;
} {
  const base = getAppBaseUrl();
  const approverParam = approverId ? `&approverId=${encodeURIComponent(approverId)}` : '';
  return {
    approvalUrl: `${base}?lineBookingId=${encodeURIComponent(bookingId)}&stage=${stage}&action=approve${approverParam}&openExternalBrowser=1`,
    rejectUrl: `${base}?lineBookingId=${encodeURIComponent(bookingId)}&stage=${stage}&action=reject${approverParam}&openExternalBrowser=1`,
    reviewUrl: `${base}?lineBookingId=${encodeURIComponent(bookingId)}&stage=${stage}&action=review${approverParam}&openExternalBrowser=1`,
  };
}

export function buildLineShareMessage(
  booking: Booking,
  stage: 1 | 2 | 'approved' | 'rejected',
  approverName?: string,
  approverId?: string,
  targetLineId?: string
): string {
  const effectiveStageNum: 1 | 2 = stage === 2 || booking.status === 'Pending_Approve2' ? 2 : 1;
  const links = buildLineDeepLinks(booking.id, effectiveStageNum, approverId);
  const jobNo = getBookingJobNumber(booking);

  const deptInfo = [booking.userDepartment, booking.userDivision].filter(Boolean).join(' / ');
  const requesterLineLabel = booking.requesterLineId ? ` [LINE ID: ${booking.requesterLineId}]` : '';

  if (stage === 'approved' || booking.status === 'Approved') {
    return [
      `✅ [แจ้งผลอนุมัติใช้รถครบ 2 ขั้นตอน]`,
      `📄 หมายเลขใบงาน: ${jobNo}`,
      `เรียนคุณ ${booking.userName}${requesterLineLabel}`,
      `━━━━━━━━━━━━━━`,
      `👤 ผู้ขอใช้รถ: ${booking.userName}${deptInfo ? ` (${deptInfo})` : ''}`,
      `🚘 รถยนต์: ${booking.vehicleName}`,
      `📅 เริ่มเดินทาง: ${formatThaiDateTimeForLine(booking.startDate)}`,
      `🏁 คืนรถยนต์: ${formatThaiDateTimeForLine(booking.endDate)}`,
      `📍 ปลายทาง: ${booking.destination} (${booking.passengersCount} คน)`,
      `📝 วัตถุประสงค์: ${booking.purpose}`,
      `━━━━━━━━━━━━━━`,
      `✔️ ขั้นที่ 1 (Approve 1): ${booking.stage1ApprovedBy || booking.assignedApproverName || '-'}`,
      `✔️ ขั้นที่ 2 (Approve 2): ${booking.stage2ApprovedBy || booking.stage2ApproverName || '-'}`,
      `🛡️ สถานะ: อนุมัติสมบูรณ์ พร้อมนำรถออกเดินทาง`,
      `🔗 เปิดดูใบจองและบันทึกไมล์เดินทาง:`,
      `${links.reviewUrl}`,
    ].join('\n');
  }

  if (stage === 'rejected' || booking.status === 'Cancelled') {
    const rejectedStageLabel = booking.rejectedStage
      ? `ขั้นที่ ${booking.rejectedStage} (Approve ${booking.rejectedStage})`
      : 'ผู้อนุมัติ';
    return [
      `❌ [แจ้งผล: ไม่อนุมัติคำขอใช้รถ]`,
      `📄 หมายเลขใบงาน: ${jobNo}`,
      `เรียนคุณ ${booking.userName}${requesterLineLabel}`,
      `━━━━━━━━━━━━━━`,
      `👤 ผู้ขอใช้รถ: ${booking.userName}${deptInfo ? ` (${deptInfo})` : ''}`,
      `🚘 รถยนต์: ${booking.vehicleName}`,
      `📅 กำหนดการ: ${formatThaiDateTimeForLine(booking.startDate)}`,
      `📍 ปลายทาง: ${booking.destination}`,
      `━━━━━━━━━━━━━━`,
      `🚫 ผู้ไม่อนุมัติ: ${booking.rejectedBy || rejectedStageLabel}`,
      `💬 เหตุผลที่ไม่อนุมัติ: ${booking.rejectionReason || 'ไม่ได้ระบุเหตุผล'}`,
      `━━━━━━━━━━━━━━`,
      `🔗 ตรวจสอบรายละเอียดในระบบ:`,
      `${links.reviewUrl}`,
    ].join('\n');
  }

  const stageTitle =
    effectiveStageNum === 2
      ? `🔵 [แจ้งเตือนคำขอใช้รถส่วนกลาง - ขั้นที่ 2 (Approve 2)]`
      : `🟢 [แจ้งเตือนคำขอใช้รถส่วนกลาง - ขั้นที่ 1 (Approve 1)]`;

  const targetApproverLabel =
    approverName ||
    (effectiveStageNum === 1
      ? booking.assignedApproverName || 'ผู้อนุมัติขั้นที่ 1 (Approve 1)'
      : booking.stage2ApproverName || 'ผู้อนุมัติขั้นที่ 2 (Approve 2)');

  const resolvedApproverLineId =
    targetLineId ||
    (effectiveStageNum === 1 ? booking.assignedApproverLineId : booking.stage2ApproverLineId) ||
    '';

  const approverLineTag = resolvedApproverLineId ? ` (LINE ID: ${resolvedApproverLineId})` : '';

  const stage1Note =
    effectiveStageNum === 2 && booking.stage1ApprovedBy
      ? `\n✔️ ขั้นที่ 1 (Approve 1) อนุมัติแล้วโดย: ${booking.stage1ApprovedBy}`
      : '';

  return [
    stageTitle,
    `📄 หมายเลขใบงาน: ${jobNo}`,
    `เรียนคุณ ${targetApproverLabel}${approverLineTag}`,
    `━━━━━━━━━━━━━━`,
    `👤 ผู้ขอใช้รถ: ${booking.userName}${deptInfo ? ` (${deptInfo})` : ''}${requesterLineLabel}`,
    `📞 เบอร์โทร: ${booking.userPhone || '-'}`,
    `🚘 รถยนต์: ${booking.vehicleName}`,
    `📅 เริ่มเดินทาง: ${formatThaiDateTimeForLine(booking.startDate)}`,
    `🏁 คืนรถยนต์: ${formatThaiDateTimeForLine(booking.endDate)}`,
    `📍 ปลายทาง: ${booking.destination} (${booking.passengersCount} คน)`,
    `📝 ภารกิจ: ${booking.purpose}${stage1Note}`,
    `━━━━━━━━━━━━━━`,
    `🔍 ดูรายละเอียด:`,
    `${links.reviewUrl}`,
  ].join('\n');
}

export function getLineShareUrl(messageText: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(messageText)}`;
}

export async function triggerServerLineApprovalPush(params: {
  booking: Booking;
  stage: 1 | 2 | 'approved' | 'rejected';
  approverUser?: User | null;
  approverName?: string;
  targetLineId?: string;
}): Promise<{
  ok: boolean;
  oaPushSuccess: boolean;
  oaPushMode: 'push' | 'broadcast' | 'share_only';
  oaError?: string;
}> {
  const { booking, stage, approverUser, approverName, targetLineId } = params;
  const effectiveStageNum: 1 | 2 = stage === 2 || booking.status === 'Pending_Approve2' ? 2 : 1;
  const links = buildLineDeepLinks(booking.id, effectiveStageNum, approverUser?.id);

  const resolvedLineId =
    targetLineId ||
    approverUser?.lineUserId ||
    (stage === 'approved' || stage === 'rejected'
      ? booking.requesterLineId
      : stage === 2
      ? booking.stage2ApproverLineId
      : booking.assignedApproverLineId) ||
    '';

  try {
    const resp = await fetch('/api/line/send-approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booking,
        stage,
        approverLineId: resolvedLineId,
        approverName:
          approverName ||
          approverUser?.name ||
          (stage === 2 ? booking.stage2ApproverName : booking.assignedApproverName) ||
          '',
        approvalUrl: links.approvalUrl,
        rejectUrl: links.rejectUrl,
        reviewUrl: links.reviewUrl,
      }),
    });
    if (!resp.ok) {
      return { ok: false, oaPushSuccess: false, oaPushMode: 'share_only' };
    }
    const data = await resp.json();
    return {
      ok: true,
      oaPushSuccess: Boolean(data.oaPushSuccess),
      oaPushMode: data.oaPushMode || 'share_only',
      oaError: data.oaError,
    };
  } catch {
    return { ok: false, oaPushSuccess: false, oaPushMode: 'share_only' };
  }
}
