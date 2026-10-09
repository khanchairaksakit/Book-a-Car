import React, { useState, useEffect, useMemo } from 'react';
import { Booking, BookingStatus, User } from '../types';
import {
  buildLineShareMessage,
  formatThaiDateTimeForLine,
  getLineShareUrl,
  triggerServerLineApprovalPush,
} from '../utils/lineApprovalUtils';
import {
  isUserAdmin,
  isUserApprover1,
  isUserApprover2,
  getEligibleStage1Approvers,
  canUserApproveBooking,
} from '../utils/userHelpers';
import { getBookingJobNumber } from '../utils/dateHelpers';
import {
  CheckCircle2,
  XCircle,
  Car,
  Clock,
  MapPin,
  User as UserIcon,
  ShieldCheck,
  X,
  MessageCircle,
  ExternalLink,
  Copy,
  Check,
  ArrowRight,
  Building2,
  Phone,
  AlertCircle,
  Send,
} from 'lucide-react';

interface LineQuickApproveModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  users: User[];
  currentUser: User | null;
  initialStage?: 1 | 2;
  initialAction?: 'approve' | 'reject' | 'review';
  initialApproverId?: string;
  onUpdateBookingStatus: (
    bookingId: string,
    status: BookingStatus,
    extraData?: Partial<Booking>
  ) => void;
  onUpdateUserLineId?: (userId: string, lineId: string) => void;
  onNavigateToBookingList?: () => void;
}

const QUICK_REJECT_REASONS = [
  'รถยนต์ต้องใช้ปฏิบัติภารกิจด่วนของผู้บริหาร',
  'ข้อมูลจุดหมายปลายทางหรือภารกิจไม่ชัดเจน',
  'ช่วงเวลาดังกล่าวมีภารกิจสำคัญทับซ้อน',
  'กรุณาเปลี่ยนไปจองรถยนต์ส่วนกลางคันอื่นแทน',
];

