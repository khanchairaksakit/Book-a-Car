import React, { useState, useMemo } from 'react';
import { Vehicle, Booking, User, BookingStatus } from '../types';
import { isUserAdmin } from '../utils/userHelpers';
import VehicleOverview from './VehicleOverview';
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
  onSelectUser: (user: User) => void;
  onAddBooking: (booking: Omit<Booking, 'id' | 'createdAt'>) => void;
  onNavigateToBookingList: () => void;
  onNavigateToVehicles: () => void;
}

export default function MonthlyCalendar({
  vehicles,
  bookings,
  currentUser,
  users,
  onSelectUser,
  onAddBooking,
  onNavigateToBookingList,
  onNavigateToVehicles,
}: MonthlyCalendarProps) {
  // Reference date: July 2026 has rich mock bookings, so default to July 2026 initially
  const defaultYear = 2026;
  const defaultMonth = 6; // 0-indexed: 6 = July

  const [currentYear, setCurrentYear] = useState<number>(defaultYear);
  const [currentMonth, setCurrentMonth] = useState<number>(defaultMonth);

  // Booking Modal States
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string>('2026-07-20');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('08:30');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [endDateStr, setEndDateStr] = useState<string>('2026-07-20');
  const [destination, setDestination] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [passengersCount, setPassengersCount] = useState<number>(1);
  const [bookingError, setBookingError] = useState<string>('');
  const [bookingSuccess, setBookingSuccess] = useState<string>('');

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
    // Navigate to July 2026 simulation month
    setCurrentYear(2026);
    setCurrentMonth(6);
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
        isToday: dStr === '2026-07-20',
      });
    }

    // Current month days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const dStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateStr: dStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dStr === '2026-07-20',
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
        isToday: dStr === '2026-07-20',
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

  // Open booking modal for a specific date
  const handleOpenBookingModal = (dateStr: string, vehicleId?: string) => {
    setSelectedDateStr(dateStr);
    setEndDateStr(dateStr);
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
        const dateBookings = bookingsByDate[dateStr] || [];
        return !dateBookings.some((b) => b.vehicleId === v.id);
      });

      if (available.length > 0) {
        setSelectedVehicleId(available[0].id);
      } else if (vehicles.length > 0) {
        setSelectedVehicleId(vehicles[0].id);
      }
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
  const handleConfirmBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError('');
    setBookingSuccess('');

    if (!currentUser) {
      setBookingError('กรุณาเลือกหรือเข้าสู่ระบบผู้ใช้งานก่อนทำการจอง');
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
    const newBookingData = {
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
      passengersCount: Number(passengersCount) || 1,
      status: (isAdminUser ? 'Approved' : 'Pending') as BookingStatus,
      approverName: isAdminUser ? `${currentUser.name} (Admin)` : undefined,
      approvedAt: isAdminUser ? new Date().toISOString() : undefined,
    };

    onAddBooking(newBookingData);
    setBookingSuccess(
      isAdminUser
        ? 'จองรถสำเร็จและได้รับการอนุมัติทันทีในฐานะผู้ดูแลระบบ!'
        : 'ส่งคำขอจองรถยนต์เรียบร้อยแล้ว รอผู้ดูแลระบบอนุมัติ'
    );

    // Reset fields
    setTimeout(() => {
      setIsBookingModalOpen(false);
      setDestination('');
      setPurpose('');
      setBookingSuccess('');
    }, 1200);
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

            <button
              id="btn-quick-book-today"
              onClick={() => handleOpenBookingModal('2026-07-20')}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/30 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>กดจองรถทันที</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. ภาพรวมระบบจองรถยนต์ส่วนกลาง (Vehicle Overview placed above the calendar) */}
      <VehicleOverview
        vehicles={vehicles}
        bookings={bookings}
        selectedDateStr={selectedDateStr}
        onSelectDate={handleSelectDate}
        onOpenBookingModal={handleOpenBookingModal}
        currentUser={currentUser}
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
            เดือนจำลอง (ก.ค. 2569)
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
                  if (isSelected) {
                    handleOpenBookingModal(day.dateStr);
                  } else {
                    handleSelectDate(day.dateStr);
                  }
                }}
                className={`min-h-[100px] sm:min-h-[125px] p-1.5 sm:p-2.5 flex flex-col justify-between transition-all cursor-pointer relative group ${
                  day.isCurrentMonth ? 'bg-white hover:bg-indigo-50/40' : 'bg-slate-50/60 opacity-60'
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

                    {/* Quick Book button on cell */}
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
                  </div>
                </div>

                {/* Bookings inside day cell */}
                <div className="space-y-1 my-1 overflow-hidden">
                  {dayBookings.slice(0, 2).map((b) => (
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
                      title={`${b.vehicleName} • ${b.userName} (${b.destination})`}
                    >
                      <Car className="w-3 h-3 shrink-0" />
                      <span className="truncate">{b.userName}</span>
                    </div>
                  ))}

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
                <div className="pt-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between text-[10px] text-indigo-600 font-semibold border-t border-indigo-100">
                  <span className="flex items-center gap-0.5">
                    <Plus className="w-3 h-3" />
                    <span>จองรถ</span>
                  </span>
                  <span className="hidden sm:inline text-gray-400 font-normal text-[9px]">
                    คลิกเพื่อจอง
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Quick Booking Modal (เมื่อกดที่วันที่ต้องการ จะเปิดให้จองรถได้เลยทันที) */}
      <AnimatePresence>
        {isBookingModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      วันที่เริ่มต้นเดินทาง
                    </label>
                    <input
                      id="input-quick-start-date"
                      type="date"
                      value={selectedDateStr}
                      onChange={(e) => {
                        const newStart = e.target.value;
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
                      value={endDateStr}
                      onChange={(e) => setEndDateStr(e.target.value)}
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

                {/* 4. Purpose & Destination */}
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
                        max={selectedVehicleObj ? selectedVehicleObj.capacity : 15}
                        value={passengersCount}
                        onChange={(e) => setPassengersCount(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 outline-hidden"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Modal Footer Controls */}
                <div className="pt-4 border-t border-gray-200 flex items-center justify-between gap-3 shrink-0">
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
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ยืนยันการจองรถยนต์</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Day Bookings Details Drawer / Modal */}
      <AnimatePresence>
        {viewingDayBookings && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden"
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
                  (bookingsByDate[viewingDayBookings] || []).map((b) => (
                    <div
                      key={b.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900">{b.vehicleName}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
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
                        👤 ผู้จอง: {b.userName} {b.userPhone && `(${b.userPhone})`}
                      </div>
                      <div className="text-gray-600 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>{formatTripDateTime(b.startDate, b.endDate)}</span>
                      </div>
                      <div className="text-gray-600 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-rose-500" />
                        <span className="truncate">ปลายทาง: {b.destination}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={() => setViewingDayBookings(null)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900"
                >
                  ปิด
                </button>
                <button
                  onClick={() => {
                    const date = viewingDayBookings;
                    setViewingDayBookings(null);
                    handleOpenBookingModal(date);
                  }}
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>จองรถคันอื่นในวันนี้</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
