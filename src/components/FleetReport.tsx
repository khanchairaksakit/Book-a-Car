import React, { useState, useMemo, useEffect } from 'react';
import { Booking, Vehicle, User } from '../types';
import { Language } from '../utils/translations';
import { formatThaiDate } from '../utils/vehicleAlerts';
import { canUserViewBooking } from '../utils/userHelpers';
import { getBookingJobNumber } from '../utils/dateHelpers';
import { getStoredDepartments, getStoredDivisions } from '../utils/organizationUtils';
import { subscribeToOrganizationSettings } from '../lib/firebase';
import {
  Printer,
  Download,
  Filter,
  Search,
  Calendar,
  Car,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  X,
  Camera,
  Phone,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface FleetReportProps {
  bookings: Booking[];
  vehicles: Vehicle[];
  users: User[];
  currentUser: User | null;
  language?: Language;
  canEdit?: boolean;
  viewOnly?: boolean;
}

export default function FleetReport({
  bookings,
  vehicles,
  users,
  currentUser,
  language = 'th',
  canEdit = true,
  viewOnly = false,
}: FleetReportProps) {
  const isEn = language === 'en';

  // Draft Filters (user selections before clicking "ตกลง")
  const [draftSearchTerm, setDraftSearchTerm] = useState('');
  const [draftStatusFilter, setDraftStatusFilter] = useState<string>('All');
  const [draftVehicleFilter, setDraftVehicleFilter] = useState<string>('All');
  const [draftDivisionFilter, setDraftDivisionFilter] = useState<string>('All');
  const [draftDepartmentFilter, setDraftDepartmentFilter] = useState<string>('All');
  const [draftStartDateFilter, setDraftStartDateFilter] = useState<string>('');
  const [draftEndDateFilter, setDraftEndDateFilter] = useState<string>('');

  // Applied Filters (only updated when clicking "ตกลง")
  const [appliedFilters, setAppliedFilters] = useState({
    searchTerm: '',
    statusFilter: 'All',
    vehicleFilter: 'All',
    divisionFilter: 'All',
    departmentFilter: 'All',
    startDateFilter: '',
    endDateFilter: '',
  });
  const [isFilterConfirmed, setIsFilterConfirmed] = useState<boolean>(false);

  // Stored organization divisions & departments
  const [storedDivisions, setStoredDivisions] = useState<string[]>(() => getStoredDivisions());
  const [storedDepartments, setStoredDepartments] = useState<string[]>(() => getStoredDepartments());

  useEffect(() => {
    setStoredDivisions(getStoredDivisions());
    setStoredDepartments(getStoredDepartments());
    const unsub = subscribeToOrganizationSettings((settings) => {
      if (settings.divisions && settings.divisions.length > 0) {
        setStoredDivisions(settings.divisions);
      }
      if (settings.departments && settings.departments.length > 0) {
        setStoredDepartments(settings.departments);
      }
    });
    return () => unsub();
  }, []);

  // Lookup helpers
  const getVehiclePlate = (b: Booking): string => {
    if (b.plateNumber) return b.plateNumber;
    const v = vehicles.find((item) => item.id === b.vehicleId);
    if (v) return v.plateNumber;
    if (b.vehicleName && b.vehicleName.includes('(')) {
      const match = b.vehicleName.match(/\(([^)]+)\)/);
      if (match && match[1]) return match[1];
    }
    return b.vehicleName || '-';
  };

  const getUserDivision = (b: Booking): string => {
    if (b.userDivision) return b.userDivision;
    const u = users.find((item) => item.id === b.userId);
    if (u?.division) return u.division;
    if (u?.department && u.department.includes('(')) {
      return u.department;
    }
    return 'ฝ่ายบริหารและปฏิบัติการ';
  };

  const getUserDepartment = (b: Booking): string => {
    if (b.userDepartment) return b.userDepartment;
    const u = users.find((item) => item.id === b.userId);
    if (u?.department) return u.department;
    return 'ทั่วไป';
  };

  const getApprover = (b: Booking): string => {
    if (b.status === 'Cancelled') {
      if (b.rejectedBy) {
        return b.rejectedBy.includes('Reject') ? b.rejectedBy : `${b.rejectedBy} (Reject)`;
      }
      const isStage2Reject =
        b.rejectedStage === 2 || (b.rejectedStage !== 1 && Boolean(b.stage1ApprovedBy));
      return isStage2Reject ? 'ผู้ดูแลรถอนุมัติ Reject' : 'ผู้จัดการอนุมัติ Reject';
    }
    if (b.approverName) return b.approverName;
    if (b.status === 'Pending') {
      return b.assignedApproverName
        ? `รอผู้จัดการอนุมัติ (${b.assignedApproverName})`
        : isEn
        ? 'Pending Approval'
        : 'รอผู้จัดการอนุมัติ';
    }
    if (b.status === 'Pending_Approve2') {
      return b.stage2ApproverName
        ? `รอผู้ดูแลรถอนุมัติ (${b.stage2ApproverName})`
        : 'รอผู้ดูแลรถอนุมัติ';
    }
    return b.assignedApproverName || '-';
  };

  const extractTime = (dateStr?: string, defaultTime: string = '08:30'): string => {
    if (!dateStr) return defaultTime + ' น.';
    if (dateStr.includes('T')) {
      const timePart = dateStr.split('T')[1]?.substring(0, 5);
      return timePart ? `${timePart} น.` : defaultTime + ' น.';
    }
    return defaultTime + ' น.';
  };

  const extractDateOnly = (dateStr?: string): string => {
    if (!dateStr) return '';
    return dateStr.substring(0, 10);
  };

  // Distinct divisions for filter
  const divisions = useMemo(() => {
    const set = new Set<string>(storedDivisions);
    users.forEach((u) => {
      if (u.division) set.add(u.division);
    });
    bookings.forEach((b) => {
      if (b.userDivision) set.add(b.userDivision);
    });
    return Array.from(set).filter(Boolean);
  }, [storedDivisions, users, bookings]);

  // Distinct departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>(storedDepartments);
    users.forEach((u) => {
      if (u.department) set.add(u.department);
    });
    bookings.forEach((b) => {
      if (b.userDepartment) set.add(b.userDepartment);
    });
    return Array.from(set).filter(Boolean);
  }, [storedDepartments, users, bookings]);

  const getUserPhone = (b: Booking): string => {
    if (b.userPhone) return b.userPhone;
    const u = users.find((item) => item.id === b.userId);
    return u?.phone || '';
  };

  // Filtered rows (strictly uses appliedFilters and only returns rows when isFilterConfirmed is true)
  const filteredBookings = useMemo(() => {
    if (!isFilterConfirmed) return [];

    return bookings.filter((b) => {
      // Role-based visibility check: User sees only own, Approver sees only department, Admin sees all
      if (!canUserViewBooking(b, currentUser, users)) return false;

      // Status filter
      if (appliedFilters.statusFilter !== 'All' && b.status !== appliedFilters.statusFilter) return false;

      // Vehicle filter
      if (appliedFilters.vehicleFilter !== 'All' && b.vehicleId !== appliedFilters.vehicleFilter) return false;

      // Division filter
      if (appliedFilters.divisionFilter !== 'All') {
        const div = getUserDivision(b);
        if (div !== appliedFilters.divisionFilter) return false;
      }

      // Department filter
      if (appliedFilters.departmentFilter !== 'All') {
        const dept = getUserDepartment(b);
        if (dept !== appliedFilters.departmentFilter) return false;
      }

      // Date range filter (checks startDate or createdAt)
      const bDate = extractDateOnly(b.startDate) || extractDateOnly(b.createdAt);
      if (appliedFilters.startDateFilter && bDate < appliedFilters.startDateFilter) return false;
      if (appliedFilters.endDateFilter && bDate > appliedFilters.endDateFilter) return false;

      // Search term
      if (appliedFilters.searchTerm.trim()) {
        const q = appliedFilters.searchTerm.toLowerCase();
        const jobNo = getBookingJobNumber(b).toLowerCase();
        const plate = getVehiclePlate(b).toLowerCase();
        const borrower = (b.userName || '').toLowerCase();
        const purpose = (b.purpose || '').toLowerCase();
        const dest = (b.destination || '').toLowerCase();
        const approver = getApprover(b).toLowerCase();
        const dept = getUserDepartment(b).toLowerCase();
        const div = getUserDivision(b).toLowerCase();
        const phone = getUserPhone(b).toLowerCase();

        return (
          jobNo.includes(q) ||
          plate.includes(q) ||
          borrower.includes(q) ||
          purpose.includes(q) ||
          dest.includes(q) ||
          approver.includes(q) ||
          dept.includes(q) ||
          div.includes(q) ||
          phone.includes(q)
        );
      }

      return true;
    });
  }, [
    bookings,
    isFilterConfirmed,
    appliedFilters,
    currentUser,
    users,
    vehicles,
  ]);

  // Photo preview modal state
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string; title: string } | null>(null);

  // Export to Excel with requested columns including mileage, fuel and photos inserted after Department
  const handleExportExcel = () => {
    const exportData = filteredBookings.map((b, idx) => {
      const photosList = [
        b.startMileagePhoto ? 'มีรูปไมล์เริ่ม' : '',
        b.endMileagePhoto ? 'มีรูปไมล์คืน' : '',
        b.keyReturnPhoto ? 'มีรูปคืนกุญแจ' : '',
      ].filter(Boolean);

      return {
        'ลำดับ': idx + 1,
        'หมายเลขใบงาน': getBookingJobNumber(b),
        'วันที่เอกสาร': formatThaiDate(b.createdAt),
        'ทะเบียนรถ': getVehiclePlate(b),
        'วันที่เริ่มใช้รถ': formatThaiDate(b.startDate),
        'เวลาเริ่ม': extractTime(b.startDate, '08:30'),
        'วันที่คืนรถ': formatThaiDate(b.endDate),
        'เวลาคืน': extractTime(b.endDate, '17:30'),
        'ผู้ยืมรถ': b.userName,
        'ฝ่าย': getUserDivision(b),
        'แผนก': getUserDepartment(b),
        // Inserted strictly after department: ไมล์เริ่มต้น ระดับน้ำมันเริ่มต้น ไมล์สิ้นสุด ระดับน้ำมันสิ้นสุด และรูปถ่าย
        'ไมล์เริ่มต้น': b.startMileage !== undefined ? `${b.startMileage.toLocaleString()} km.` : '-',
        'ระดับน้ำมันเริ่มต้น': b.startFuelLevel || '-',
        'ไมล์สิ้นสุด': b.endMileage !== undefined ? `${b.endMileage.toLocaleString()} km.` : '-',
        'ระดับน้ำมันสิ้นสุด': b.endFuelLevel || '-',
        'รูปภาพหลักฐาน': photosList.length > 0 ? photosList.join(', ') : 'ไม่มีรูป',
        'เหตุผลการใช้รถ': b.purpose,
        'สถานที่ปลายทาง': b.destination,
        'ผู้อนุมัติ': getApprover(b),
        'สถานะคำขอ': b.status,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 8 },  // ลำดับ
      { wch: 18 }, // วันที่เอกสาร
      { wch: 22 }, // ทะเบียนรถ
      { wch: 18 }, // วันที่เริ่มใช้รถ
      { wch: 12 }, // เวลาเริ่ม
      { wch: 18 }, // วันที่คืนรถ
      { wch: 12 }, // เวลาคืน
      { wch: 22 }, // ผู้ยืมรถ
      { wch: 25 }, // ฝ่าย
      { wch: 22 }, // แผนก
      { wch: 16 }, // ไมล์เริ่มต้น
      { wch: 18 }, // ระดับน้ำมันเริ่มต้น
      { wch: 16 }, // ไมล์สิ้นสุด
      { wch: 18 }, // ระดับน้ำมันสิ้นสุด
      { wch: 24 }, // รูปภาพหลักฐาน
      { wch: 35 }, // เหตุผลการใช้รถ
      { wch: 30 }, // สถานที่ปลายทาง
      { wch: 24 }, // ผู้อนุมัติ
      { wch: 14 }, // สถานะ
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'รายงานการใช้รถยนต์');
    const todayStr = new Date().toISOString().substring(0, 10);
    XLSX.writeFile(workbook, `Fleet_Usage_Report_${todayStr}.xlsx`);
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Apply Filters ("ตกลง")
  const handleApplyFilters = () => {
    setAppliedFilters({
      searchTerm: draftSearchTerm,
      statusFilter: draftStatusFilter,
      vehicleFilter: draftVehicleFilter,
      divisionFilter: draftDivisionFilter,
      departmentFilter: draftDepartmentFilter,
      startDateFilter: draftStartDateFilter,
      endDateFilter: draftEndDateFilter,
    });
    setIsFilterConfirmed(true);
  };

  // Reset Filters ("ล้างตัวกรอง")
  const handleResetFilters = () => {
    setDraftSearchTerm('');
    setDraftStatusFilter('All');
    setDraftVehicleFilter('All');
    setDraftDivisionFilter('All');
    setDraftDepartmentFilter('All');
    setDraftStartDateFilter('');
    setDraftEndDateFilter('');
    setAppliedFilters({
      searchTerm: '',
      statusFilter: 'All',
      vehicleFilter: 'All',
      divisionFilter: 'All',
      departmentFilter: 'All',
      startDateFilter: '',
      endDateFilter: '',
    });
    setIsFilterConfirmed(false);
  };

  return (
    <div className="space-y-6 pb-12 print:p-0 print:space-y-4">
      {/* 1. Top Action Header (Hidden in Print) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {isEn ? 'Fleet Vehicle Usage Report' : 'รายงานการใช้รถยนต์'}
              </h2>
              <p className="text-xs text-gray-500">
                {isEn
                  ? 'Vehicle usage report with printable layout & Excel export'
                  : 'รายงานสรุปการใช้รถยนต์ส่วนกลาง รองรับการพิมพ์เอกสารทางการและดาวน์โหลด Excel'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {canEdit && !viewOnly ? (
            <>
              <button
                id="btn-export-excel-report"
                onClick={handleExportExcel}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer hover:scale-[1.02]"
                title="ดาวน์โหลดไฟล์ Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isEn ? 'Export Excel' : 'ส่งออก Excel'}</span>
              </button>

              <button
                id="btn-print-fleet-report"
                onClick={handlePrint}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer hover:scale-[1.02]"
                title="สั่งพิมพ์รายงาน หรือ บันทึกเป็น PDF"
              >
                <Printer className="w-4 h-4" />
                <span>{isEn ? 'Print Report' : 'พิมพ์รายงาน (Print)'}</span>
              </button>
            </>
          ) : (
            <div className="px-3.5 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
              <span>👁️ โหมดดูได้อย่างเดียว (ตามตารางกำหนดสิทธิ)</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Filter Bar (Hidden in Print) */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
            <Filter className="w-4 h-4 text-indigo-600" />
            <span>{isEn ? 'Report Filters' : 'ตัวกรองรายงาน'}</span>
            {isFilterConfirmed ? (
              <span className="bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-full text-[11px] border border-indigo-200">
                พบ {filteredBookings.length} รายการ
              </span>
            ) : (
              <span className="bg-amber-50 text-amber-700 font-semibold px-2.5 py-0.5 rounded-full text-[11px] border border-amber-200">
                {isEn ? 'Press Confirm to load data' : 'เลือกตัวกรองแล้วกดปุ่ม "ตกลง" เพื่อแสดงข้อมูล'}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              {isEn ? 'Search (Job No. / Requester / Plate / Destination)' : 'ค้นหา (เลขที่ใบงาน / ผู้ยืม / ทะเบียน / ปลายทาง)'}
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={draftSearchTerm}
                onChange={(e) => {
                  setDraftSearchTerm(e.target.value);
                  setIsFilterConfirmed(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApplyFilters();
                }}
                placeholder={isEn ? 'Search job number (AX-...), requester, plate...' : 'พิมพ์เลขที่ใบงาน (AX-...), ชื่อผู้ยืม, ทะเบียนรถ...'}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Vehicle Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              {isEn ? 'Vehicle' : 'ยานพาหนะ'}
            </label>
            <select
              value={draftVehicleFilter}
              onChange={(e) => {
                setDraftVehicleFilter(e.target.value);
                setIsFilterConfirmed(false);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">{isEn ? 'All Vehicles' : 'รถทุกคัน'}</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model} ({v.plateNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Division Filter (ฝ่าย) */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              {isEn ? 'Division' : 'ฝ่าย'}
            </label>
            <select
              value={draftDivisionFilter}
              onChange={(e) => {
                setDraftDivisionFilter(e.target.value);
                setIsFilterConfirmed(false);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">{isEn ? 'All Divisions' : 'ทุกฝ่าย'}</option>
              {divisions.map((div) => (
                <option key={div} value={div}>
                  {div}
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter (แผนก) */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              {isEn ? 'Department' : 'แผนก'}
            </label>
            <select
              value={draftDepartmentFilter}
              onChange={(e) => {
                setDraftDepartmentFilter(e.target.value);
                setIsFilterConfirmed(false);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">{isEn ? 'All Departments' : 'ทุกแผนก'}</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              {isEn ? 'Status' : 'สถานะ'}
            </label>
            <select
              value={draftStatusFilter}
              onChange={(e) => {
                setDraftStatusFilter(e.target.value);
                setIsFilterConfirmed(false);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">{isEn ? 'All Statuses' : 'ทุกสถานะ'}</option>
              <option value="Approved">{isEn ? 'Approved' : 'อนุมัติแล้ว'}</option>
              <option value="Completed">{isEn ? 'Completed' : 'เสร็จสิ้นภารกิจ'}</option>
              <option value="Pending">{isEn ? 'Pending' : 'รอดำเนินการ'}</option>
              <option value="Cancelled">{isEn ? 'Cancelled' : 'ยกเลิก / ไม่อนุมัติ'}</option>
            </select>
          </div>
        </div>

        {/* Date Range & Action Buttons Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-2 border-t border-gray-100 items-end">
          <div className="lg:col-span-3">
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              {isEn ? 'Start Date (From)' : 'ตั้งแต่วันที่'}
            </label>
            <input
              type="date"
              value={draftStartDateFilter}
              onChange={(e) => {
                setDraftStartDateFilter(e.target.value);
                setIsFilterConfirmed(false);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="lg:col-span-3">
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              {isEn ? 'End Date (To)' : 'ถึงวันที่'}
            </label>
            <input
              type="date"
              value={draftEndDateFilter}
              onChange={(e) => {
                setDraftEndDateFilter(e.target.value);
                setIsFilterConfirmed(false);
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="lg:col-span-3 flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                setDraftStartDateFilter(`${y}-${m}-01`);
                setDraftEndDateFilter(`${y}-${m}-31`);
                setIsFilterConfirmed(false);
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              {isEn ? 'This Month' : 'เดือนนี้'}
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const y = now.getFullYear();
                setDraftStartDateFilter(`${y}-01-01`);
                setDraftEndDateFilter(`${y}-12-31`);
                setIsFilterConfirmed(false);
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              {isEn ? 'This Year' : 'ปีนี้'}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftStartDateFilter('');
                setDraftEndDateFilter('');
                setIsFilterConfirmed(false);
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              {isEn ? 'All Dates' : 'ตลอดเวลา'}
            </button>
          </div>

          <div className="lg:col-span-3 flex items-center justify-end gap-2">
            <button
              type="button"
              id="btn-clear-report-filters"
              onClick={handleResetFilters}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-white hover:bg-red-50 text-gray-700 hover:text-red-600 border border-gray-300 hover:border-red-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isEn ? 'Clear Filters' : 'ล้างตัวกรอง'}</span>
            </button>
            <button
              type="button"
              id="btn-confirm-report-filters"
              onClick={handleApplyFilters}
              className="flex-1 sm:flex-none px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isEn ? 'Confirm' : 'ตกลง'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Official Printable Document Section */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 print:border-none print:shadow-none print:p-0 print:m-0">
        {/* Printable Official Header (Shows prominently in print and on screen) */}
        <div className="border-b-2 border-gray-900 pb-4 mb-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-lg text-gray-900 uppercase tracking-tight">
                  {isEn ? 'Company Fleet Vehicle Management' : 'ระบบบริหารยานพาหนะส่วนกลางองค์กร'}
                </span>
              </div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">
                {isEn ? 'VEHICLE USAGE & RESERVATION REPORT' : 'รายงานการขอใช้และบันทึกการใช้ยานพาหนะส่วนกลาง'}
              </h1>
              <p className="text-xs text-gray-600 mt-1">
                {isEn ? 'Document Type: Official Administration Report' : 'ประเภทเอกสาร: สรุปบันทึกการใช้ยานพาหนะและขออนุมัติ'}
                {appliedFilters.startDateFilter || appliedFilters.endDateFilter ? (
                  <span className="font-semibold text-gray-900 ml-2">
                    (ช่วงวันที่: {appliedFilters.startDateFilter ? formatThaiDate(appliedFilters.startDateFilter) : 'เริ่มต้น'} ถึง{' '}
                    {appliedFilters.endDateFilter ? formatThaiDate(appliedFilters.endDateFilter) : 'ปัจจุบัน'})
                  </span>
                ) : (
                  <span className="font-semibold text-gray-900 ml-2">(ข้อมูลทั้งหมดในระบบ)</span>
                )}
              </p>
            </div>

            <div className="text-left sm:text-right text-xs text-gray-600 space-y-0.5">
              <p>
                <span className="text-gray-500">วันที่พิมพ์รายงาน:</span>{' '}
                <strong className="text-gray-900">{formatThaiDate(new Date().toISOString())}</strong>
              </p>
              <p>
                <span className="text-gray-500">ผู้จัดทำรายงาน:</span>{' '}
                <strong className="text-gray-900">{currentUser?.name || 'Administrator'}</strong>
              </p>
              <p>
                <span className="text-gray-500">จำนวนบันทึก:</span>{' '}
                <strong className="text-indigo-700 font-bold">{filteredBookings.length} รายการ</strong>
              </p>
            </div>
          </div>
        </div>

        {/* The 12 Columns Table */}
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left text-xs border-collapse border border-gray-300">
            <thead>
              <tr className="bg-slate-100 text-gray-900 font-bold border-b-2 border-gray-300 print:bg-slate-200">
                <th className="p-2.5 border border-gray-300 text-center w-10">ลำดับ</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap">เลขที่ใบงาน</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap">วันที่เอกสาร</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap">ทะเบียนรถ</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap">วันที่เริ่มใช้รถ</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap text-center">เวลาเริ่ม</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap">วันที่คืนรถ</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap text-center">เวลาคืน</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap">ผู้ยืมรถ</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap">ฝ่าย</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap">แผนก</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap text-center">ไมล์เริ่มต้น</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap text-center">น้ำมันเริ่มต้น</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap text-center">ไมล์สิ้นสุด</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap text-center">น้ำมันสิ้นสุด</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap text-center">รูปหลักฐาน</th>
                <th className="p-2.5 border border-gray-300 min-w-40">เหตุผลการใช้รถ</th>
                <th className="p-2.5 border border-gray-300 min-w-36">สถานที่ปลายทาง</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap">ผู้อนุมัติ</th>
              </tr>
            </thead>
            <tbody>
              {!isFilterConfirmed ? (
                <tr>
                  <td colSpan={19} className="p-10 text-center border border-gray-300 bg-indigo-50/20">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <Filter className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-bold text-gray-800">
                        {isEn
                          ? 'Please click "Confirm" to load report data'
                          : 'กรุณาเลือกข้อมูลตัวกรองแล้วกดปุ่ม "ตกลง" เพื่อแสดงรายงาน'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {isEn
                          ? 'System will fetch and display data only after you click Confirm.'
                          : 'ระบบจะยังไม่แสดงข้อมูลจนกว่าจะกดปุ่ม "ตกลง" เพื่อดึงข้อมูลตามตัวกรองที่เลือก'}
                      </p>
                      <button
                        type="button"
                        onClick={handleApplyFilters}
                        className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isEn ? 'Confirm & Load Data' : 'ตกลง'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={19} className="p-8 text-center text-gray-400 border border-gray-300">
                    ไม่พบรายการบันทึกการใช้รถตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b, idx) => {
                  const plate = getVehiclePlate(b);
                  const division = getUserDivision(b);
                  const department = getUserDepartment(b);
                  const userPhone = getUserPhone(b);
                  const approver = getApprover(b);
                  const startTime = extractTime(b.startDate, '08:30');
                  const endTime = extractTime(b.endDate, '17:30');

                  return (
                    <tr
                      key={b.id}
                      className={`border-b border-gray-200 hover:bg-slate-50 print:hover:bg-transparent ${
                        idx % 2 === 1 ? 'bg-slate-50/60 print:bg-slate-50/40' : 'bg-white'
                      }`}
                    >
                      <td className="p-2 border border-gray-300 text-center font-mono text-[11px] text-gray-500">
                        {idx + 1}
                      </td>
                      <td className="p-2 border border-gray-300 whitespace-nowrap font-mono font-bold text-[11px] text-indigo-700">
                        {getBookingJobNumber(b)}
                      </td>
                      <td className="p-2 border border-gray-300 whitespace-nowrap text-gray-700 font-medium">
                        {formatThaiDate(b.createdAt)}
                      </td>
                      <td className="p-2 border border-gray-300 whitespace-nowrap font-bold text-indigo-900 print:text-black">
                        {plate}
                      </td>
                      <td className="p-2 border border-gray-300 whitespace-nowrap text-gray-800">
                        {formatThaiDate(b.startDate)}
                      </td>
                      <td className="p-2 border border-gray-300 whitespace-nowrap text-center font-mono text-[11px] text-gray-700">
                        {startTime}
                      </td>
                      <td className="p-2 border border-gray-300 whitespace-nowrap text-gray-800">
                        {formatThaiDate(b.endDate)}
                      </td>
                      <td className="p-2 border border-gray-300 whitespace-nowrap text-center font-mono text-[11px] text-gray-700">
                        {endTime}
                      </td>
                      <td className="p-2 border border-gray-300 whitespace-nowrap font-semibold text-gray-900">
                        <div>{b.userName}</div>
                        {userPhone && (
                          <a
                            href={`tel:${userPhone.replace(/[^\d+]/g, '')}`}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 transition-colors mt-0.5 print:bg-transparent print:border-none print:p-0 print:text-gray-600"
                            title={`กดเพื่อโทรออกหา ${b.userName} (${userPhone})`}
                          >
                            <Phone className="w-2.5 h-2.5 shrink-0 print:hidden" />
                            <span>{userPhone}</span>
                          </a>
                        )}
                      </td>
                      <td className="p-2 border border-gray-300 text-gray-700 text-[11px]">
                        {division}
                      </td>
                      <td className="p-2 border border-gray-300 text-gray-700 text-[11px]">
                        {department}
                      </td>
                      {/* Mileage & Fuel Columns inserted strictly after Department */}
                      <td className="p-2 border border-gray-300 text-center whitespace-nowrap font-mono text-[11px]">
                        {b.startMileage !== undefined ? (
                          <span className="font-bold text-indigo-700">{b.startMileage.toLocaleString()} km.</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-2 border border-gray-300 text-center whitespace-nowrap">
                        {b.startFuelLevel ? (
                          <span
                            className={`px-1.5 py-0.5 rounded font-semibold text-[10px] border ${
                              b.startFuelLevel === 'ใกล้หมด'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {b.startFuelLevel}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-2 border border-gray-300 text-center whitespace-nowrap font-mono text-[11px]">
                        {b.endMileage !== undefined ? (
                          <span className="font-bold text-emerald-700">{b.endMileage.toLocaleString()} km.</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-2 border border-gray-300 text-center whitespace-nowrap">
                        {b.endFuelLevel ? (
                          <span
                            className={`px-1.5 py-0.5 rounded font-semibold text-[10px] border ${
                              b.endFuelLevel === 'ใกล้หมด'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {b.endFuelLevel}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-2 border border-gray-300 text-center whitespace-nowrap print:hidden">
                        <div className="flex items-center justify-center gap-1">
                          {b.startMileagePhoto && (
                            <button
                              type="button"
                              onClick={() => setViewingPhoto({ url: b.startMileagePhoto!, title: `รูปไมล์เริ่ม (${b.userName})` })}
                              className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-semibold border border-blue-200 cursor-pointer"
                              title="ดูรูปไมล์เริ่มต้น"
                            >
                              ไมล์เริ่ม
                            </button>
                          )}
                          {b.endMileagePhoto && (
                            <button
                              type="button"
                              onClick={() => setViewingPhoto({ url: b.endMileagePhoto!, title: `รูปไมล์คืน (${b.userName})` })}
                              className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[10px] font-semibold border border-emerald-200 cursor-pointer"
                              title="ดูรูปไมล์สิ้นสุด"
                            >
                              ไมล์คืน
                            </button>
                          )}
                          {b.keyReturnPhoto && (
                            <button
                              type="button"
                              onClick={() => setViewingPhoto({ url: b.keyReturnPhoto!, title: `รูปหย่อนกุญแจ (${b.userName})` })}
                              className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded text-[10px] font-semibold border border-amber-200 cursor-pointer"
                              title="ดูรูปหลักฐานหย่อนกุญแจ"
                            >
                              กุญแจ
                            </button>
                          )}
                          {!b.startMileagePhoto && !b.endMileagePhoto && !b.keyReturnPhoto && (
                            <span className="text-gray-400 text-[10px]">-</span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 border border-gray-300 text-gray-800 leading-snug">
                        {b.purpose}
                      </td>
                      <td className="p-2 border border-gray-300 text-gray-800 leading-snug">
                        {b.destination}
                      </td>
                      <td className="p-2 border border-gray-300 whitespace-nowrap">
                        <span
                          className={`font-semibold text-[11px] ${
                            approver.includes('รอ')
                              ? 'text-amber-600'
                              : approver.includes('ไม่อนุมัติ') || approver.includes('Reject') || b.status === 'Cancelled'
                              ? 'text-red-600'
                              : 'text-emerald-700 print:text-black'
                          }`}
                        >
                          {approver}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Official Signatures Box for Printed Reports */}
        <div className="hidden print:grid grid-cols-3 gap-6 pt-12 mt-8 border-t border-gray-300 text-center text-xs">
          <div className="space-y-12">
            <p className="font-semibold text-gray-700">ลงชื่อ ...........................................................</p>
            <div>
              <p className="font-bold text-gray-900">( ........................................................... )</p>
              <p className="text-[10px] text-gray-600 mt-1">ผู้ขอใช้รถยนต์ / ผู้ขับขี่</p>
              <p className="text-[10px] text-gray-500">วันที่ ......./......./...........</p>
            </div>
          </div>

          <div className="space-y-12">
            <p className="font-semibold text-gray-700">ลงชื่อ ...........................................................</p>
            <div>
              <p className="font-bold text-gray-900">( ........................................................... )</p>
              <p className="text-[10px] text-gray-600 mt-1">หัวหน้าแผนก / ผู้ตรวจสอบ</p>
              <p className="text-[10px] text-gray-500">วันที่ ......./......./...........</p>
            </div>
          </div>

          <div className="space-y-12">
            <p className="font-semibold text-gray-700">ลงชื่อ ...........................................................</p>
            <div>
              <p className="font-bold text-gray-900">( ........................................................... )</p>
              <p className="text-[10px] text-gray-600 mt-1">ผู้อนุมัติ / ผู้ดูแลยานพาหนะส่วนกลาง</p>
              <p className="text-[10px] text-gray-500">วันที่ ......./......./...........</p>
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
}
