import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Vehicle, Booking, User, BookingStatus, FuelLevel } from '../types';
import {
  isUserAdmin,
  canUserViewBooking,
  canUserApproveBooking,
  getEligibleStage1Approvers,
  getEligibleStage2Approvers,
} from '../utils/userHelpers';
import VehicleOverview from './VehicleOverview';
import CameraCaptureModal from './CameraCaptureModal';
import {
  getRealTodayStr,
  isDateInPast,
  isDateToday,
  validateBookingDates,
  getBookingJobNumber,
  generateNextJobNumber,
} from '../utils/dateHelpers';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  Clock,
  MapPin,
  Users,
  Car,
  CheckCircle2,
  AlertCircle,
  X,
  UserCheck,
  Calendar as CalendarIcon,
  Search,
  Shield,
  CircleUser,
  Info,
  Check,
  AlertTriangle,
  ArrowRight,
  Wrench,
  Camera,
  Gauge,
  Key,
  Upload,
  MessageCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  formatMileage,
  formatThaiDate,
  formatTripDateTime,
  getVehicleAlerts,
} from '../utils/vehicleAlerts';

interface MonthlyCalendarProps {
  vehicles: Vehicle[];
  bookings: Booking[];
  currentUser: User | null;
  users: User[];
  onSelectUser?: (user: User) => void;
  onAddBooking: (booking: Omit<Booking, 'id' | 'createdAt'>) => void | Promise<void>;
  onUpdateBookingStatus?: (bookingId: string, status: BookingStatus, extraData?: Partial<Booking>) => void;
  onNavigateToBookingList: () => void;
  onNavigateToVehicles: () => void;
  onOpenLineShare?: (booking: Booking) => void;
  onOpenLineQuickApprove?: (booking: Booking, stage: 1 | 2, action?: 'approve' | 'reject' | 'review') => void;
  isLineModuleEnabled?: boolean;
  onUpdateUserLineId?: (userId: string, lineId: string) => void;
  canEdit?: boolean;
  viewOnly?: boolean;
}

const FUEL_OPTIONS: FuelLevel[] = ['เต็มถัง', '3/4', '1/2', '1/4'];

