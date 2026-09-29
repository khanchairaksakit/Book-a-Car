import React, { useState, useMemo } from 'react';
import { Vehicle, Booking, User, BookingStatus } from '../types';
import { isUserAdmin, isUserApprover } from '../utils/userHelpers';
import {
  Clock,
  MapPin,
  Users,
  Search,
  Filter,
  CheckCircle2,
  Calendar as CalendarIcon,
  ClipboardList,
  Car,
  X,
  Shield,
  Phone,
} from 'lucide-react';

interface BookingSystemProps {
  vehicles: Vehicle[];
  bookings: Booking[];
  currentUser: User | null;
  onAddBooking?: (booking: Omit<Booking, 'id' | 'createdAt'>) => void;
  onUpdateBookingStatus: (bookingId: string, status: BookingStatus) => void;
  onDeleteBooking: (bookingId: string) => void;
}

export default function BookingSystem({
  vehicles,
  bookings,
  currentUser,
  onUpdateBookingStatus,
  onDeleteBooking,
}: BookingSystemProps) {
  // Search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [deletingBooking, setDeletingBooking] = useState<Booking | null>(null);

  const isAdmin = isUserAdmin(currentUser);
  const canApprove = isAdmin || isUserApprover(currentUser);

  // Counts for quick badges
  const pendingCount = useMemo(() => bookings.filter((b) => b.status === 'Pending').length, [bookings]);
  const approvedCount = useMemo(() => bookings.filter((b) => b.status === 'Approved').length, [bookings]);
  const completedCount = useMemo(() => bookings.filter((b) => b.status === 'Completed').length, [bookings]);
  const cancelledCount = useMemo(() => bookings.filter((b) => b.status === 'Cancelled').length, [bookings]);

  // Filtered booking records for the list view
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        b.userName.toLowerCase().includes(q) ||
        b.destination.toLowerCase().includes(q) ||
        b.vehicleName.toLowerCase().includes(q) ||
        b.purpose.toLowerCase().includes(q) ||
        (b.userPhone && b.userPhone.includes(q));

      const matchStatus = statusFilter === 'All' || b.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [bookings, searchQuery, statusFilter]);

  const getBookingStatusBadge = (st: BookingStatus) => {
    switch (st) {
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            ⏳ รออนุมัติ
          </span>
        );
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
            ✅ อนุมัติแล้ว
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            🏁 เดินทางเสร็จสิ้น
          </span>
        );
      case 'Cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            ❌ ยกเลิกแล้ว
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

  return (
    <div className="space-y-5" id="booking-status-system-section">
      {/* 1. Header & Summary Stats */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-900 text-xl flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-indigo-600" />
              <span>รายการจองทั้งหมด</span>
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              ตรวจสอบสถานะการจอง อนุมัติหรือยกเลิกคำขอใช้รถยนต์ส่วนกลาง
            </p>
          </div>

          {/* Quick status summary chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('All')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === 'All'
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              ทั้งหมด ({bookings.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Pending')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'Pending'
                  ? 'bg-amber-500 text-white font-bold shadow-xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800'
              }`}
            >
              <span>⏳ รออนุมัติ</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/30 text-[11px] font-bold">
                {pendingCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Approved')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'Approved'
                  ? 'bg-indigo-600 text-white font-bold shadow-xs'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800'
              }`}
            >
              <span>✅ อนุมัติแล้ว</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/30 text-[11px] font-bold">
                {approvedCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Completed')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === 'Completed'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
              }`}
            >
              🏁 เสร็จสิ้น ({completedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('Cancelled')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === 'Cancelled'
                  ? 'bg-rose-600 text-white font-bold shadow-xs'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-800'
              }`}
            >
              ❌ ยกเลิก ({cancelledCount})
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-gray-100">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-gray-400" />
            <input
              id="search-booking-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อผู้จอง, ทะเบียน/ยี่ห้อรถ, จุดหมายปลายทาง หรือจุดประสงค์..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl text-xs bg-slate-50/50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              id="filter-booking-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-full sm:w-auto"
            >
              <option value="All">แสดงทุกสถานะ</option>
              <option value="Pending">⏳ รออนุมัติ ({pendingCount})</option>
              <option value="Approved">✅ อนุมัติแล้ว ({approvedCount})</option>
              <option value="Completed">🏁 เดินทางเสร็จสิ้น ({completedCount})</option>
              <option value="Cancelled">❌ ยกเลิกแล้ว ({cancelledCount})</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Bookings List / Cards */}
      <div className="space-y-3" id="booking-cards-container">
        {filteredBookings.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center space-y-2">
            <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto" />
            <h4 className="font-semibold text-gray-700 text-sm">ไม่พบรายการขอจองรถยนต์ส่วนกลาง</h4>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              ไม่พบข้อมูลใดๆ ตามเงื่อนไขการค้นหาข้างต้น สามารถเลือกดูสถานะอื่นๆ หรือล้างคำค้นหาได้
            </p>
          </div>
        ) : (
          filteredBookings.map((booking) => {
            const canApproveReject = canApprove && (booking.status === 'Pending' || booking.status === 'Approved');
            const canUserCancel = currentUser?.id === booking.userId && booking.status === 'Pending';

            return (
              <div
                key={booking.id}
                id={`booking-list-card-${booking.id}`}
                className="p-5 border border-gray-200 hover:border-gray-300 rounded-2xl bg-white shadow-xs transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
              >
                {/* Left: Booking Details */}
                <div className="space-y-2.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 inline-flex items-center justify-center text-xs font-semibold">
                        {booking.userName.substring(0, 1)}
                      </span>
                      <span>{booking.userName}</span>
                    </span>

                    {booking.userPhone && (
                      <span className="text-xs text-gray-500 inline-flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md">
                        <Phone className="w-3 h-3 text-gray-400" />
                        <span>{booking.userPhone}</span>
                      </span>
                    )}

                    <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                      <Car className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{booking.vehicleName}</span>
                    </span>

                    {getBookingStatusBadge(booking.status)}
                  </div>

                  <div className="text-xs text-gray-600 space-y-1.5">
                    <p className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-gray-500 font-medium">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        <span>ช่วงเวลาเดินทาง:</span>
                      </span>
                      <span className="font-semibold text-gray-800 font-mono">
                        {formatThaiDate(booking.startDate)}
                      </span>
                      <span className="text-gray-400">ถึง</span>
                      <span className="font-semibold text-gray-800 font-mono">
                        {formatThaiDate(booking.endDate)}
                      </span>
                    </p>

                    <p className="flex items-center gap-3 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-500" />
                        <strong className="font-medium text-gray-700">ปลายทาง:</strong> {booking.destination}
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <strong className="font-medium text-gray-700">ผู้โดยสาร:</strong> {booking.passengersCount} คน
                      </span>
                    </p>

                    <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs mt-2">
                      <span className="font-semibold text-gray-700 block mb-0.5">วัตถุประสงค์ในการเดินทาง:</span>
                      <span className="text-gray-600 leading-relaxed">{booking.purpose}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions & Timestamp */}
                <div className="flex flex-row md:flex-col items-stretch sm:items-end justify-between sm:justify-start gap-2 w-full md:w-auto border-t border-gray-100 md:border-transparent pt-3 md:pt-0 shrink-0">
                  <div className="text-right hidden md:block">
                    <span className="text-[10px] text-gray-400 block">วันที่บันทึกคำขอ</span>
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
                            type="button"
                            onClick={() => onUpdateBookingStatus(booking.id, 'Approved')}
                            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>อนุมัติ</span>
                          </button>
                        )}

                        {booking.status === 'Approved' && (
                          <button
                            id={`btn-complete-booking-${booking.id}`}
                            type="button"
                            onClick={() => onUpdateBookingStatus(booking.id, 'Completed')}
                            className="flex-1 md:flex-none inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                          >
                            <span>🚀 เสร็จสิ้นภารกิจ</span>
                          </button>
                        )}

                        <button
                          id={`btn-reject-booking-${booking.id}`}
                          type="button"
                          onClick={() => onUpdateBookingStatus(booking.id, 'Cancelled')}
                          className="flex-1 md:flex-none inline-flex items-center justify-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          <span>ไม่อนุมัติ/ยกเลิก</span>
                        </button>
                      </>
                    )}

                    {/* User cancels own request */}
                    {canUserCancel && (
                      <button
                        id={`btn-user-cancel-booking-${booking.id}`}
                        type="button"
                        onClick={() => onUpdateBookingStatus(booking.id, 'Cancelled')}
                        className="w-full md:w-auto text-center px-4 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-600 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        ยกเลิกใบจอง
                      </button>
                    )}

                    {/* Deleted history by Admin */}
                    {isAdmin && (
                      <button
                        id={`btn-delete-booking-history-${booking.id}`}
                        type="button"
                        onClick={() => setDeletingBooking(booking)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="ลบออกจากระบบ"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Helper hint for non-admin on pending */}
                  {!isAdmin && booking.status === 'Pending' && !canUserCancel && (
                    <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      <span>กำลังรอการอนุมัติโดยเจ้าหน้าที่</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Booking Custom Modal */}
      {deletingBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center font-bold text-lg shrink-0">
                📋
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">ยืนยันลบประวัติการจอง</h3>
                <p className="text-xs text-gray-500">คุณต้องการลบรายการขอจองรถยนต์นี้ถาวรใช่หรือไม่?</p>
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-gray-700 space-y-1">
              <p><strong className="font-semibold text-gray-900">ผู้ขอจอง:</strong> {deletingBooking.userName}</p>
              <p><strong className="font-semibold text-gray-900">รถยนต์:</strong> {deletingBooking.vehicleName}</p>
              <p><strong className="font-semibold text-gray-900">ปลายทาง:</strong> {deletingBooking.destination}</p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                id="btn-cancel-delete-booking"
                type="button"
                onClick={() => setDeletingBooking(null)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                id="btn-confirm-delete-booking"
                type="button"
                onClick={() => {
                  onDeleteBooking(deletingBooking.id);
                  setDeletingBooking(null);
                }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                ยืนยันลบรายการ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
