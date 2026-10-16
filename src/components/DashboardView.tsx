import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Vehicle,
  Booking,
  User,
  BookingStatus,
  FuelLevel,
  AppMenuKey,
} from '../types';
import {
  isUserAdmin,
  isUserApprover1,
  isUserApprover2,
  isUserOperator,
  canUserApproveBooking,
  getUserRoles,
  getRoleBadgeInfo,
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
  formatThaiDate,
  formatTripDateTime,
  getVehicleAlerts,
  doesBookingMatchVehicle,
  doesBookingCoverDate,
  getVehicleBookingAlerts,
  formatMaintenanceAlertsForLine,
} from '../utils/vehicleAlerts';
import VehicleOverview from './VehicleOverview';
import CameraCaptureModal from './CameraCaptureModal';
import FuelGaugeGraphic from './FuelGaugeGraphic';
import VehicleMaintenanceAlertModal from './VehicleMaintenanceAlertModal';
import { compressImageFile } from '../utils/imageCompression';
import {
  LayoutDashboard,
  BellRing,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  Car,
  CalendarDays,
  ClipboardList,
  MapPin,
  UserCheck,
  Check,
  X,
  ArrowRight,
  Plus,
  Gauge,
  Key,
  Camera,
  Upload,
  Shield,
  Wrench,
  MessageCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardViewProps {
  vehicles: Vehicle[];
  bookings: Booking[];
  users: User[];
  currentUser: User | null;
  canEdit?: boolean;
  viewOnly?: boolean;
  isLineModuleEnabled?: boolean;
  onAddBooking: (booking: Omit<Booking, 'id' | 'createdAt'>) => void | Promise<void>;
  onUpdateBookingStatus: (
    bookingId: string,
    status: BookingStatus,
    extraData?: Partial<Booking>
  ) => void;
  onNavigateTab: (tab: AppMenuKey) => void;
  onOpenLineShare?: (booking: Booking) => void;
  onOpenLineQuickApprove?: (
    booking: Booking,
    stage: 1 | 2,
    action?: 'approve' | 'reject'
  ) => void;
}

export default function DashboardView({
  vehicles,
  bookings,
  users,
  currentUser,
  canEdit = true,
  viewOnly = false,
  isLineModuleEnabled = true,
  onAddBooking,
  onUpdateBookingStatus,
  onNavigateTab,
  onOpenLineShare,
  onOpenLineQuickApprove,
}: DashboardViewProps) {
  const hasEditPermission = canEdit && !viewOnly;
  const realTodayStr = getRealTodayStr();

  const isAdmin = isUserAdmin(currentUser);
  const isApprove1 = isUserApprover1(currentUser);
  const isApprove2 = isUserApprover2(currentUser);
  const isOperator = isUserOperator(currentUser);

  const isMyBooking = (b: Booking) => {
    if (!currentUser) return false;
    if (b.userId === currentUser.id) return true;
    if (
      currentUser.name &&
      b.userName &&
      currentUser.name.trim().toLowerCase() === b.userName.trim().toLowerCase()
    ) {
      return true;
    }
    return false;
  };

  // 1. Pending Stage 1 Approvals for this user (Approve 1 / Admin)
  const pendingStage1ForMe = useMemo(() => {
    if (!currentUser) return [];
    return bookings.filter(
      (b) =>
        b.status === 'Pending' && canUserApproveBooking(b, currentUser, users)
    );
  }, [bookings, currentUser, users]);

  // 2. Pending Stage 2 Approvals for this user (Approve 2 / Admin)
  const pendingStage2ForMe = useMemo(() => {
    if (!currentUser) return [];
    return bookings.filter(
      (b) =>
        b.status === 'Pending_Approve2' &&
        canUserApproveBooking(b, currentUser, users)
    );
  }, [bookings, currentUser, users]);

  // 3. Active Approved Missions that need start mileage or vehicle return
  const myActiveApprovedTrips = useMemo(() => {
    if (!currentUser) return [];
    return bookings.filter(
      (b) => b.status === 'Approved' && (isMyBooking(b) || isAdmin)
    );
  }, [bookings, currentUser, isAdmin]);

  // 4. User's own submitted requests still waiting for approval (that they aren't already approving in 1 or 2)
  const myWaitingApprovalRequests = useMemo(() => {
    if (!currentUser) return [];
    const stage1Ids = new Set(pendingStage1ForMe.map((b) => b.id));
    const stage2Ids = new Set(pendingStage2ForMe.map((b) => b.id));
    return bookings.filter(
      (b) =>
        (b.status === 'Pending' || b.status === 'Pending_Approve2') &&
        isMyBooking(b) &&
        !stage1Ids.has(b.id) &&
        !stage2Ids.has(b.id)
    );
  }, [bookings, currentUser, pendingStage1ForMe, pendingStage2ForMe]);

  // 5. Fleet maintenance alerts (shown to Admin / Operator / Approve 2)
  const fleetMaintenanceAlerts = useMemo(() => {
    if (!isAdmin && !isOperator && !isApprove2) return [];
    return vehicles
      .map((v) => ({
        vehicle: v,
        alerts: getVehicleAlerts(v),
      }))
      .filter((item) => item.alerts.length > 0);
  }, [vehicles, isAdmin, isOperator, isApprove2]);

  const totalActionableTasks =
    pendingStage1ForMe.length +
    pendingStage2ForMe.length +
    myActiveApprovedTrips.length +
    myWaitingApprovalRequests.length;

  // Selected date state for VehicleOverview & Quick Booking
  const [selectedDateStr, setSelectedDateStr] = useState<string>(realTodayStr);

  // Modals for Departure Checklist, Return Checklist, Reject Modal, and Quick Booking
  const [departureBooking, setDepartureBooking] = useState<Booking | null>(null);
  const [returnBooking, setReturnBooking] = useState<Booking | null>(null);
  const [rejectingBookingState, setRejectingBookingState] = useState<{
    booking: Booking;
    stage: 1 | 2;
  } | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [rejectReasonError, setRejectReasonError] = useState('');

  // Departure Checklist states
  const [startMileageInput, setStartMileageInput] = useState<string>('');
  const [startFuelInput, setStartFuelInput] = useState<FuelLevel>('เต็มถัง');
  const [departureError, setDepartureError] = useState<string>('');

  // Return Checklist states
  const [endMileageInput, setEndMileageInput] = useState<string>('');
  const [endFuelInput, setEndFuelInput] = useState<FuelLevel>('เต็มถัง');
  const [keyPhotoPreview, setKeyPhotoPreview] = useState<string>('');
  const [returnError, setReturnError] = useState<string>('');
  const keyCameraInputRef = useRef<HTMLInputElement>(null);
  const keyFileInputRef = useRef<HTMLInputElement>(null);

  // Camera Modal state
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

  const getVehicleLatestMileage = (booking: Booking): number | undefined => {
    const v = vehicles.find((veh) => doesBookingMatchVehicle(booking, veh));
    let maxMileage = v?.currentMileage;
    for (const b of bookings) {
      if (b.status === 'Cancelled') continue;
      if (v && doesBookingMatchVehicle(b, v)) {
        if (
          typeof b.endMileage === 'number' &&
          (maxMileage === undefined || b.endMileage > maxMileage)
        ) {
          maxMileage = b.endMileage;
        }
      }
    }
    return maxMileage;
  };

  const handleOpenDeparture = (booking: Booking) => {
    setDepartureBooking(booking);
    setDepartureError('');
    const vehicleMileage = getVehicleLatestMileage(booking);
    setStartMileageInput(
      booking.startMileage !== undefined
        ? String(booking.startMileage)
        : vehicleMileage !== undefined
        ? String(vehicleMileage)
        : ''
    );
    setStartFuelInput(booking.startFuelLevel || 'เต็มถัง');
  };

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

    setDepartureBooking(null);
  };

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
    setKeyPhotoPreview(booking.keyReturnPhoto || '');
  };

  const handleConfirmReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnBooking) return;
    setReturnError('');

    const endMileageNum = parseInt(endMileageInput, 10);
    if (isNaN(endMileageNum) || endMileageNum < 0) {
      setReturnError('กรุณากรอกเลขไมล์สิ้นสุดให้ถูกต้องเป็นตัวเลข (km.)');
      return;
    }

    if (
      returnBooking.startMileage !== undefined &&
      endMileageNum < returnBooking.startMileage
    ) {
      setReturnError(
        `เลขไมล์สิ้นสุด (${endMileageNum}) ต้องไม่น้อยกว่าไมล์เริ่มต้น (${returnBooking.startMileage})`
      );
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

    setKeyPhotoPreview('');
    setReturnBooking(null);
  };

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

  // Quick Booking Modal states (for VehicleOverview on Dashboard)
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
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
    if (!hasEditPermission) return;
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
    if (isSubmittingBooking) return;
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
    <div className="space-y-6" id="dashboard-home-view">
      {/* 1. Welcome & Action Center Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-indigo-800/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-bold">
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>หน้าแรก (Dashboard)</span>
              </span>
              {currentUser &&
                getUserRoles(currentUser).map((role) => {
                  const b = getRoleBadgeInfo(role, false);
                  return (
                    <span
                      key={role}
                      className="text-[11px] font-bold px-2 py-0.5 rounded bg-white/10 text-slate-100 border border-white/15"
                    >
                      {b.label}
                    </span>
                  );
                })}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              สวัสดีคุณ {currentUser?.name || 'ผู้ใช้งาน'} ({currentUser?.department || '-'})
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200/90 max-w-2xl">
              ศูนย์รวมแจ้งเตือนใบงานค้าง รายการรออนุมัติ การบันทึกไมล์/คืนรถ และภาพรวมสถานะรถยนต์ส่วนกลางประจำวัน
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {hasEditPermission && (
              <button
                id="btn-dashboard-quick-book"
                type="button"
                onClick={() => handleOpenBookingModal(realTodayStr)}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>กดจองรถทันที</span>
              </button>
            )}
            <button
              id="btn-dashboard-go-calendar"
              type="button"
              onClick={() => onNavigateTab('calendar')}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CalendarDays className="w-4 h-4 text-indigo-300" />
              <span>เปิดปฏิทินการจอง</span>
            </button>
            <button
              id="btn-dashboard-go-status"
              type="button"
              onClick={() => onNavigateTab('booking')}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ClipboardList className="w-4 h-4 text-amber-300" />
              <span>ตรวจสอบสถานะทั้งหมด</span>
            </button>
          </div>
        </div>

        {/* Pending Tasks Quick Summary Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-indigo-200 block">
                รออนุมัติขั้นที่ 1 (ผู้จัดการ)
              </span>
              <span className="text-lg font-bold text-white font-mono">
                {pendingStage1ForMe.length} รายการ
              </span>
            </div>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                pendingStage1ForMe.length > 0
                  ? 'bg-amber-500 text-slate-950 animate-pulse'
                  : 'bg-white/10 text-slate-400'
              }`}
            >
              1
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-indigo-200 block">
                รออนุมัติขั้นที่ 2 (ผู้ดูแลรถ)
              </span>
              <span className="text-lg font-bold text-white font-mono">
                {pendingStage2ForMe.length} รายการ
              </span>
            </div>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                pendingStage2ForMe.length > 0
                  ? 'bg-blue-500 text-white animate-pulse'
                  : 'bg-white/10 text-slate-400'
              }`}
            >
              2
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-indigo-200 block">
                ภารกิจกำลังใช้รถ / รอคืนรถ
              </span>
              <span className="text-lg font-bold text-white font-mono">
                {myActiveApprovedTrips.length} รายการ
              </span>
            </div>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                myActiveApprovedTrips.length > 0
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/10 text-slate-400'
              }`}
            >
              <Car className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-indigo-200 block">
                คำขอของฉันที่รออนุมัติ
              </span>
              <span className="text-lg font-bold text-white font-mono">
                {myWaitingApprovalRequests.length} รายการ
              </span>
            </div>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                myWaitingApprovalRequests.length > 0
                  ? 'bg-indigo-500 text-white'
                  : 'bg-white/10 text-slate-400'
              }`}
            >
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. ACTION CENTER: รายการงานค้างและแจ้งเตือนที่ต้องดำเนินการ (Pending & Unfinished Tasks) */}
      <div className="space-y-4" id="dashboard-pending-tasks-container">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BellRing
              className={`w-5 h-5 ${
                totalActionableTasks > 0
                  ? 'text-amber-600 animate-bounce'
                  : 'text-emerald-600'
              }`}
            />
            <h2 className="text-base sm:text-lg font-bold text-gray-900">
              แจ้งเตือนรายการค้างดำเนินการของคุณ ({totalActionableTasks} รายการ)
            </h2>
          </div>
          {totalActionableTasks > 0 && (
            <button
              type="button"
              onClick={() => onNavigateTab('booking')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer"
            >
              <span>ดูใบงานทั้งหมดในหน้าตรวจสอบสถานะ</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {totalActionableTasks === 0 && (
          <div className="bg-white rounded-2xl border border-emerald-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  ไม่มีใบงานค้างหรือรายการรอดำเนินการในขณะนี้
                </h3>
                <p className="text-xs text-gray-500">
                  คุณดำเนินการอนุมัติและจัดการภารกิจการใช้รถยนต์ครบถ้วนแล้ว สามารถตรวจสอบสถานะรถว่างด้านล่างเพื่อจองรถใหม่ได้ทันที
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 2A. ใบงานรออนุมัติขั้นที่ 1 (สำหรับ Approve 1 / ผู้จัดการ) */}
        {pendingStage1ForMe.length > 0 && (
          <div
            id="dashboard-stage1-approvals-box"
            className="bg-white rounded-2xl border-2 border-amber-300 p-4 sm:p-5 shadow-xs space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                <h3 className="text-sm sm:text-base font-bold text-amber-950">
                  แจ้งเตือนผู้อนุมัติขั้นที่ 1 (Approve 1 - ผู้จัดการ): มีใบงานรออนุมัติ{' '}
                  {pendingStage1ForMe.length} รายการ
                </h3>
              </div>
              <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                กดอนุมัติหรือไม่อนุมัติได้ทันที
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {pendingStage1ForMe.map((b) => {
                const contactPhone =
                  b.userPhone || users.find((u) => u.id === b.userId)?.phone || '';
                return (
                  <div
                    key={b.id}
                    id={`dash-approve1-card-${b.id}`}
                    className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                              📄 {getBookingJobNumber(b)}
                            </span>
                            <span className="font-bold text-gray-900 text-sm">
                              {b.vehicleName}
                            </span>
                          </div>
                          <div className="text-xs text-gray-700 mt-1 flex items-center gap-1.5 flex-wrap">
                            <span>
                              ผู้ขอใช้รถ: <strong>{b.userName}</strong> (
                              {b.userDepartment || '-'})
                            </span>
                            {contactPhone && (
                              <a
                                href={getTelHref(contactPhone)}
                                onClick={(e) => e.stopPropagation()}
                                title="กดเพื่อโทรออก"
                                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-mono font-bold bg-white hover:bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 transition-colors cursor-pointer"
                              >
                                📞 {maskPhoneNumber(contactPhone)}
                              </a>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                          ⏳ รอผู้จัดการ (Approve 1)
                        </span>
                      </div>

                      <div className="text-xs text-gray-700 bg-white p-2.5 rounded-lg border border-amber-100 space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-gray-800">
                          <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{formatTripDateTime(b.startDate, b.endDate)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-700">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span className="truncate">
                            <strong>ปลายทาง:</strong> {b.destination} •{' '}
                            <strong>วัตถุประสงค์:</strong> {b.purpose}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onNavigateTab('booking')}
                        className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        ดูรายละเอียดใบงาน →
                      </button>

                      {hasEditPermission && (
                        <div className="flex items-center gap-2">
                          <button
                            id={`dash-btn-approve1-${b.id}`}
                            type="button"
                            onClick={() =>
                              onUpdateBookingStatus(b.id, 'Pending_Approve2', {
                                stage1ApprovedBy: currentUser?.name || 'ผู้จัดการ',
                                stage1ApprovedAt: new Date().toISOString(),
                              })
                            }
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>อนุมัติขั้นที่ 1 (ส่งต่อผู้ดูแลรถ)</span>
                          </button>
                          <button
                            id={`dash-btn-reject1-${b.id}`}
                            type="button"
                            onClick={() => {
                              setRejectingBookingState({ booking: b, stage: 1 });
                              setRejectReasonInput('');
                              setRejectReasonError('');
                            }}
                            className="px-3 py-1.5 border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 rounded-lg text-xs font-bold cursor-pointer"
                          >
                            ไม่อนุมัติ
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2B. ใบงานรออนุมัติขั้นที่ 2 (สำหรับ Approve 2 / ผู้ดูแลรถ) */}
        {pendingStage2ForMe.length > 0 && (
          <div
            id="dashboard-stage2-approvals-box"
            className="bg-white rounded-2xl border-2 border-blue-300 p-4 sm:p-5 shadow-xs space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
                <h3 className="text-sm sm:text-base font-bold text-blue-950">
                  แจ้งเตือนผู้อนุมัติขั้นที่ 2 (Approve 2 - ผู้ดูแลรถ): มีใบงานรออนุมัติ{' '}
                  {pendingStage2ForMe.length} รายการ
                </h3>
              </div>
              <span className="text-xs font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                ผ่านผู้จัดการแล้ว รอผู้ดูแลรถอนุมัติ
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {pendingStage2ForMe.map((b) => {
                const contactPhone =
                  b.userPhone || users.find((u) => u.id === b.userId)?.phone || '';
                return (
                  <div
                    key={b.id}
                    id={`dash-approve2-card-${b.id}`}
                    className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                              📄 {getBookingJobNumber(b)}
                            </span>
                            <span className="font-bold text-gray-900 text-sm">
                              {b.vehicleName}
                            </span>
                          </div>
                          <div className="text-xs text-gray-700 mt-1 flex items-center gap-1.5 flex-wrap">
                            <span>
                              ผู้ขอใช้รถ: <strong>{b.userName}</strong> (
                              {b.userDepartment || '-'})
                            </span>
                            {contactPhone && (
                              <a
                                href={getTelHref(contactPhone)}
                                onClick={(e) => e.stopPropagation()}
                                title="กดเพื่อโทรออก"
                                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-mono font-bold bg-white hover:bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 transition-colors cursor-pointer"
                              >
                                📞 {maskPhoneNumber(contactPhone)}
                              </a>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300 shrink-0">
                          ⏳ รอผู้ดูแลรถ (Approve 2)
                        </span>
                      </div>

                      <div className="text-xs text-gray-700 bg-white p-2.5 rounded-lg border border-blue-100 space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-emerald-700 font-semibold">
                          <span>
                            ✅ อนุมัติขั้นที่ 1 โดย: {b.stage1ApprovedBy || b.assignedApproverName || 'ผู้จัดการ'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-gray-800">
                          <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{formatTripDateTime(b.startDate, b.endDate)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-700">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span className="truncate">
                            <strong>ปลายทาง:</strong> {b.destination} •{' '}
                            <strong>วัตถุประสงค์:</strong> {b.purpose}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onNavigateTab('booking')}
                        className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                      >
                        ดูรายละเอียดใบงาน →
                      </button>

                      {hasEditPermission && (
                        <div className="flex items-center gap-2">
                          <button
                            id={`dash-btn-approve2-${b.id}`}
                            type="button"
                            onClick={() =>
                              onUpdateBookingStatus(b.id, 'Approved', {
                                stage2ApprovedBy: currentUser?.name || 'ผู้ดูแลรถ',
                                stage2ApprovedAt: new Date().toISOString(),
                              })
                            }
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>อนุมัติขั้นที่ 2 (อนุมัติให้ใช้รถ)</span>
                          </button>
                          <button
                            id={`dash-btn-reject2-${b.id}`}
                            type="button"
                            onClick={() => {
                              setRejectingBookingState({ booking: b, stage: 2 });
                              setRejectReasonInput('');
                              setRejectReasonError('');
                            }}
                            className="px-3 py-1.5 border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 rounded-lg text-xs font-bold cursor-pointer"
                          >
                            ไม่อนุมัติ
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2C. ภารกิจการใช้รถยนต์ที่อนุมัติแล้วและยังค้างดำเนินการ (รอบันทึกไมล์เริ่มต้น / รอคืนรถและกุญแจ) */}
        {myActiveApprovedTrips.length > 0 && (
          <div
            id="dashboard-active-missions-box"
            className="bg-white rounded-2xl border-2 border-emerald-400 p-4 sm:p-5 shadow-xs space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <h3 className="text-sm sm:text-base font-bold text-emerald-950">
                  ภารกิจการใช้รถที่กำลังดำเนินการ / รอบันทึกไมล์และคืนรถ (
                  {myActiveApprovedTrips.length} รายการ)
                </h3>
              </div>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                กรุณาบันทึกไมล์เริ่มต้นก่อนเดินทาง และกดคืนรถเมื่อเสร็จภารกิจ
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myActiveApprovedTrips.map((b) => {
                return (
                  <div
                    key={b.id}
                    id={`dash-active-trip-card-${b.id}`}
                    className="bg-emerald-50/30 border border-emerald-200 rounded-xl p-4 space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-600 text-white">
                              📄 {getBookingJobNumber(b)}
                            </span>
                            <h4 className="font-bold text-gray-900 text-sm">
                              {b.vehicleName}
                            </h4>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            ผู้ยืมรถ: <strong>{b.userName}</strong> •{' '}
                            <span className="font-mono">
                              {formatTripDateTime(b.startDate, b.endDate)}
                            </span>
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                          <Car className="w-3.5 h-3.5" /> กำลังใช้งาน
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-white p-2.5 rounded-lg border border-emerald-100">
                        <div>
                          <span className="text-gray-500 block text-[10px]">ปลายทาง:</span>
                          <strong className="text-gray-900">{b.destination}</strong>
                        </div>
                        <div>
                          <span className="text-gray-500 block text-[10px]">วัตถุประสงค์:</span>
                          <span className="text-gray-800 truncate block">{b.purpose}</span>
                        </div>
                      </div>

                      {/* Step 1: Start Mileage Status */}
                      <div className="flex items-center justify-between text-xs bg-white p-2.5 rounded-lg border border-slate-200">
                        <div>
                          <span className="text-gray-500 block text-[10px]">
                            ขั้นตอนที่ 1 • ข้อมูลไมล์/น้ำมันก่อนเดินทาง:
                          </span>
                          {b.startMileage !== undefined ? (
                            <span className="font-bold text-indigo-700 font-mono text-[11px]">
                              ✅ ไมล์เริ่ม {b.startMileage.toLocaleString()} km. • น้ำมัน{' '}
                              {b.startFuelLevel || '-'}
                            </span>
                          ) : (
                            <span className="text-amber-600 font-bold text-[11px]">
                              ⚠️ ค้างบันทึกเลขไมล์และน้ำมันเริ่มต้น
                            </span>
                          )}
                        </div>
                        {hasEditPermission && (
                          <button
                            id={`dash-btn-record-start-${b.id}`}
                            type="button"
                            onClick={() => handleOpenDeparture(b)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                              b.startMileage === undefined
                                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-2xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-indigo-700'
                            }`}
                          >
                            {b.startMileage === undefined
                              ? '🚗 บันทึกไมล์เริ่ม'
                              : 'แก้ไขไมล์เริ่ม'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Step 2: Complete Mission & Return Vehicle */}
                    {hasEditPermission && (
                      <div className="pt-1 flex items-center gap-2">
                        <button
                          id={`dash-btn-complete-mission-${b.id}`}
                          type="button"
                          onClick={() => handleOpenReturn(b)}
                          className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>เสร็จสิ้นภารกิจ (คืนรถและกุญแจ)</span>
                        </button>
                        <button
                          id={`dash-btn-cancel-active-${b.id}`}
                          type="button"
                          onClick={() =>
                            onUpdateBookingStatus(b.id, 'Cancelled', {
                              rejectedBy: `${currentUser?.name || b.userName} (ผู้จองยกเลิกการจอง)`,
                              rejectionReason: 'ผู้ขอใช้รถกดยกเลิกการจองด้วยตนเอง',
                              rejectedAt: new Date().toISOString(),
                            })
                          }
                          className="py-2.5 px-3 border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2D. คำขอจองรถของฉันที่อยู่ระหว่างรอผู้อนุมัติพิจารณา */}
        {myWaitingApprovalRequests.length > 0 && (
          <div
            id="dashboard-my-waiting-requests-box"
            className="bg-white rounded-2xl border border-indigo-200 p-4 sm:p-5 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-gray-900">
                  คำขอจองรถของคุณที่อยู่ระหว่างรอการอนุมัติ (
                  {myWaitingApprovalRequests.length} รายการ)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('booking')}
                className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
              >
                ดูสถานะทั้งหมด →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myWaitingApprovalRequests.map((b) => {
                const isStage2 = b.status === 'Pending_Approve2';
                return (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-2.5 text-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                          📄 {getBookingJobNumber(b)}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            isStage2
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {isStage2
                            ? `⏳ ผ่านผู้จัดการแล้ว → รอผู้ดูแลรถ (${b.stage2ApproverName || 'Approve 2'})`
                            : `⏳ รอผู้จัดการอนุมัติ (${b.assignedApproverName || 'Approve 1'})`}
                        </span>
                      </div>
                      <div className="font-bold text-gray-900 text-sm">
                        {b.vehicleName}
                      </div>
                      <div className="text-gray-600 font-mono text-[11px]">
                        {formatTripDateTime(b.startDate, b.endDate)}
                      </div>
                      <div className="text-gray-700 truncate">
                        ปลายทาง: <strong>{b.destination}</strong> • {b.purpose}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
                      <div className="flex items-center gap-2">
                        {isLineModuleEnabled && onOpenLineShare && (
                          <button
                            type="button"
                            onClick={() => onOpenLineShare(b)}
                            className="px-2.5 py-1 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <MessageCircle className="w-3 h-3 fill-white" />
                            <span>ส่ง LINE แจ้งผู้อนุมัติ</span>
                          </button>
                        )}
                      </div>
                      {hasEditPermission && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateBookingStatus(b.id, 'Cancelled', {
                              rejectedBy: `${currentUser?.name || b.userName} (ผู้จองยกเลิกการจอง)`,
                              rejectionReason: 'ผู้ขอใช้รถกดยกเลิกการจองด้วยตนเอง',
                              rejectedAt: new Date().toISOString(),
                            })
                          }
                          className="px-2.5 py-1 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-bold cursor-pointer"
                        >
                          ยกเลิกคำขอ
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2E. แจ้งเตือนการบำรุงรักษารถยนต์ (สำหรับ Admin / Operator / Approve 2) */}
        {fleetMaintenanceAlerts.length > 0 && (
          <div className="bg-white rounded-2xl border border-amber-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-gray-900">
                  แจ้งเตือนตรวจเช็คสภาพ/ภาษีรถยนต์ส่วนกลาง ({fleetMaintenanceAlerts.length}{' '}
                  คัน)
                </h4>
                <p className="text-xs text-gray-500">
                  {fleetMaintenanceAlerts
                    .map(
                      (item) =>
                        `${item.vehicle.brand} ${item.vehicle.model} (${item.vehicle.plateNumber})`
                    )
                    .join(' • ')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('vehicles')}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold shrink-0 cursor-pointer self-start sm:self-center"
            >
              จัดการข้อมูลรถยนต์ →
            </button>
          </div>
        )}
      </div>

      {/* 3. ภาพรวมระบบจองรถยนต์ส่วนกลาง (Moved to Dashboard) */}
      <VehicleOverview
        vehicles={vehicles}
        bookings={bookings}
        users={users}
        selectedDateStr={selectedDateStr}
        onSelectDate={setSelectedDateStr}
        onOpenBookingModal={handleOpenBookingModal}
        currentUser={currentUser}
        canEdit={canEdit}
        viewOnly={viewOnly}
      />

      {/* MODAL: Quick Booking from Dashboard */}
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
                        {formatThaiDate(selectedDateStr)}
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
                              `ไม่อนุญาตให้จองย้อนหลัง กรุณาเลือกตั้งแต่วันที่ปัจจุบัน (${formatThaiDate(
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
                      {formatThaiDate(selectedDateStr)} {startTime} น. →{' '}
                      {formatThaiDate(endDateStr)} {endTime} น.
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

      {/* MODAL: Departure Checklist */}
      <AnimatePresence>
        {departureBooking && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setDepartureBooking(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-bold">
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
                  type="button"
                  onClick={() => setDepartureBooking(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {departureError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{departureError}</span>
                </div>
              )}

              <form onSubmit={handleSaveDeparture} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-800">
                    1. ไมล์เริ่มต้น (กิโลเมตร) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={startMileageInput}
                      onChange={(e) => setStartMileageInput(e.target.value)}
                      placeholder="เช่น 18200"
                      className="w-full pl-3 pr-12 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-sm text-gray-900 font-mono font-bold"
                      required
                    />
                    <span className="absolute right-3.5 top-3 text-xs text-gray-400 font-mono">
                      km.
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="block text-xs font-bold text-gray-800">
                    2. น้ำมันเริ่มต้น <span className="text-red-500">*</span>
                  </label>
                  <FuelGaugeGraphic
                    value={startFuelInput}
                    onChange={setStartFuelInput}
                    accentColor="amber"
                  />
                </div>

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

      {/* MODAL: Return Checklist & Complete Mission */}
      <AnimatePresence>
        {returnBooking && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setReturnBooking(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 my-8 space-y-4 max-h-[92vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold">
                    <Check className="w-5 h-5 stroke-[3]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">
                      เสร็จสิ้นภารกิจ & คืนรถยนต์ส่วนกลาง
                    </h3>
                    <p className="text-xs text-gray-500">
                      รถ: {returnBooking.vehicleName} ({getBookingJobNumber(returnBooking)})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReturnBooking(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Early Return Alert Banner */}
              {isEarlyVehicleReturn(returnBooking, new Date()) && (
                <div className="p-3.5 bg-amber-50 border-2 border-amber-400 rounded-xl text-xs text-amber-950 flex items-start gap-2.5 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-amber-950 block">
                      {EARLY_RETURN_WARNING_TEXT}
                    </span>
                    <span className="text-[11px] text-amber-800 block">
                      เมื่อกดยืนยันคืนรถ ใบงานนี้จะเสร็จสิ้นทันทีและสถานะรถจะกลับมาว่างพร้อมใช้งาน
                    </span>
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

              <form
                onSubmit={handleConfirmReturn}
                className="flex-1 overflow-y-auto pr-1 space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-800">
                    1. ไมล์สิ้นสุด (กิโลเมตร) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={endMileageInput}
                      onChange={(e) => setEndMileageInput(e.target.value)}
                      placeholder="เช่น 18720"
                      className="w-full pl-3 pr-12 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-sm text-gray-900 font-mono font-bold"
                      required
                    />
                    <span className="absolute right-3.5 top-3 text-xs text-gray-400 font-mono">
                      km.
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <label className="block text-xs font-bold text-gray-800">
                    2. น้ำมันเมื่อคืนรถ <span className="text-red-500">*</span>
                  </label>
                  <FuelGaugeGraphic
                    value={endFuelInput}
                    onChange={setEndFuelInput}
                    accentColor="emerald"
                  />
                </div>

                <div className="space-y-1.5 pt-2 border-t border-gray-100">
                  <label className="block text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-amber-600" />
                    <span>
                      3. แนบรูปหลักฐานการคืนกุญแจ (หย่อนลงตู้){' '}
                      <span className="text-red-500">*</span>
                    </span>
                  </label>

                  <input
                    ref={keyCameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleFileChange(e, setKeyPhotoPreview)}
                    className="hidden"
                  />
                  <input
                    ref={keyFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, setKeyPhotoPreview)}
                    className="hidden"
                  />

                  {keyPhotoPreview ? (
                    <div className="space-y-1.5">
                      <div className="relative w-full h-40 rounded-xl overflow-hidden border-2 border-emerald-500">
                        <img
                          src={keyPhotoPreview}
                          alt="Key Return Preview"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 right-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setKeyPhotoPreview('')}
                            className="p-1.5 bg-red-600 text-white rounded-lg text-xs cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => keyCameraInputRef.current?.click()}
                        className="w-full py-4 px-4 border-2 border-dashed border-amber-400 hover:border-emerald-500 bg-amber-50 rounded-2xl text-xs text-amber-900 flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center">
                          <Camera className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-sm text-gray-900">
                          📸 กดเปิดกล้องถ่ายภาพหย่อนกุญแจลงตู้
                        </span>
                      </button>
                      <div className="flex items-center justify-between px-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => keyFileInputRef.current?.click()}
                          className="text-gray-500 hover:text-amber-800 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <Upload className="w-3.5 h-3.5 text-amber-600" />
                          <span>เลือกรูปจากเครื่อง</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openCamera(
                              'ถ่ายภาพหลักฐานการคืนกุญแจ',
                              'กรุณาถ่ายรูปขณะหย่อนกุญแจรถยนต์ลงในตู้รับกุญแจ',
                              (img) => setKeyPhotoPreview(img)
                            )
                          }
                          className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                        >
                          📹 กล้องสด (Live Viewfinder)
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-gray-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => setReturnBooking(null)}
                    className="flex-1 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  {keyPhotoPreview ? (
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>OK ยืนยันคืนรถ</span>
                    </button>
                  ) : (
                    <div className="flex-1 py-2.5 bg-gray-100 border border-gray-200 text-gray-400 text-xs font-bold rounded-xl text-center">
                      กรุณาถ่ายรูปหย่อนกุญแจเพื่อปลดล็อกปุ่ม OK
                    </div>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Reject Reason */}
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
                  ❌ ไม่อนุมัติคำขอใช้รถ (
                  {rejectingBookingState.stage === 1 ? 'ผู้จัดการ' : 'ผู้ดูแลรถ'})
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
                ใบงาน{' '}
                <strong>{getBookingJobNumber(rejectingBookingState.booking)}</strong> •
                คำขอของ <strong>{rejectingBookingState.booking.userName}</strong> (
                {rejectingBookingState.booking.vehicleName})
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
                  placeholder="กรุณาระบุเหตุผลที่ไม่อนุมัติ..."
                  className="w-full p-3 border border-gray-300 rounded-xl text-xs"
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
                    const stageLabel =
                      rejectingBookingState.stage === 1 ? 'ผู้จัดการ' : 'ผู้ดูแลรถ';
                    onUpdateBookingStatus(
                      rejectingBookingState.booking.id,
                      'Cancelled',
                      {
                        rejectionReason: rejectReasonInput.trim(),
                        rejectedBy: `${currentUser?.name || stageLabel} (${stageLabel} Reject)`,
                        rejectedAt: new Date().toISOString(),
                        rejectedStage: rejectingBookingState.stage,
                      }
                    );
                    setRejectingBookingState(null);
                  }}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  ยืนยันไม่อนุมัติ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
