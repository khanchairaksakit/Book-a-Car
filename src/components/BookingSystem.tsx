import React, { useState, useMemo, useRef } from 'react';
import { Vehicle, Booking, User, BookingStatus, FuelLevel } from '../types';
import {
  isUserAdmin,
  isUserApprover1,
  isUserApprover2,
  hasRole,
  filterBookingsForUser,
  getBookingDepartment,
  getBookingDivision,
} from '../utils/userHelpers';
import {
  Clock,
  MapPin,
  Users,
  Search,
  CheckCircle2,
  Car,
  X,
  Shield,
  Phone,
  Building2,
  Camera,
  Fuel,
  Gauge,
  Key,
  KeyRound,
  Check,
  AlertCircle,
  Eye,
  Trash2,
  Upload,
  ArrowRight,
  Sparkles,
  MessageCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import CameraCaptureModal from './CameraCaptureModal';

interface BookingSystemProps {
  vehicles: Vehicle[];
  bookings: Booking[];
  users?: User[];
  currentUser: User | null;
  onAddBooking?: (booking: Omit<Booking, 'id' | 'createdAt'>) => void;
  onUpdateBookingStatus: (bookingId: string, status: BookingStatus, extraData?: Partial<Booking>) => void;
  onDeleteBooking: (bookingId: string) => void;
  onOpenLineShare?: (booking: Booking) => void;
  onOpenLineQuickApprove?: (booking: Booking, stage: 1 | 2, action?: 'approve' | 'reject' | 'review') => void;
  isLineModuleEnabled?: boolean;
  onToggleLineModule?: (enabled: boolean) => void;
}

const FUEL_OPTIONS: FuelLevel[] = ['เต็มถัง', '3/4', '1/2', '1/4'];

export default function BookingSystem({
  vehicles,
  bookings,
  users = [],
  currentUser,
  onUpdateBookingStatus,
  onDeleteBooking,
  onOpenLineShare,
  onOpenLineQuickApprove,
  isLineModuleEnabled = true,
  onToggleLineModule,
}: BookingSystemProps) {
  // Search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [deletingBooking, setDeletingBooking] = useState<Booking | null>(null);
  const [rejectingBookingState, setRejectingBookingState] = useState<{
    booking: Booking;
    stage: 1 | 2;
  } | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [rejectReasonError, setRejectReasonError] = useState('');

  // Modal States for Trip Checklists
  const [departureBooking, setDepartureBooking] = useState<Booking | null>(null);
  const [returnBooking, setReturnBooking] = useState<Booking | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string; title: string } | null>(null);

  // Form states for Departure Checklist
  const [startMileageInput, setStartMileageInput] = useState<string>('');
  const [startFuelInput, setStartFuelInput] = useState<FuelLevel>('เต็มถัง');
  const [startPhotoPreview, setStartPhotoPreview] = useState<string>('');
  const [departureError, setDepartureError] = useState<string>('');
  const startCameraInputRef = useRef<HTMLInputElement>(null);
  const startFileInputRef = useRef<HTMLInputElement>(null);

  // Form states for Return Checklist (Mission Complete)
  const [endMileageInput, setEndMileageInput] = useState<string>('');
  const [endFuelInput, setEndFuelInput] = useState<FuelLevel>('เต็มถัง');
  const [endPhotoPreview, setEndPhotoPreview] = useState<string>('');
  const [keyPhotoPreview, setKeyPhotoPreview] = useState<string>('');
  const [returnError, setReturnError] = useState<string>('');
  const endCameraInputRef = useRef<HTMLInputElement>(null);
  const endFileInputRef = useRef<HTMLInputElement>(null);
  const keyCameraInputRef = useRef<HTMLInputElement>(null);
  const keyFileInputRef = useRef<HTMLInputElement>(null);

  // Real-time camera modal state
  const [cameraModalConfig, setCameraModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    onCapture: (base64: string) => void;
  } | null>(null);

  const openCamera = (
    title: string,
    subtitle: string,
    onCapture: (base64: string) => void
  ) => {
    setCameraModalConfig({
      isOpen: true,
      title,
      subtitle,
      onCapture,
    });
  };

  const isAdmin = isUserAdmin(currentUser);
  const canApproveStage1 = isUserApprover1(currentUser);
  const canApproveStage2 = isUserApprover2(currentUser);

  // Filter bookings strictly according to role visibility
  const visibleBookings = useMemo(() => {
    return filterBookingsForUser(bookings, currentUser, users);
  }, [bookings, currentUser, users]);

  // Counts for quick badges
  const pending1Count = useMemo(
    () => visibleBookings.filter((b) => b.status === 'Pending').length,
    [visibleBookings]
  );
  const pending2Count = useMemo(
    () => visibleBookings.filter((b) => b.status === 'Pending_Approve2').length,
    [visibleBookings]
  );
  const approvedCount = useMemo(
    () => visibleBookings.filter((b) => b.status === 'Approved').length,
    [visibleBookings]
  );
  const completedCount = useMemo(
    () => visibleBookings.filter((b) => b.status === 'Completed').length,
    [visibleBookings]
  );
  const cancelledCount = useMemo(
    () => visibleBookings.filter((b) => b.status === 'Cancelled').length,
    [visibleBookings]
  );

  // Filtered booking records for the list view
  const filteredBookings = useMemo(() => {
    return visibleBookings.filter((b) => {
      const q = searchQuery.toLowerCase().trim();
      const dept = getBookingDepartment(b, users).toLowerCase();
      const div = getBookingDivision(b, users).toLowerCase();
      const matchSearch =
        !q ||
        b.userName.toLowerCase().includes(q) ||
        b.destination.toLowerCase().includes(q) ||
        b.vehicleName.toLowerCase().includes(q) ||
        b.purpose.toLowerCase().includes(q) ||
        dept.includes(q) ||
        div.includes(q) ||
        (b.userPhone && b.userPhone.includes(q));

      const matchStatus = statusFilter === 'All' || b.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [visibleBookings, searchQuery, statusFilter, users]);

  const getBookingStatusBadge = (st: BookingStatus) => {
    switch (st) {
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            ⏳ รออนุมัติขั้นที่ 1 (Approve 1)
          </span>
        );
      case 'Pending_Approve2':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            ⏳ รออนุมัติขั้นที่ 2 (Approve 2)
          </span>
        );
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            ✅ อนุมัติแล้ว (พร้อมใช้งาน)
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            🏁 เสร็จสิ้นภารกิจ (คืนรถแล้ว)
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            ❌ ไม่อนุมัติ / ยกเลิก
          </span>
        );
      default:
        return st;
    }
  };

  const formatThaiDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return `${d.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })} เวลา ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;
    } catch {
      return isoString;
    }
  };

  // Open Departure Checklist
  const handleOpenDeparture = (booking: Booking) => {
    setDepartureBooking(booking);
    setDepartureError('');
    // Prefill with existing or vehicle's mileage
    const v = vehicles.find((veh) => veh.id === booking.vehicleId);
    setStartMileageInput(
      booking.startMileage !== undefined
        ? String(booking.startMileage)
        : v?.currentMileage !== undefined
        ? String(v.currentMileage)
        : ''
    );
    setStartFuelInput(booking.startFuelLevel || 'เต็มถัง');
    setStartPhotoPreview(booking.startMileagePhoto || '');
  };

  // Submit Departure Checklist
  const handleSaveDeparture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!departureBooking) return;
    setDepartureError('');

    const mileageNum = parseInt(startMileageInput, 10);
    if (isNaN(mileageNum) || mileageNum < 0) {
      setDepartureError('กรุณากรอกเลขไมล์เริ่มต้นให้ถูกต้องเป็นตัวเลข (km.)');
      return;
    }

    onUpdateBookingStatus(departureBooking.id, departureBooking.status, {
      startMileage: mileageNum,
      startMileagePhoto: startPhotoPreview || undefined,
      startFuelLevel: startFuelInput,
      startRecordedAt: new Date().toISOString(),
    });

    setDepartureBooking(null);
  };

  // Open Return Checklist (Mission Complete)
  const handleOpenReturn = (booking: Booking) => {
    setReturnBooking(booking);
    setReturnError('');
    const baseMileage = booking.startMileage || 0;
    setEndMileageInput(
      booking.endMileage !== undefined
        ? String(booking.endMileage)
        : baseMileage > 0
        ? String(baseMileage + 10)
        : ''
    );
    setEndFuelInput(booking.endFuelLevel || 'เต็มถัง');
    setEndPhotoPreview(booking.endMileagePhoto || '');
    setKeyPhotoPreview(booking.keyReturnPhoto || '');
  };

  // Submit Return Checklist (Mission Complete)
  const handleConfirmReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnBooking) return;
    setReturnError('');

    const endMileageNum = parseInt(endMileageInput, 10);
    if (isNaN(endMileageNum) || endMileageNum < 0) {
      setReturnError('กรุณากรอกเลขไมล์สิ้นสุดให้ถูกต้องเป็นตัวเลข (km.)');
      return;
    }

    if (returnBooking.startMileage !== undefined && endMileageNum < returnBooking.startMileage) {
      setReturnError(`เลขไมล์สิ้นสุด (${endMileageNum}) ต้องไม่น้อยกว่าไมล์เริ่มต้น (${returnBooking.startMileage})`);
      return;
    }

    if (!keyPhotoPreview) {
      setReturnError('จำเป็นต้องแนบรูปถ่ายขณะหย่อนกุญแจลงตู้เพื่อยืนยันการคืนรถ');
      return;
    }

    onUpdateBookingStatus(returnBooking.id, 'Completed', {
      endMileage: endMileageNum,
      endMileagePhoto: endPhotoPreview || undefined,
      endFuelLevel: endFuelInput,
      keyReturnPhoto: keyPhotoPreview,
      endRecordedAt: new Date().toISOString(),
    });

    setReturnBooking(null);
  };

  // Generic file to base64 helper
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      setter(res);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6" id="booking-system-container">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">
              รายการจองรถยนต์ส่วนกลาง
            </h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              อนุมัติ 2 ขั้น (Approve 1 & Approve 2)
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {isAdmin
              ? 'ระบบการอนุมัติ 2 ขั้น: ขั้นที่ 1 (Approve 1 ในฝ่าย) → ขั้นที่ 2 (Approve 2 ขั้นสุดท้าย) พร้อมระบบบันทึกไมล์ น้ำมัน และส่งคืนกุญแจ'
              : 'ตรวจสอบสถานะคำขอ อนุมัติการใช้รถตามสิทธิ์ และบันทึกข้อมูลไมล์/น้ำมัน/รูปถ่ายเมื่อเสร็จสิ้นภารกิจ'}
          </p>
        </div>

        {/* Quick status summary pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setStatusFilter('All')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'All'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด ({visibleBookings.length})
          </button>
          <button
            onClick={() => setStatusFilter('Pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              statusFilter === 'Pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <span>รออนุมัติ 1</span>
            <span className="px-1.5 py-0.2 bg-white/30 rounded-full text-[10px]">
              {pending1Count}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('Pending_Approve2')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              statusFilter === 'Pending_Approve2'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
            }`}
          >
            <span>รออนุมัติ 2</span>
            <span className="px-1.5 py-0.2 bg-white/30 rounded-full text-[10px]">
              {pending2Count}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('Approved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              statusFilter === 'Approved'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span>อนุมัติแล้ว</span>
            <span className="px-1.5 py-0.2 bg-white/30 rounded-full text-[10px]">
              {approvedCount}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('Completed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              statusFilter === 'Completed'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>เสร็จสิ้น</span>
            <span className="px-1.5 py-0.2 bg-white/30 rounded-full text-[10px]">
              {completedCount}
            </span>
          </button>
        </div>
      </div>

      {/* LINE Integration & System Savepoint Control Bar */}
      <div
        id="line-savepoint-control-bar"
        className={`rounded-2xl p-4 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isLineModuleEnabled
            ? 'bg-gradient-to-r from-[#06C755]/10 via-emerald-50/60 to-white border-[#06C755]/35 shadow-2xs'
            : 'bg-slate-100/80 border-slate-200 text-slate-600'
        }`}
      >
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl font-black text-xs flex items-center justify-center shrink-0 shadow-xs ${
              isLineModuleEnabled
                ? 'bg-[#06C755] text-white'
                : 'bg-slate-300 text-slate-600'
            }`}
          >
            LINE
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                ระบบส่งขออนุมัติและกดอนุมัติผ่าน LINE (2 ขั้นตอน)
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isLineModuleEnabled
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                {isLineModuleEnabled ? '🟢 เปิดใช้งานอยู่' : '⚪ ปิดใช้งาน (โหมดจุดเซฟเดิม)'}
              </span>
            </div>
            <p className="text-[11px] text-gray-600 mt-0.5">
              {isLineModuleEnabled
                ? 'แยกโมดูลอิสระ 100% • สามารถส่งการ์ดขออนุมัติเข้าแชท LINE และกดอนุมัติผ่านลิงก์ LINE ได้ทันทีโดยไม่กระทบข้อมูลหลัก'
                : 'ขณะนี้อยู่ในโหมดจุดเซฟมาตรฐาน (นำปุ่มขอและอนุมัติผ่าน LINE ออกชั่วคราวโดยไม่กระทบข้อมูลใดๆ ที่สร้างไว้)'}
            </p>
          </div>
        </div>

        {onToggleLineModule && (
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              id="btn-toggle-line-savepoint"
              onClick={() => onToggleLineModule(!isLineModuleEnabled)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                isLineModuleEnabled
                  ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                  : 'bg-[#06C755] hover:bg-[#05b34c] text-white border-[#06C755]'
              }`}
              title="สลับเปิด/ปิดระบบขอและอนุมัติผ่าน LINE (จุดเซฟระบบ ไม่กระทบข้อมูลเดิม)"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>
                {isLineModuleEnabled
                  ? 'สลับกลับจุดเซฟ (เอา LINE ออก)'
                  : 'เปิดใช้งานระบบขอและอนุมัติผ่าน LINE'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ค้นหาตามชื่อผู้ยืม, ทะเบียนรถ, แผนก, ฝ่าย หรือสถานที่ปลายทาง..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs"
        />
      </div>

      {/* Bookings List Cards */}
      <div className="space-y-4">
        {filteredBookings.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Car className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">
              ไม่พบรายการจองรถยนต์
            </h3>
            <p className="text-xs text-gray-400">
              {searchQuery || statusFilter !== 'All'
                ? 'ลองปรับเปลี่ยนตัวกรองสถานะหรือคำค้นหา'
                : 'ยังไม่มีประวัติการจองรถยนต์ในขณะนี้'}
            </p>
          </div>
        ) : (
          filteredBookings.map((booking) => {
            const isOwner = currentUser?.id === booking.userId;
            const isAssignedStage1 = Boolean(
              booking.assignedApproverId && currentUser?.id === booking.assignedApproverId
            );
            const canApproveStage1Action =
              booking.status === 'Pending' && (isAssignedStage1 || isAdmin);
            const canApproveStage2Action =
              booking.status === 'Pending_Approve2' && (canApproveStage2 || isAdmin);
            const canUserCancel =
              isOwner && (booking.status === 'Pending' || booking.status === 'Pending_Approve2');
            const canRecordDeparture =
              booking.status === 'Approved' && (isOwner || isAdmin);
            const canRecordReturn =
              booking.status === 'Approved' && (isOwner || isAdmin);

            return (
              <div
                key={booking.id}
                id={`booking-card-${booking.id}`}
                className="bg-white rounded-2xl border border-gray-200 hover:border-gray-300 p-5 shadow-xs transition-all space-y-4"
              >
                {/* Top Row: User & Vehicle Badges */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                      {booking.userName.substring(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm">
                          {booking.userName}
                        </span>
                        {isOwner && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            การจองของคุณ
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 block">
                        {booking.userDepartment || '-'} {booking.userDivision ? `• ${booking.userDivision}` : ''}
                        {booking.userPhone ? ` • 📞 ${booking.userPhone}` : ''}
                        {isLineModuleEnabled && booking.requesterLineId ? (
                          <span className="ml-1.5 font-mono text-[10px] font-bold text-[#059440] bg-[#06C755]/10 px-1.5 py-0.2 rounded border border-[#06C755]/30">
                            💬 LINE User: {booking.requesterLineId}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 shadow-2xs">
                      <Car className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{booking.vehicleName}</span>
                    </span>
                    {getBookingStatusBadge(booking.status)}
                    {isLineModuleEnabled && booking.approvedVia === 'LINE' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#06C755]/15 text-[#059440] border border-[#06C755]/30">
                        💬 อนุมัติผ่าน LINE
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle Info: Trip details & 2-stage approval status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Trip Details */}
                  <div className="space-y-2 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-start gap-2 text-gray-700">
                      <Clock className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-bold text-gray-900 block">กำหนดการเดินทาง:</span>
                        <span className="font-mono text-gray-700">
                          {formatThaiDate(booking.startDate)} → {formatThaiDate(booking.endDate)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-gray-700">
                      <MapPin className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-bold text-gray-900">ปลายทาง:</span> {booking.destination}
                        <span className="text-gray-400 ml-2">({booking.passengersCount} ผู้โดยสาร)</span>
                      </div>
                    </div>

                    <div className="text-gray-600 pt-1 border-t border-slate-200/60">
                      <span className="font-semibold text-gray-700">วัตถุประสงค์: </span>
                      <span>{booking.purpose}</span>
                    </div>
                  </div>

                  {/* 2-Stage Approvals & Progress Stepper */}
                  <div className="space-y-2 bg-slate-50/70 p-3 rounded-xl border border-slate-100 flex flex-col justify-between">
                    <div>
                      <span className="font-bold text-gray-800 text-xs block mb-2">
                        🛡️ สถานะการพิจารณาอนุมัติ 2 ขั้น:
                      </span>

                      {/* Stage 1 Indicator */}
                      <div className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-white border border-gray-200 mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">
                            1
                          </span>
                          <div>
                            <span className="font-bold text-gray-900">ขั้นที่ 1 (Approve 1):</span>{' '}
                            <span className="text-gray-600">{booking.assignedApproverName || 'ผู้อนุมัติแผนก'}</span>
                            {isLineModuleEnabled && booking.assignedApproverLineId && (
                              <span className="ml-1 font-mono text-[9px] text-[#059440]">
                                ({booking.assignedApproverLineId})
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          {booking.stage1ApprovedBy ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                              <Check className="w-3 h-3" /> ผ่านแล้ว
                            </span>
                          ) : booking.status === 'Cancelled' && (!booking.rejectedStage || booking.rejectedStage === 1) ? (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              ไม่อนุมัติ
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              รอ Approve 1
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stage 2 Indicator */}
                      <div className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-white border border-gray-200">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px]">
                            2
                          </span>
                          <div>
                            <span className="font-bold text-gray-900">ขั้นที่ 2 (Approve 2):</span>{' '}
                            <span className="text-gray-600">
                              {booking.stage2ApprovedBy
                                ? booking.stage2ApprovedBy
                                : booking.stage2ApproverName || 'ผู้อนุมัติขั้นสุดท้าย'}
                            </span>
                            {isLineModuleEnabled && booking.stage2ApproverLineId && (
                              <span className="ml-1 font-mono text-[9px] text-[#059440]">
                                ({booking.stage2ApproverLineId})
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          {booking.stage2ApprovedBy || booking.status === 'Approved' || booking.status === 'Completed' ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                              <Check className="w-3 h-3" /> อนุมัติครบแล้ว
                            </span>
                          ) : booking.status === 'Cancelled' && booking.rejectedStage === 2 ? (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              ไม่อนุมัติ
                            </span>
                          ) : booking.status === 'Pending_Approve2' ? (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 animate-pulse">
                              รอ Approve 2
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">รอผ่านขั้นที่ 1</span>
                          )}
                        </div>
                      </div>

                      {/* Rejection Reason Display if Cancelled/Rejected */}
                      {booking.status === 'Cancelled' && booking.rejectionReason && (
                        <div className="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 space-y-0.5">
                          <div className="font-bold text-rose-700 flex items-center justify-between">
                            <span>❌ เหตุผลที่ไม่อนุมัติ:</span>
                            {booking.rejectedBy && (
                              <span className="text-[10px] font-medium text-rose-600">
                                โดย {booking.rejectedBy}
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-rose-900">{booking.rejectionReason}</p>
                        </div>
                      )}
                    </div>

                    {booking.approverName && (
                      <div className="text-[10px] text-gray-500 pt-1 text-right">
                        อนุมัติครบสมบูรณ์: {booking.approverName}
                      </div>
                    )}
                  </div>
                </div>

                {/* Trip Inspection Data Display (Departure & Return Photos/Mileage) */}
                {(booking.startMileage !== undefined || booking.endMileage !== undefined) && (
                  <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <Gauge className="w-4 h-4 text-emerald-600" />
                        <span>บันทึกการใช้รถยนต์ (ไมล์ & ระดับน้ำมัน & รูปภาพหลักฐาน)</span>
                      </span>
                      {booking.endMileage && booking.startMileage && (
                        <span className="font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-emerald-300 text-[11px]">
                          ระยะทางใช้งานรวม: {(booking.endMileage - booking.startMileage).toLocaleString()} กม.
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Departure Summary */}
                      <div className="bg-white p-2.5 rounded-lg border border-emerald-100 space-y-1">
                        <div className="flex items-center justify-between text-gray-700">
                          <span className="font-bold text-gray-900">1. ข้อมูลออกเดินทาง:</span>
                          <span className="text-[10px] text-gray-400">
                            {booking.startRecordedAt ? formatThaiDate(booking.startRecordedAt) : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-gray-700 pt-1">
                          <span>ไมล์เริ่มต้น:</span>
                          <strong className="font-mono text-gray-900">
                            {booking.startMileage !== undefined ? `${booking.startMileage.toLocaleString()} km.` : '-'}
                          </strong>
                        </div>
                        <div className="flex items-center justify-between text-gray-700">
                          <span>น้ำมันเริ่มต้น:</span>
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded border border-emerald-200">
                            {booking.startFuelLevel || '-'}
                          </span>
                        </div>
                        {booking.startMileagePhoto && (
                          <div className="pt-1.5 flex items-center gap-2">
                            <span className="text-[11px] text-gray-500">รูปไมล์เริ่ม:</span>
                            <button
                              type="button"
                              onClick={() =>
                                setViewingPhoto({ url: booking.startMileagePhoto!, title: 'รูปถ่ายไมล์เริ่มต้น' })
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                            >
                              <img
                                src={booking.startMileagePhoto}
                                alt="Start Mileage"
                                className="w-8 h-8 rounded object-cover border border-indigo-200"
                              />
                              <span>ดูรูปถ่าย</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Return Summary */}
                      <div className="bg-white p-2.5 rounded-lg border border-emerald-100 space-y-1">
                        <div className="flex items-center justify-between text-gray-700">
                          <span className="font-bold text-gray-900">2. ข้อมูลส่งคืนรถ:</span>
                          <span className="text-[10px] text-gray-400">
                            {booking.endRecordedAt ? formatThaiDate(booking.endRecordedAt) : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-gray-700 pt-1">
                          <span>ไมล์สิ้นสุด:</span>
                          <strong className="font-mono text-gray-900">
                            {booking.endMileage !== undefined ? `${booking.endMileage.toLocaleString()} km.` : '-'}
                          </strong>
                        </div>
                        <div className="flex items-center justify-between text-gray-700">
                          <span>น้ำมันส่งคืน:</span>
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded border border-emerald-200">
                            {booking.endFuelLevel || '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 pt-1.5 flex-wrap">
                          {booking.endMileagePhoto && (
                            <button
                              type="button"
                              onClick={() =>
                                setViewingPhoto({ url: booking.endMileagePhoto!, title: 'รูปถ่ายไมล์สิ้นสุด' })
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                            >
                              <img
                                src={booking.endMileagePhoto}
                                alt="End Mileage"
                                className="w-7 h-7 rounded object-cover border border-indigo-200"
                              />
                              <span>รูปไมล์คืน</span>
                            </button>
                          )}
                          {booking.keyReturnPhoto && (
                            <button
                              type="button"
                              onClick={() =>
                                setViewingPhoto({ url: booking.keyReturnPhoto!, title: 'หลักฐานหย่อนกุญแจลงตู้' })
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                            >
                              <img
                                src={booking.keyReturnPhoto}
                                alt="Key Return"
                                className="w-7 h-7 rounded object-cover border border-emerald-300"
                              />
                              <span>🔑 รูปหย่อนกุญแจ</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom Action Buttons Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
                  <div className="text-[11px] text-gray-400">
                    ยื่นคำขอเมื่อ: {new Date(booking.createdAt).toLocaleDateString('th-TH')}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* LINE Share / Send Approval Request Button */}
                    {isLineModuleEnabled && onOpenLineShare && booking.status !== 'Cancelled' && booking.status !== 'Completed' && (
                      <button
                        id={`btn-line-share-${booking.id}`}
                        type="button"
                        onClick={() => onOpenLineShare(booking)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#06C755] hover:bg-[#05b34c] active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                        title="ส่งคำขออนุมัติพร้อมลิงก์กดอนุมัติด่วนเข้าแชท LINE หรือ LINE Official Account"
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-white" />
                        <span>
                          {booking.status === 'Pending'
                            ? 'ส่งขออนุมัติผ่าน LINE (ขั้นที่ 1)'
                            : booking.status === 'Pending_Approve2'
                            ? 'ส่งต่อขออนุมัติผ่าน LINE (ขั้นที่ 2)'
                            : 'แจ้งผลอนุมัติผ่าน LINE'}
                        </span>
                      </button>
                    )}

                    {/* Stage 1 Approval Action */}
                    {canApproveStage1Action && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          id={`btn-approve-stage1-${booking.id}`}
                          type="button"
                          onClick={() =>
                            onUpdateBookingStatus(booking.id, 'Pending_Approve2', {
                              stage1ApprovedBy: currentUser?.name || 'Approve 1',
                              stage1ApprovedAt: new Date().toISOString(),
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>อนุมัติขั้นที่ 1 (ส่งต่อ Approve 2)</span>
                        </button>

                        <button
                          id={`btn-reject-stage1-${booking.id}`}
                          type="button"
                          onClick={() => {
                            setRejectingBookingState({ booking, stage: 1 });
                            setRejectReasonInput('');
                            setRejectReasonError('');
                          }}
                          className="px-3 py-2 border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                        >
                          ไม่อนุมัติ (ระบุเหตุผล)
                        </button>
                      </div>
                    )}

                    {/* Stage 2 Approval Action */}
                    {canApproveStage2Action && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          id={`btn-approve-stage2-${booking.id}`}
                          type="button"
                          onClick={() =>
                            onUpdateBookingStatus(booking.id, 'Approved', {
                              stage2ApprovedBy: currentUser?.name || 'Approve 2',
                              stage2ApprovedAt: new Date().toISOString(),
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>อนุมัติขั้นที่ 2 (อนุมัติขั้นสุดท้าย)</span>
                        </button>

                        <button
                          id={`btn-reject-stage2-${booking.id}`}
                          type="button"
                          onClick={() => {
                            setRejectingBookingState({ booking, stage: 2 });
                            setRejectReasonInput('');
                            setRejectReasonError('');
                          }}
                          className="px-3 py-2 border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                        >
                          ไม่อนุมัติ (ระบุเหตุผล)
                        </button>
                      </div>
                    )}

                    {/* Departure Info Entry Button */}
                    {canRecordDeparture && !booking.startMileage && (
                      <button
                        id={`btn-record-departure-${booking.id}`}
                        type="button"
                        onClick={() => handleOpenDeparture(booking)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                      >
                        <Gauge className="w-3.5 h-3.5" />
                        <span>🚗 บันทึกข้อมูลก่อนออกเดินทาง</span>
                      </button>
                    )}

                    {/* Prominent GREEN Complete Mission Button for User (Requirement 3) */}
                    {canRecordReturn && (
                      <button
                        id={`btn-complete-mission-${booking.id}`}
                        type="button"
                        onClick={() => handleOpenReturn(booking)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                        title="กดปุ่มนี้เพื่อบันทึกไมล์สิ้นสุด น้ำมัน และหลักฐานหย่อนกุญแจลงตู้เพื่อเสร็จสิ้นภารกิจ"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>เสร็จสิ้นภารกิจ</span>
                      </button>
                    )}

                    {/* User Cancel Own Request */}
                    {canUserCancel && (
                      <button
                        id={`btn-user-cancel-${booking.id}`}
                        type="button"
                        onClick={() => onUpdateBookingStatus(booking.id, 'Cancelled')}
                        className="px-3 py-2 border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-600 hover:text-red-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        ยกเลิกคำขอ
                      </button>
                    )}

                    {/* Admin Delete */}
                    {isAdmin && (
                      <button
                        id={`btn-delete-booking-${booking.id}`}
                        type="button"
                        onClick={() => setDeletingBooking(booking)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        title="ลบรายการจอง"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: Departure Checklist (บันทึกก่อนออกเดินทาง) */}
      <AnimatePresence>
        {departureBooking && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 my-8 space-y-4 max-h-[90vh] flex flex-col z-10"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center font-bold shadow-xs">
                    <Gauge className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">
                      บันทึกข้อมูลก่อนออกเดินทาง
                    </h3>
                    <p className="text-xs text-gray-500">
                      รถ: {departureBooking.vehicleName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDepartureBooking(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {departureError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 shrink-0">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{departureError}</span>
                </div>
              )}

              <form onSubmit={handleSaveDeparture} className="flex-1 overflow-y-auto pr-1 space-y-4">
                {/* 1. ไมล์เริ่มต้น */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-800">
                    1. ไมล์เริ่มต้น (กิโลเมตร) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="input-start-mileage"
                      type="number"
                      value={startMileageInput}
                      onChange={(e) => setStartMileageInput(e.target.value)}
                      placeholder="เช่น 18500"
                      className="w-full pl-3 pr-12 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 font-mono focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      required
                    />
                    <span className="absolute right-3.5 top-3 text-xs text-gray-400 font-mono">
                      km.
                    </span>
                  </div>

                  {/* แนบรูปถ่ายไมล์เริ่มต้น */}
                  <div className="pt-1.5">
                    {/* Hidden Native Camera Input */}
                    <input
                      ref={startCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleFileChange(e, setStartPhotoPreview)}
                      className="hidden"
                      id="input-camera-booking-start-mileage"
                    />
                    {/* Hidden File Picker Input */}
                    <input
                      ref={startFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setStartPhotoPreview)}
                      className="hidden"
                      id="input-file-booking-start-mileage"
                    />
                    {startPhotoPreview ? (
                      <div className="relative w-full h-36 rounded-xl overflow-hidden border border-amber-200 group bg-black/5">
                        <img
                          src={startPhotoPreview}
                          alt="Start Mileage Preview"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 right-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => startCameraInputRef.current?.click()}
                            className="p-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs shadow-md cursor-pointer flex items-center gap-1 active:scale-95"
                            title="ถ่ายภาพใหม่ด้วยกล้อง"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold">ถ่ายใหม่</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setStartPhotoPreview('')}
                            className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs shadow-md cursor-pointer active:scale-95"
                            title="ลบรูป"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <button
                          type="button"
                          id="btn-open-camera-booking-start-mileage"
                          onClick={() => startCameraInputRef.current?.click()}
                          className="w-full py-3.5 px-4 border-2 border-dashed border-amber-400 hover:border-amber-500 bg-amber-50/70 hover:bg-amber-100/70 rounded-2xl text-xs font-bold text-amber-900 flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                        >
                          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                            <Camera className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-xs sm:text-sm text-gray-900">📸 กดเปิดกล้องถ่ายภาพไมล์เริ่มต้นทันที</div>
                            <div className="text-[11px] text-amber-700 font-normal">เปิดกล้องจากมือถือหรืออุปกรณ์เพื่อถ่ายรูปหน้าปัดไมล์</div>
                          </div>
                        </button>
                        <div className="flex items-center justify-between px-1 text-[11px]">
                          <button
                            type="button"
                            onClick={() => startFileInputRef.current?.click()}
                            className="text-gray-500 hover:text-amber-800 hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <Upload className="w-3.5 h-3.5 text-amber-600" />
                            <span>เลือกรูปจากเครื่อง/คลังภาพ</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openCamera('ถ่ายภาพหน้าปัดไมล์เริ่มต้น', 'กรุณาจัดกล้องให้เห็นตัวเลขไมล์และระดับน้ำมันชัดเจน', (img) => setStartPhotoPreview(img))}
                            className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <span>📹 กล้องสด (Live Viewfinder)</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. น้ำมันเริ่มต้น */}
                <div className="space-y-1.5 pt-2 border-t border-gray-100">
                  <label className="block text-xs font-bold text-gray-800">
                    2. น้ำมันเริ่มต้น (เลือกได้ 1 ตัวเลือก) <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {FUEL_OPTIONS.map((f) => {
                      const isSel = startFuelInput === f;
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setStartFuelInput(f)}
                          className={`py-2 px-1 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                            isSel
                              ? 'bg-amber-500 text-white border-amber-600 shadow-xs ring-2 ring-amber-400/30'
                              : 'bg-slate-50 hover:bg-slate-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {f}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setDepartureBooking(null)}
                    className="flex-1 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    บันทึกข้อมูลออกเดินทาง
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Return Checklist & Complete Mission (เสร็จสิ้นภารกิจ & คืนรถ) */}
      <AnimatePresence>
        {returnBooking && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 my-8 space-y-4 max-h-[92vh] flex flex-col z-10"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold shadow-xs">
                    <Check className="w-5 h-5 stroke-[3]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">
                      เสร็จสิ้นภารกิจ & คืนรถยนต์ส่วนกลาง
                    </h3>
                    <p className="text-xs text-gray-500">
                      รถ: {returnBooking.vehicleName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setReturnBooking(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Trip Reference summary */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1 shrink-0">
                <div className="flex items-center justify-between text-gray-600">
                  <span>ผู้ยืมรถ:</span>
                  <strong className="text-gray-900">{returnBooking.userName}</strong>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>ไมล์เริ่มต้นที่บันทึกไว้:</span>
                  <span className="font-mono font-bold text-indigo-700">
                    {returnBooking.startMileage !== undefined ? `${returnBooking.startMileage.toLocaleString()} km.` : 'ไม่ได้ระบุ'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-600">
                  <span>น้ำมันเริ่มต้น:</span>
                  <span className="font-semibold text-gray-800">{returnBooking.startFuelLevel || '-'}</span>
                </div>
              </div>

              {returnError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 shrink-0">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{returnError}</span>
                </div>
              )}

              <form onSubmit={handleConfirmReturn} className="flex-1 overflow-y-auto pr-1 space-y-4">
                {/* 3.1 ไมล์สิ้นสุด */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-800">
                      3.1 ไมล์สิ้นสุด (กิโลเมตร) <span className="text-red-500">*</span>
                    </label>
                    {returnBooking.startMileage && endMileageInput && parseInt(endMileageInput, 10) >= returnBooking.startMileage && (
                      <span className="text-[11px] font-bold text-emerald-700">
                        วิ่งไป {(parseInt(endMileageInput, 10) - returnBooking.startMileage).toLocaleString()} km.
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="input-end-mileage"
                      type="number"
                      value={endMileageInput}
                      onChange={(e) => setEndMileageInput(e.target.value)}
                      placeholder="เช่น 18720"
                      className="w-full pl-3 pr-12 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 font-mono focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      required
                    />
                    <span className="absolute right-3.5 top-3 text-xs text-gray-400 font-mono">
                      km.
                    </span>
                  </div>

                  {/* แนบรูปถ่ายไมล์สิ้นสุด */}
                  <div className="pt-1.5">
                    {/* Hidden Native Camera Input */}
                    <input
                      ref={endCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleFileChange(e, setEndPhotoPreview)}
                      className="hidden"
                      id="input-camera-booking-end-mileage"
                    />
                    {/* Hidden File Picker Input */}
                    <input
                      ref={endFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setEndPhotoPreview)}
                      className="hidden"
                      id="input-file-booking-end-mileage"
                    />
                    {endPhotoPreview ? (
                      <div className="relative w-full h-36 rounded-xl overflow-hidden border border-emerald-200 group bg-black/5">
                        <img
                          src={endPhotoPreview}
                          alt="End Mileage Preview"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 right-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => endCameraInputRef.current?.click()}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs shadow-md cursor-pointer flex items-center gap-1 active:scale-95"
                            title="ถ่ายภาพใหม่ด้วยกล้อง"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold">ถ่ายใหม่</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEndPhotoPreview('')}
                            className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs shadow-md cursor-pointer active:scale-95"
                            title="ลบรูป"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <button
                          type="button"
                          id="btn-open-camera-booking-end-mileage"
                          onClick={() => endCameraInputRef.current?.click()}
                          className="w-full py-3.5 px-4 border-2 border-dashed border-emerald-400 hover:border-emerald-600 bg-emerald-50/70 hover:bg-emerald-100/70 rounded-2xl text-xs font-bold text-emerald-900 flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                        >
                          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                            <Camera className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-xs sm:text-sm text-gray-900">📸 กดเปิดกล้องถ่ายภาพไมล์สิ้นสุดทันที</div>
                            <div className="text-[11px] text-emerald-700 font-normal">เปิดกล้องจากมือถือหรืออุปกรณ์เพื่อถ่ายรูปหน้าปัดไมล์ส่งคืน</div>
                          </div>
                        </button>
                        <div className="flex items-center justify-between px-1 text-[11px]">
                          <button
                            type="button"
                            onClick={() => endFileInputRef.current?.click()}
                            className="text-gray-500 hover:text-emerald-700 hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <Upload className="w-3.5 h-3.5 text-emerald-600" />
                            <span>เลือกรูปจากเครื่อง/คลังภาพ</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openCamera('ถ่ายภาพหน้าปัดไมล์สิ้นสุด', 'กรุณาจัดกล้องให้เห็นตัวเลขไมล์และระดับน้ำมันตอนส่งคืนชัดเจน', (img) => setEndPhotoPreview(img))}
                            className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <span>📹 กล้องสด (Live Viewfinder)</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3.2 น้ำมันส่งคืน */}
                <div className="space-y-1.5 pt-2 border-t border-gray-100">
                  <label className="block text-xs font-bold text-gray-800">
                    3.2 น้ำมันส่งคืน (เลือกได้ 1 ตัวเลือก) <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {FUEL_OPTIONS.map((f) => {
                      const isSel = endFuelInput === f;
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setEndFuelInput(f)}
                          className={`py-2 px-1 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                            isSel
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-400/30'
                              : 'bg-slate-50 hover:bg-slate-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {f}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3.3 แนบรูปหลักฐานการคืนกุญแจ (หย่อนลงตู้) - REQUIRED TO UNLOCK OK BUTTON */}
                <div className="space-y-1.5 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-amber-600" />
                      <span>3.3 แนบรูปหลักฐานการคืนกุญแจ <span className="text-red-500">*</span></span>
                    </label>
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-medium">
                      ถ่ายรูปตอนหย่อนกุญแจลงตู้
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-500">
                    กรุณาถ่ายรูปขณะหย่อนกุญแจรถยนต์ลงในตู้รับกุญแจ เพื่อเป็นหลักฐานว่าส่งคืนกุญแจเรียบร้อยแล้ว
                  </p>

                  {/* Hidden Native Camera Input */}
                  <input
                    ref={keyCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleFileChange(e, setKeyPhotoPreview)}
                    className="hidden"
                    id="input-camera-booking-key-photo"
                  />
                  {/* Hidden File Picker Input */}
                  <input
                    ref={keyFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, setKeyPhotoPreview)}
                    className="hidden"
                    id="input-file-booking-key-photo"
                  />

                  {keyPhotoPreview ? (
                    <div className="space-y-1.5">
                      <div className="relative w-full h-40 rounded-xl overflow-hidden border-2 border-emerald-500 group shadow-xs">
                        <img
                          src={keyPhotoPreview}
                          alt="Key Return Preview"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 right-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => keyCameraInputRef.current?.click()}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs shadow-md cursor-pointer flex items-center gap-1 active:scale-95"
                            title="ถ่ายภาพใหม่ด้วยกล้อง"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold">ถ่ายใหม่</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setKeyPhotoPreview('')}
                            className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs shadow-md cursor-pointer active:scale-95"
                            title="ลบรูปแล้วถ่ายใหม่"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> แนบรูปถ่ายกุญแจลงตู้เรียบร้อย พร้อมกดยืนยันคืนรถ
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        id="btn-open-camera-booking-key-photo"
                        onClick={() => keyCameraInputRef.current?.click()}
                        className="w-full py-4 px-4 border-2 border-dashed border-amber-400 hover:border-emerald-500 bg-amber-50 hover:bg-emerald-50/50 rounded-2xl text-xs text-amber-900 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs group active:scale-[0.99]"
                      >
                        <div className="w-11 h-11 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                          <Camera className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-sm text-gray-900">📸 กดเปิดกล้องถ่ายภาพหย่อนกุญแจลงตู้ทันที</span>
                        <span className="text-[11px] text-amber-700 font-normal">
                          เปิดกล้องจากมือถือหรืออุปกรณ์เพื่อถ่ายรูปหลักฐานคืนกุญแจ
                        </span>
                      </button>
                      <div className="flex items-center justify-between px-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => keyFileInputRef.current?.click()}
                          className="text-gray-500 hover:text-amber-800 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <Upload className="w-3.5 h-3.5 text-amber-600" />
                          <span>เลือกรูปจากเครื่อง/คลังภาพ</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openCamera('ถ่ายภาพส่งคืนกุญแจรถยนต์', 'กรุณาถ่ายรูปขณะหย่อนกุญแจรถลงในตู้รับกุญแจ เพื่อเป็นหลักฐาน', (img) => setKeyPhotoPreview(img))}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <span>📹 กล้องสด (Live Viewfinder)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Buttons with Conditional OK Button (Requirement 3.3) */}
                <div className="flex items-center gap-3 pt-3 border-t border-gray-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => setReturnBooking(null)}
                    className="flex-1 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    ยกเลิก
                  </button>

                  {/* The OK Button: Appears only when key photo is attached */}
                  {keyPhotoPreview ? (
                    <button
                      id="btn-confirm-return-ok"
                      type="submit"
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5 cursor-pointer transition-all animate-fade-in"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>OK ยืนยันว่าคืนรถได้</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="flex-1 py-2.5 bg-gray-200 text-gray-400 text-xs font-bold rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5"
                      title="กรุณาถ่ายรูปหย่อนกุญแจลงตู้ก่อน"
                    >
                      <span>รอแนบรูปกุญแจตู้</span>
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: Photo Lightbox Preview */}
      <AnimatePresence>
        {viewingPhoto && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setViewingPhoto(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900 text-white rounded-3xl max-w-2xl w-full p-4 overflow-hidden relative shadow-2xl space-y-3 cursor-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-sm text-slate-200">{viewingPhoto.title}</span>
                <button
                  onClick={() => setViewingPhoto(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="max-h-[75vh] flex items-center justify-center overflow-hidden rounded-2xl bg-black">
                <img
                  src={viewingPhoto.url}
                  alt={viewingPhoto.title}
                  className="max-h-[75vh] max-w-full object-contain"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reject with Reason Modal (when LINE module is off or standard web reject) */}
      <AnimatePresence>
        {rejectingBookingState && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-rose-700 text-base">
                  ❌ ไม่อนุมัติคำขอใช้รถ (ขั้นที่ {rejectingBookingState.stage})
                </h3>
                <button
                  type="button"
                  onClick={() => setRejectingBookingState(null)}
                  className="p-1 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-gray-600">
                คำขอของ <strong>{rejectingBookingState.booking.userName}</strong> ({rejectingBookingState.booking.vehicleName})
              </p>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-800">
                  ระบุเหตุผลที่ไม่อนุมัติ <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectReasonInput}
                  onChange={(e) => {
                    setRejectReasonInput(e.target.value);
                    if (e.target.value.trim()) setRejectReasonError('');
                  }}
                  placeholder="กรุณาระบุเหตุผลที่ไม่อนุมัติ เพื่อแจ้งให้ผู้ขอใช้รถทราบ..."
                  className="w-full p-3 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 outline-hidden"
                />
                {rejectReasonError && (
                  <p className="text-xs font-bold text-rose-600">{rejectReasonError}</p>
                )}
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingBookingState(null)}
                  className="flex-1 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!rejectReasonInput.trim()) {
                      setRejectReasonError('กรุณาระบุเหตุผลที่ไม่อนุมัติคำขอใช้รถ');
                      return;
                    }
                    onUpdateBookingStatus(rejectingBookingState.booking.id, 'Cancelled', {
                      rejectionReason: rejectReasonInput.trim(),
                      rejectedBy: `${currentUser?.name || 'ผู้อนุมัติ'} (Approve ${rejectingBookingState.stage})`,
                      rejectedAt: new Date().toISOString(),
                      rejectedStage: rejectingBookingState.stage,
                    });
                    setRejectingBookingState(null);
                  }}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  ยืนยันไม่อนุมัติ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal for Admin */}
      <AnimatePresence>
        {deletingBooking && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-bold text-gray-900 text-base">
                  ยืนยันการลบรายการจองรถยนต์
                </h3>
                <p className="text-xs text-gray-500">
                  คุณต้องการลบรายการจองของ {deletingBooking.userName} ({deletingBooking.vehicleName}) ออกจากระบบหรือไม่?
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingBooking(null)}
                  className="flex-1 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteBooking(deletingBooking.id);
                    setDeletingBooking(null);
                  }}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  ยืนยันการลบ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Real-time Camera Viewfinder Modal */}
      {cameraModalConfig && cameraModalConfig.isOpen && (
        <CameraCaptureModal
          isOpen={cameraModalConfig.isOpen}
          title={cameraModalConfig.title}
          subtitle={cameraModalConfig.subtitle}
          onCapture={cameraModalConfig.onCapture}
          onClose={() => setCameraModalConfig(null)}
          preferredFacingMode="environment"
        />
      )}
    </div>
  );
}
