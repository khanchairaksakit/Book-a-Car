import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Vehicle, Booking, User, BookingStatus, FuelLevel } from '../types';
import {
  isUserAdmin,
  isUserApprover1,
  isUserApprover2,
  hasRole,
  filterBookingsForUser,
  getBookingDepartment,
  getBookingDivision,
  canUserApproveBooking,
  getEligibleStage1Approvers,
  getEligibleStage2Approvers,
  maskPhoneNumber,
  getTelHref,
} from '../utils/userHelpers';
import {
  getRealTodayStr,
  isDateInPast,
  validateBookingDates,
  getBookingJobNumber,
  generateNextJobNumber,
  isEarlyVehicleReturn,
  EARLY_RETURN_WARNING_TEXT,
} from '../utils/dateHelpers';
import {
  formatThaiDate as formatShortThaiDate,
  formatTripDateTime,
  doesBookingMatchVehicle,
  doesBookingCoverDate,
  getVehicleBookingAlerts,
  formatMaintenanceAlertsForLine,
} from '../utils/vehicleAlerts';
import VehicleMaintenanceAlertModal from './VehicleMaintenanceAlertModal';
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
  AlertTriangle,
  Eye,
  Trash2,
  Upload,
  ArrowRight,
  Sparkles,
  MessageCircle,
  XCircle,
  Plus,
  CalendarDays,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import CameraCaptureModal from './CameraCaptureModal';
import FuelGaugeGraphic from './FuelGaugeGraphic';
import { compressImageFile } from '../utils/imageCompression';

interface BookingSystemProps {
  vehicles: Vehicle[];
  bookings: Booking[];
  users?: User[];
  currentUser: User | null;
  onAddBooking?: (booking: Omit<Booking, 'id' | 'createdAt'>) => void | Promise<void>;
  onUpdateBookingStatus: (bookingId: string, status: BookingStatus, extraData?: Partial<Booking>) => void;
  onDeleteBooking: (bookingId: string) => void;
  onOpenLineShare?: (booking: Booking) => void;
  onOpenLineQuickApprove?: (booking: Booking, stage: 1 | 2, action?: 'approve' | 'reject' | 'review') => void;
  isLineModuleEnabled?: boolean;
  onToggleLineModule?: (enabled: boolean) => void;
  canEdit?: boolean;
  viewOnly?: boolean;
}

const FUEL_OPTIONS: FuelLevel[] = ['เต็มถัง', '3/4', '1/2', '1/4'];