export default function MonthlyCalendar({
  vehicles,
  bookings,
  currentUser,
  users,
  onSelectUser,
  onAddBooking,
  onUpdateBookingStatus,
  onNavigateToBookingList,
  onNavigateToVehicles,
  onOpenLineShare,
  onOpenLineQuickApprove,
  isLineModuleEnabled = true,
  onUpdateUserLineId,
  canEdit = true,
  viewOnly = false,
}: MonthlyCalendarProps) {
  const hasEditPermission = canEdit && !viewOnly;
  // Real-time current date
  const realTodayStr = getRealTodayStr();
  const todayDate = new Date();
  const defaultYear = todayDate.getFullYear();
  const defaultMonth = todayDate.getMonth();

  const [currentYear, setCurrentYear] = useState<number>(defaultYear);
  const [currentMonth, setCurrentMonth] = useState<number>(defaultMonth);

  // Active approved trips for current user
  const myActiveBookings = useMemo(() => {
    if (!currentUser) return [];
    return bookings.filter(
      (b) => b.status === 'Approved' && (b.userId === currentUser.id || isUserAdmin(currentUser))
    );
  }, [bookings, currentUser]);

  // Pending bookings ready for approval / status tracking
  const pendingLineBookings = useMemo(() => {
    if (!currentUser) return [];
    return bookings.filter(
      (b) =>
        (b.status === 'Pending' || b.status === 'Pending_Approve2') &&
        canUserViewBooking(b, currentUser, users)
    );
  }, [bookings, currentUser, users]);

  // Trip Checklist Modals for departure and return
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

  // Open Departure Checklist
  const handleOpenDeparture = (booking: Booking) => {
    setDepartureBooking(booking);
    setDepartureError('');
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
    if (!departureBooking || !onUpdateBookingStatus) return;
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
    if (!returnBooking || !onUpdateBookingStatus) return;
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

  // Booking Modal States
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

  // Real-time Camera Capture Modal State
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

  // Eligible approvers: users with 'Approve 1' permission (same dept/div prioritized, or all if toggled/fallback)
  const eligibleApprovers = useMemo(
    () => getEligibleStage1Approvers(users, currentUser, showAllDeptApprovers),
    [users, currentUser, showAllDeptApprovers]
  );

  // Ensure selectedApproverId always belongs to the current user's eligible department/division approvers
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

  // Day View Modal (To view all bookings for a clicked day)
  const [viewingDayBookings, setViewingDayBookings] = useState<string | null>(null);

  // Helper to calculate end date string from start date and total days (1 = same day, 2 = next day, etc.)
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

  // Helper to calculate total days count between start date and end date
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

  // Quick preset actions
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

  // Active state computations for quick presets
  const currentDurationDays = getSelectedDaysCount(selectedDateStr, endDateStr);
  const isPresetHalfMorning = selectedDateStr === endDateStr && startTime === '08:30' && endTime === '12:00';
  const isPresetHalfAfternoon = selectedDateStr === endDateStr && startTime === '13:00' && endTime === '17:00';
  const isPresetFullDay = currentDurationDays === 1 && startTime === '08:30' && (endTime === '17:00' || endTime === '17:30');
  const isPreset2Days = currentDurationDays === 2 && startTime === '08:30' && (endTime === '17:00' || endTime === '17:30');
  const isPreset3Days = currentDurationDays === 3 && startTime === '08:30' && (endTime === '17:00' || endTime === '17:30');
  const isPreset5Days = currentDurationDays === 5 && startTime === '08:30' && (endTime === '17:00' || endTime === '17:30');
  const isPreset7Days = currentDurationDays === 7 && startTime === '08:30' && (endTime === '17:00' || endTime === '17:30');

  // Thai month names
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
    'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
    'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ];

  const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleGoToToday = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDateStr(getRealTodayStr());
  };

  // Pre-calculate calendar grid days
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isPast: boolean;
    }> = [];

    // Previous month padding days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevM = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dateStr: dStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: isDateToday(dStr),
        isPast: isDateInPast(dStr),
      });
    }

    // Current month days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const dStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateStr: dStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: isDateToday(dStr),
        isPast: isDateInPast(dStr),
      });
    }

    // Next month padding days to complete 35 or 42 grid cells
    const remainingCells = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
      const nextM = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextY = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateStr: dStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: isDateToday(dStr),
        isPast: isDateInPast(dStr),
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Map bookings to dates for fast lookups
  const bookingsByDate = useMemo(() => {
    const map: { [dateStr: string]: Booking[] } = {};
    bookings.forEach((b) => {
      if (b.status === 'Cancelled') return;
      const start = b.startDate.substring(0, 10);
      const end = b.endDate.substring(0, 10);

      // Add to each date between start and end
      const s = new Date(start);
      const e = new Date(end);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        const curr = new Date(s);
        while (curr <= e) {
          const key = curr.toISOString().substring(0, 10);
          if (!map[key]) map[key] = [];
          if (!map[key].some((item) => item.id === b.id)) {
            map[key].push(b);
          }
          curr.setDate(curr.getDate() + 1);
        }
      } else {
        if (!map[start]) map[start] = [];
        map[start].push(b);
      }
    });
    return map;
  }, [bookings]);

  // Select date to inspect on overview and calendar
  const handleSelectDate = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      if (d.getFullYear() !== currentYear || d.getMonth() !== currentMonth) {
        setCurrentYear(d.getFullYear());
        setCurrentMonth(d.getMonth());
      }
    }
  };

  // Open booking modal for a specific date (Strictly prevents booking in the past)
  const handleOpenBookingModal = (dateStr?: string, vehicleId?: string) => {
    if (!hasEditPermission) return;
    const todayStr = getRealTodayStr();
    let targetDate = dateStr || selectedDateStr || todayStr;
    // Strict requirement: ห้ามจองย้อนหลัง! If user tries a past date, lock to today
    if (isDateInPast(targetDate)) {
      targetDate = todayStr;
    }
    setSelectedDateStr(targetDate);
    setEndDateStr(targetDate);
    setStartTime('08:30');
    setEndTime('17:00');
    setBookingError('');
    setBookingSuccess('');

    if (vehicleId) {
      setSelectedVehicleId(vehicleId);
    } else {
      // Pre-select first available vehicle on that date if none selected
      const available = vehicles.filter((v) => {
        if (v.status === 'Maintenance') return false;
        const dateBookings = bookingsByDate[targetDate] || [];
        return !dateBookings.some((b) => b.vehicleId === v.id);
      });

      if (available.length > 0) {
        setSelectedVehicleId(available[0].id);
      } else if (vehicles.length > 0) {
        setSelectedVehicleId(vehicles[0].id);
      }
    }

    // Pre-select appropriate approver 1 (prefer same department Approve 1)
    setShowAllDeptApprovers(false);

    const approvers = getEligibleStage1Approvers(users, currentUser);
    const sameDept = approvers.find(
      (a) =>
        (a.department === currentUser?.department ||
          (a.division && currentUser?.division && a.division === currentUser.division)) &&
        a.id !== currentUser?.id
    );
    const chosenApp1 = sameDept || approvers[0] || null;
    if (chosenApp1) {
      setSelectedApproverId(chosenApp1.id);
    } else {
      setSelectedApproverId('');
    }

    setIsBookingModalOpen(true);
  };

  // Helper to check conflict
  const checkOverlap = (vId: string, sDate: string, sTime: string, eDate: string, eTime: string) => {
    const startIso = `${sDate}T${sTime}`;
    const endIso = `${eDate}T${eTime}`;
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();

    if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
      return 'วันเวลาสิ้นสุดการจองต้องอยู่หลังวันเวลาเริ่มต้น';
    }

    const relevant = bookings.filter(
      (b) => b.vehicleId === vId && b.status !== 'Cancelled'
    );

    for (const b of relevant) {
      const bStart = new Date(b.startDate).getTime();
      const bEnd = new Date(b.endDate).getTime();
      if (startMs < bEnd && endMs > bStart) {
        return `รถยนต์คันนี้ติดจองแล้วโดยคุณ ${b.userName} (${formatTripDateTime(b.startDate, b.endDate)})`;
      }
    }
    return null;
  };

  // Submit Quick Booking
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingBooking) return;
    setBookingError('');
    setBookingSuccess('');

    if (!currentUser) {
      setBookingError('กรุณาเลือกหรือเข้าสู่ระบบผู้ใช้งานก่อนทำการจอง');
      return;
    }

    // Strict requirement: "ห้ามจองย้อนหลัง" (prohibit booking in the past)
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

    const isAdminUser = isUserAdmin(currentUser);
    const isSelfApproval = isAdminUser && chosenApprover.id === currentUser.id && !isLineModuleEnabled;
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
    };

    try {
      setIsSubmittingBooking(true);
      await onAddBooking(newBookingData);
      handleSelectDate(selectedDateStr);
      setBookingSuccess(
        isSelfApproval
          ? `จองรถสำเร็จ (หมายเลขใบงาน: ${jobNumber}) และได้รับการอนุมัติทันทีในฐานะผู้ดูแลระบบ!`
          : `ส่งคำขอจองรถยนต์เรียบร้อยแล้ว (หมายเลขใบงาน: ${jobNumber}) รอคุณ ${chosenApprover.name} (${chosenApprover.division || chosenApprover.department}) พิจารณาอนุมัติขั้นที่ 1`
      );

      setTimeout(() => {
        setIsBookingModalOpen(false);
        setDestination('');
        setPurpose('');
        setBookingSuccess('');
        setIsSubmittingBooking(false);
      }, 900);
    } catch (err) {
      console.error('Error submitting booking:', err);
      setBookingError('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
      setIsSubmittingBooking(false);
    }
  };

  // Month stats
  const totalMonthBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status === 'Cancelled') return false;
      const d = new Date(b.startDate);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }).length;
  }, [bookings, currentYear, currentMonth]);

  const selectedVehicleObj = vehicles.find((v) => v.id === selectedVehicleId);

  return (
    <div className="space-y-6" id="monthly-calendar-view">
      {/* 1. Header Banner & Welcome */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-indigo-700/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-white/10 rounded-full text-xs font-semibold backdrop-blur-xs text-indigo-200">
              <CalendarDays className="w-3.5 h-3.5 text-indigo-300" />
              <span>ปฏิทินจองรถส่วนกลาง • หน้าแรกของระบบ</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>ปฏิทินประจำเดือน {thaiMonths[currentMonth]} {currentYear + 543}</span>
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200/90 max-w-2xl leading-relaxed">
              คลิกที่วันที่ต้องการบนปฏิทินเพื่อเปิดหน้าต่างจองรถได้ทันที ตรวจสอบรถว่างและสถานะการใช้งานของแต่ละวันแบบเรียลไทม์
            </p>
          </div>

          {/* Current User Quick Badge & Switcher */}
          <div className="flex flex-wrap items-center gap-3">
            {currentUser ? (
              <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-2.5 flex items-center gap-3 text-xs">
                <div className="w-9 h-9 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-inner">
                  {currentUser.name.substring(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-sm">{currentUser.name}</span>
                    {currentUser.role === 'Admin' ? (
                      <span className="px-1.5 py-0.2 bg-purple-500/30 text-purple-200 border border-purple-400/40 rounded text-[10px] font-bold">
                        Admin
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 bg-blue-500/30 text-blue-200 border border-blue-400/40 rounded text-[10px]">
                        User
                      </span>
                    )}
                  </div>
                  <span className="text-indigo-200 text-[11px] block">{currentUser.department}</span>
                </div>
              </div>
            ) : null}

            {hasEditPermission ? (
              <button
                id="btn-quick-book-today"
                onClick={() => handleOpenBookingModal(realTodayStr)}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/30 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02]"
              >
                <Plus className="w-4 h-4" />
                <span>กดจองรถทันที</span>
              </button>
            ) : (
              <div className="px-3.5 py-2 bg-amber-500/20 border border-amber-300/40 text-amber-100 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                <span>🔒 โหมดดูได้อย่างเดียว (View Only)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Active Approved Missions Banner & Prominent "เสร็จสิ้นภารกิจ" button */}
      {hasEditPermission && myActiveBookings.length > 0 && (
        <div id="user-active-missions-section" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-emerald-700">ภารกิจการใช้รถยนต์ของคุณในขณะนี้ (Active Trips)</span>
            </h2>
            <span className="text-xs text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              {myActiveBookings.length} รายการพร้อมใช้งาน
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myActiveBookings.map((b) => (
              <div
                key={b.id}
                id={`active-trip-card-${b.id}`}
                className="bg-gradient-to-br from-emerald-50/70 via-white to-white border-2 border-emerald-400/80 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-2 border-b border-emerald-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                      <Car className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          📄 {getBookingJobNumber(b)}
                        </span>
                        <h4 className="font-bold text-gray-900 text-sm leading-snug">
                          {b.vehicleName}
                        </h4>
                      </div>
                      <p className="text-xs text-gray-500 font-mono">
                        {formatThaiDate(b.startDate)} → {formatThaiDate(b.endDate)}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <Check className="w-3.5 h-3.5" /> อนุมัติแล้ว
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-white/80 p-3 rounded-xl border border-emerald-100/80">
                  <div>
                    <span className="text-gray-500 block text-[11px]">ปลายทาง:</span>
                    <strong className="text-gray-900 font-semibold">{b.destination}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">วัตถุประสงค์:</span>
                    <span className="text-gray-800 truncate block">{b.purpose}</span>
                  </div>
                </div>

                {/* Departure checklist status indicator */}
                <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-gray-500 block text-[10px]">ข้อมูลไมล์/น้ำมันเริ่มต้น:</span>
                    {b.startMileage !== undefined ? (
                      <span className="font-bold text-indigo-700 font-mono text-[11px]">
                        ไมล์ {b.startMileage.toLocaleString()} km. • น้ำมัน {b.startFuelLevel || '-'}
                      </span>
                    ) : (
                      <span className="text-amber-600 font-semibold text-[11px]">
                        ⚠️ ยังไม่ได้บันทึกไมล์เริ่มต้น
                      </span>
                    )}
                  </div>
                  {b.startMileage === undefined ? (
                    <button
                      id={`btn-user-record-departure-${b.id}`}
                      type="button"
                      onClick={() => handleOpenDeparture(b)}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      🚗 บันทึกไมล์เริ่ม
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenDeparture(b)}
                      className="text-[11px] text-indigo-600 hover:underline font-semibold cursor-pointer"
                    >
                      แก้ไขไมล์เริ่ม
                    </button>
                  )}
                </div>

                {/* The prominent GREEN "เสร็จสิ้นภารกิจ" Button (Requirement 3) */}
                <div className="pt-1 flex items-center gap-2">
                  <button
                    id={`btn-user-complete-mission-${b.id}`}
                    type="button"
                    onClick={() => handleOpenReturn(b)}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-700/25 flex items-center justify-center gap-2 transition-all cursor-pointer ring-2 ring-emerald-400/40"
                    title="กดปุ่มเพื่อบันทึกไมล์สิ้นสุด น้ำมัน และหลักฐานรูปถ่ายหย่อนกุญแจลงตู้เพื่อเสร็จสิ้นภารกิจ"
                  >
                    <Check className="w-5 h-5 stroke-[3]" />
                    <span>เสร็จสิ้นภารกิจ (คืนรถและกุญแจ)</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Bookings & Quick Approval Section (Visible to Requesters & Approvers immediately) */}
      {pendingLineBookings.length > 0 && (
        <div
          id="pending-approvals-home-section"
          className="bg-white rounded-2xl border border-amber-200 p-4 sm:p-5 shadow-xs space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-100 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <h2 className="text-sm sm:text-base font-bold text-gray-900">
                รายการคำขอจองรถที่รอการพิจารณาอนุมัติ ({pendingLineBookings.length} รายการ)
              </h2>
            </div>
            <button
              type="button"
              onClick={onNavigateToBookingList}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              <span>ไปที่หน้าตรวจสอบสถานะและอนุมัติทั้งหมด</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {pendingLineBookings.slice(0, 6).map((b) => {
              const canApproveThis =
                hasEditPermission && canUserApproveBooking(b, currentUser, users);
              const isStage2 = b.status === 'Pending_Approve2';
              return (
                <div
                  key={b.id}
                  id={`home-pending-card-${b.id}`}
                  className="p-4 rounded-xl border border-amber-200/90 bg-amber-50/30 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                            📄 {getBookingJobNumber(b)}
                          </span>
                          <span className="font-bold text-gray-900 text-xs sm:text-sm">
                            {b.vehicleName}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">
                          ผู้ขอจอง: <strong>{b.userName}</strong> ({b.userDepartment || '-'})
                        </p>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${
                          isStage2
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        {isStage2
                          ? `⏳ รอ Approve 2 (${b.stage2ApproverName || 'ขั้นที่ 2'})`
                          : `⏳ รอ Approve 1 (${b.assignedApproverName || 'ขั้นที่ 1'})`}
                      </span>
                    </div>

                    <div className="text-xs text-gray-700 bg-white/90 p-2.5 rounded-lg border border-amber-100 space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-gray-700">
                        <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>{formatTripDateTime(b.startDate, b.endDate)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-700">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="truncate">
                          <strong>ปลายทาง:</strong> {b.destination} • <strong>วัตถุประสงค์:</strong> {b.purpose}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={onNavigateToBookingList}
                      className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                    >
                      ดูรายละเอียดใบงาน →
                    </button>

                    {canApproveThis && onUpdateBookingStatus && (
                      <div className="flex items-center gap-1.5">
                        {b.status === 'Pending' ? (
                          <button
                            id={`btn-home-approve1-${b.id}`}
                            type="button"
                            onClick={() =>
                              onUpdateBookingStatus(b.id, 'Pending_Approve2', {
                                stage1ApprovedBy: currentUser?.name || 'Approve 1',
                                stage1ApprovedAt: new Date().toISOString(),
                              })
                            }
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>อนุมัติขั้นที่ 1</span>
                          </button>
                        ) : (
                          <button
                            id={`btn-home-approve2-${b.id}`}
                            type="button"
                            onClick={() =>
                              onUpdateBookingStatus(b.id, 'Approved', {
                                stage2ApprovedBy: currentUser?.name || 'Approve 2',
                                stage2ApprovedAt: new Date().toISOString(),
                              })
                            }
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>อนุมัติขั้นที่ 2 (อนุมัติใช้รถ)</span>
                          </button>
                        )}
                        {onOpenLineQuickApprove && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenLineQuickApprove(b, b.status === 'Pending' ? 1 : 2, 'reject')
                            }
                            className="px-2.5 py-1.5 border border-red-200 bg-white hover:bg-red-50 text-red-600 rounded-lg text-xs font-bold cursor-pointer"
                          >
                            ไม่อนุมัติ
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. ภาพรวมระบบจองรถยนต์ส่วนกลาง (Vehicle Overview placed above the calendar) */}
      <VehicleOverview
        vehicles={vehicles}
        bookings={bookings}
        users={users}
        selectedDateStr={selectedDateStr}
        onSelectDate={handleSelectDate}
        onOpenBookingModal={handleOpenBookingModal}
        currentUser={currentUser}
        canEdit={canEdit}
        viewOnly={viewOnly}
      />

      {/* 3. Month Controls & Legend Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
            <button
              id="btn-calendar-prev-month"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-md hover:bg-white text-gray-700 hover:text-indigo-600 transition-colors cursor-pointer"
              title="เดือนก่อนหน้า"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              id="btn-calendar-next-month"
              onClick={handleNextMonth}
              className="p-1.5 rounded-md hover:bg-white text-gray-700 hover:text-indigo-600 transition-colors cursor-pointer"
              title="เดือนถัดไป"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <button
            id="btn-calendar-jump-today"
            onClick={handleGoToToday}
            className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-gray-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors cursor-pointer"
          >
            ไปยังเดือนนี้
          </button>

          <span className="text-sm font-bold text-gray-900 ml-2">
            {thaiMonths[currentMonth]} {currentYear + 543}
          </span>
          <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full border border-indigo-100">
            {totalMonthBookings} รายการจอง
          </span>
        </div>

        {/* Legend Indicators */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>รถว่าง</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>มีการจอง</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>กำลังใช้งาน</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>เต็มทุกคัน</span>
          </div>
        </div>
      </div>

      {/* 3. Calendar Month Grid */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-slate-50 text-center">
          {thaiDays.map((day, idx) => (
            <div
              key={day}
              className={`py-2.5 text-xs font-bold uppercase tracking-wider ${
                idx === 0 || idx === 6 ? 'text-rose-600 bg-rose-50/40' : 'text-gray-700'
              }`}
            >
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.substring(0, 2)}</span>
            </div>
          ))}
        </div>

        {/* Calendar Day Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-gray-100 bg-gray-50/50">
          {calendarDays.map((day) => {
            const dayBookings = bookingsByDate[day.dateStr] || [];
            const isToday = day.isToday;
            const isSelected = selectedDateStr === day.dateStr;
            const bookedVehicleIds = new Set(dayBookings.map((b) => b.vehicleId));
            const availableCount = vehicles.filter(
              (v) => v.status !== 'Maintenance' && !bookedVehicleIds.has(v.id)
            ).length;
            const isFullyBooked = availableCount === 0 && vehicles.length > 0;

            return (
              <div
                key={day.dateStr}
                id={`calendar-cell-${day.dateStr}`}
                onClick={() => {
                  if (isSelected && !day.isPast) {
                    handleOpenBookingModal(day.dateStr);
                  } else {
                    handleSelectDate(day.dateStr);
                  }
                }}
                className={`min-h-[100px] sm:min-h-[125px] p-1.5 sm:p-2.5 flex flex-col justify-between transition-all cursor-pointer relative group ${
                  day.isPast
                    ? 'bg-slate-100/70 opacity-70'
                    : day.isCurrentMonth
                    ? 'bg-white hover:bg-indigo-50/40'
                    : 'bg-slate-50/60 opacity-60'
                } ${
                  isSelected
                    ? 'ring-2 ring-indigo-600 bg-indigo-50/30 shadow-xs z-10'
                    : isToday
                    ? 'ring-1 ring-indigo-400 bg-indigo-50/15'
                    : ''
                }`}
              >
                {/* Top of day cell: Day Number, Availability, & Quick Book Button */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-xs sm:text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : isToday
                          ? 'bg-indigo-100 text-indigo-800 font-extrabold'
                          : day.isCurrentMonth
                          ? 'text-gray-900'
                          : 'text-gray-400'
                      }`}
                    >
                      {day.dayNumber}
                    </span>
                    {isToday && (
                      <span className="hidden sm:inline text-[9px] font-bold px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded-md">
                        วันนี้
                      </span>
                    )}
                    {day.isPast && (
                      <span className="hidden md:inline text-[8px] text-gray-400 font-medium">
                        ผ่านมาแล้ว
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Availability pill */}
                    {day.isCurrentMonth && (
                      <span
                        className={`text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                          isFullyBooked
                            ? 'bg-rose-100 text-rose-800'
                            : dayBookings.length > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isFullyBooked ? (
                          'เต็ม'
                        ) : (
                          <span>ว่าง {availableCount}</span>
                        )}
                      </span>
                    )}

                    {/* Quick Book button on cell (Only shown for today and future dates) */}
                    {hasEditPermission && !day.isPast && (
                      <button
                        id={`btn-cell-book-${day.dateStr}`}
                        type="button"
                        title={`จองรถสำหรับวันที่ ${day.dayNumber}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenBookingModal(day.dateStr);
                        }}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md transition-all flex items-center gap-0.5 cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-2xs opacity-100'
                            : 'opacity-0 group-hover:opacity-100 bg-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white'
                        }`}
                      >
                        <Plus className="w-2.5 h-2.5" />
                        <span className="hidden sm:inline">จอง</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Bookings inside day cell */}
                <div className="space-y-1 my-1 overflow-hidden">
                  {dayBookings.slice(0, 2).map((b) => {
                    const isAllowed = canUserViewBooking(b, currentUser, users);
                    return (
                      <div
                        key={b.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingDayBookings(day.dateStr);
                        }}
                        className={`px-1.5 py-1 rounded text-[10px] font-medium border truncate flex items-center gap-1 transition-transform hover:scale-[1.02] ${
                          b.status === 'Approved'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : b.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                        title={isAllowed ? `${b.vehicleName} • ${b.userName} (${b.destination})` : `${b.vehicleName} • ติดภารกิจ`}
                      >
                        <Car className="w-3 h-3 shrink-0" />
                        <span className="truncate">{isAllowed ? b.userName : 'ติดภารกิจ'}</span>
                      </div>
                    );
                  })}

                  {dayBookings.length > 2 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingDayBookings(day.dateStr);
                      }}
                      className="text-[9px] text-indigo-600 font-bold hover:underline block text-center w-full"
                    >
                      +อีก {dayBookings.length - 2} คัน
                    </button>
                  )}
                </div>

                {/* Bottom hover action: Quick Book CTA */}
                {hasEditPermission && !day.isPast && (
                  <div className="pt-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between text-[10px] text-indigo-600 font-semibold border-t border-indigo-100">
                    <span className="flex items-center gap-0.5">
                      <Plus className="w-3 h-3" />
                      <span>จองรถ</span>
                    </span>
                    <span className="hidden sm:inline text-gray-400 font-normal text-[9px]">
                      คลิกเพื่อจอง
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Quick Booking Modal (เมื่อกดที่วันที่ต้องการ จะเปิดให้จองรถได้เลยทันที) */}
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
                      สำหรับวันที่: <span className="font-bold text-white underline">{formatThaiDate(selectedDateStr)}</span>
                    </p>
                  </div>
                </div>
                <button
                  id="btn-close-quick-booking"
                  onClick={() => setIsBookingModalOpen(false)}
                  className="p-1.5 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content - Scrollable */}
              <form onSubmit={handleConfirmBooking} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm">
                {/* Alert/Error message */}
                {bookingError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{bookingError}</span>
                  </div>
                )}

                {/* Success message */}
                {bookingSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{bookingSuccess}</span>
                  </div>
                )}

                {/* 1. User Info Header */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                      {currentUser ? currentUser.name.substring(0, 2) : '?'}
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block font-semibold">ผู้ขอจอง:</span>
                      <span className="font-bold text-gray-900 text-xs">
                        {currentUser ? `${currentUser.name} (${currentUser.department})` : 'ไม่ได้เลือกผู้ใช้'}
                      </span>
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
                      const dayBookings = bookingsByDate[selectedDateStr] || [];
                      const isBooked = dayBookings.some((b) => b.vehicleId === v.id);
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
                      } else if (isBooked) {
                        statusBadge = (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            🟡 มีจองบางช่วง
                          </span>
                        );
                      }

                      return (
                        <div
                          key={v.id}
                          id={`modal-vehicle-card-${v.id}`}
                          onClick={() => {
                            if (!isMaintenance) setSelectedVehicleId(v.id);
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
                        วันที่เริ่มต้นเดินทาง <span className="text-gray-400 font-normal">(วันนี้เป็นต้นไป)</span>
                      </label>
                      <input
                        id="input-quick-start-date"
                        type="date"
                        min={realTodayStr}
                        value={selectedDateStr}
                        onChange={(e) => {
                          const newStart = e.target.value;
                          if (isDateInPast(newStart)) {
                            setBookingError(`ไม่อนุญาตให้จองย้อนหลัง กรุณาเลือกตั้งแต่วันที่ปัจจุบัน (${formatThaiDate(realTodayStr)}) เป็นต้นไป`);
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

                {/* Quick time preset shortcuts: 2 วัน, 3 วัน, 5 วัน, 7 วัน */}
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
                  </div>

                  {/* Summary of selected duration */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-indigo-50/70 border border-indigo-100 rounded-lg px-3 py-2 text-indigo-950">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>
                        ระยะเวลาที่เลือก: <strong className="font-bold text-indigo-700">{currentDurationDays} วัน</strong>
                        {isPresetHalfMorning && ' (ครึ่งเช้า 08:30 - 12:00)'}
                        {isPresetHalfAfternoon && ' (ครึ่งบ่าย 13:00 - 17:00)'}
                        {isPresetFullDay && ' (เต็มวัน 08:30 - 17:30)'}
                        {isPreset2Days && ' (2 วัน เดินทางต่อเนื่อง)'}
                        {isPreset3Days && ' (3 วัน เดินทางต่อเนื่อง)'}
                        {isPreset5Days && ' (5 วัน เดินทางต่อเนื่อง)'}
                        {isPreset7Days && ' (7 วัน เดินทางต่อเนื่อง)'}
                      </span>
                    </div>
                    <div className="text-gray-600 text-[10px] sm:text-[11px] font-medium">
                      {formatThaiDate(selectedDateStr)} {startTime} น. → {formatThaiDate(endDateStr)} {endTime} น.
                    </div>
                  </div>
                </div>

                {/* 4. Choose Approver 1 (เฉพาะผู้อนุมัติในแผนกหรือฝ่ายเดียวกันเท่านั้น) */}
                <div className="space-y-3 pt-2 border-t border-gray-100" id="booking-approver-selection-section">
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
                    แสดงเฉพาะผู้มีสิทธิ์ <strong>Approve 1</strong> ที่สังกัดในแผนกหรือฝ่ายเดียวกับผู้ขอจอง ({currentUser?.department || '-'}{currentUser?.division ? ` • ${currentUser.division}` : ''}) เท่านั้น
                  </p>

                  {eligibleApprovers.length === 0 ? (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        ไม่พบผู้อนุมัติขั้นที่ 1 (Approve 1) ในแผนกหรือฝ่ายของคุณ ({currentUser?.department || '-'}{currentUser?.division ? ` / ${currentUser.division}` : ''}) กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนดผู้อนุมัติประจำแผนก/ฝ่าย
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
                                {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                              </div>
                              <span className="text-[11px] text-gray-600 block truncate font-medium">
                                {approver.department}
                                {approver.division ? ` • ${approver.division}` : ''}
                              </span>
                              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                <span className="text-[9px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                                  Approve 1
                                </span>
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

                {/* Inline Error/Success Alert right above submit button so user always sees it */}
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
                      <span>หลังกดยืนยัน ระบบจะส่งแจ้งเตือนทาง LINE ให้ผู้อนุมัติโดยอัตโนมัติ</span>
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
                      <span>{isSubmittingBooking ? 'กำลังบันทึก...' : 'ยืนยันการจองรถยนต์'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Day Bookings Details Drawer / Modal */}
      <AnimatePresence>
        {viewingDayBookings && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => setViewingDayBookings(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-indigo-400" />
                  <span className="font-bold text-sm">
                    รายการจองวันที่ {formatThaiDate(viewingDayBookings)}
                  </span>
                </div>
                <button
                  onClick={() => setViewingDayBookings(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                {(bookingsByDate[viewingDayBookings] || []).length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">
                    ไม่มีรายการจองรถในวันนี้
                  </p>
                ) : (
                  (bookingsByDate[viewingDayBookings] || []).map((b) => {
                    const isAllowed = canUserViewBooking(b, currentUser, users);
                    return (
                      <div
                        key={b.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                              📄 {getBookingJobNumber(b)}
                            </span>
                            <span className="font-bold text-gray-900 truncate">{b.vehicleName}</span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                              b.status === 'Approved'
                                ? 'bg-indigo-100 text-indigo-700'
                                : b.status === 'Completed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {b.status === 'Approved' ? 'อนุมัติแล้ว' : b.status === 'Completed' ? 'เสร็จสิ้น' : 'รออนุมัติ'}
                          </span>
                        </div>
                        <div className="text-gray-700 font-medium">
                          👤 ผู้จอง: {isAllowed ? `${b.userName} ${b.userPhone ? `(${b.userPhone})` : ''}` : 'ผู้ใช้งานภายในองค์กร (สงวนสิทธิ์การดู)'}
                        </div>
                        <div className="text-gray-600 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>{formatTripDateTime(b.startDate, b.endDate)}</span>
                        </div>
                        <div className="text-gray-600 flex items-center justify-between gap-2 pt-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span className="truncate">ปลายทาง: {isAllowed ? b.destination : 'ติดภารกิจ'}</span>
                          </div>
                          {isLineModuleEnabled && isAllowed && onOpenLineShare && b.status !== 'Cancelled' && b.status !== 'Completed' && (
                            <button
                              type="button"
                              onClick={() => {
                                setViewingDayBookings(null);
                                onOpenLineShare(b);
                              }}
                              className="px-2.5 py-1 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                            >
                              <MessageCircle className="w-3 h-3 fill-white" />
                              <span>แจ้งเตือนทาง LINE</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={() => setViewingDayBookings(null)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900"
                >
                  ปิด
                </button>
                {!hasEditPermission ? (
                  <span className="text-[11px] text-amber-700 font-medium">
                    🔒 สิทธิ์ดูได้อย่างเดียว
                  </span>
                ) : viewingDayBookings && !isDateInPast(viewingDayBookings) ? (
                  <button
                    onClick={() => {
                      const date = viewingDayBookings;
                      setViewingDayBookings(null);
                      handleOpenBookingModal(date);
                    }}
                    className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>จองรถสำหรับวันนี้</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-gray-400 font-medium italic">
                    (วันที่ผ่านมาแล้ว - ไม่อนุญาตให้จองย้อนหลัง)
                  </span>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Departure Checklist (บันทึกข้อมูลก่อนออกเดินทาง) */}
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
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 my-8 space-y-4 max-h-[92vh] flex flex-col z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-bold shadow-xs">
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
                      id="home-input-start-mileage"
                      type="number"
                      value={startMileageInput}
                      onChange={(e) => setStartMileageInput(e.target.value)}
                      placeholder="เช่น 18200"
                      className="w-full pl-3 pr-12 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 font-mono focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      required
                    />
                    <span className="absolute right-3.5 top-3 text-xs text-gray-400 font-mono">
                      km.
                    </span>
                  </div>

                  {/* แนบรูปถ่ายไมล์เริ่มต้น */}
                  <div className="pt-1.5">
                    {/* Hidden Native Camera Input (Opens phone camera directly) */}
                    <input
                      ref={startCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleFileChange(e, setStartPhotoPreview)}
                      className="hidden"
                      id="input-camera-start-mileage"
                    />
                    {/* Hidden File Picker Input (Gallery / Device files) */}
                    <input
                      ref={startFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setStartPhotoPreview)}
                      className="hidden"
                      id="input-file-start-mileage"
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
                          id="btn-open-camera-start-mileage"
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
                              ? 'bg-amber-500 text-white border-amber-600 shadow-xs ring-2 ring-amber-300/40'
                              : 'bg-slate-50 hover:bg-slate-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {f}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-gray-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDepartureBooking(null)}
                    className="flex-1 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer active:scale-95"
                  >
                    บันทึกข้อมูลออกเดินทาง
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Return Checklist & Complete Mission (เสร็จสิ้นภารกิจ & คืนรถ) */}
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
                      id="home-input-end-mileage"
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
                      id="input-camera-end-mileage"
                    />
                    {/* Hidden File Picker Input */}
                    <input
                      ref={endFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, setEndPhotoPreview)}
                      className="hidden"
                      id="input-file-end-mileage"
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
                          id="btn-open-camera-end-mileage"
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
                    3.2 น้ำมันเริ่มต้น / สิ้นสุด (เลือกได้ 1 ตัวเลือก) <span className="text-red-500">*</span>
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
                    id="input-camera-key-photo"
                  />
                  {/* Hidden File Picker Input */}
                  <input
                    ref={keyFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, setKeyPhotoPreview)}
                    className="hidden"
                    id="input-file-key-photo"
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
                            title="ลบรูป"
                          >
                            <X className="w-3.5 h-3.5" />
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
                        id="btn-open-camera-key-photo"
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
                          onClick={() => openCamera('ถ่ายภาพหลักฐานการคืนกุญแจ', 'กรุณาถ่ายรูปขณะหย่อนกุญแจรถยนต์ลงในตู้รับกุญแจ เพื่อเป็นหลักฐาน', (img) => setKeyPhotoPreview(img))}
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
                      id="btn-home-confirm-return-ok"
                      type="submit"
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>OK ยืนยันว่าคืนรถได้</span>
                    </button>
                  ) : (
                    <div className="flex-1 py-2.5 bg-gray-100 border border-gray-200 text-gray-400 text-xs font-bold rounded-xl text-center cursor-not-allowed">
                      <span>กรุณาถ่ายรูปหย่อนกุญแจเพื่อปลดล็อกปุ่ม OK</span>
                    </div>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Photo Preview Modal */}
      {viewingPhoto && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setViewingPhoto(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-indigo-600" />
                <span>{viewingPhoto.title}</span>
              </span>
              <button
                type="button"
                onClick={() => setViewingPhoto(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-hidden rounded-xl bg-black flex items-center justify-center">
              <img
                src={viewingPhoto.url}
                alt={viewingPhoto.title}
                className="max-h-[75vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}

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
