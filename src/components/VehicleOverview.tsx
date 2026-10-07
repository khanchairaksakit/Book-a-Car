import React, { useState, useMemo } from 'react';
import {
  Car,
  CheckCircle2,
  Calendar,
  Clock,
  Wrench,
  ChevronRight,
  Plus,
  RotateCcw,
  UserCheck,
  MapPin,
  Users,
  Gauge,
  Info,
} from 'lucide-react';
import { Vehicle, Booking, User, VehicleType } from '../types';
import { formatMileage, formatThaiDate } from '../utils/vehicleAlerts';
import { canUserViewBooking } from '../utils/userHelpers';
import { getRealTodayStr, isDateInPast, isDateToday } from '../utils/dateHelpers';

interface VehicleOverviewProps {
  vehicles: Vehicle[];
  bookings: Booking[];
  users?: User[];
  selectedDateStr: string;
  onSelectDate: (dateStr: string) => void;
  onOpenBookingModal: (dateStr: string, vehicleId?: string) => void;
  currentUser: User | null;
  canEdit?: boolean;
  viewOnly?: boolean;
}

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  Sedan: 'รถเก๋ง',
  SUV: 'รถ SUV',
  Van: 'รถตู้',
  Pickup: 'รถกระบะ',
};

export default function VehicleOverview({
  vehicles,
  bookings,
  users = [],
  selectedDateStr,
  onSelectDate,
  onOpenBookingModal,
  currentUser,
  canEdit = true,
  viewOnly = false,
}: VehicleOverviewProps) {
  const hasEditPermission = canEdit && !viewOnly;
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'booked' | 'maintenance'>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  const todayStr = getRealTodayStr();
  const isToday = isDateToday(selectedDateStr);
  const isPast = isDateInPast(selectedDateStr);

  // Format full Thai date with day of week (e.g. วันจันทร์ที่ 20 กรกฎาคม 2569)
  const fullThaiDate = useMemo(() => {
    try {
      const d = new Date(selectedDateStr);
      if (isNaN(d.getTime())) return selectedDateStr;
      return d.toLocaleDateString('th-TH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return selectedDateStr;
    }
  }, [selectedDateStr]);

  // Active bookings on the selected date
  const bookingsOnDate = useMemo(() => {
    return bookings.filter((b) => {
      if (b.status === 'Cancelled') return false;
      const start = b.startDate.substring(0, 10);
      const end = b.endDate.substring(0, 10);
      return selectedDateStr >= start && selectedDateStr <= end;
    });
  }, [bookings, selectedDateStr]);

  // Map vehicle id -> bookings on this date
  const bookingsByVehicleId = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    bookingsOnDate.forEach((b) => {
      if (!map[b.vehicleId]) map[b.vehicleId] = [];
      map[b.vehicleId].push(b);
    });
    return map;
  }, [bookingsOnDate]);

  // Determine vehicle status specifically for the selected date
  const vehiclesWithDailyStatus = useMemo(() => {
    return vehicles.map((v) => {
      const vBookings = bookingsByVehicleId[v.id] || [];
      const hasActiveBooking = vBookings.some(
        (b) =>
          b.status === 'Approved' ||
          b.status === 'Pending' ||
          b.status === 'Pending_Approve2'
      );
      const approvedBooking = vBookings.find((b) => b.status === 'Approved');
      const pendingBooking = vBookings.find(
        (b) => b.status === 'Pending' || b.status === 'Pending_Approve2'
      );
      const primaryBooking = approvedBooking || pendingBooking;

      let dailyStatus: 'Available' | 'In Use' | 'Maintenance' = 'Available';
      if (v.status === 'Maintenance') {
        dailyStatus = 'Maintenance';
      } else if (hasActiveBooking) {
        dailyStatus = 'In Use';
      }

      return {
        vehicle: v,
        dailyStatus,
        booking: primaryBooking,
        allBookings: vBookings,
      };
    });
  }, [vehicles, bookingsByVehicleId]);

  // Metrics calculation
  const totalVehicles = vehicles.length;
  const availableVehicles = vehiclesWithDailyStatus.filter((item) => item.dailyStatus === 'Available').length;
  const bookedVehicles = vehiclesWithDailyStatus.filter((item) => item.dailyStatus === 'In Use').length;
  const maintenanceVehicles = vehiclesWithDailyStatus.filter((item) => item.dailyStatus === 'Maintenance').length;
  const pendingApprovalsCount = bookingsOnDate.filter(
    (b) => b.status === 'Pending' || b.status === 'Pending_Approve2'
  ).length;

  // Filtered vehicles for display
  const filteredVehicles = useMemo(() => {
    return vehiclesWithDailyStatus.filter(({ vehicle, dailyStatus }) => {
      if (filterStatus === 'available' && dailyStatus !== 'Available') return false;
      if (filterStatus === 'booked' && dailyStatus !== 'In Use') return false;
      if (filterStatus === 'maintenance' && dailyStatus !== 'Maintenance') return false;
      if (selectedType !== 'all' && vehicle.type !== selectedType) return false;
      return true;
    });
  }, [vehiclesWithDailyStatus, filterStatus, selectedType]);

  return (
    <div className="space-y-4" id="fleet-overview-component">
      {/* 1. Header with dynamic date selector banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                <Car className="w-5 h-5 text-indigo-600" />
                <span>ภาพรวมระบบจองรถยนต์ส่วนกลาง</span>
              </h2>
              {isToday ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  วันปัจจุบัน
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Calendar className="w-3.5 h-3.5" />
                  วันที่เลือกจากปฏิทิน
                </span>
              )}
            </div>

            <p className="text-sm text-gray-600 mt-1 flex items-center gap-1.5 flex-wrap">
              <span>แสดงสถานะความพร้อมของรถยนต์ ประจำ:</span>
              <strong className="text-indigo-900 font-bold underline decoration-indigo-300 underline-offset-2">
                {fullThaiDate}
              </strong>
              {!isToday && (
                <button
                  id="btn-overview-reset-today"
                  type="button"
                  onClick={() => onSelectDate(todayStr)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md transition-colors cursor-pointer ml-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>กลับไปดูวันปัจจุบัน</span>
                </button>
              )}
            </p>
          </div>

          {/* Quick Action Button with anti-past booking rule */}
          <div className="flex items-center gap-2">
            {!hasEditPermission ? (
              <div className="px-3.5 py-2 bg-amber-50 text-amber-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-amber-200">
                <span>🔒 สิทธิ์ดูได้อย่างเดียว (View Only)</span>
              </div>
            ) : isPast ? (
              <div className="px-3.5 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-200">
                <span>⚠️ วันที่ผ่านมาแล้ว (ห้ามจองย้อนหลัง)</span>
              </div>
            ) : (
              <button
                id="btn-overview-book-for-date"
                type="button"
                onClick={() => onOpenBookingModal(selectedDateStr)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>จองรถสำหรับวันนี้ ({formatThaiDate(selectedDateStr)})</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Key Metrics Grid (4 Stat Cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5">
          {/* Total vehicles card */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
              <Car className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block truncate">
                รถยนต์ทั้งหมด
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-gray-900">{totalVehicles}</span>
                <span className="text-xs text-gray-500">คัน</span>
              </div>
              <span className="text-[10px] text-gray-500 block truncate">
                พร้อมใช้ {availableVehicles} • ซ่อม {maintenanceVehicles}
              </span>
            </div>
          </div>

          {/* Available vehicles card */}
          <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/70 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100/70 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block truncate">
                รถว่างในวันนี้
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-emerald-700">{availableVehicles}</span>
                <span className="text-xs text-emerald-700/80">คัน</span>
              </div>
              <span className="text-[10px] text-emerald-600 block truncate">
                {totalVehicles > 0 ? Math.round((availableVehicles / totalVehicles) * 100) : 0}% ของกองรถทั้งหมด
              </span>
            </div>
          </div>

          {/* Active Bookings card */}
          <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200/70 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-100/70 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider block truncate">
                การจองในวันนี้
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-indigo-700">{bookingsOnDate.length}</span>
                <span className="text-xs text-indigo-700/80">รายการ</span>
              </div>
              <span className="text-[10px] text-indigo-600 block truncate">
                {pendingApprovalsCount > 0 ? `รออนุมัติ ${pendingApprovalsCount} รายการ` : 'อนุมัติครบทุกคัน'}
              </span>
            </div>
          </div>

          {/* Booked & Maintenance card */}
          <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/70 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100/70 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block truncate">
                ติดจอง / ซ่อมบำรุง
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-amber-700">{bookedVehicles + maintenanceVehicles}</span>
                <span className="text-xs text-amber-700/80">คัน</span>
              </div>
              <span className="text-[10px] text-amber-700 block truncate">
                ติดจอง {bookedVehicles} • ซ่อมบำรุง {maintenanceVehicles}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Vehicle Status & Details List for the Selected Date */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <span>สถานะรถยนต์แต่ละคันในวันที่เลือก</span>
              <span className="text-xs font-normal text-gray-500">
                ({filteredVehicles.length} คัน)
              </span>
            </h3>
            <p className="text-xs text-gray-500">
              กดปุ่ม <strong className="text-indigo-600">"จองคันนี้"</strong> เพื่อเปิดแบบฟอร์มจองรถคันที่ต้องการได้ทันที
            </p>
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              id="filter-tab-all"
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'bg-slate-100 hover:bg-slate-200 text-gray-700'
              }`}
            >
              ทั้งหมด ({totalVehicles})
            </button>
            <button
              id="filter-tab-available"
              type="button"
              onClick={() => setFilterStatus('available')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filterStatus === 'available'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
              }`}
            >
              🟢 รถว่าง ({availableVehicles})
            </button>
            <button
              id="filter-tab-booked"
              type="button"
              onClick={() => setFilterStatus('booked')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filterStatus === 'booked'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800'
              }`}
            >
              🔵 ติดจอง ({bookedVehicles})
            </button>
            <button
              id="filter-tab-maint"
              type="button"
              onClick={() => setFilterStatus('maintenance')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filterStatus === 'maintenance'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-800'
              }`}
            >
              🔴 ซ่อมบำรุง ({maintenanceVehicles})
            </button>
          </div>
        </div>

        {/* Vehicle Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredVehicles.map(({ vehicle, dailyStatus, booking }) => {
            const isAvailable = dailyStatus === 'Available';
            const isBooked = dailyStatus === 'In Use';
            const isMaint = dailyStatus === 'Maintenance';

            return (
              <div
                key={vehicle.id}
                id={`vehicle-card-${vehicle.id}`}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                  isAvailable
                    ? 'bg-white border-gray-200 hover:border-emerald-300 hover:shadow-xs'
                    : isBooked
                    ? 'bg-indigo-50/30 border-indigo-200'
                    : 'bg-rose-50/30 border-rose-200'
                }`}
              >
                <div>
                  {/* Top line: Brand, Model, Plate and Daily Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm truncate">
                          {vehicle.brand} {vehicle.model}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-medium text-slate-700">
                          {VEHICLE_TYPE_LABELS[vehicle.type] || vehicle.type}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-semibold text-gray-600 block mt-0.5">
                        {vehicle.plateNumber}
                      </span>
                    </div>

                    {/* Status Pill */}
                    {isAvailable && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-full border border-emerald-200 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        ว่าง
                      </span>
                    )}
                    {isBooked && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded-full border border-indigo-200 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                        ติดจอง
                      </span>
                    )}
                    {isMaint && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 text-[11px] font-bold rounded-full border border-rose-200 shrink-0">
                        <Wrench className="w-3 h-3" />
                        ซ่อมบำรุง
                      </span>
                    )}
                  </div>

                  {/* Vehicle Specs row */}
                  <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-2.5 pt-2 border-t border-gray-100">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-gray-400" />
                      <span>{vehicle.capacity} ที่นั่ง</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Gauge className="w-3 h-3 text-gray-400" />
                      <span>{formatMileage(vehicle.currentMileage)}</span>
                    </span>
                  </div>

                  {/* Booking Details if In Use */}
                  {isBooked && booking && (() => {
                    const isAllowed = canUserViewBooking(booking, currentUser, users);
                    return (
                      <div className="mt-2.5 p-2 bg-indigo-50/80 border border-indigo-100 rounded-lg text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-indigo-900 flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-indigo-600" />
                            <span>{isAllowed ? `คุณ ${booking.userName}` : 'ติดภารกิจการใช้งาน'}</span>
                          </span>
                          <span className="text-[10px] text-indigo-700 font-mono">
                            {booking.startDate.substring(11, 16)} - {booking.endDate.substring(11, 16)} น.
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-600 flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="truncate">{isAllowed ? booking.destination : 'ติดภารกิจเดินทาง'}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Maintenance notice */}
                  {isMaint && (
                    <div className="mt-2.5 p-2 bg-rose-50/80 border border-rose-100 rounded-lg text-xs text-rose-700 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>อยู่ระหว่างตรวจเช็คระยะ/ซ่อมบำรุง</span>
                    </div>
                  )}
                </div>

                {/* Card Action Button */}
                <div className="pt-2">
                  {isAvailable ? (
                    !hasEditPermission ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-1.5 px-3 bg-slate-100 text-slate-500 rounded-lg text-xs font-medium cursor-not-allowed text-center"
                        title="สิทธิ์ดูได้อย่างเดียว"
                      >
                        🔒 ดูได้อย่างเดียว
                      </button>
                    ) : isPast ? (
                      <button
                        type="button"
                        disabled
                        className="w-full py-1.5 px-3 bg-slate-100 text-slate-400 rounded-lg text-xs font-medium cursor-not-allowed text-center"
                        title="ไม่อนุญาตให้จองย้อนหลัง"
                      >
                        ไม่อนุญาตให้จองย้อนหลัง
                      </button>
                    ) : (
                      <button
                        id={`btn-book-car-${vehicle.id}`}
                        type="button"
                        onClick={() => onOpenBookingModal(selectedDateStr, vehicle.id)}
                        className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        <span>จองคันนี้</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )
                  ) : isBooked ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-1.5 px-3 bg-slate-100 text-slate-400 rounded-lg text-xs font-medium cursor-not-allowed text-center"
                    >
                      ติดจองแล้วในวันนี้
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full py-1.5 px-3 bg-rose-50 text-rose-400 rounded-lg text-xs font-medium cursor-not-allowed text-center"
                    >
                      งดใช้งานชั่วคราว
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredVehicles.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-500 bg-slate-50 rounded-xl border border-dashed border-gray-200">
            ไม่มีรถยนต์ในหมวดหมู่นี้สำหรับวันที่เลือก
          </div>
        )}
      </div>
    </div>
  );
}