export default function BookingSystem({
  vehicles,
  bookings,
  users = [],
  currentUser,
  onAddBooking,
  onUpdateBookingStatus,
  onDeleteBooking,
  onOpenLineShare,
  onOpenLineQuickApprove,
  isLineModuleEnabled = true,
  onToggleLineModule,
  canEdit = true,
  viewOnly = false,
}: BookingSystemProps) {
  const hasEditPermission = canEdit && !viewOnly;
  const realTodayStr = getRealTodayStr();
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
      const dept = (getBookingDepartment(b, users) || '').toLowerCase();
      const div = (getBookingDivision(b, users) || '').toLowerCase();
      const jobNo = (getBookingJobNumber(b) || '').toLowerCase();
      const matchSearch =
        !q ||
        jobNo.includes(q) ||
        (b.id || '').toLowerCase().includes(q) ||
        (b.userName || '').toLowerCase().includes(q) ||
        (b.destination || '').toLowerCase().includes(q) ||
        (b.vehicleName || '').toLowerCase().includes(q) ||
        (b.purpose || '').toLowerCase().includes(q) ||
        dept.includes(q) ||
        div.includes(q) ||
        (b.userPhone && b.userPhone.includes(q));

      const matchStatus = statusFilter === 'All' || b.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [visibleBookings, searchQuery, statusFilter, users]);

  const getBookingStatusBadge = (booking: Booking) => {
    const st = booking.status;
    switch (st) {
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            ⏳ รอผู้จัดการ
          </span>
        );
      case 'Pending_Approve2':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            ⏳ รอผู้ดูแลรถ
          </span>
        );
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            🚗 กำลังใช้งาน (ยังไม่ได้คืนรถ)
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            🏁 เสร็จสิ้นภารกิจ (คืนรถแล้ว)
          </span>
        );
      case 'Cancelled': {
        const isStage2Reject =
          booking.rejectedStage === 2 ||
          (booking.rejectedStage !== 1 && Boolean(booking.stage1ApprovedBy));
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            ❌ {isStage2Reject ? 'ผู้ดูแลรถ Reject' : 'ผู้จัดการ Reject'}
          </span>
        );
      }
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

  // Helper to get the latest current mileage of the vehicle for a booking
  const getVehicleLatestMileage = (booking: Booking): number | undefined => {
    const v = vehicles.find(
      (veh) =>
        veh.id === booking.vehicleId ||
        (booking.plateNumber && veh.plateNumber === booking.plateNumber)
    );
    let maxMileage = v?.currentMileage;
    for (const b of bookings) {
      if (b.status === 'Cancelled') continue;
      if (
        b.vehicleId === booking.vehicleId ||
        (booking.plateNumber && b.plateNumber === booking.plateNumber)
      ) {
        if (typeof b.endMileage === 'number' && (maxMileage === undefined || b.endMileage > maxMileage)) {
          maxMileage = b.endMileage;
        }
      }
    }
    return maxMileage;
  };

  // Open Departure Checklist
  const handleOpenDeparture = (booking: Booking) => {
    setDepartureBooking(booking);
    setDepartureError('');
    // Prefill with existing or vehicle's current mileage
    const vehicleMileage = getVehicleLatestMileage(booking);
    setStartMileageInput(
      booking.startMileage !== undefined
        ? String(booking.startMileage)
        : vehicleMileage !== undefined
        ? String(vehicleMileage)
        : ''
    );
    setStartFuelInput(booking.startFuelLevel || 'เต็มถัง');
    setStartPhotoPreview('');
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
      startFuelLevel: startFuelInput,
      startRecordedAt: new Date().toISOString(),
    });

    setStartPhotoPreview('');
    setDepartureBooking(null);
  };

  // Open Return Checklist (Mission Complete)
  const handleOpenReturn = (booking: Booking) => {
    setReturnBooking(booking);
    setReturnError('');
    const vehicleMileage = getVehicleLatestMileage(booking);
    const baseMileage = booking.startMileage ?? vehicleMileage ?? 0;
    setEndMileageInput(
      booking.endMileage !== undefined
        ? String(booking.endMileage)
        : baseMileage > 0
        ? String(baseMileage)
        : ''
    );
    setEndFuelInput(booking.endFuelLevel || booking.startFuelLevel || 'เต็มถัง');
    setEndPhotoPreview('');
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
      endFuelLevel: endFuelInput,
      keyReturnPhoto: keyPhotoPreview,
      endRecordedAt: new Date().toISOString(),
    });

    setEndPhotoPreview('');
    setKeyPhotoPreview('');
    setReturnBooking(null);
  };

  // Generic file to compressed base64 helper
  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 800, 0.65);
      if (compressed) {
        setter(compressed);
      }
    } catch (err) {
      console.error('Error compressing photo:', err);
    }
  };

  // Quick Booking Modal states (for booking directly from Status menu)
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(realTodayStr);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('08:30');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [endDateStr, setEndDateStr] = useState<string>(realTodayStr);
  const [selectedApproverId, setSelectedApproverId] = useState<string>('');
  const [showAllDeptApprovers, setShowAllDeptApprovers] = useState<boolean>(false);
  const [destination, setDestination] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [passengersCount, setPassengersCount] = useState<number>(1);
  const [bookingError, setBookingError] = useState<string>('');
  const [bookingSuccess, setBookingSuccess] = useState<string>('');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState<boolean>(false);
  const [isMaintenanceAlertModalOpen, setIsMaintenanceAlertModalOpen] = useState(false);
  const [hasAcknowledgedAlertsForVehicleId, setHasAcknowledgedAlertsForVehicleId] = useState<string | null>(null);

  const selectedVehicleObj = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) || null,
    [vehicles, selectedVehicleId]
  );

  const currentVehicleBookingAlerts = useMemo(
    () => getVehicleBookingAlerts(selectedVehicleObj),
    [selectedVehicleObj]
  );

  const eligibleApprovers = useMemo(
    () => getEligibleStage1Approvers(users, currentUser, showAllDeptApprovers),
    [users, currentUser, showAllDeptApprovers]
  );

  useEffect(() => {
    if (eligibleApprovers.length > 0) {
      if (!eligibleApprovers.some((a) => a.id === selectedApproverId)) {
        const preferred =
          eligibleApprovers.find((a) => a.id !== currentUser?.id) ||
          eligibleApprovers[0];
        setSelectedApproverId(preferred.id);
      }
    } else if (selectedApproverId !== '') {
      setSelectedApproverId('');
    }
  }, [eligibleApprovers, currentUser, selectedApproverId]);

  const eligibleStage2Approvers = useMemo(
    () => getEligibleStage2Approvers(users, currentUser),
    [users, currentUser]
  );

  const calculateEndDateStr = (startStr: string, totalDays: number): string => {
    if (!startStr) return startStr;
    const parts = startStr.split('-');
    if (parts.length !== 3) return startStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    d.setDate(d.getDate() + (totalDays - 1));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  const getSelectedDaysCount = (startStr: string, endStr: string): number => {
    if (!startStr || !endStr) return 1;
    const p1 = startStr.split('-').map(Number);
    const p2 = endStr.split('-').map(Number);
    if (p1.length !== 3 || p2.length !== 3) return 1;
    const d1 = new Date(p1[0], p1[1] - 1, p1[2]);
    const d2 = new Date(p2[0], p2[1] - 1, p2[2]);
    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 1;
  };

  const handleQuickPresetHalfMorning = () => {
    setStartTime('08:30');
    setEndTime('12:00');
    setEndDateStr(selectedDateStr);
  };

  const handleQuickPresetHalfAfternoon = () => {
    setStartTime('13:00');
    setEndTime('17:00');
    setEndDateStr(selectedDateStr);
  };

  const handleQuickPresetDays = (days: number) => {
    setStartTime('08:30');
    setEndTime('17:30');
    setEndDateStr(calculateEndDateStr(selectedDateStr, days));
  };

  const currentDurationDays = getSelectedDaysCount(selectedDateStr, endDateStr);
  const isPresetHalfMorning =
    selectedDateStr === endDateStr && startTime === '08:30' && endTime === '12:00';
  const isPresetHalfAfternoon =
    selectedDateStr === endDateStr && startTime === '13:00' && endTime === '17:00';
  const isPresetFullDay =
    currentDurationDays === 1 &&
    startTime === '08:30' &&
    (endTime === '17:00' || endTime === '17:30');
  const isPreset2Days =
    currentDurationDays === 2 &&
    startTime === '08:30' &&
    (endTime === '17:00' || endTime === '17:30');
  const isPreset3Days =
    currentDurationDays === 3 &&
    startTime === '08:30' &&
    (endTime === '17:00' || endTime === '17:30');
  const isPreset5Days =
    currentDurationDays === 5 &&
    startTime === '08:30' &&
    (endTime === '17:00' || endTime === '17:30');
  const isPreset7Days =
    currentDurationDays === 7 &&
    startTime === '08:30' &&
    (endTime === '17:00' || endTime === '17:30');
  const isPreset15Days =
    currentDurationDays === 15 &&
    startTime === '08:30' &&
    (endTime === '17:00' || endTime === '17:30');
  const isPreset30Days =
    currentDurationDays === 30 &&
    startTime === '08:30' &&
    (endTime === '17:00' || endTime === '17:30');

  const handleOpenBookingModal = (dateStr?: string, vehicleId?: string) => {
    if (!hasEditPermission || !onAddBooking) return;
    let targetDate = dateStr || selectedDateStr || realTodayStr;
    if (isDateInPast(targetDate)) {
      targetDate = realTodayStr;
    }
    setSelectedDateStr(targetDate);
    setEndDateStr(targetDate);
    setStartTime('08:30');
    setEndTime('17:00');
    setBookingError('');
    setBookingSuccess('');
    setHasAcknowledgedAlertsForVehicleId(null);

    let targetVehicleId = vehicleId;
    if (targetVehicleId) {
      setSelectedVehicleId(targetVehicleId);
    } else {
      const available = vehicles.filter((v) => {
        if (v.status === 'Maintenance') return false;
        return !bookings.some(
          (b) =>
            doesBookingMatchVehicle(b, v) &&
            b.status !== 'Completed' &&
            b.status !== 'Cancelled' &&
            doesBookingCoverDate(b, targetDate, realTodayStr)
        );
      });
      if (available.length > 0) {
        targetVehicleId = available[0].id;
        setSelectedVehicleId(available[0].id);
      } else if (vehicles.length > 0) {
        targetVehicleId = vehicles[0].id;
        setSelectedVehicleId(vehicles[0].id);
      }
    }

    if (targetVehicleId) {
      const targetV = vehicles.find((v) => v.id === targetVehicleId);
      if (targetV) {
        const alerts = getVehicleBookingAlerts(targetV);
        if (alerts.length > 0) {
          setIsMaintenanceAlertModalOpen(true);
        }
      }
    }

    setShowAllDeptApprovers(false);
    const approvers = getEligibleStage1Approvers(users, currentUser);
    const sameDept = approvers.find(
      (a) =>
        (a.department === currentUser?.department ||
          (a.division && currentUser?.division && a.division === currentUser.division)) &&
        a.id !== currentUser?.id
    );
    const chosenApp1 = sameDept || approvers[0] || null;
    setSelectedApproverId(chosenApp1 ? chosenApp1.id : '');
    setIsBookingModalOpen(true);
  };

  const checkOverlap = (
    vId: string,
    sDate: string,
    sTime: string,
    eDate: string,
    eTime: string
  ) => {
    const startIso = `${sDate}T${sTime}`;
    const endIso = `${eDate}T${eTime}`;
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();

    if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
      return 'วันเวลาสิ้นสุดการจองต้องอยู่หลังวันเวลาเริ่มต้น';
    }

    const targetVeh = vehicles.find((v) => v.id === vId);
    const relevant = bookings.filter(
      (b) =>
        (b.vehicleId === vId || (targetVeh && doesBookingMatchVehicle(b, targetVeh))) &&
        b.status !== 'Cancelled' &&
        b.status !== 'Completed'
    );

    for (const b of relevant) {
      const bStart = new Date(b.startDate).getTime();
      const bEnd = new Date(b.endDate).getTime();
      if (startMs < bEnd && endMs > bStart) {
        return `รถยนต์คันนี้ติดจองแล้วโดยคุณ ${b.userName} (${formatTripDateTime(
          b.startDate,
          b.endDate
        )})`;
      }
    }
    return null;
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingBooking || !onAddBooking) return;
    setBookingError('');
    setBookingSuccess('');

    if (!currentUser) {
      setBookingError('กรุณาเข้าสู่ระบบผู้ใช้งานก่อนทำการจอง');
      return;
    }

    const dateValidation = validateBookingDates(selectedDateStr, endDateStr);
    if (!dateValidation.isValid) {
      setBookingError(dateValidation.errorMessage || 'ไม่อนุญาตให้จองย้อนหลัง');
      return;
    }

    if (!selectedVehicleId) {
      setBookingError('กรุณาเลือกรถยนต์ที่ต้องการจอง');
      return;
    }

    if (!destination.trim()) {
      setBookingError('กรุณาระบุสถานที่ปลายทาง');
      return;
    }

    if (!purpose.trim()) {
      setBookingError('กรุณาระบุวัตถุประสงค์การใช้งาน');
      return;
    }

    const chosenApprover =
      eligibleApprovers.find((u) => u.id === selectedApproverId) ||
      users.find((u) => u.id === selectedApproverId) ||
      eligibleApprovers[0] ||
      null;

    if (!chosenApprover) {
      setBookingError('กรุณาเลือกผู้อนุมัติการจองรถ');
      return;
    }

    const chosenStage2Approver =
      eligibleStage2Approvers.find((u) => u.id !== chosenApprover.id) ||
      eligibleStage2Approvers[0] ||
      null;

    const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
    if (!selectedVehicle) {
      setBookingError('ไม่พบข้อมูลรถยนต์ที่ระบุ');
      return;
    }

    if (selectedVehicle.status === 'Maintenance') {
      setBookingError('ขออภัย รถยนต์คันนี้อยู่ระหว่างซ่อมบำรุง ไม่สามารถจองได้');
      return;
    }

    // Check approaching maintenance alerts: mileage check, tire replacement, tax expiry
    const vehicleBookingAlerts = getVehicleBookingAlerts(selectedVehicle);
    if (
      vehicleBookingAlerts.length > 0 &&
      hasAcknowledgedAlertsForVehicleId !== selectedVehicle.id
    ) {
      setIsMaintenanceAlertModalOpen(true);
      return;
    }

    const conflict = checkOverlap(
      selectedVehicleId,
      selectedDateStr,
      startTime,
      endDateStr,
      endTime
    );
    if (conflict) {
      setBookingError(conflict);
      return;
    }

    const startIso = `${selectedDateStr}T${startTime}`;
    const endIso = `${endDateStr}T${endTime}`;
    const isSelfApproval =
      isAdmin && chosenApprover.id === currentUser.id && !isLineModuleEnabled;
    const jobNumber = generateNextJobNumber(bookings, new Date().toISOString());

    const newBookingData = {
      jobNumber,
      vehicleId: selectedVehicle.id,
      userId: currentUser.id,
      userName: currentUser.name,
      userPhone: currentUser.phone,
      userDepartment: currentUser.department,
      userDivision: currentUser.division || 'ฝ่ายพัฒนาธุรกิจและการตลาด',
      plateNumber: selectedVehicle.plateNumber,
      vehicleName: `${selectedVehicle.brand} ${selectedVehicle.model} (${selectedVehicle.plateNumber})`,
      startDate: startIso,
      endDate: endIso,
      purpose: purpose.trim(),
      destination: destination.trim(),
      passengersCount: Math.max(1, Number(passengersCount) || 1),
      status: (isSelfApproval ? 'Approved' : 'Pending') as BookingStatus,
      assignedApproverId: chosenApprover.id,
      assignedApproverName: chosenApprover.name,
      assignedApproverLineId: chosenApprover.lineUserId || undefined,
      stage2ApproverId: chosenStage2Approver?.id,
      stage2ApproverName: chosenStage2Approver?.name || 'Approve 2',
      stage2ApproverLineId: chosenStage2Approver?.lineUserId || undefined,
      requesterLineId: currentUser.lineUserId || undefined,
      approverName: isSelfApproval ? `${currentUser.name} (Admin)` : undefined,
      approvedAt: isSelfApproval ? new Date().toISOString() : undefined,
      maintenanceAlerts:
        vehicleBookingAlerts.length > 0
          ? formatMaintenanceAlertsForLine(vehicleBookingAlerts)
          : undefined,
      maintenanceAlertsAcknowledged: vehicleBookingAlerts.length > 0 ? true : undefined,
      maintenanceAlertsAcknowledgedAt:
        vehicleBookingAlerts.length > 0 ? new Date().toISOString() : undefined,
    };

    try {
      setIsSubmittingBooking(true);
      await onAddBooking(newBookingData);
      setBookingSuccess(
        isSelfApproval
          ? `จองรถสำเร็จ (ใบงาน: ${jobNumber}) และอนุมัติทันที!`
          : `ส่งคำขอจองรถสำเร็จ (ใบงาน: ${jobNumber}) รอคุณ ${chosenApprover.name} พิจารณาอนุมัติ`
      );
      setTimeout(() => {
        setIsBookingModalOpen(false);
        setDestination('');
        setPurpose('');
        setBookingSuccess('');
        setIsSubmittingBooking(false);
      }, 800);
    } catch {
      setBookingError('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
      setIsSubmittingBooking(false);
    }
  };

  return (
    <div className="space-y-6" id="booking-system-container">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900">
              รายการจองรถยนต์ส่วนกลาง
            </h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              อนุมัติ 2 ขั้น (ผู้จัดการ & ผู้ดูแลรถ)
            </span>
            {!hasEditPermission && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                🔒 โหมดดูได้อย่างเดียว (View Only)
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {isAdmin
              ? 'ระบบการอนุมัติ 2 ขั้น: ผู้จัดการ → ผู้ดูแลรถ พร้อมระบบบันทึกไมล์ น้ำมัน และส่งคืนกุญแจ'
              : 'ตรวจสอบสถานะคำขอ อนุมัติการใช้รถตามสิทธิ์ และบันทึกข้อมูลไมล์/น้ำมัน/รูปถ่ายเมื่อเสร็จสิ้นภารกิจ'}
          </p>
        </div>

        {/* Quick status summary pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {hasEditPermission && onAddBooking && (
            <button
              id="btn-status-menu-quick-book"
              type="button"
              onClick={() => handleOpenBookingModal(realTodayStr)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer flex items-center gap-1.5 mr-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>กดจองรถทันที</span>
            </button>
          )}
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
            <span>ผู้จัดการ</span>
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
            <span>ผู้ดูแลรถ</span>
            <span className="px-1.5 py-0.2 bg-white/30 rounded-full text-[10px]">
              {pending2Count}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('Approved')}
            title="รถที่เรายืมหรือจองและยังไม่ได้คืนรถ"
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              statusFilter === 'Approved'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span>กำลังใช้งาน</span>
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
          <button
            onClick={() => setStatusFilter('Cancelled')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              statusFilter === 'Cancelled'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <span>Reject</span>
            <span className="px-1.5 py-0.2 bg-white/30 rounded-full text-[10px]">
              {cancelledCount}
            </span>
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ค้นหาตามหมายเลขใบงาน (เช่น AX-...), ชื่อผู้ยืม, ทะเบียนรถ, แผนก, ฝ่าย หรือสถานที่ปลายทาง..."
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
            const isOwner =
              Boolean(currentUser) &&
              (currentUser?.id === booking.userId ||
                (Boolean(currentUser?.name) &&
                  Boolean(booking.userName) &&
                  currentUser!.name.trim().toLowerCase() ===
                    booking.userName.trim().toLowerCase()));
            const isEligibleToApprove =
              hasEditPermission && canUserApproveBooking(booking, currentUser, users);
            const canApproveStage1Action =
              booking.status === 'Pending' && isEligibleToApprove;
            const canApproveStage2Action =
              booking.status === 'Pending_Approve2' && isEligibleToApprove;
            // ผู้จอง (User) หรือ Admin สามารถกดยกเลิกการจองได้ (แต่ห้ามลบข้อมูลถาวร ยกเว้น Admin)
            const canUserCancel =
              Boolean(currentUser) &&
              (isOwner || isAdmin) &&
              booking.status !== 'Completed' &&
              booking.status !== 'Cancelled';
            const canRecordDeparture =
              Boolean(currentUser) &&
              booking.status === 'Approved' &&
              (isOwner || isAdmin);
            const canRecordReturn =
              Boolean(currentUser) &&
              booking.status === 'Approved' &&
              (isOwner || isAdmin);

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
                      {(booking.userName || 'U').substring(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-900 text-white border border-slate-800 shadow-2xs">
                          📄 ใบงาน: {getBookingJobNumber(booking)}
                        </span>
                        <span className="font-bold text-gray-900 text-sm">
                          {booking.userName}
                        </span>
                        {isOwner && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            การจองของคุณ
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span>
                          {booking.userDepartment || '-'} {booking.userDivision ? `• ${booking.userDivision}` : ''}
                        </span>
                        {(() => {
                          const contactPhone =
                            booking.userPhone ||
                            users.find((u) => u.id === booking.userId)?.phone ||
                            '';
                          if (!contactPhone) return null;
                          return (
                            <>
                              <span>•</span>
                              <a
                                href={getTelHref(contactPhone)}
                                onClick={(e) => e.stopPropagation()}
                                title="กดเพื่อโทรออก"
                                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-mono font-semibold bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200 transition-colors cursor-pointer"
                              >
                                📞 {maskPhoneNumber(contactPhone)}
                              </a>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 shadow-2xs">
                      <Car className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{booking.vehicleName}</span>
                    </span>
                    {getBookingStatusBadge(booking)}
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
                            <span className="font-bold text-gray-900">ผู้จัดการ:</span>{' '}
                            <span className="text-gray-600">{booking.assignedApproverName || 'ผู้จัดการ'}</span>
                          </div>
                        </div>
                        <div>
                          {booking.stage1ApprovedBy && booking.rejectedStage !== 1 ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                              <Check className="w-3 h-3" /> ผ่านแล้ว
                            </span>
                          ) : booking.status === 'Cancelled' ? (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              ❌ ผู้จัดการ Reject
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              รอผู้จัดการ
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
                            <span className="font-bold text-gray-900">ผู้ดูแลรถ:</span>{' '}
                            <span className="text-gray-600">
                              {booking.stage2ApprovedBy
                                ? booking.stage2ApprovedBy
                                : booking.stage2ApproverName || 'ผู้ดูแลรถ'}
                            </span>
                          </div>
                        </div>
                        <div>
                          {booking.stage2ApprovedBy || booking.status === 'Approved' || booking.status === 'Completed' ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                              <Check className="w-3 h-3" /> อนุมัติครบแล้ว
                            </span>
                          ) : booking.status === 'Cancelled' &&
                            (booking.rejectedStage === 2 ||
                              (booking.rejectedStage !== 1 && Boolean(booking.stage1ApprovedBy))) ? (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              ❌ ผู้ดูแลรถ Reject
                            </span>
                          ) : booking.status === 'Cancelled' ? (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              ❌ ผู้จัดการ Reject
                            </span>
                          ) : booking.status === 'Pending_Approve2' ? (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 animate-pulse">
                              รอผู้ดูแลรถ
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">รอผ่านผู้จัดการ</span>
                          )}
                        </div>
                      </div>

                      {/* Rejection Reason Display if Cancelled/Rejected */}
                      {booking.status === 'Cancelled' && (
                        <div className="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 space-y-0.5">
                          <div className="font-bold text-rose-700 flex items-center justify-between">
                            <span>
                              ❌ ผู้อนุมัติ Reject:{' '}
                              {booking.rejectedBy ||
                                (booking.rejectedStage === 2 ||
                                (booking.rejectedStage !== 1 && Boolean(booking.stage1ApprovedBy))
                                  ? `${booking.stage2ApproverName || 'ผู้ดูแลรถ'} (ผู้ดูแลรถ Reject)`
                                  : `${booking.assignedApproverName || 'ผู้จัดการ'} (ผู้จัดการ Reject)`)}
                            </span>
                          </div>
                          {booking.rejectionReason && (
                            <p className="font-medium text-rose-900">เหตุผล: {booking.rejectionReason}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {booking.status === 'Cancelled' ? (
                      <div className="text-[10px] font-bold text-rose-600 pt-1 text-right">
                        สถานะผู้อนุมัติ: Reject
                      </div>
                    ) : booking.approverName ? (
                      <div className="text-[10px] text-gray-500 pt-1 text-right">
                        อนุมัติครบสมบูรณ์: {booking.approverName}
                      </div>
                    ) : null}
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
                    {/* Stage 1 Approval Action */}
                    {canApproveStage1Action && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          id={`btn-approve-stage1-${booking.id}`}
                          type="button"
                          onClick={() =>
                            onUpdateBookingStatus(booking.id, 'Pending_Approve2', {
                              stage1ApprovedBy: currentUser?.name || 'ผู้จัดการ',
                              stage1ApprovedAt: new Date().toISOString(),
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>ผู้จัดการ (ส่งต่อผู้ดูแลรถ)</span>
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
                              stage2ApprovedBy: currentUser?.name || 'ผู้ดูแลรถ',
                              stage2ApprovedAt: new Date().toISOString(),
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>ผู้ดูแลรถ (อนุมัติขั้นสุดท้าย)</span>
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

                    {/* User Cancel Booking (ยกเลิกการจองได้ แต่ห้ามลบข้อมูล) */}
                    {canUserCancel && (
                      <button
                        id={`btn-cancel-booking-${booking.id}`}
                        type="button"
                        onClick={() =>
                          onUpdateBookingStatus(booking.id, 'Cancelled', {
                            rejectedBy: `${currentUser?.name || booking.userName} (ผู้จองยกเลิกการจอง)`,
                            rejectionReason: 'ผู้ขอใช้รถกดยกเลิกการจองด้วยตนเอง',
                            rejectedAt: new Date().toISOString(),
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                        title="ยกเลิกใบงานคำขอใช้รถรายการนี้ (ข้อมูลใบงานยังคงอยู่ในระบบ)"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>ยกเลิกการจอง</span>
                      </button>
                    )}

                    {/* Admin Delete ONLY (Requirement 6: ห้าม user ลบข้อมูลการยืมรถเอง ต้องสิทธิ admin เท่านั้น) */}
                    {isAdmin && (
                      <button
                        id={`btn-delete-booking-${booking.id}`}
                        type="button"
                        onClick={() => setDeletingBooking(booking)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        title="ลบรายการจองถาวร (เฉพาะ Admin เท่านั้น)"
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
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setDepartureBooking(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 my-8 space-y-4 max-h-[90vh] flex flex-col z-10"
              onClick={(e) => e.stopPropagation()}
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
                {/* 1. ไมล์เริ่มต้น (ดึงข้อมูลจากเลขไมล์ของรถคันนั้นมาแสดง แต่สามารถปรับแก้เองได้) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="block text-xs font-bold text-gray-800">
                      1. ไมล์เริ่มต้น (กิโลเมตร) <span className="text-red-500">*</span>
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      id="input-start-mileage"
                      type="number"
                      value={startMileageInput}
                      onChange={(e) => setStartMileageInput(e.target.value)}
                      placeholder="เช่น 18500"
                      className="w-full pl-3 pr-12 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-sm text-gray-900 font-mono font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      required
                    />
                    <span className="absolute right-3.5 top-3 text-xs text-gray-400 font-mono">
                      km.
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    ระบบดึงเลขไมล์ปัจจุบันของรถคันนี้มาแสดงให้อัตโนมัติ (สามารถแก้ไขตัวเลขเองได้ตามหน้าปัดรถจริง)
                  </p>
                </div>

                {/* 2. น้ำมันเริ่มต้น พร้อมกราฟฟิกหน้าปัดระดับน้ำมัน */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="block text-xs font-bold text-gray-800">
                    2. น้ำมันเริ่มต้น (เลือกได้ 1 ตัวเลือก) <span className="text-red-500">*</span>
                  </label>
                  <FuelGaugeGraphic
                    value={startFuelInput}
                    onChange={setStartFuelInput}
                    accentColor="amber"
                  />
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
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setReturnBooking(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 my-8 space-y-4 max-h-[92vh] flex flex-col z-10"
              onClick={(e) => e.stopPropagation()}
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

              {/* Early Return Warning Banner */}
              {isEarlyVehicleReturn(returnBooking, new Date().toISOString()) && (
                <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 shrink-0 shadow-2xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-amber-900">
                      ⚠️ แจ้งเตือนการคืนรถก่อนกำหนด
                    </p>
                    <p className="font-semibold text-amber-800">
                      &ldquo;{EARLY_RETURN_WARNING_TEXT}&rdquo;
                    </p>
                  </div>
                </div>
              )}

              {/* Vehicle Approaching Maintenance Alert Callout during Return */}
              {(() => {
                const returnVehicle =
                  vehicles.find((v) => v.id === returnBooking.vehicleId) ||
                  vehicles.find((v) => doesBookingMatchVehicle(returnBooking, v));
                if (!returnVehicle) return null;
                const endMileageNum = parseInt(endMileageInput, 10);
                const effectiveMileage =
                  !isNaN(endMileageNum) && endMileageNum > 0
                    ? endMileageNum
                    : returnVehicle.currentMileage || returnBooking.startMileage || 0;
                const vehicleForAlert: Vehicle = {
                  ...returnVehicle,
                  currentMileage: effectiveMileage,
                };
                const returnAlerts = getVehicleBookingAlerts(vehicleForAlert);
                if (returnAlerts.length === 0) return null;
                return (
                  <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-xl text-xs space-y-1.5 shrink-0 shadow-2xs">
                    <div className="flex items-center gap-2 font-bold text-amber-950">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>⚠️ แจ้งเตือนการซ่อมบำรุงรถยนต์ ({returnAlerts.length} รายการ):</span>
                    </div>
                    <div className="space-y-1 pl-6">
                      {returnAlerts.map((a, i) => (
                        <div key={i} className="text-amber-900 text-[11px]">
                          <strong>• {a.shortLabel}:</strong> {a.remainingText} ({a.badge})
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

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
                      className="w-full pl-3 pr-12 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-sm text-gray-900 font-mono font-bold focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      required
                    />
                    <span className="absolute right-3.5 top-3 text-xs text-gray-400 font-mono">
                      km.
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    เมื่อยืนยันคืนรถแล้ว เลขไมล์ที่กรอกจะถูกนำไปอัปเดตที่เมนูจัดการข้อมูลรถยนต์โดยอัตโนมัติ
                  </p>
                </div>

                {/* 3.2 น้ำมันส่งคืน พร้อมกราฟฟิกหน้าปัดระดับน้ำมัน */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="block text-xs font-bold text-gray-800">
                    3.2 น้ำมันส่งคืน (เลือกได้ 1 ตัวเลือก) <span className="text-red-500">*</span>
                  </label>
                  <FuelGaugeGraphic
                    value={endFuelInput}
                    onChange={setEndFuelInput}
                    accentColor="emerald"
                  />
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
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => setRejectingBookingState(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-rose-700 text-base">
                  ❌ ไม่อนุมัติคำขอใช้รถ ({rejectingBookingState.stage === 1 ? 'ผู้จัดการ' : 'ผู้ดูแลรถ'})
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
                    const stageLabel = rejectingBookingState.stage === 1 ? 'ผู้จัดการ' : 'ผู้ดูแลรถ';
                    onUpdateBookingStatus(rejectingBookingState.booking.id, 'Cancelled', {
                      rejectionReason: rejectReasonInput.trim(),
                      rejectedBy: `${currentUser?.name || stageLabel} (${stageLabel} Reject)`,
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
        {deletingBooking && isAdmin && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => setDeletingBooking(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4"
              onClick={(e) => e.stopPropagation()}
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

      {/* MODAL: Quick Booking from Status Menu */}
      <AnimatePresence>
        {isBookingModalOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={() => setIsBookingModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-700 to-indigo-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white backdrop-blur-xs">
                    <CalendarDays className="w-5 h-5 text-indigo-200" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base sm:text-lg text-white">
                      จองรถยนต์ส่วนกลางทันที
                    </h3>
                    <p className="text-xs text-indigo-200">
                      สำหรับวันที่:{' '}
                      <span className="font-bold text-white underline">
                        {formatShortThaiDate(selectedDateStr)}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  id="btn-close-quick-booking"
                  type="button"
                  onClick={() => setIsBookingModalOpen(false)}
                  className="p-1.5 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content - Scrollable */}
              <form
                onSubmit={handleConfirmBooking}
                className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm"
              >
                {bookingError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{bookingError}</span>
                  </div>
                )}

                {bookingSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{bookingSuccess}</span>
                  </div>
                )}

                {/* 1. User Info Header */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                      {currentUser ? currentUser.name.substring(0, 2) : '?'}
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block font-semibold">
                        ผู้ขอจอง:
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-xs">
                          {currentUser
                            ? `${currentUser.name} (${currentUser.department})`
                            : 'ไม่ได้เลือกผู้ใช้'}
                        </span>
                        {currentUser?.phone && (
                          <a
                            href={getTelHref(currentUser.phone)}
                            onClick={(e) => e.stopPropagation()}
                            title="กดเพื่อโทรออก"
                            className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200 transition-colors cursor-pointer"
                          >
                            📞 {maskPhoneNumber(currentUser.phone)}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Choose Vehicle */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                    เลือกรถยนต์ที่ต้องการจอง <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto p-1">
                    {vehicles.map((v) => {
                      const matchedDayBooking = bookings.find(
                        (b) =>
                          doesBookingMatchVehicle(b, v) &&
                          b.status !== 'Completed' &&
                          b.status !== 'Cancelled' &&
                          doesBookingCoverDate(b, selectedDateStr, realTodayStr)
                      );
                      const isBooked = Boolean(matchedDayBooking);
                      const isMaintenance = v.status === 'Maintenance';
                      const isSelected = selectedVehicleId === v.id;

                      let statusBadge = (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          🟢 ว่างในวันนี้
                        </span>
                      );

                      if (isMaintenance) {
                        statusBadge = (
                          <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded">
                            🔴 ซ่อมบำรุง
                          </span>
                        );
                      } else if (isBooked && matchedDayBooking) {
                        statusBadge = (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            🟡 ติดภารกิจ/จอง (คุณ {matchedDayBooking.userName})
                          </span>
                        );
                      }

                      return (
                        <div
                          key={v.id}
                          id={`modal-vehicle-card-${v.id}`}
                          onClick={() => {
                            if (!isMaintenance) {
                              setSelectedVehicleId(v.id);
                              const alerts = getVehicleBookingAlerts(v);
                              if (alerts.length > 0 && hasAcknowledgedAlertsForVehicleId !== v.id) {
                                setIsMaintenanceAlertModalOpen(true);
                              }
                            }
                          }}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/30'
                              : isMaintenance
                              ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                              : 'border-gray-200 hover:border-indigo-300 bg-white'
                          }`}
                        >
                          <img
                            src={v.imageUrl}
                            alt={v.model}
                            referrerPolicy="no-referrer"
                            className="w-14 h-12 rounded-lg object-cover bg-gray-100 shrink-0 border border-gray-200"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-gray-900 text-xs truncate">
                                {v.brand} {v.model}
                              </span>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-gray-500 block truncate">
                              {v.plateNumber} • {v.capacity} ที่นั่ง
                            </span>
                            <div className="mt-1">{statusBadge}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Approaching Maintenance Warning Banner in Vehicle Selection */}
                  {currentVehicleBookingAlerts.length > 0 && selectedVehicleObj && (
                    <div className="mt-2.5 p-3 bg-amber-50 border-2 border-amber-300 rounded-xl text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
                      <div className="flex items-start gap-2 min-w-0">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-amber-950 flex items-center gap-1.5 flex-wrap">
                            <span>⚠️ รถคันนี้มีรายการใกล้ถึงกำหนด ({currentVehicleBookingAlerts.length} รายการ)</span>
                            <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-semibold">
                              เตือนก่อน 1,000 กม. / ภาษี 1 เดือน
                            </span>
                          </p>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            {currentVehicleBookingAlerts.map((a) => `${a.shortLabel} (${a.badge})`).join(' • ')}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsMaintenanceAlertModalOpen(true)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shrink-0 transition-colors cursor-pointer shadow-2xs self-start sm:self-auto"
                      >
                        กดดูรายละเอียด / รับทราบ
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. Trip Times and Dates */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      กำหนดวันและเวลาเดินทาง <span className="text-red-500">*</span>
                    </span>
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-semibold flex items-center gap-1">
                      <span>🔒 ห้ามจองย้อนหลัง</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        วันที่เริ่มต้นเดินทาง{' '}
                        <span className="text-gray-400 font-normal">(วันนี้เป็นต้นไป)</span>
                      </label>
                      <input
                        id="input-quick-start-date"
                        type="date"
                        min={realTodayStr}
                        value={selectedDateStr}
                        onChange={(e) => {
                          const newStart = e.target.value;
                          if (isDateInPast(newStart)) {
                            setBookingError(
                              `ไม่อนุญาตให้จองย้อนหลัง กรุณาเลือกตั้งแต่วันที่ปัจจุบัน (${formatShortThaiDate(
                                realTodayStr
                              )}) เป็นต้นไป`
                            );
                            return;
                          }
                          setBookingError('');
                          const prevDuration = getSelectedDaysCount(selectedDateStr, endDateStr);
                          setSelectedDateStr(newStart);
                          if (prevDuration > 1) {
                            setEndDateStr(calculateEndDateStr(newStart, prevDuration));
                          } else if (endDateStr < newStart) {
                            setEndDateStr(newStart);
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-indigo-500 outline-hidden"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        เวลาเริ่มต้น
                      </label>
                      <input
                        id="input-quick-start-time"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-indigo-500 outline-hidden"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        วันที่สิ้นสุดเดินทาง
                      </label>
                      <input
                        id="input-quick-end-date"
                        type="date"
                        min={selectedDateStr || realTodayStr}
                        value={endDateStr}
                        onChange={(e) => {
                          const newEnd = e.target.value;
                          if (newEnd < selectedDateStr) {
                            setBookingError('วันที่สิ้นสุดการเดินทางต้องไม่น้อยกว่าวันที่เริ่มต้น');
                            return;
                          }
                          setBookingError('');
                          setEndDateStr(newEnd);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-indigo-500 outline-hidden"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        เวลาสิ้นสุด
                      </label>
                      <input
                        id="input-quick-end-time"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-indigo-500 outline-hidden"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Quick time preset shortcuts: ครึ่งเช้า, ครึ่งบ่าย, เต็มวัน, 2 วัน, 3 วัน, 5 วัน, 7 วัน */}
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-600">
                    <span className="text-gray-500 font-semibold">เวลารวดเร็ว:</span>
                    <button
                      id="btn-preset-half-morning"
                      type="button"
                      onClick={handleQuickPresetHalfMorning}
                      title="ครึ่งเช้า (08:30 - 12:00 น.)"
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer border ${
                        isPresetHalfMorning
                          ? 'bg-indigo-600 text-white font-bold border-indigo-600 shadow-2xs'
                          : 'bg-slate-100 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 border-slate-200'
                      }`}
                    >
                      ครึ่งเช้า
                    </button>
                    <button
                      id="btn-preset-half-afternoon"
                      type="button"
                      onClick={handleQuickPresetHalfAfternoon}
                      title="ครึ่งบ่าย (13:00 - 17:00 น.)"
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer border ${
                        isPresetHalfAfternoon
                          ? 'bg-indigo-600 text-white font-bold border-indigo-600 shadow-2xs'
                          : 'bg-slate-100 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 border-slate-200'
                      }`}
                    >
                      ครึ่งบ่าย
                    </button>
                    <button
                      id="btn-preset-1-day"
                      type="button"
                      onClick={() => handleQuickPresetDays(1)}
                      title="เต็มวัน (08:30 - 17:30 น.)"
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer border ${
                        isPresetFullDay
                          ? 'bg-indigo-600 text-white font-bold border-indigo-600 shadow-2xs'
                          : 'bg-slate-100 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 border-slate-200'
                      }`}
                    >
                      เต็มวัน
                    </button>
                    <button
                      id="btn-preset-2-days"
                      type="button"
                      onClick={() => handleQuickPresetDays(2)}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer border ${
                        isPreset2Days
                          ? 'bg-indigo-600 text-white font-bold border-indigo-600 shadow-2xs'
                          : 'bg-slate-100 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 border-slate-200'
                      }`}
                    >
                      2 วัน
                    </button>
                    <button
                      id="btn-preset-3-days"
                      type="button"
                      onClick={() => handleQuickPresetDays(3)}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer border ${
                        isPreset3Days
                          ? 'bg-indigo-600 text-white font-bold border-indigo-600 shadow-2xs'
                          : 'bg-slate-100 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 border-slate-200'
                      }`}
                    >
                      3 วัน
                    </button>
                    <button
                      id="btn-preset-5-days"
                      type="button"
                      onClick={() => handleQuickPresetDays(5)}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer border ${
                        isPreset5Days
                          ? 'bg-indigo-600 text-white font-bold border-indigo-600 shadow-2xs'
                          : 'bg-slate-100 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 border-slate-200'
                      }`}
                    >
                      5 วัน
                    </button>
                    <button
                      id="btn-preset-7-days"
                      type="button"
                      onClick={() => handleQuickPresetDays(7)}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer border ${
                        isPreset7Days
                          ? 'bg-indigo-600 text-white font-bold border-indigo-600 shadow-2xs'
                          : 'bg-slate-100 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 border-slate-200'
                      }`}
                    >
                      7 วัน
                    </button>
                    <button
                      id="btn-preset-15-days"
                      type="button"
                      onClick={() => handleQuickPresetDays(15)}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer border ${
                        isPreset15Days
                          ? 'bg-indigo-600 text-white font-bold border-indigo-600 shadow-2xs'
                          : 'bg-slate-100 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 border-slate-200'
                      }`}
                    >
                      15 วัน
                    </button>
                    <button
                      id="btn-preset-30-days"
                      type="button"
                      onClick={() => handleQuickPresetDays(30)}
                      className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer border ${
                        isPreset30Days
                          ? 'bg-indigo-600 text-white font-bold border-indigo-600 shadow-2xs'
                          : 'bg-slate-100 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 border-slate-200'
                      }`}
                    >
                      30 วัน
                    </button>
                  </div>

                  {/* Summary of selected duration */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-indigo-50/70 border border-indigo-100 rounded-lg px-3 py-2 text-indigo-950">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>
                        ระยะเวลาที่เลือก:{' '}
                        <strong className="font-bold text-indigo-700">
                          {currentDurationDays} วัน
                        </strong>
                        {isPresetHalfMorning && ' (ครึ่งเช้า 08:30 - 12:00)'}
                        {isPresetHalfAfternoon && ' (ครึ่งบ่าย 13:00 - 17:00)'}
                        {isPresetFullDay && ' (เต็มวัน 08:30 - 17:30)'}
                        {isPreset2Days && ' (2 วัน เดินทางต่อเนื่อง)'}
                        {isPreset3Days && ' (3 วัน เดินทางต่อเนื่อง)'}
                        {isPreset5Days && ' (5 วัน เดินทางต่อเนื่อง)'}
                        {isPreset7Days && ' (7 วัน เดินทางต่อเนื่อง)'}
                        {isPreset15Days && ' (15 วัน เดินทางต่อเนื่อง)'}
                        {isPreset30Days && ' (30 วัน เดินทางต่อเนื่อง)'}
                      </span>
                    </div>
                    <div className="text-gray-600 text-[10px] sm:text-[11px] font-medium">
                      {formatShortThaiDate(selectedDateStr)} {startTime} น. →{' '}
                      {formatShortThaiDate(endDateStr)} {endTime} น.
                    </div>
                  </div>
                </div>

                {/* 4. Choose Approver 1 */}
                <div
                  className="space-y-3 pt-2 border-t border-gray-100"
                  id="booking-approver-selection-section"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-indigo-600" />
                      <span>
                        เลือกผู้อนุมัติขั้นที่ 1 (Approve 1){' '}
                        <span className="text-red-500">*</span>
                      </span>
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setShowAllDeptApprovers((prev) => !prev)}
                        className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 cursor-pointer"
                      >
                        {showAllDeptApprovers
                          ? 'แสดงเฉพาะแผนก/ฝ่ายเดียวกัน'
                          : 'แสดงผู้อนุมัติขั้นที่ 1 ทั้งหมด'}
                      </button>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 font-semibold px-2 py-0.5 rounded-full border border-emerald-200 w-fit">
                        ผ่าน Approve 1 แล้วส่งต่อ Approve 2 อัตโนมัติ
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    แสดงเฉพาะผู้มีสิทธิ์ <strong>Approve 1</strong> ที่สังกัดในแผนกหรือฝ่ายเดียวกับผู้ขอจอง (
                    {currentUser?.department || '-'}
                    {currentUser?.division ? ` • ${currentUser.division}` : ''}) เท่านั้น
                  </p>

                  {eligibleApprovers.length === 0 ? (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        ไม่พบผู้อนุมัติขั้นที่ 1 (Approve 1) ในแผนกหรือฝ่ายของคุณ (
                        {currentUser?.department || '-'}
                        {currentUser?.division ? ` / ${currentUser.division}` : ''})
                        กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนดผู้อนุมัติประจำแผนก/ฝ่าย
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {eligibleApprovers.map((approver) => {
                        const isSelected = selectedApproverId === approver.id;

                        return (
                          <div
                            key={approver.id}
                            id={`approver-card-${approver.id}`}
                            onClick={() => setSelectedApproverId(approver.id)}
                            className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/30 shadow-xs'
                                : 'border-gray-200 hover:border-indigo-300 bg-white hover:bg-slate-50/50'
                            }`}
                          >
                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-2xs">
                              {approver.name.substring(0, 2)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-gray-900 truncate block">
                                  {approver.name}{' '}
                                  {approver.employeeCode ? (
                                    <span className="text-[10px] font-mono text-gray-500 font-normal">
                                      [{approver.employeeCode}]
                                    </span>
                                  ) : null}
                                </span>
                                {isSelected && (
                                  <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                                )}
                              </div>
                              <span className="text-[11px] text-gray-600 block truncate font-medium">
                                {approver.department}
                                {approver.division ? ` • ${approver.division}` : ''}
                              </span>
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <span className="text-[9px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                                  Approve 1
                                </span>
                                {approver.phone && (
                                  <a
                                    href={getTelHref(approver.phone)}
                                    onClick={(e) => e.stopPropagation()}
                                    title="กดเพื่อโทรออก"
                                    className="text-[10px] font-mono font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200 transition-colors cursor-pointer"
                                  >
                                    📞 {maskPhoneNumber(approver.phone)}
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 5. Purpose & Destination */}
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      สถานที่ปลายทาง (Destination) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        id="input-quick-destination"
                        type="text"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="เช่น สำนักงานเทศบาลนนทบุรี หรือ ศูนย์ประชุมไบเทค บางนา"
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 outline-hidden"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        วัตถุประสงค์การใช้งาน (Purpose) <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="input-quick-purpose"
                        type="text"
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        placeholder="เช่น ไปพบลูกค้าเพื่อเซ็นสัญญาซื้อขาย"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 outline-hidden"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        จำนวนผู้โดยสาร
                      </label>
                      <input
                        id="input-quick-passengers"
                        type="number"
                        min={1}
                        max={20}
                        value={passengersCount}
                        onChange={(e) => setPassengersCount(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 outline-hidden"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Inline Error/Success Alert right above submit button */}
                {bookingError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{bookingError}</span>
                  </div>
                )}

                {bookingSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{bookingSuccess}</span>
                  </div>
                )}

                {/* Modal Footer Controls */}
                <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                  {isLineModuleEnabled ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-[#059440] bg-[#06C755]/10 px-3 py-1.5 rounded-xl border border-[#06C755]/25 font-semibold">
                      <MessageCircle className="w-3.5 h-3.5 fill-[#06C755] text-[#06C755] shrink-0" />
                      <span>
                        หลังกดยืนยัน ระบบจะส่งแจ้งเตือนทาง LINE ให้ผู้อนุมัติโดยอัตโนมัติ
                      </span>
                    </div>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsBookingModalOpen(false)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      ยกเลิก
                    </button>

                    <button
                      id="btn-submit-quick-booking"
                      type="submit"
                      disabled={isSubmittingBooking}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {isSubmittingBooking ? 'กำลังบันทึก...' : 'ยืนยันการจองรถยนต์'}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
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

      {/* Maintenance Alerts Acknowledgment Popup Modal */}
      <VehicleMaintenanceAlertModal
        isOpen={isMaintenanceAlertModalOpen}
        vehicle={selectedVehicleObj}
        alerts={currentVehicleBookingAlerts}
        onAcknowledge={() => {
          if (selectedVehicleId) {
            setHasAcknowledgedAlertsForVehicleId(selectedVehicleId);
          }
          setIsMaintenanceAlertModalOpen(false);
        }}
        onCancelOrChangeVehicle={() => {
          setIsMaintenanceAlertModalOpen(false);
        }}
      />
    </div>
  );
}