export default function LineQuickApproveModal({
  isOpen,
  onClose,
  booking,
  users,
  currentUser,
  initialAction = 'review',
  initialApproverId,
  onUpdateBookingStatus,
  onUpdateUserLineId,
  onNavigateToBookingList,
}: LineQuickApproveModalProps) {
  const [selectedApproverId, setSelectedApproverId] = useState<string>('');
  const [selectedApproverName, setSelectedApproverName] = useState<string>('');
  const [selectedApproverLineId, setSelectedApproverLineId] = useState<string>('');

  // Next stage (Approve 2) target selection when approving Stage 1
  const [nextStage2ApproverId, setNextStage2ApproverId] = useState<string>('');
  const [nextStage2ApproverLineId, setNextStage2ApproverLineId] = useState<string>('');

  // Requester LINE ID for notification
  const [requesterLineIdInput, setRequesterLineIdInput] = useState<string>('');

  // Rejection mode & mandatory reason
  const [isRejectingMode, setIsRejectingMode] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [rejectionError, setRejectionError] = useState<string>('');

  const [completedStep, setCompletedStep] = useState<
    'none' | 'stage1_approved' | 'stage2_approved' | 'rejected'
  >('none');
  const [copiedShare, setCopiedShare] = useState(false);

  // Determine current booking stage
  const isStage1Pending = booking?.status === 'Pending';
  const isStage2Pending = booking?.status === 'Pending_Approve2';
  const isAlreadyApproved = booking?.status === 'Approved' || booking?.status === 'Completed';
  const isAlreadyRejected = booking?.status === 'Cancelled';

  // Requester user object
  const requesterUser = useMemo(
    () => users.find((u) => u.id === booking?.userId) || null,
    [users, booking?.userId]
  );

  // Eligible Stage 1 approvers (same department/division Approve 1 permission)
  const stage1ApproverCandidates = useMemo(() => {
    return getEligibleStage1Approvers(users, requesterUser);
  }, [users, requesterUser]);

  // Eligible Stage 2 approvers (strictly Approve 2 permission)
  const stage2ApproverCandidates = useMemo(() => {
    return users.filter((u) => isUserApprover2(u));
  }, [users]);

  useEffect(() => {
    if (!isOpen || !booking) return;
    setCompletedStep('none');
    setCopiedShare(false);
    setIsRejectingMode(initialAction === 'reject');
    setRejectionReason(booking.rejectionReason || '');
    setRejectionError('');

    const reqUser = users.find((u) => u.id === booking.userId);
    setRequesterLineIdInput(booking.requesterLineId || reqUser?.lineUserId || '');

    // Setup next Stage 2 approver defaults
    const defaultStage2 =
      users.find((u) => u.id === booking.stage2ApproverId) ||
      stage2ApproverCandidates.find((u) => u.roles?.includes('Approve 2')) ||
      stage2ApproverCandidates[0];
    if (defaultStage2) {
      setNextStage2ApproverId(defaultStage2.id);
      setNextStage2ApproverLineId(
        booking.stage2ApproverLineId || defaultStage2.lineUserId || ''
      );
    }

    if (initialApproverId) {
      const matched = users.find((u) => u.id === initialApproverId);
      if (matched) {
        setSelectedApproverId(matched.id);
        setSelectedApproverName(matched.name);
        setSelectedApproverLineId(matched.lineUserId || '');
        return;
      }
    }

    if (booking.status === 'Pending') {
      const assignedUser =
        users.find((u) => u.id === booking.assignedApproverId) ||
        stage1ApproverCandidates[0];
      if (assignedUser) {
        setSelectedApproverId(assignedUser.id);
        setSelectedApproverName(assignedUser.name);
        setSelectedApproverLineId(
          booking.assignedApproverLineId || assignedUser.lineUserId || ''
        );
      } else {
        setSelectedApproverId('');
        setSelectedApproverName(booking.assignedApproverName || 'Approve 1');
        setSelectedApproverLineId(booking.assignedApproverLineId || '');
      }
    } else if (booking.status === 'Pending_Approve2') {
      const stage2User =
        users.find((u) => u.id === booking.stage2ApproverId && isUserApprover2(u)) ||
        (currentUser && isUserApprover2(currentUser)
          ? currentUser
          : stage2ApproverCandidates[0]);
      if (stage2User) {
        setSelectedApproverId(stage2User.id);
        setSelectedApproverName(stage2User.name);
        setSelectedApproverLineId(
          booking.stage2ApproverLineId || stage2User.lineUserId || ''
        );
      } else {
        setSelectedApproverId('');
        setSelectedApproverName(booking.stage2ApproverName || 'ผู้ดูแลรถ');
        setSelectedApproverLineId(booking.stage2ApproverLineId || '');
      }
    }
  }, [
    isOpen,
    booking?.id,
    booking?.status,
    initialAction,
    initialApproverId,
    currentUser,
    users,
    stage1ApproverCandidates,
    stage2ApproverCandidates,
  ]);

  if (!isOpen || !booking) return null;

  const handleApproverSelectChange = (userId: string) => {
    const found = users.find((u) => u.id === userId);
    if (found) {
      setSelectedApproverId(found.id);
      setSelectedApproverName(found.name);
      setSelectedApproverLineId(found.lineUserId || '');
    }
  };

  const handleStage2TargetChange = (userId: string) => {
    const found = users.find((u) => u.id === userId);
    if (found) {
      setNextStage2ApproverId(found.id);
      setNextStage2ApproverLineId(found.lineUserId || '');
    }
  };

  const syncLineIdsToUsers = () => {
    if (!onUpdateUserLineId) return;
    if (booking.userId && requesterLineIdInput.trim()) {
      onUpdateUserLineId(booking.userId, requesterLineIdInput.trim());
    }
    if (selectedApproverId && selectedApproverLineId.trim()) {
      onUpdateUserLineId(selectedApproverId, selectedApproverLineId.trim());
    }
    if (nextStage2ApproverId && nextStage2ApproverLineId.trim()) {
      onUpdateUserLineId(nextStage2ApproverId, nextStage2ApproverLineId.trim());
    }
  };

  const handleApproveStage1 = async () => {
    syncLineIdsToUsers();

    const approverToUse =
      selectedApproverName.trim() ||
      booking.assignedApproverName ||
      currentUser?.name ||
      'Approve 1';

    const stage2TargetUser =
      users.find((u) => u.id === nextStage2ApproverId) || stage2ApproverCandidates[0];
    const stage2Name = stage2TargetUser?.name || booking.stage2ApproverName || 'Approve 2';
    const stage2LineId =
      nextStage2ApproverLineId.trim() ||
      stage2TargetUser?.lineUserId ||
      booking.stage2ApproverLineId ||
      '';

    const nowIso = new Date().toISOString();
    const extraUpdates: Partial<Booking> = {
      stage1ApprovedBy: `${approverToUse} (ผ่าน LINE)`,
      stage1ApprovedAt: nowIso,
      assignedApproverLineId: selectedApproverLineId.trim() || booking.assignedApproverLineId,
      stage2ApproverId: stage2TargetUser?.id || booking.stage2ApproverId,
      stage2ApproverName: stage2Name,
      stage2ApproverLineId: stage2LineId,
      requesterLineId: requesterLineIdInput.trim() || booking.requesterLineId,
      approvedVia: 'LINE',
    };

    onUpdateBookingStatus(booking.id, 'Pending_Approve2', extraUpdates);
    setCompletedStep('stage1_approved');

    // Automatically push Stage 2 request via server to Approve 2's LINE ID
    await triggerServerLineApprovalPush({
      booking: {
        ...booking,
        ...extraUpdates,
        status: 'Pending_Approve2',
      },
      stage: 2,
      approverUser: stage2TargetUser,
      approverName: stage2Name,
      targetLineId: stage2LineId,
    });
  };

  const handleApproveStage2 = async () => {
    syncLineIdsToUsers();

    const approverToUse =
      selectedApproverName.trim() ||
      booking.stage2ApproverName ||
      currentUser?.name ||
      'Approve 2';

    const nowIso = new Date().toISOString();
    const extraUpdates: Partial<Booking> = {
      stage2ApprovedBy: `${approverToUse} (ผ่าน LINE)`,
      stage2ApprovedAt: nowIso,
      stage2ApproverLineId: selectedApproverLineId.trim() || booking.stage2ApproverLineId,
      requesterLineId: requesterLineIdInput.trim() || booking.requesterLineId,
      approvedVia: 'LINE',
    };

    onUpdateBookingStatus(booking.id, 'Approved', extraUpdates);
    setCompletedStep('stage2_approved');

    // Automatically push Approved notification to Requester User's LINE ID
    await triggerServerLineApprovalPush({
      booking: {
        ...booking,
        ...extraUpdates,
        status: 'Approved',
        approverName: `${booking.stage1ApprovedBy || 'Approve 1'} & ${approverToUse} (ผ่าน LINE)`,
      },
      stage: 'approved',
      approverUser: requesterUser,
      approverName: booking.userName,
      targetLineId: requesterLineIdInput.trim() || booking.requesterLineId || requesterUser?.lineUserId,
    });
  };

  const handleConfirmRejectBooking = async () => {
    if (!rejectionReason.trim()) {
      setRejectionError('กรุณาระบุเหตุผลที่ไม่อนุมัติคำขอใช้รถ เพื่อส่งแจ้งเตือนให้ผู้จองทราบผ่าน LINE');
      return;
    }
    setRejectionError('');
    syncLineIdsToUsers();

    const currentStageNum: 1 | 2 = isStage1Pending ? 1 : 2;
    const stageRoleLabel = currentStageNum === 1 ? 'ผู้จัดการ' : 'ผู้ดูแลรถ';
    const approverToUse =
      selectedApproverName.trim() ||
      (currentStageNum === 1 ? booking.assignedApproverName : booking.stage2ApproverName) ||
      currentUser?.name ||
      stageRoleLabel;

    const nowIso = new Date().toISOString();
    const extraUpdates: Partial<Booking> = {
      approvedVia: 'LINE',
      rejectionReason: rejectionReason.trim(),
      rejectedBy: `${approverToUse} (${stageRoleLabel} Reject)`,
      rejectedAt: nowIso,
      rejectedStage: currentStageNum,
      requesterLineId: requesterLineIdInput.trim() || booking.requesterLineId,
    };

    onUpdateBookingStatus(booking.id, 'Cancelled', extraUpdates);
    setCompletedStep('rejected');

    // Automatically push Rejection notification with reason to Requester's LINE ID
    await triggerServerLineApprovalPush({
      booking: {
        ...booking,
        ...extraUpdates,
        status: 'Cancelled',
      },
      stage: 'rejected',
      approverUser: requesterUser,
      approverName: booking.userName,
      targetLineId: requesterLineIdInput.trim() || booking.requesterLineId || requesterUser?.lineUserId,
    });
  };

  // Build follow-up LINE share messages for forwarding to Stage 2 or notifying Requester
  const stage2TargetUser =
    users.find((u) => u.id === nextStage2ApproverId) || stage2ApproverCandidates[0];
  const stage2ForwardBooking: Booking = {
    ...booking,
    status: 'Pending_Approve2',
    stage1ApprovedBy:
      booking.stage1ApprovedBy || `${selectedApproverName || 'Approve 1'} (ผ่าน LINE)`,
    stage2ApproverName: stage2TargetUser?.name || booking.stage2ApproverName || 'Approve 2',
    stage2ApproverLineId:
      nextStage2ApproverLineId || stage2TargetUser?.lineUserId || booking.stage2ApproverLineId,
    requesterLineId: requesterLineIdInput || booking.requesterLineId,
  };
  const stage2ShareText = buildLineShareMessage(
    stage2ForwardBooking,
    2,
    stage2ForwardBooking.stage2ApproverName,
    stage2TargetUser?.id,
    stage2ForwardBooking.stage2ApproverLineId
  );
  const stage2LineShareHref = getLineShareUrl(stage2ShareText);

  const approvedResultBooking: Booking = {
    ...booking,
    status: 'Approved',
    stage2ApprovedBy:
      booking.stage2ApprovedBy || `${selectedApproverName || 'Approve 2'} (ผ่าน LINE)`,
    approverName:
      booking.approverName ||
      `${booking.stage1ApprovedBy || 'Approve 1'} & ${selectedApproverName || 'Approve 2'} (ผ่าน LINE)`,
    requesterLineId: requesterLineIdInput || booking.requesterLineId,
  };
  const approvedShareText = buildLineShareMessage(approvedResultBooking, 'approved');
  const approvedLineShareHref = getLineShareUrl(approvedShareText);

  const rejectedResultBooking: Booking = {
    ...booking,
    status: 'Cancelled',
    rejectionReason: rejectionReason.trim() || booking.rejectionReason || 'ไม่ผ่านการพิจารณา',
    rejectedBy:
      booking.rejectedBy ||
      `${selectedApproverName || 'ผู้อนุมัติ'} (Approve ${isStage1Pending ? 1 : 2})`,
    rejectedStage: booking.rejectedStage || (isStage1Pending ? 1 : 2),
    requesterLineId: requesterLineIdInput || booking.requesterLineId,
  };
  const rejectedShareText = buildLineShareMessage(rejectedResultBooking, 'rejected');
  const rejectedLineShareHref = getLineShareUrl(rejectedShareText);

  const handleCopyFollowUp = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 3000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-gray-100 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Official LINE Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#06C755] to-emerald-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white text-[#06C755] font-black text-base flex items-center justify-center shadow-md shrink-0">
              LINE
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded-full">
                AX CAR RESERVATION • BOOKING DETAILS
              </span>
              <h3 className="font-bold text-base sm:text-lg mt-0.5 leading-tight">
                รายละเอียดใบงานคำขอใช้รถยนต์ส่วนกลาง
              </h3>
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

        <div className="p-4 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Booking Summary Card */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/90 space-y-3">
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm leading-snug">
                    {booking.vehicleName}
                  </h4>
                  <span className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    📄 หมายเลขใบงาน: {getBookingJobNumber(booking)}
                  </span>
                </div>
              </div>

              {booking.status === 'Pending' && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                  ⏳ รอผู้จัดการ
                </span>
              )}
              {booking.status === 'Pending_Approve2' && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
                  ⏳ รอผู้ดูแลรถ
                </span>
              )}
              {isAlreadyApproved && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                  ✅ อนุมัติครบ 2 ขั้นแล้ว
                </span>
              )}
              {isAlreadyRejected && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                  ❌{' '}
                  {booking.rejectedStage === 2 ||
                  (booking.rejectedStage !== 1 && Boolean(booking.stage1ApprovedBy))
                    ? 'ผู้ดูแลรถ Reject'
                    : 'ผู้จัดการ Reject'}
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="text-gray-500">ผู้ขอใช้รถ (User): </span>
                  <strong className="text-gray-900">{booking.userName}</strong>
                </div>
                <span className="text-[10px] font-bold text-[#059440] bg-[#06C755]/10 px-2 py-0.5 rounded-md border border-[#06C755]/30">
                  💬 LINE User: {requesterLineIdInput || booking.requesterLineId || 'ยังไม่ระบุ'}
                </span>
              </div>

              <div className="flex items-start gap-2">
                <Building2 className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-gray-500">แผนก / ฝ่าย: </span>
                  <span className="font-semibold text-gray-800">
                    {booking.userDepartment || '-'}
                    {booking.userDivision ? ` • ${booking.userDivision}` : ''}
                  </span>
                </div>
              </div>

              {(booking.userPhone || requesterUser?.phone) && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-gray-500">เบอร์ติดต่อ: </span>
                  <a
                    href={`tel:${(booking.userPhone || requesterUser?.phone || '').replace(/[^0-9+]/g, '')}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono font-bold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200"
                    title={`กดเพื่อโทรออก ${booking.userPhone || requesterUser?.phone}`}
                  >
                    <span>📞 {booking.userPhone || requesterUser?.phone}</span>
                  </a>
                </div>
              )}

              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-gray-500 block">กำหนดการเดินทาง:</span>
                  <span className="font-semibold text-gray-900 block">
                    เริ่ม: {formatThaiDateTimeForLine(booking.startDate)}
                  </span>
                  <span className="font-semibold text-gray-900 block">
                    คืนรถ: {formatThaiDateTimeForLine(booking.endDate)}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-gray-500">สถานที่ปลายทาง: </span>
                  <strong className="text-gray-900">
                    {booking.destination} ({booking.passengersCount} ผู้โดยสาร)
                  </strong>
                </div>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 text-gray-700">
                <span className="font-bold text-gray-900">วัตถุประสงค์: </span>
                <span>{booking.purpose}</span>
              </div>
            </div>

            {/* 2-Stage Progress Indicator with LINE IDs */}
            <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div
                className={`p-2.5 rounded-xl border ${
                  booking.stage1ApprovedBy && booking.rejectedStage !== 1
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : isAlreadyRejected
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">ผู้จัดการ</span>
                </div>
                <span className="text-[10px] block truncate mt-0.5 font-medium">
                  {booking.stage1ApprovedBy && booking.rejectedStage !== 1
                    ? `✅ ${booking.stage1ApprovedBy}`
                    : isAlreadyRejected
                    ? `❌ Reject (${booking.rejectedBy || booking.assignedApproverName || 'ผู้จัดการ'})`
                    : `รอคุณ ${booking.assignedApproverName || 'ผู้จัดการ'}`}
                </span>
                <span className="text-[9px] opacity-80 block truncate mt-0.5">
                  LINE ID: {booking.assignedApproverLineId || selectedApproverLineId || '-'}
                </span>
              </div>

              <div
                className={`p-2.5 rounded-xl border ${
                  booking.stage2ApprovedBy || isAlreadyApproved
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : isAlreadyRejected
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : isStage2Pending
                    ? 'bg-blue-50 border-blue-200 text-blue-800'
                    : 'bg-gray-100 border-gray-200 text-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">ผู้ดูแลรถ</span>
                </div>
                <span className="text-[10px] block truncate mt-0.5 font-medium">
                  {booking.stage2ApprovedBy
                    ? `✅ ${booking.stage2ApprovedBy}`
                    : isAlreadyRejected &&
                      (booking.rejectedStage === 2 ||
                        (booking.rejectedStage !== 1 && Boolean(booking.stage1ApprovedBy)))
                    ? `❌ Reject (${booking.rejectedBy || booking.stage2ApproverName || 'ผู้ดูแลรถ'})`
                    : isAlreadyRejected
                    ? `❌ ผู้จัดการ Reject`
                    : isStage2Pending
                    ? `⏳ รอคุณ ${booking.stage2ApproverName || 'ผู้ดูแลรถ'}`
                    : `รอส่งต่อคุณ ${booking.stage2ApproverName || stage2TargetUser?.name || 'ผู้ดูแลรถ'}`}
                </span>
                <span className="text-[9px] opacity-80 block truncate mt-0.5">
                  LINE ID: {booking.stage2ApproverLineId || nextStage2ApproverLineId || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Approval / Completion Section */}
          {completedStep === 'stage1_approved' ? (
            <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 space-y-3.5 animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-950 text-sm sm:text-base">
                    อนุมัติขั้นที่ 1 (Approve 1) สำเร็จ! ส่งไลน์ไปหา Approve 2 แล้ว
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                    ระบบได้บันทึกการอนุมัติของ <strong>{selectedApproverName}</strong> และส่งคำขออนุมัติผ่าน LINE ไปยัง{' '}
                    <strong>{stage2ForwardBooking.stage2ApproverName}</strong> (LINE ID:{' '}
                    <span className="font-mono font-bold">
                      {stage2ForwardBooking.stage2ApproverLineId || 'ยังไม่ระบุ'}
                    </span>
                    ) เพื่อพิจารณาอนุมัติขั้นที่ 2 ต่อทันที
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <a
                  id="btn-line-forward-stage2"
                  href={stage2LineShareHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  <span>
                    ส่งไลน์ขออนุมัติไปยัง Approve 2 ({stage2ForwardBooking.stage2ApproverName})
                  </span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  id="btn-proceed-to-stage2-now"
                  onClick={() => {
                    setCompletedStep('none');
                    setIsRejectingMode(false);
                    if (stage2TargetUser) {
                      setSelectedApproverId(stage2TargetUser.id);
                      setSelectedApproverName(stage2TargetUser.name);
                      setSelectedApproverLineId(
                        nextStage2ApproverLineId || stage2TargetUser.lineUserId || ''
                      );
                    }
                  }}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    เปิดหน้าจอของ Approve 2 เพื่อกดอนุมัติ/ไม่อนุมัติ ขั้นที่ 2 ต่อทันที
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyFollowUp(stage2ShareText)}
                  className="w-full py-2 px-3 bg-white hover:bg-emerald-100/50 text-emerald-900 font-semibold text-xs rounded-xl border border-emerald-300 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedShare ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>คัดลอกข้อความและลิงก์ส่งต่อให้ Approve 2 แล้ว</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>คัดลอกข้อความส่ง LINE ให้ Approve 2</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : completedStep === 'stage2_approved' || isAlreadyApproved ? (
            <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-4 space-y-3 text-center animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-bold text-emerald-950 text-base">
                  🎉 อนุมัติครบทั้ง 2 ขั้นตอนเรียบร้อยแล้ว!
                </h4>
                <p className="text-xs text-emerald-800 mt-1">
                  ระบบได้ส่งข้อความแจ้งเตือนผลการอนุมัติไปยัง LINE ของผู้จองรถ{' '}
                  <strong>{booking.userName}</strong> (LINE ID:{' '}
                  <span className="font-mono font-bold">
                    {requesterLineIdInput || booking.requesterLineId || '-'}
                  </span>
                  ) เรียบร้อยแล้ว
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <a
                  id="btn-line-notify-requester"
                  href={approvedLineShareHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  <span>ส่งแจ้งเตือนผลอนุมัติเข้า LINE ผู้จองรถ ({booking.userName})</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => handleCopyFollowUp(approvedShareText)}
                  className="w-full py-2.5 px-3 bg-white hover:bg-emerald-100/50 text-emerald-900 font-semibold text-xs rounded-xl border border-emerald-300 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedShare ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>คัดลอกข้อความแจ้งผลอนุมัติแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>คัดลอกข้อความแจ้งผลอนุมัติ</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : completedStep === 'rejected' || isAlreadyRejected ? (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-rose-950 text-sm sm:text-base">
                    บันทึกการไม่อนุมัติคำขอใช้รถเรียบร้อยแล้ว
                  </h4>
                  <p className="text-xs text-rose-700 mt-0.5">
                    ผู้ไม่อนุมัติ:{' '}
                    <strong>
                      {rejectedResultBooking.rejectedBy || 'ผู้อนุมัติ'}
                    </strong>
                  </p>
                  <div className="mt-2 p-2.5 bg-white rounded-xl border border-rose-200 text-xs text-rose-900">
                    <span className="font-bold">เหตุผลที่ไม่อนุมัติ: </span>
                    <span>{rejectedResultBooking.rejectionReason}</span>
                  </div>
                  <p className="text-[11px] text-rose-700 mt-1.5">
                    ระบบส่งแจ้งเตือนพร้อมเหตุผลไปยัง LINE ของผู้จอง ({booking.userName} • LINE ID:{' '}
                    <span className="font-mono font-bold">
                      {requesterLineIdInput || booking.requesterLineId || '-'}
                    </span>
                    )
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <a
                  id="btn-line-notify-rejected"
                  href={rejectedLineShareHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  <span>ส่งแจ้งผลไม่อนุมัติและเหตุผลเข้า LINE ผู้จองรถ ({booking.userName})</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => handleCopyFollowUp(rejectedShareText)}
                  className="w-full py-2 px-3 bg-white hover:bg-rose-100/50 text-rose-900 font-semibold text-xs rounded-xl border border-rose-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedShare ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>คัดลอกข้อความแจ้งไม่อนุมัติแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>คัดลอกข้อความแจ้งผลไม่อนุมัติ</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Notification Details & Direct Action Box */
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>
                    {isStage1Pending
                      ? `สถานะปัจจุบัน: รอคุณ ${booking.assignedApproverName || 'ผู้จัดการ'} พิจารณาในระบบ`
                      : `สถานะปัจจุบัน: รอคุณ ${booking.stage2ApproverName || 'ผู้ดูแลรถ'} พิจารณาอนุมัติขั้นสุดท้ายในระบบ`}
                  </span>
                </span>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  แจ้งเตือนผ่าน LINE
                </span>
              </div>

              {currentUser && canUserApproveBooking(booking, currentUser, users) && (
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  {isRejectingMode ? (
                    <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-rose-800">
                          ❌ ระบุเหตุผลที่ไม่อนุมัติ ({isStage1Pending ? 'ผู้จัดการ' : 'ผู้ดูแลรถ'})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsRejectingMode(false);
                            setRejectionError('');
                          }}
                          className="text-[11px] text-gray-500 hover:text-gray-800 cursor-pointer"
                        >
                          ยกเลิก
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {QUICK_REJECT_REASONS.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => {
                              setRejectionReason(r);
                              setRejectionError('');
                            }}
                            className="text-[10px] px-2 py-1 rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 cursor-pointer"
                          >
                            + {r}
                          </button>
                        ))}
                      </div>
                      <textarea
                        rows={2}
                        value={rejectionReason}
                        onChange={(e) => {
                          setRejectionReason(e.target.value);
                          if (e.target.value.trim()) setRejectionError('');
                        }}
                        placeholder="กรุณาระบุเหตุผลที่ไม่อนุมัติ เพื่อแจ้งให้ผู้ขอใช้รถทราบ..."
                        className="w-full p-2.5 bg-white border border-rose-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 outline-hidden"
                      />
                      {rejectionError && (
                        <p className="text-xs font-bold text-rose-600">{rejectionError}</p>
                      )}
                      <button
                        type="button"
                        onClick={handleConfirmRejectBooking}
                        className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                      >
                        ยืนยันไม่อนุมัติคำขอใช้รถ
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={isStage1Pending ? handleApproveStage1 : handleApproveStage2}
                        className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {isStage1Pending
                            ? 'ผู้จัดการ (ส่งต่อผู้ดูแลรถ)'
                            : 'ผู้ดูแลรถ (อนุมัติขั้นสุดท้าย)'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsRejectingMode(true)}
                        className="py-2.5 px-4 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl cursor-pointer"
                      >
                        ไม่อนุมัติ (ระบุเหตุผล)
                      </button>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-gray-600 leading-relaxed">
                ผู้อนุมัติสามารถตรวจสอบข้อมูลคำขอใช้รถด้านบน หรือเปิดไปยังเมนู{' '}
                <strong>ตรวจสอบสถานะ (รายการจองรถยนต์ส่วนกลาง)</strong> ในระบบได้ทันที
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  id="btn-go-to-status-menu"
                  onClick={() => {
                    if (onNavigateToBookingList) {
                      onNavigateToBookingList();
                    } else {
                      onClose();
                    }
                  }}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ไปที่หน้าตรวจสอบสถานะในระบบ</span>
                </button>

                {currentUser &&
                  (currentUser.id === booking.userId ||
                    (currentUser.name &&
                      booking.userName &&
                      currentUser.name.trim().toLowerCase() ===
                        booking.userName.trim().toLowerCase()) ||
                    isUserAdmin(currentUser)) &&
                  booking.status !== 'Completed' &&
                  booking.status !== 'Cancelled' && (
                    <button
                      type="button"
                      id="btn-modal-cancel-booking"
                      onClick={() => {
                        onUpdateBookingStatus(booking.id, 'Cancelled', {
                          rejectedBy: `${currentUser.name || booking.userName} (ผู้จองยกเลิกการจอง)`,
                          rejectionReason: 'ผู้ขอใช้รถกดยกเลิกการจองด้วยตนเอง',
                          rejectedAt: new Date().toISOString(),
                        });
                        setCompletedStep('rejected');
                      }}
                      className="w-full sm:w-auto shrink-0 py-3 px-4 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>ยกเลิกการจอง</span>
                    </button>
                  )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-gray-200 flex items-center justify-between">
          <span className="text-[11px] text-gray-500">
            ซิงค์ข้อมูลการอนุมัติและแจ้งเตือนผ่าน LINE แบบเรียลไทม์
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
