import React, { useState, useMemo } from 'react';
import { AuditLogEntry, AuditLogCategory, Booking, User, Vehicle } from '../types';
import { Language } from '../utils/translations';
import { getBookingJobNumber } from '../utils/dateHelpers';
import {
  History,
  Search,
  Filter,
  RotateCcw,
  CheckCircle2,
  FileSpreadsheet,
  Printer,
  ShieldCheck,
  Car,
  Users,
  CalendarCheck,
  LogIn,
  Building2,
  Gauge,
  MessageCircle,
  Globe,
  Clock,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface AuditLogViewProps {
  auditLogs: AuditLogEntry[];
  bookings: Booking[];
  users: User[];
  vehicles: Vehicle[];
  currentUser: User | null;
  language: Language;
}

const CATEGORY_META: Record<
  AuditLogCategory,
  { labelTh: string; labelEn: string; badgeClass: string }
> = {
  AUTH: {
    labelTh: 'การเข้าสู่ระบบ',
    labelEn: 'Authentication',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  BOOKING: {
    labelTh: 'การจองรถ',
    labelEn: 'Booking',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  APPROVAL: {
    labelTh: 'การอนุมัติ / ยกเลิก',
    labelEn: 'Approval',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  TRIP: {
    labelTh: 'บันทึกไมล์ / คืนรถ',
    labelEn: 'Trip & Mileage',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  VEHICLE: {
    labelTh: 'จัดการยานพาหนะ',
    labelEn: 'Vehicle Mgmt',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  USER: {
    labelTh: 'จัดการผู้ใช้งาน',
    labelEn: 'User Mgmt',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  ORGANIZATION: {
    labelTh: 'แผนก / ฝ่าย',
    labelEn: 'Organization',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  PERMISSION: {
    labelTh: 'กำหนดสิทธิ์',
    labelEn: 'Permissions',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

export default function AuditLogView({
  auditLogs,
  bookings,
  users,
  language,
}: AuditLogViewProps) {
  const isEn = language === 'en';

  // Draft Filter States
  const [draftSearch, setDraftSearch] = useState('');
  const [draftCategory, setDraftCategory] = useState<'All' | AuditLogCategory>('All');
  const [draftChannel, setDraftChannel] = useState<'All' | 'Web' | 'LINE'>('All');
  const [draftStartDate, setDraftStartDate] = useState('');
  const [draftEndDate, setDraftEndDate] = useState('');

  // Applied Filter States
  const [appliedFilters, setAppliedFilters] = useState({
    search: '',
    category: 'All' as 'All' | AuditLogCategory,
    channel: 'All' as 'All' | 'Web' | 'LINE',
    startDate: '',
    endDate: '',
  });

  // Synthesize historical logs from existing bookings so past actions are always visible in Audit Log
  const combinedLogs = useMemo(() => {
    const derivedLogs: AuditLogEntry[] = [];

    for (const b of bookings) {
      const jobNo = getBookingJobNumber(b);
      const userObj = users.find((u) => u.id === b.userId);
      const dept = b.userDepartment || userObj?.department || '-';

      // 1. Booking Created
      if (b.createdAt) {
        derivedLogs.push({
          id: `hist-create-${b.id}`,
          timestamp: b.createdAt,
          category: 'BOOKING',
          action: 'สร้างใบงานขอใช้รถ',
          actorId: b.userId,
          actorName: b.userName || 'ผู้ขอใช้รถ',
          actorRole: 'User',
          actorDepartment: dept,
          targetId: jobNo,
          targetLabel: `${jobNo} (${b.vehicleName})`,
          details: `ขอใช้รถ ${b.vehicleName} ไปยัง "${b.destination}" (${b.purpose})`,
          channel: 'Web',
        });
      }

      // 2. Stage 1 Approved
      if (b.stage1ApprovedAt || b.stage1ApprovedBy) {
        const isLine =
          b.approvedVia === 'LINE' || (b.stage1ApprovedBy || '').includes('LINE');
        derivedLogs.push({
          id: `hist-approve1-${b.id}`,
          timestamp: b.stage1ApprovedAt || b.approvedAt || b.createdAt,
          category: 'APPROVAL',
          action: 'อนุมัติขั้นที่ 1 (ผู้จัดการ)',
          actorName: b.stage1ApprovedBy || b.assignedApproverName || 'ผู้จัดการ (Approve 1)',
          actorRole: 'Approve 1',
          actorDepartment: dept,
          targetId: jobNo,
          targetLabel: `${jobNo} (${b.vehicleName})`,
          details: `อนุมัติคำขอใช้รถขั้นที่ 1 สำหรับผู้ขอ ${b.userName} เส้นทาง ${b.destination}`,
          channel: isLine ? 'LINE' : 'Web',
        });
      }

      // 3. Stage 2 Approved
      if (b.stage2ApprovedAt || b.stage2ApprovedBy || b.status === 'Approved' || b.status === 'Completed') {
        const isLine =
          b.approvedVia === 'LINE' || (b.stage2ApprovedBy || '').includes('LINE');
        if (b.stage2ApprovedAt || b.approvedAt) {
          derivedLogs.push({
            id: `hist-approve2-${b.id}`,
            timestamp: b.stage2ApprovedAt || b.approvedAt || b.createdAt,
            category: 'APPROVAL',
            action: 'อนุมัติขั้นที่ 2 (ผู้ดูแลรถ)',
            actorName: b.stage2ApprovedBy || b.stage2ApproverName || 'ผู้ดูแลรถ (Approve 2)',
            actorRole: 'Approve 2',
            targetId: jobNo,
            targetLabel: `${jobNo} (${b.vehicleName})`,
            details: `อนุมัติใบงาน ${jobNo} ครบ 2 ขั้นตอน พร้อมออกเดินทาง`,
            channel: isLine ? 'LINE' : 'Web',
          });
        }
      }

      // 4. Departure Mileage Recorded
      if (b.startMileage !== undefined && b.startRecordedAt) {
        derivedLogs.push({
          id: `hist-start-trip-${b.id}`,
          timestamp: b.startRecordedAt,
          category: 'TRIP',
          action: 'บันทึกไมล์และน้ำมันก่อนเดินทาง',
          actorId: b.userId,
          actorName: b.userName || 'ผู้ขอใช้รถ',
          actorRole: 'User',
          actorDepartment: dept,
          targetId: jobNo,
          targetLabel: `${jobNo} (${b.vehicleName})`,
          details: `บันทึกไมล์เริ่มต้น ${b.startMileage.toLocaleString()} กม. | ระดับน้ำมันเริ่มต้น: ${b.startFuelLevel || '-'}`,
          channel: 'Web',
        });
      }

      // 5. Return Mileage & Mission Completed
      if (b.status === 'Completed' || b.endRecordedAt || b.endMileage !== undefined) {
        derivedLogs.push({
          id: `hist-end-trip-${b.id}`,
          timestamp: b.endRecordedAt || b.endDate || b.createdAt,
          category: 'TRIP',
          action: 'คืนรถและเสร็จสิ้นภารกิจ',
          actorId: b.userId,
          actorName: b.userName || 'ผู้ขอใช้รถ',
          actorRole: 'User',
          actorDepartment: dept,
          targetId: jobNo,
          targetLabel: `${jobNo} (${b.vehicleName})`,
          details: `คืนรถเสร็จสิ้นภารกิจ | ไมล์สิ้นสุด: ${
            b.endMileage !== undefined ? `${b.endMileage.toLocaleString()} กม.` : '-'
          } | ระดับน้ำมันคืนรถ: ${b.endFuelLevel || '-'}`,
          channel: 'Web',
        });
      }

      // 6. Cancelled / Rejected
      if (b.status === 'Cancelled') {
        const isLine = b.approvedVia === 'LINE' || (b.rejectedBy || '').includes('LINE');
        derivedLogs.push({
          id: `hist-cancel-${b.id}`,
          timestamp: b.rejectedAt || b.createdAt,
          category: 'APPROVAL',
          action: b.rejectionReason ? 'ไม่อนุมัติคำขอใช้รถ' : 'ยกเลิกใบงานขอใช้รถ',
          actorName: b.rejectedBy || b.userName || 'ผู้อนุมัติ',
          actorRole: b.rejectedStage === 2 ? 'Approve 2' : b.rejectedStage === 1 ? 'Approve 1' : 'User',
          actorDepartment: dept,
          targetId: jobNo,
          targetLabel: `${jobNo} (${b.vehicleName})`,
          details: b.rejectionReason
            ? `ไม่อนุมัติใบงาน ${jobNo} เหตุผล: "${b.rejectionReason}"`
            : `ยกเลิกรายการจองใบงาน ${jobNo}`,
          channel: isLine ? 'LINE' : 'Web',
        });
      }
    }

    // Deduplicate: prefer explicit stored auditLogs, supplement with derivedLogs
    const map = new Map<string, AuditLogEntry>();
    for (const item of derivedLogs) {
      map.set(item.id, item);
    }
    for (const item of auditLogs) {
      map.set(item.id, item);
    }

    return Array.from(map.values()).sort((a, b) =>
      (b.timestamp || '').localeCompare(a.timestamp || '')
    );
  }, [auditLogs, bookings, users]);

  const formatDateTimeThai = (isoStr?: string) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return new Intl.DateTimeFormat('th-TH', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(d);
    } catch {
      return isoStr;
    }
  };

  const filteredLogs = useMemo(() => {
    return combinedLogs.filter((log) => {
      if (appliedFilters.category !== 'All' && log.category !== appliedFilters.category) {
        return false;
      }
      if (appliedFilters.channel !== 'All' && (log.channel || 'Web') !== appliedFilters.channel) {
        return false;
      }
      const logDate = (log.timestamp || '').substring(0, 10);
      if (appliedFilters.startDate && logDate < appliedFilters.startDate) {
        return false;
      }
      if (appliedFilters.endDate && logDate > appliedFilters.endDate) {
        return false;
      }
      if (appliedFilters.search.trim()) {
        const q = appliedFilters.search.toLowerCase();
        const matchAction = (log.action || '').toLowerCase().includes(q);
        const matchActor = (log.actorName || '').toLowerCase().includes(q);
        const matchDept = (log.actorDepartment || '').toLowerCase().includes(q);
        const matchTarget = (log.targetLabel || log.targetId || '').toLowerCase().includes(q);
        const matchDetails = (log.details || '').toLowerCase().includes(q);
        return matchAction || matchActor || matchDept || matchTarget || matchDetails;
      }
      return true;
    });
  }, [combinedLogs, appliedFilters]);

  const handleApplyFilters = () => {
    setAppliedFilters({
      search: draftSearch,
      category: draftCategory,
      channel: draftChannel,
      startDate: draftStartDate,
      endDate: draftEndDate,
    });
  };

  const handleResetFilters = () => {
    setDraftSearch('');
    setDraftCategory('All');
    setDraftChannel('All');
    setDraftStartDate('');
    setDraftEndDate('');
    setAppliedFilters({
      search: '',
      category: 'All',
      channel: 'All',
      startDate: '',
      endDate: '',
    });
  };

  const handleExportExcel = () => {
    const rows = filteredLogs.map((log, idx) => ({
      'ลำดับ': idx + 1,
      'วัน-เวลา': formatDateTimeThai(log.timestamp),
      'หมวดหมู่': CATEGORY_META[log.category]?.labelTh || log.category,
      'กิจกรรม (Action)': log.action,
      'ผู้ทำรายการ': log.actorName || '-',
      'สิทธิ์/บทบาท': log.actorRole || '-',
      'แผนก': log.actorDepartment || '-',
      'ข้อมูลอ้างอิง': log.targetLabel || log.targetId || '-',
      'รายละเอียด': log.details || '-',
      'ช่องทาง': log.channel || 'Web',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 8 },
      { wch: 24 },
      { wch: 20 },
      { wch: 28 },
      { wch: 22 },
      { wch: 16 },
      { wch: 20 },
      { wch: 28 },
      { wch: 50 },
      { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audit_Log');
    const todayStr = new Date().toISOString().substring(0, 10);
    XLSX.writeFile(wb, `System_Audit_Log_${todayStr}.xlsx`);
  };

  const todayPrefix = new Date().toISOString().substring(0, 10);
  const todayCount = combinedLogs.filter((l) => (l.timestamp || '').startsWith(todayPrefix)).length;
  const approvalCount = combinedLogs.filter((l) => l.category === 'APPROVAL').length;
  const bookingAndTripCount = combinedLogs.filter(
    (l) => l.category === 'BOOKING' || l.category === 'TRIP'
  ).length;
  const adminChangesCount = combinedLogs.filter(
    (l) =>
      l.category === 'VEHICLE' ||
      l.category === 'USER' ||
      l.category === 'ORGANIZATION' ||
      l.category === 'PERMISSION'
  ).length;

  return (
    <div className="space-y-6 pb-12 print:p-0 print:space-y-4">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {isEn ? 'System Audit Log & Activity History' : 'ประวัติการใช้งานระบบ (Audit Log)'}
            </h2>
            <p className="text-xs text-gray-500">
              {isEn
                ? 'Track all system activities, bookings, approvals, vehicle updates, and settings changes'
                : 'ตรวจสอบประวัติการทำรายการย้อนหลังทั้งหมด การจอง การอนุมัติ การคืนรถ และการแก้ไขตั้งค่าระบบ'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            id="btn-export-audit-log-excel"
            onClick={handleExportExcel}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isEn ? 'Export Excel' : 'ส่งออก Excel'}</span>
          </button>
          <button
            id="btn-print-audit-log"
            onClick={() => window.print()}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{isEn ? 'Print Log' : 'พิมพ์ประวัติ (Print)'}</span>
          </button>
        </div>
      </div>

      {/* 2. Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 print:hidden">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-500 block">
              {isEn ? 'Total Logs' : 'รายการบันทึกทั้งหมด'}
            </span>
            <span className="text-xl font-black text-gray-900">{combinedLogs.length}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-500 block">
              {isEn ? 'Bookings & Trips' : 'การจองและบันทึกไมล์'}
            </span>
            <span className="text-xl font-black text-gray-900">{bookingAndTripCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-500 block">
              {isEn ? 'Approvals & Rejections' : 'การอนุมัติ / ยกเลิก'}
            </span>
            <span className="text-xl font-black text-gray-900">{approvalCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-500 block">
              {isEn ? 'Today / Admin Actions' : `กิจกรรมวันนี้ (${todayCount}) / ตั้งค่า`}
            </span>
            <span className="text-xl font-black text-gray-900">{adminChangesCount}</span>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar (Buttons only at bottom) */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
            <Filter className="w-4 h-4 text-indigo-600" />
            <span>{isEn ? 'Audit Log Filters' : 'ตัวกรองประวัติการใช้งาน (Audit Log)'}</span>
            <span className="bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-full text-[11px] border border-indigo-200">
              แสดง {filteredLogs.length} รายการ
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              {isEn
                ? 'Search (Actor / Job No. / Action / Details)'
                : 'ค้นหา (ชื่อผู้ทำรายการ / เลขใบงาน / ทะเบียนรถ / รายละเอียด)'}
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApplyFilters();
                }}
                placeholder={
                  isEn
                    ? 'Search actor, job number, vehicle, details...'
                    : 'พิมพ์ชื่อผู้ทำรายการ, เลขใบงาน AX-..., ทะเบียนรถ...'
                }
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              {isEn ? 'Category' : 'หมวดหมู่กิจกรรม'}
            </label>
            <select
              value={draftCategory}
              onChange={(e) => setDraftCategory(e.target.value as 'All' | AuditLogCategory)}
              className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">{isEn ? 'All Categories' : 'ทุกหมวดหมู่'}</option>
              <option value="BOOKING">การจองรถ (Booking)</option>
              <option value="APPROVAL">การอนุมัติ / ยกเลิก (Approval)</option>
              <option value="TRIP">บันทึกไมล์ / คืนรถ (Trip & Mileage)</option>
              <option value="VEHICLE">จัดการยานพาหนะ (Vehicle)</option>
              <option value="USER">จัดการผู้ใช้งาน (User)</option>
              <option value="ORGANIZATION">กำหนดแผนกและฝ่าย (Organization)</option>
              <option value="PERMISSION">กำหนดสิทธิ์การใช้งาน (Permission)</option>
              <option value="AUTH">การเข้าสู่ระบบ (Login / Logout)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              {isEn ? 'Channel' : 'ช่องทางทำรายการ'}
            </label>
            <select
              value={draftChannel}
              onChange={(e) => setDraftChannel(e.target.value as 'All' | 'Web' | 'LINE')}
              className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">{isEn ? 'All Channels' : 'ทุกช่องทาง'}</option>
              <option value="Web">เว็บไซต์ (Web App)</option>
              <option value="LINE">LINE Official Account</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">
                {isEn ? 'From Date' : 'ตั้งแต่วันที่'}
              </label>
              <input
                type="date"
                value={draftStartDate}
                onChange={(e) => setDraftStartDate(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">
                {isEn ? 'To Date' : 'ถึงวันที่'}
              </label>
              <input
                type="date"
                value={draftEndDate}
                onChange={(e) => setDraftEndDate(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Bottom Filter Buttons Only */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            id="btn-clear-audit-filters"
            onClick={handleResetFilters}
            className="px-3.5 py-2 bg-white hover:bg-red-50 text-gray-700 hover:text-red-600 border border-gray-300 hover:border-red-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isEn ? 'Clear Filters' : 'ล้างตัวกรอง'}</span>
          </button>
          <button
            type="button"
            id="btn-confirm-audit-filters"
            onClick={handleApplyFilters}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isEn ? 'Confirm' : 'ตกลง'}</span>
          </button>
        </div>
      </div>

      {/* 4. Audit Log Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-3 text-center w-12">#</th>
                <th className="py-3 px-3 w-44">{isEn ? 'Date / Time' : 'วัน-เวลา'}</th>
                <th className="py-3 px-3 w-36">{isEn ? 'Category' : 'หมวดหมู่'}</th>
                <th className="py-3 px-3 w-48">{isEn ? 'Action' : 'กิจกรรมที่ทำ'}</th>
                <th className="py-3 px-3 w-44">{isEn ? 'Actor' : 'ผู้ทำรายการ'}</th>
                <th className="py-3 px-3 w-44">{isEn ? 'Target / Reference' : 'ข้อมูลอ้างอิง'}</th>
                <th className="py-3 px-3">{isEn ? 'Details' : 'รายละเอียด'}</th>
                <th className="py-3 px-3 text-center w-24">{isEn ? 'Channel' : 'ช่องทาง'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    ไม่พบประวัติการใช้งานตามตัวกรองที่เลือก
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, index) => {
                  const catMeta = CATEGORY_META[log.category] || CATEGORY_META.BOOKING;
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 transition-colors align-top"
                    >
                      <td className="py-3 px-3 text-center font-semibold text-gray-400">
                        {index + 1}
                      </td>
                      <td className="py-3 px-3 font-medium text-gray-700 whitespace-nowrap">
                        {formatDateTimeThai(log.timestamp)}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${catMeta.badgeClass}`}
                        >
                          {log.category === 'AUTH' && <LogIn className="w-3 h-3" />}
                          {log.category === 'BOOKING' && <CalendarCheck className="w-3 h-3" />}
                          {log.category === 'APPROVAL' && <ShieldCheck className="w-3 h-3" />}
                          {log.category === 'TRIP' && <Gauge className="w-3 h-3" />}
                          {log.category === 'VEHICLE' && <Car className="w-3 h-3" />}
                          {log.category === 'USER' && <Users className="w-3 h-3" />}
                          {(log.category === 'ORGANIZATION' ||
                            log.category === 'PERMISSION') && <Building2 className="w-3 h-3" />}
                          <span>{isEn ? catMeta.labelEn : catMeta.labelTh}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-gray-900">{log.action}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-gray-900">{log.actorName || '-'}</div>
                        {(log.actorDepartment || log.actorRole) && (
                          <div className="text-[10px] text-gray-500">
                            {[log.actorDepartment, log.actorRole].filter(Boolean).join(' • ')}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-semibold text-indigo-700">
                        {log.targetLabel || log.targetId || '-'}
                      </td>
                      <td className="py-3 px-3 text-gray-700 leading-relaxed">{log.details}</td>
                      <td className="py-3 px-3 text-center">
                        {log.channel === 'LINE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            <MessageCircle className="w-3 h-3" /> LINE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                            <Globe className="w-3 h-3" /> Web
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
