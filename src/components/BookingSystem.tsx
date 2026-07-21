import React, { useState } from 'react';
import { Vehicle, Booking, User, BookingStatus } from '../types';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Users,
  AlertCircle,
  Check,
  X,
  FileText,
  Search,
  Filter,
  CheckCircle2,
  CalendarDays,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'motion/react';

interface BookingSystemProps {
  vehicles: Vehicle[];
  bookings: Booking[];
  currentUser: User | null;
  onAddBooking: (booking: Omit<Booking, 'id' | 'createdAt'>) => void;
  onUpdateBookingStatus: (bookingId: string, status: BookingStatus) => void;
  onDeleteBooking: (bookingId: string) => void;
}

export default function BookingSystem({
  vehicles,
  bookings,
  currentUser,
  onAddBooking,
  onUpdateBookingStatus,
  onDeleteBooking,
}: BookingSystemProps) {
  // Navigation tabs inside bookings
  const [activeSubTab, setActiveSubTab] = useState<'create' | 'list'>('create');

  // Form states
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [destination, setDestination] = useState('');
  const [passengersCount, setPassengersCount] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Search & filter states for bookings list
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Check availability state (for instant quick check)
  const [checkDate, setCheckDate] = useState('2026-07-20');

  const isAdmin = currentUser?.role === 'Admin';

  // Helper function to check if a booking overlaps
  const checkTimeOverlap = (vehicleId: string, startStr: string, endStr: string, excludeBookingId?: string) => {
    if (!startStr || !endStr) return false;
    const newStart = new Date(startStr).getTime();
    const newEnd = new Date(endStr).getTime();

    if (newEnd <= newStart) {
      return 'วันเวลาสิ้นสุดการจองต้องอยู่หลังวันเวลาเริ่มต้น';
    }

    // Filter relevant bookings for this vehicle that are approved, pending or completed
    const activeVehicleBookings = bookings.filter(
      (b) =>
        b.vehicleId === vehicleId &&
        b.id !== excludeBookingId &&
        b.status !== 'Cancelled'
    );

    for (const b of activeVehicleBookings) {
      const bStart = new Date(b.startDate).getTime();
      const bEnd = new Date(b.endDate).getTime();

      // Overlap condition
      if (newStart < bEnd && newEnd > bStart) {
        const formatTime = (iso: string) => {
          const d = new Date(iso);
          return `${d.toLocaleDateString('th-TH')} เวลา ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} น.`;
        };
        return `รถยนต์คันนี้ติดจองแล้วโดยคุณ ${b.userName} (${formatTime(b.startDate)} ถึง ${formatTime(b.endDate)})`;
      }
    }

    return null; // No overlap
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!currentUser) {
      setErrorMessage('กรุณาเลือกโปรไฟล์ผู้จองที่แท็บ "ลงทะเบียนผู้ใช้งาน" ก่อนจองรถ');
      return;
    }

    if (!selectedVehicleId) {
      setErrorMessage('กรุณาเลือกยานพาหนะที่ต้องการจอง');
      return;
    }

    if (!startDate || !endDate) {
      setErrorMessage('กรุณาระบุวันเวลาเริ่มต้นและวันเวลาสิ้นสุดการเดินทาง');
      return;
    }

    if (!purpose.trim() || !destination.trim()) {
      setErrorMessage('กรุณากรอกวัตถุประสงค์และสถานที่ปลายทาง');
      return;
    }

    const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
    if (!selectedVehicle) {
      setErrorMessage('ไม่พบข้อมูลรถยนต์ที่ระบุ');
      return;
    }

    if (selectedVehicle.status === 'Maintenance') {
      setErrorMessage('ขออภัย รถยนต์คันนี้อยู่ระหว่างการซ่อมบำรุง ไม่สามารถจองใช้งานได้');
      return;
    }

    if (passengersCount > selectedVehicle.capacity) {
      setErrorMessage(`ขออภัย จำนวนผู้เดินทาง (${passengersCount} คน) เกินความจุของรถ (${selectedVehicle.capacity} ที่นั่ง)`);
      return;
    }

    // Check overlaps
    const overlapError = checkTimeOverlap(selectedVehicleId, startDate, endDate);
    if (overlapError) {
      setErrorMessage(overlapError);
      return;
    }

    // All good! Add booking
    onAddBooking({
      vehicleId: selectedVehicleId,
      userId: currentUser.id,
      userName: currentUser.name,
      userPhone: currentUser.phone,
      vehicleName: `${selectedVehicle.brand} ${selectedVehicle.model} (${selectedVehicle.plateNumber})`,
      startDate,
      endDate,
      purpose,
      destination,
      passengersCount,
      // If admin books, auto approve; otherwise pending
      status: currentUser.role === 'Admin' ? 'Approved' : 'Pending',
    });

    setSuccessMessage(
      currentUser.role === 'Admin'
        ? '🎉 ส่งคำขอจองเรียบร้อย และอนุมัติอัตโนมัติเนื่องจากคุณใช้สิทธิ์แอดมิน!'
        : '🎉 ส่งคำขอจองรถยนต์เรียบร้อยแล้ว! กรุณารอผู้ดูแลระบบอนุมัติคำขอเดินทาง'
    );

    // Reset Form
    setSelectedVehicleId('');
    setStartDate('');
    setEndDate('');
    setPurpose('');
    setDestination('');
    setPassengersCount(1);

    // Move to bookings list after 2.5 seconds
    setTimeout(() => {
      setActiveSubTab('list');
      setSuccessMessage('');
    }, 2500);
  };

  // Availability checker for a selected date
  const getVehicleAvailabilityForDate = (vehicleId: string, dateStr: string) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) return 'Unknown';
    if (vehicle.status === 'Maintenance') return 'Maintenance';

    const checkDateStart = new Date(`${dateStr}T00:00:00`).getTime();
    const checkDateEnd = new Date(`${dateStr}T23:59:59`).getTime();

    const activeBookings = bookings.filter(
      (b) =>
        b.vehicleId === vehicleId &&
        b.status !== 'Cancelled' &&
        b.status !== 'Completed'
    );

    const overlappingBookings = activeBookings.filter((b) => {
      const bStart = new Date(b.startDate).getTime();
      const bEnd = new Date(b.endDate).getTime();
      return bStart <= checkDateEnd && bEnd >= checkDateStart;
    });

    if (overlappingBookings.length > 0) {
      return 'In Use';
    }

    return 'Available';
  };

  // Filtered booking records for the list view
  const filteredBookings = bookings.filter((b) => {
    const matchSearch =
      b.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.vehicleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.purpose.toLowerCase().includes(searchQuery.toLowerCase());

    const matchStatus = statusFilter === 'All' || b.status === statusFilter;

    return matchSearch && matchStatus;
  });

  const getBookingStatusBadge = (st: BookingStatus) => {
    switch (st) {
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
            ⏳ รอพิจารณา
          </span>
        );
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
            ✅ อนุมัติแล้ว
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
            🏁 เดินทางเสร็จสิ้น
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
            ❌ ยกเลิกแล้ว
          </span>
        );
      default:
        return st;
    }
  };

  const formatThaiDate = (isoString: string) => {
    const d = new Date(isoString);
    return `${d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })} เวลา ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} น.`;
  };

  return (
    <div className="space-y-6" id="booking-system-section">
      {/* Tab Switcher */}
      <div className="flex border-b border-gray-200">
        <button
          id="tab-sub-booking-create"
          onClick={() => setActiveSubTab('create')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeSubTab === 'create'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          ✍️ ตรวจสอบสถานะรถว่างและกรอกใบจอง
        </button>
        <button
          id="tab-sub-booking-list"
          onClick={() => setActiveSubTab('list')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-colors cursor-pointer relative ${
            activeSubTab === 'list'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          📋 รายการจองทั้งหมด
          {bookings.filter((b) => b.status === 'Pending').length > 0 && (
            <span className="absolute top-2.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          )}
        </button>
      </div>

      {activeSubTab === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Availability Checker Grid (5/12 width) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 text-base flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-indigo-600" />
                  <span>ตรวจสอบสถานะรถว่างรายวัน</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  เลือกวันต้องการเดินทางเพื่อเช็กแบบเรียลไทม์ว่ารถยนต์คันไหนว่างบ้าง
                </p>
              </div>

              {/* Date selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  เลือกวันที่เดินทางหลัก
                </label>
                <input
                  id="checker-date-input"
                  type="date"
                  value={checkDate}
                  onChange={(e) => setCheckDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Cars Availability List for Selected Date */}
              <div className="space-y-3 pt-2">
                {vehicles.map((v) => {
                  const dayStatus = getVehicleAvailabilityForDate(v.id, checkDate);
                  let dayBadge = (
                    <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold rounded-md">
                      🟢 ว่างเปล่า
                    </span>
                  );
                  let cardBg = 'bg-white';

                  if (dayStatus === 'In Use') {
                    dayBadge = (
                      <span className="px-2.5 py-1 bg-amber-50 border border-amber-100 text-amber-700 text-xs font-semibold rounded-md">
                        🟡 ติดจองแล้ว
                      </span>
                    );
                    cardBg = 'bg-slate-50/70';
                  } else if (dayStatus === 'Maintenance') {
                    dayBadge = (
                      <span className="px-2.5 py-1 bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-md">
                        🔴 ซ่อมบำรุง
                      </span>
                    );
                    cardBg = 'bg-slate-50/70 opacity-75';
                  }

                  const activeUserBookingsForThisCar = bookings.filter(
                    (b) =>
                      b.vehicleId === v.id &&
                      b.status !== 'Cancelled' &&
                      b.startDate.substring(0, 10) <= checkDate &&
                      b.endDate.substring(0, 10) >= checkDate
                  );

                  return (
                    <div
                      key={v.id}
                      id={`avail-vehicle-${v.id}`}
                      className={`p-3.5 border border-gray-100 rounded-xl flex flex-col justify-between gap-3 shadow-xs transition-colors ${cardBg}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h4 className="font-semibold text-gray-900 text-sm">{v.brand} {v.model}</h4>
                          <span className="font-mono text-xs text-gray-500">{v.plateNumber}</span>
                        </div>
                        {dayBadge}
                      </div>

                      {/* Overlap Info if any */}
                      {activeUserBookingsForThisCar.length > 0 && (
                        <div className="text-[11px] text-gray-500 bg-amber-50 border border-amber-100/50 p-2 rounded-md space-y-1">
                          {activeUserBookingsForThisCar.map((b) => (
                            <p key={b.id}>
                              📌 <span className="font-medium text-gray-800">{b.userName}</span>จองไป: {b.purpose.length > 25 ? b.purpose.substring(0, 25) + '...' : b.purpose}
                            </p>
                          ))}
                        </div>
                      )}

                      {dayStatus === 'Available' && (
                        <button
                          id={`btn-select-car-${v.id}`}
                          onClick={() => {
                            setSelectedVehicleId(v.id);
                            // Set startDate/endDate to checkDate plus default hours
                            setStartDate(`${checkDate}T09:00`);
                            setEndDate(`${checkDate}T17:00`);
                            setErrorMessage('');
                          }}
                          className="w-full text-center py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          ⚡ เลือกจองคันนี้ทันที
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Booking Form (7/12 width) */}
          <div className="lg:col-span-7">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-5">
              <div>
                <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                  <FileText className="w-5.5 h-5.5 text-indigo-600" />
                  <span>บันทึกแบบฟอร์มขอจองรถยนต์</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  กรอกใบจองพร้อมจุดหมายปลายทาง โดยผู้เดินทางที่บันทึกจะต้องตรงกับโปรไฟล์ที่เลือก
                </p>
              </div>

              {/* Status Banner */}
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 flex items-start gap-2 animate-pulse">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-700 flex items-start gap-2">
                  <Check className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Booking Profile Alert */}
              {currentUser ? (
                <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100/50 text-xs text-indigo-900 flex items-center justify-between">
                  <span>ผู้บันทึกจอง: <strong className="font-bold">{currentUser.name}</strong> ({currentUser.department})</span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-medium">โปรไฟล์ Active</span>
                </div>
              ) : (
                <div className="bg-rose-50 p-3 rounded-lg border border-rose-100 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">ยังไม่ได้เลือกผู้ใช้งาน!</span> กรุณาเลือกหรือลงทะเบียนพนักงานที่แท็บ <span className="font-semibold underline">"ลงทะเบียนผู้ใช้งาน"</span> ก่อนส่งฟอร์มจองรถ
                  </div>
                </div>
              )}

              <form onSubmit={handleBookingSubmit} className="space-y-4">
                {/* Vehicle Selector */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    รถยนต์ที่ต้องการจอง <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="booking-input-vehicle"
                    value={selectedVehicleId}
                    onChange={(e) => {
                      setSelectedVehicleId(e.target.value);
                      setErrorMessage('');
                    }}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    required
                  >
                    <option value="">-- เลือกยานพาหนะ --</option>
                    {vehicles.map((v) => (
                      <option
                        key={v.id}
                        value={v.id}
                        disabled={v.status === 'Maintenance'}
                      >
                        {v.brand} {v.model} ({v.plateNumber}) - {v.capacity} ที่นั่ง {v.status === 'Maintenance' ? '[งดใช้งาน - ซ่อม]' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Times Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>เริ่มต้นเดินทาง <span className="text-red-500">*</span></span>
                    </label>
                    <input
                      id="booking-input-start"
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setErrorMessage('');
                      }}
                      className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>สิ้นสุดการเดินทาง <span className="text-red-500">*</span></span>
                    </label>
                    <input
                      id="booking-input-end"
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setErrorMessage('');
                      }}
                      className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                {/* Destination & Passengers count */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>จุดหมายปลายทาง (จังหวัด/สถานที่) <span className="text-red-500">*</span></span>
                    </label>
                    <input
                      id="booking-input-dest"
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="เช่น คลังสินค้าบางปะอิน จ.อยุธยา"
                      className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>ผู้โดยสารทั้งหมด <span className="text-red-500">*</span></span>
                    </label>
                    <input
                      id="booking-input-passengers"
                      type="number"
                      min={1}
                      max={15}
                      value={passengersCount}
                      onChange={(e) => setPassengersCount(parseInt(e.target.value, 10) || 1)}
                      className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                {/* Purpose of Booking */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                    วัตถุประสงค์ในการขอใช้รถส่วนกลาง <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="booking-input-purpose"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    rows={2}
                    placeholder="เช่น เพื่อออกไปติดตั้งอุปกรณ์คอมพิวเตอร์และเชื่อมสายแลนให้ลูกค้ารายใหม่"
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:outline-hidden focus:ring-1 focus:ring-indigo-500 outline-hidden"
                    required
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-end">
                  <button
                    id="btn-submit-booking-form"
                    type="submit"
                    disabled={!currentUser}
                    className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm ${
                      currentUser
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    🚀 ยืนยันคำขอจองรถส่วนกลาง
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : (
        /* TAB: BOOKINGS LIST RECORD */
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-6">
          {/* List Search & Filter Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">ตรวจสอบและจัดการรายการจอง</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                ค้นหา อนุมัติ ปฏิเสธ หรือลบข้อมูลรายการใช้รถส่วนกลางของทุกคนในบริษัท
              </p>
            </div>

            {/* Quick Filter */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Search input */}
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  id="search-booking-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาผู้จอง, ปลายทาง, จุดประสงค์..."
                  className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Status Select Filter */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <select
                  id="filter-booking-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-full sm:w-auto"
                >
                  <option value="All">สถานะ: ทั้งหมด</option>
                  <option value="Pending">⏳ รออนุมัติ</option>
                  <option value="Approved">✅ อนุมัติแล้ว</option>
                  <option value="Completed">🏁 เดินทางเสร็จสิ้น</option>
                  <option value="Cancelled">❌ ยกเลิกแล้ว</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bookings Table / Cards Display */}
          {filteredBookings.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-xl space-y-2">
              <CalendarIcon className="w-10 h-10 text-gray-300 mx-auto" />
              <h4 className="font-semibold text-gray-600 text-sm">ไม่พบรายการขอจองรถยนต์ส่วนกลาง</h4>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                ไม่พบข้อมูลใดๆ ตามเงื่อนไขการค้นหาข้างต้น คุณสามารถจองคันใหม่ได้ที่แท็บด้านบน
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBookings.map((booking) => {
                const canApproveReject = isAdmin && (booking.status === 'Pending' || booking.status === 'Approved');
                const canUserCancel = currentUser?.id === booking.userId && booking.status === 'Pending';

                return (
                  <div
                    key={booking.id}
                    id={`booking-list-card-${booking.id}`}
                    className="p-5 border border-gray-200 hover:border-gray-300 rounded-xl bg-white shadow-xs transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                  >
                    {/* Left: Booking Details */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">
                          👤 {booking.userName}
                        </span>
                        <span className="text-xs text-gray-400">
                          ({booking.userPhone || 'ไม่มีเบอร์โทร'})
                        </span>
                        <span className="text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded-sm">
                          🚘 {booking.vehicleName}
                        </span>
                        {getBookingStatusBadge(booking.status)}
                      </div>

                      <div className="text-xs text-gray-600 space-y-1">
                        <p className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>
                            <strong className="font-medium text-gray-800">ช่วงเวลาเดินทาง: </strong>
                            {formatThaiDate(booking.startDate)} ถึง {formatThaiDate(booking.endDate)}
                          </span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          <span>
                            <strong className="font-medium text-gray-800">สถานที่ปลายทาง: </strong>
                            {booking.destination} • <strong className="font-medium text-gray-800">จำนวนคน: </strong> {booking.passengersCount} คน
                          </span>
                        </p>
                        <p className="flex items-start gap-1.5 bg-slate-50 p-2 rounded-lg mt-2">
                          <span className="font-semibold text-gray-700 shrink-0">จุดประสงค์:</span>
                          <span className="text-gray-600">{booking.purpose}</span>
                        </p>
                      </div>
                    </div>

                    {/* Right: Approve/Reject Actions */}
                    <div className="flex flex-row md:flex-col items-stretch sm:items-end justify-between sm:justify-start gap-2 w-full md:w-auto border-t border-gray-100 md:border-transparent pt-3 md:pt-0 shrink-0">
                      <div className="text-right hidden md:block">
                        <span className="text-[10px] text-gray-400 block">ทำรายการเมื่อ</span>
                        <span className="text-xs text-gray-500 font-mono">
                          {new Date(booking.createdAt).toLocaleDateString('th-TH')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 w-full md:w-auto">
                        {/* Admin Approvals */}
                        {canApproveReject && (
                          <>
                            {booking.status === 'Pending' && (
                              <button
                                id={`btn-approve-booking-${booking.id}`}
                                onClick={() => onUpdateBookingStatus(booking.id, 'Approved')}
                                className="flex-1 md:flex-none inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>อนุมัติ</span>
                              </button>
                            )}

                            {booking.status === 'Approved' && (
                              <button
                                id={`btn-complete-booking-${booking.id}`}
                                onClick={() => onUpdateBookingStatus(booking.id, 'Completed')}
                                className="flex-1 md:flex-none inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                <span>🚀 เสร็จสิ้นภารกิจ</span>
                              </button>
                            )}

                            <button
                              id={`btn-reject-booking-${booking.id}`}
                              onClick={() => onUpdateBookingStatus(booking.id, 'Cancelled')}
                              className="flex-1 md:flex-none inline-flex items-center justify-center gap-1 px-3 py-1.5 border border-red-100 text-red-600 hover:bg-red-50 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                            >
                              <span>ไม่อนุมัติ/ยกเลิก</span>
                            </button>
                          </>
                        )}

                        {/* User cancels own request */}
                        {canUserCancel && (
                          <button
                            id={`btn-user-cancel-booking-${booking.id}`}
                            onClick={() => onUpdateBookingStatus(booking.id, 'Cancelled')}
                            className="w-full md:w-auto text-center px-4 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-600 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                          >
                            ยกเลิกใบจอง
                          </button>
                        )}

                        {/* Deleted history */}
                        {isAdmin && (
                          <button
                            id={`btn-delete-booking-history-${booking.id}`}
                            onClick={() => {
                              if (confirm('ต้องการลบประวัติคำขอจองรถยนต์ส่วนกลางรายการนี้ออกจากระบบถาวรหรือไม่?')) {
                                onDeleteBooking(booking.id);
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="ลบออกจากระบบ"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Helper hint for non-admin on pending */}
                      {!isAdmin && booking.status === 'Pending' && !canUserCancel && (
                        <span className="text-[10px] text-amber-600 font-medium">
                          🔒 กำลังรอการอนุมัติโดยแอดมิน
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
