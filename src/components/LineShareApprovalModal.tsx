import React, { useState, useEffect } from 'react';
import { Booking, User, BookingStatus } from '../types';
import {
  buildLineDeepLinks,
  buildLineShareMessage,
  formatThaiDateTimeForLine,
  getLineShareUrl,
  triggerServerLineApprovalPush,
} from '../utils/lineApprovalUtils';
import { getBookingJobNumber } from '../utils/dateHelpers';
import {
  X,
  Check,
  Copy,
  Send,
  ExternalLink,
  Smartphone,
  ShieldCheck,
  UserCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  ArrowRight,
} from 'lucide-react';

interface LineShareApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  users: User[];
  currentUser: User | null;
  onOpenQuickApprove?: (
    booking: Booking,
    stage: 1 | 2,
    initialAction?: 'approve' | 'reject' | 'review'
  ) => void;
  onMarkLineNotified?: (bookingId: string) => void;
  onUpdateBookingStatus?: (
    bookingId: string,
    status: BookingStatus,
    extraData?: Partial<Booking>
  ) => void;
  onUpdateUserLineId?: (userId: string, lineId: string) => void;
}

export default function LineShareApprovalModal({
  isOpen,
  onClose,
  booking,
  users,
  onOpenQuickApprove,
  onMarkLineNotified,
  onUpdateBookingStatus,
  onUpdateUserLineId,
}: LineShareApprovalModalProps) {
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSendingOa, setIsSendingOa] = useState(false);
  const [oaStatusMsg, setOaStatusMsg] = useState<{
    type: 'success' | 'info';
    text: string;
  } | null>(null);
  const [lineServerConfigured, setLineServerConfigured] = useState<boolean>(false);

  // Editable LINE IDs for User, Approve 1, and Approve 2
  const [requesterLineId, setRequesterLineId] = useState('');
  const [approve1LineId, setApprove1LineId] = useState('');
  const [approve2LineId, setApprove2LineId] = useState('');
  const [savedLineIdsMsg, setSavedLineIdsMsg] = useState(false);

  const requesterUser = users.find((u) => u.id === booking?.userId);
  const stage1Approver = users.find((u) => u.id === booking?.assignedApproverId);
  const stage2Approvers = users.filter((u) => Boolean(u.roles && u.roles.includes('Approve 2')));
  const stage2Approver =
    users.find((u) => u.id === booking?.stage2ApproverId) ||
    stage2Approvers[0];

  useEffect(() => {
    if (!isOpen || !booking) return;
    setCopiedText(false);
    setCopiedLink(false);
    setOaStatusMsg(null);
    setSavedLineIdsMsg(false);

    setRequesterLineId(booking.requesterLineId || requesterUser?.lineUserId || '');
    setApprove1LineId(booking.assignedApproverLineId || stage1Approver?.lineUserId || '');
    setApprove2LineId(booking.stage2ApproverLineId || stage2Approver?.lineUserId || '');

    fetch('/api/line/status')
      .then((r) => r.json())
      .then((data) => {
        setLineServerConfigured(Boolean(data?.configured));
      })
      .catch(() => {
        setLineServerConfigured(false);
      });
  }, [
    isOpen,
    booking?.id,
    booking?.requesterLineId,
    booking?.assignedApproverLineId,
    booking?.stage2ApproverLineId,
    requesterUser?.lineUserId,
    stage1Approver?.lineUserId,
    stage2Approver?.lineUserId,
  ]);

  if (!isOpen || !booking) return null;

  const isApproved = booking.status === 'Approved' || booking.status === 'Completed';
  const isRejected = booking.status === 'Cancelled';
  const isStage2 = booking.status === 'Pending_Approve2';
  const activeStageNum: 1 | 2 = isStage2 ? 2 : 1;

  const targetApprover = isStage2 ? stage2Approver : stage1Approver;

  const stageMode: 1 | 2 | 'approved' | 'rejected' = isApproved
    ? 'approved'
    : isRejected
    ? 'rejected'
    : isStage2
    ? 2
    : 1;

  const targetApproverLabel = isStage2
    ? booking.stage2ApproverName || stage2Approver?.name || 'ผู้อนุมัติขั้นที่ 2 (Approve 2)'
    : booking.assignedApproverName || stage1Approver?.name || 'ผู้อนุมัติขั้นที่ 1 (Approve 1)';

  const targetRecipientLineId =
    isApproved || isRejected
      ? requesterLineId
      : isStage2
      ? approve2LineId
      : approve1LineId;

  const enrichedBooking: Booking = {
    ...booking,
    requesterLineId: requesterLineId.trim() || booking.requesterLineId,
    assignedApproverLineId: approve1LineId.trim() || booking.assignedApproverLineId,
    stage2ApproverId: booking.stage2ApproverId || stage2Approver?.id,
    stage2ApproverName: booking.stage2ApproverName || stage2Approver?.name,
    stage2ApproverLineId: approve2LineId.trim() || booking.stage2ApproverLineId,
  };

  const shareMessage = buildLineShareMessage(
    enrichedBooking,
    stageMode,
    targetApproverLabel,
    targetApprover?.id,
    targetRecipientLineId
  );
  const lineShareHref = getLineShareUrl(shareMessage);
  const deepLinks = buildLineDeepLinks(booking.id, activeStageNum, targetApprover?.id);

  const handleSaveLineIds = () => {
    if (onUpdateUserLineId) {
      if (booking.userId && requesterLineId.trim()) {
        onUpdateUserLineId(booking.userId, requesterLineId.trim());
      }
      if (stage1Approver?.id && approve1LineId.trim()) {
        onUpdateUserLineId(stage1Approver.id, approve1LineId.trim());
      }
      if (stage2Approver?.id && approve2LineId.trim()) {
        onUpdateUserLineId(stage2Approver.id, approve2LineId.trim());
      }
    }
    if (onUpdateBookingStatus) {
      onUpdateBookingStatus(booking.id, booking.status, {
        requesterLineId: requesterLineId.trim() || undefined,
        assignedApproverLineId: approve1LineId.trim() || undefined,
        stage2ApproverId: stage2Approver?.id,
        stage2ApproverName: booking.stage2ApproverName || stage2Approver?.name,
        stage2ApproverLineId: approve2LineId.trim() || undefined,
      });
    }
    setSavedLineIdsMsg(true);
    setTimeout(() => setSavedLineIdsMsg(false), 3000);
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopiedText(true);
      if (onMarkLineNotified) onMarkLineNotified(booking.id);
      setTimeout(() => setCopiedText(false), 3000);
    } catch {
      // Fallback copy
    }
  };

  const handleCopyReviewLink = async () => {
    try {
      await navigator.clipboard.writeText(deepLinks.reviewUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      // Fallback
    }
  };

  const handleSendViaLineOA = async () => {
    handleSaveLineIds();
    setIsSendingOa(true);
    setOaStatusMsg(null);
    const res = await triggerServerLineApprovalPush({
      booking: enrichedBooking,
      stage: stageMode,
      approverUser: isApproved || isRejected ? requesterUser : targetApprover,
      approverName: isApproved || isRejected ? booking.userName : targetApproverLabel,
      targetLineId: targetRecipientLineId,
    });
    setIsSendingOa(false);
    if (onMarkLineNotified) onMarkLineNotified(booking.id);

    if (res.oaPushSuccess) {
      setOaStatusMsg({
        type: 'success',
        text: `ส่งการ์ดแจ้งเตือนผ่าน LINE ไปยัง ${
          isApproved || isRejected ? booking.userName : targetApproverLabel
        } (LINE ID: ${targetRecipientLineId || '-'}) เรียบร้อยแล้ว!`,
      });
    } else {
      setOaStatusMsg({
        type: 'info',
        text: `สร้างการ์ดแจ้งเตือนพร้อมแล้ว! กดปุ่ม "เปิดแอป LINE ส่งแจ้งเตือน" ด้านล่างเพื่อส่งเข้าแชท LINE ได้ทันที`,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[93vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#06C755] via-[#05b34c] to-emerald-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white font-extrabold text-lg shadow-inner border border-white/30">
              LINE
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base sm:text-lg leading-tight">
                  {isApproved
                    ? 'ส่ง LINE แจ้งผลการอนุมัติให้ผู้จองรถ (User)'
                    : isRejected
                    ? 'ส่ง LINE แจ้งผลไม่อนุมัติและเหตุผลให้ผู้จองรถ (User)'
                    : isStage2
                    ? 'ส่ง LINE แจ้งเตือนคำขอใช้รถ ขั้นที่ 2 (Approve 2)'
                    : 'ส่ง LINE แจ้งเตือนคำขอใช้รถ ขั้นที่ 1 (Approve 1)'}
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                  แจ้งเตือนทาง LINE
                </span>
              </div>
              <p className="text-xs text-emerald-50 mt-0.5">
                ส่งการ์ดแจ้งเตือนพร้อมปุ่มกดดูรายละเอียดใบงานผ่าน LINE
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50/60">
          {/* Left Column: Realistic LINE Chat & Flex Message Bubble Preview (5 cols) */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="text-xs font-bold text-gray-700 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-[#06C755]" />
                <span>ตัวอย่างข้อความการ์ดในแอป LINE</span>
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold">
                กดปุ่มบนการ์ดได้ทันที
              </span>
            </div>

            {/* Simulated LINE Chat Screen */}
            <div className="bg-[#8CABD9] rounded-2xl p-3.5 shadow-inner border border-slate-300 flex-1 flex flex-col justify-between space-y-3">
              {/* Chat Top Bar */}
              <div className="flex items-center justify-between text-white text-[11px] font-bold bg-slate-900/25 px-3 py-1.5 rounded-xl backdrop-blur-xs">
                <span className="flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-[#06C755]" />
                  <span>
                    ถึง:{' '}
                    {isApproved || isRejected
                      ? `${booking.userName} (${requesterLineId || 'User'})`
                      : `${targetApproverLabel} (${targetRecipientLineId || 'Approver'})`}
                  </span>
                </span>
                <span className="text-[10px] opacity-80 shrink-0">LINE Notify</span>
              </div>

              {/* Flex Message Bubble */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-md border border-slate-200/80 text-xs mx-auto w-full max-w-[300px]">
                {/* Bubble Header */}
                <div
                  className={`p-3.5 text-white ${
                    isApproved
                      ? 'bg-emerald-600'
                      : isRejected
                      ? 'bg-rose-600'
                      : isStage2
                      ? 'bg-blue-600'
                      : 'bg-[#06C755]'
                  }`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider opacity-85 block">
                    AX CAR RESERVATION NOTIFICATION
                  </span>
                  <h4 className="font-bold text-sm leading-snug mt-0.5">
                    {isApproved
                      ? '✅ อนุมัติคำขอใช้รถเรียบร้อยแล้ว'
                      : isRejected
                      ? '❌ คำขอไม่ได้รับการอนุมัติ'
                      : isStage2
                      ? '🚗 แจ้งเตือนคำขอใช้รถ (ขั้นที่ 2: Approve 2)'
                      : '🚗 แจ้งเตือนคำขอใช้รถ (ขั้นที่ 1: Approve 1)'}
                  </h4>
                  <p className="text-[11px] opacity-90 mt-0.5 truncate">
                    {isApproved
                      ? `แจ้งเตือนคุณ ${booking.userName} (${requesterLineId || '-'})`
                      : isRejected
                      ? `แจ้งเตือนคุณ ${booking.userName} • ไม่อนุมัติ`
                      : `เรียนคุณ ${targetApproverLabel} (${targetRecipientLineId || 'ยังไม่ระบุ LINE ID'})`}
                  </p>
                </div>

                {/* Bubble Body */}
                <div className="p-3.5 space-y-2 text-[11px]">
                  <div className="flex justify-between gap-2 pb-1.5 border-b border-gray-100">
                    <span className="text-gray-400 shrink-0">หมายเลขใบงาน:</span>
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      📄 {getBookingJobNumber(booking)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 shrink-0">ผู้ขอใช้รถ:</span>
                    <span className="font-bold text-gray-900 text-right truncate">
                      {booking.userName} ({booking.userDepartment || '-'})
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 shrink-0">LINE ผู้ขอ:</span>
                    <span className="font-mono font-semibold text-emerald-700 text-right truncate">
                      {requesterLineId || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 shrink-0">รถยนต์:</span>
                    <span className="font-bold text-indigo-700 text-right truncate">
                      {booking.vehicleName}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 shrink-0">เริ่มเดินทาง:</span>
                    <span className="text-gray-800 text-right font-medium">
                      {formatThaiDateTimeForLine(booking.startDate)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 shrink-0">คืนรถยนต์:</span>
                    <span className="text-gray-800 text-right font-medium">
                      {formatThaiDateTimeForLine(booking.endDate)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 shrink-0">ปลายทาง:</span>
                    <span className="font-bold text-gray-900 text-right truncate">
                      {booking.destination} ({booking.passengersCount} คน)
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-400 shrink-0">ภารกิจ:</span>
                    <span className="text-gray-700 text-right truncate">{booking.purpose}</span>
                  </div>

                  <div className="pt-2 border-t border-gray-100 space-y-1 text-[10px]">
                    <div
                      className={`font-bold flex items-center gap-1 ${
                        booking.stage1ApprovedBy
                          ? 'text-emerald-600'
                          : isRejected && booking.rejectedStage === 1
                          ? 'text-rose-600'
                          : 'text-amber-600'
                      }`}
                    >
                      <span>
                        {booking.stage1ApprovedBy
                          ? `✅ ขั้นที่ 1: อนุมัติโดย ${booking.stage1ApprovedBy}`
                          : isRejected && booking.rejectedStage === 1
                          ? `❌ ขั้นที่ 1: ไม่อนุมัติโดย ${booking.rejectedBy}`
                          : `⏳ ขั้นที่ 1: รอ ${booking.assignedApproverName || 'Approve 1'} (${approve1LineId || '-'})`}
                      </span>
                    </div>
                    <div
                      className={`font-bold flex items-center gap-1 ${
                        booking.stage2ApprovedBy
                          ? 'text-emerald-600'
                          : isRejected && booking.rejectedStage === 2
                          ? 'text-rose-600'
                          : isStage2
                          ? 'text-blue-600'
                          : 'text-gray-400'
                      }`}
                    >
                      <span>
                        {booking.stage2ApprovedBy
                          ? `✅ ขั้นที่ 2: อนุมัติโดย ${booking.stage2ApprovedBy}`
                          : isRejected && booking.rejectedStage === 2
                          ? `❌ ขั้นที่ 2: ไม่อนุมัติโดย ${booking.rejectedBy}`
                          : isStage2
                          ? `⏳ ขั้นที่ 2: รอ ${targetApproverLabel} (${approve2LineId || '-'})`
                          : `⚪ ขั้นที่ 2: รอส่งต่อ ${booking.stage2ApproverName || stage2Approver?.name || 'Approve 2'}`}
                      </span>
                    </div>

                    {isRejected && booking.rejectionReason && (
                      <div className="mt-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-bold">
                        💬 เหตุผลที่ไม่อนุมัติ: {booking.rejectionReason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bubble Footer Action Button: View Details Only */}
                <div className="p-3 pt-0 space-y-1.5">
                  <button
                    type="button"
                    id="btn-preview-line-review"
                    onClick={() => {
                      handleSaveLineIds();
                      onClose();
                      if (onOpenQuickApprove) {
                        onOpenQuickApprove(enrichedBooking, activeStageNum, 'review');
                      }
                    }}
                    className="w-full py-2.5 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold rounded-lg text-xs transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1"
                  >
                    <span>🔍 ดูรายละเอียด</span>
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-slate-900/80 text-center font-medium">
                💡 ผู้รับสามารถกดปุ่ม &ldquo;🔍 ดูรายละเอียด&rdquo; บนการ์ดแจ้งเตือนใน LINE เพื่อเปิดดูข้อมูลใบงานได้ทันที
              </p>
            </div>
          </div>

          {/* Right Column: Sending Options & Workflow (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              {/* Visual Workflow Stepper Banner */}
              <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-2xs flex items-center justify-between text-[10px] text-gray-600 flex-wrap gap-1.5">
                <span className="font-semibold text-emerald-800 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-[#06C755]" />
                  <span>ลำดับการแจ้งเตือนผ่าน LINE:</span>
                </span>
                <div className="flex items-center gap-1 flex-wrap font-medium">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                    User จองรถ
                  </span>
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                  <span
                    className={`px-2 py-0.5 rounded font-bold ${
                      booking.status === 'Pending'
                        ? 'bg-[#06C755] text-white'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    แจ้งเตือน Approve 1
                  </span>
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                  <span
                    className={`px-2 py-0.5 rounded font-bold ${
                      booking.status === 'Pending_Approve2'
                        ? 'bg-blue-600 text-white'
                        : booking.status === 'Approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    แจ้งเตือน Approve 2
                  </span>
                  <ArrowRight className="w-3 h-3 text-gray-400" />
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">
                    แจ้งผลให้ User
                  </span>
                </div>
              </div>

              {/* Status Feedback Banner */}
              {oaStatusMsg && (
                <div
                  className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 animate-in fade-in ${
                    oaStatusMsg.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-blue-50 border-blue-200 text-blue-800'
                  }`}
                >
                  {oaStatusMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  )}
                  <span className="font-medium leading-relaxed">{oaStatusMsg.text}</span>
                </div>
              )}

              {/* Option 1: Direct LINE Share */}
              <div className="bg-white p-4 rounded-2xl border-2 border-[#06C755] shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#06C755]/15 text-[#059440] mb-1">
                      ⭐ ส่งเข้าแชท LINE ทันที
                    </span>
                    <h4 className="font-bold text-gray-900 text-sm">
                      {isApproved || isRejected
                        ? `1. ส่งข้อความแจ้งผลการอนุมัติไปยัง LINE ของ ${booking.userName}`
                        : `1. ส่งแจ้งเตือนคำขอใช้รถเข้าแชท LINE ของ ${targetApproverLabel} (ขั้นที่ ${activeStageNum})`}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      แนบรายละเอียดการจองและหมายเลขใบงาน พร้อม <strong>ลิงก์กดดูรายละเอียด</strong>
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <a
                    id="btn-direct-line-share"
                    href={lineShareHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      handleSaveLineIds();
                      if (onMarkLineNotified) onMarkLineNotified(booking.id);
                    }}
                    className="flex-1 py-3 px-4 bg-[#06C755] hover:bg-[#05b34c] active:scale-[0.99] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-[#06C755]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 fill-white" />
                    <span>
                      {isApproved || isRejected
                        ? `เปิดแอป LINE ส่งแจ้งผลให้ ${booking.userName}`
                        : `เปิดแอป LINE ส่งแจ้งเตือนหา ${targetApproverLabel}`}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </a>

                  <button
                    type="button"
                    id="btn-copy-line-message"
                    onClick={handleCopyMessage}
                    className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
                  >
                    {copiedText ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">คัดลอกข้อความแล้ว!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-600" />
                        <span>คัดลอกข้อความส่ง LINE</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Option 2: Automated LINE OA Push */}
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <Send className="w-4 h-4 text-indigo-600" />
                    <span>2. ส่งการ์ดแจ้งเตือนผ่าน LINE Official Account (@479mbfhu)</span>
                  </h4>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      lineServerConfigured
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {lineServerConfigured ? '🟢 เชื่อมต่อ LINE OA แล้ว' : '⚡ โหมดลิงก์แจ้งเตือน'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    id="btn-push-line-oa"
                    disabled={isSendingOa}
                    onClick={handleSendViaLineOA}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {isSendingOa
                        ? 'กำลังส่งข้อมูลเข้า LINE...'
                        : `ส่งแจ้งเตือนไปยัง LINE ID (${targetRecipientLineId || 'ผู้อนุมัติ'})`}
                    </span>
                  </button>

                  <button
                    type="button"
                    id="btn-copy-magic-link"
                    onClick={handleCopyReviewLink}
                    className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl border border-gray-300 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">คัดลอกลิงก์แล้ว</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-gray-500" />
                        <span>คัดลอกลิงก์ดูรายละเอียด</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-gray-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <ShieldCheck className="w-4 h-4 text-[#06C755] shrink-0" />
                <span>เมื่อ Approve 1 อนุมัติ ระบบจะส่ง LINE หา Approve 2 และแจ้งเตือน LINE ของ User อัตโนมัติ</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
