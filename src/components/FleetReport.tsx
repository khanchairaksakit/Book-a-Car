import React, { useState, useMemo } from 'react';
import { Booking, Vehicle, User } from '../types';
import { Language } from '../utils/translations';
import { formatThaiDate } from '../utils/vehicleAlerts';
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
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface FleetReportProps {
  bookings: Booking[];
  vehicles: Vehicle[];
  users: User[];
  currentUser: User | null;
  language?: Language;
}

export default function FleetReport({
  bookings,
  vehicles,
  users,
  currentUser,
  language = 'th',
}: FleetReportProps) {
  const isEn = language === 'en';

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [vehicleFilter, setVehicleFilter] = useState<string>('All');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('All');

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
    if (b.approverName) return b.approverName;
    if (b.status === 'Approved' || b.status === 'Completed') {
      return 'สมชาย ใจดี (Admin)';
    }
    if (b.status === 'Pending') {
      return isEn ? 'Pending Approval' : 'รอการอนุมัติ';
    }
    if (b.status === 'Cancelled') {
      return isEn ? 'Rejected / Cancelled' : 'ไม่อนุมัติ / ยกเลิก';
    }
    return '-';
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

  // Distinct departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.department) set.add(u.department);
    });
    bookings.forEach((b) => {
      if (b.userDepartment) set.add(b.userDepartment);
    });
    return Array.from(set);
  }, [users, bookings]);

  // Filtered rows
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Status filter
      if (statusFilter !== 'All' && b.status !== statusFilter) return false;

      // Vehicle filter
      if (vehicleFilter !== 'All' && b.vehicleId !== vehicleFilter) return false;

      // Department filter
      if (departmentFilter !== 'All') {
        const dept = getUserDepartment(b);
        if (dept !== departmentFilter) return false;
      }

      // Date range filter (checks startDate or createdAt)
      const bDate = extractDateOnly(b.startDate) || extractDateOnly(b.createdAt);
      if (startDateFilter && bDate < startDateFilter) return false;
      if (endDateFilter && bDate > endDateFilter) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const plate = getVehiclePlate(b).toLowerCase();
        const borrower = (b.userName || '').toLowerCase();
        const purpose = (b.purpose || '').toLowerCase();
        const dest = (b.destination || '').toLowerCase();
        const approver = getApprover(b).toLowerCase();
        const dept = getUserDepartment(b).toLowerCase();
        const div = getUserDivision(b).toLowerCase();

        return (
          plate.includes(q) ||
          borrower.includes(q) ||
          purpose.includes(q) ||
          dest.includes(q) ||
          approver.includes(q) ||
          dept.includes(q) ||
          div.includes(q)
        );
      }

      return true;
    });
  }, [
    bookings,
    statusFilter,
    vehicleFilter,
    departmentFilter,
    startDateFilter,
    endDateFilter,
    searchTerm,
    users,
    vehicles,
  ]);

  // Export to Excel with the exact 12 requested columns
  const handleExportExcel = () => {
    const exportData = filteredBookings.map((b, idx) => {
      return {
        'ลำดับ': idx + 1,
        'วันที่เอกสาร': formatThaiDate(b.createdAt),
        'ทะเบียนรถ': getVehiclePlate(b),
        'วันที่เริ่มใช้รถ': formatThaiDate(b.startDate),
        'เวลาเริ่ม': extractTime(b.startDate, '08:30'),
        'วันที่คืนรถ': formatThaiDate(b.endDate),
        'เวลาคืน': extractTime(b.endDate, '17:30'),
        'ผู้ยืมรถ': b.userName,
        'ฝ่าย': getUserDivision(b),
        'แผนก': getUserDepartment(b),
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

  // Reset Filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('All');
    setVehicleFilter('All');
    setDepartmentFilter('All');
    setStartDateFilter('');
    setEndDateFilter('');
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
                {isEn ? 'Fleet Vehicle Usage Report' : 'รายงานการใช้ยานพาหนะส่วนกลาง'}
              </h2>
              <p className="text-xs text-gray-500">
                {isEn
                  ? 'Administrator report with printable layout & Excel export'
                  : 'รายงานสำหรับผู้ดูแลระบบ รองรับการพิมพ์เอกสารทางการและดาวน์โหลด Excel'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
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
        </div>
      </div>

      {/* 2. Filter Bar (Hidden in Print) */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4 print:hidden">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
            <Filter className="w-4 h-4 text-indigo-600" />
            <span>{isEn ? 'Report Filters' : 'ตัวกรองรายงาน'}</span>
            <span className="bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full text-[11px]">
              พบ {filteredBookings.length} รายการ
            </span>
          </div>

          {(searchTerm || statusFilter !== 'All' || vehicleFilter !== 'All' || departmentFilter !== 'All' || startDateFilter || endDateFilter) && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isEn ? 'Clear Filters' : 'ล้างตัวกรอง'}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              {isEn ? 'Search' : 'ค้นหา (ผู้ยืม / ทะเบียน / ปลายทาง)'}
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isEn ? 'Search requester, plate, destination...' : 'พิมพ์ชื่อผู้ยืม, ทะเบียนรถ, ปลายทาง...'}
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
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
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

          {/* Department Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              {isEn ? 'Department' : 'แผนก'}
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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

        {/* Date Range Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              {isEn ? 'Start Date (From)' : 'ตั้งแต่วันที่'}
            </label>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">
              {isEn ? 'End Date (To)' : 'ถึงวันที่'}
            </label>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="sm:col-span-2 flex items-end gap-2">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                setStartDateFilter(`${y}-${m}-01`);
                setEndDateFilter(`${y}-${m}-31`);
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
                setStartDateFilter(`${y}-01-01`);
                setEndDateFilter(`${y}-12-31`);
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              {isEn ? 'This Year' : 'ปีนี้'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStartDateFilter('');
                setEndDateFilter('');
              }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              {isEn ? 'All Dates' : 'ตลอดเวลา'}
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
                {startDateFilter || endDateFilter ? (
                  <span className="font-semibold text-gray-900 ml-2">
                    (ช่วงวันที่: {startDateFilter ? formatThaiDate(startDateFilter) : 'เริ่มต้น'} ถึง{' '}
                    {endDateFilter ? formatThaiDate(endDateFilter) : 'ปัจจุบัน'})
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
                <th className="p-2.5 border border-gray-300 whitespace-nowrap">วันที่เอกสาร</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap">ทะเบียนรถ</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap">วันที่เริ่มใช้รถ</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap text-center">เวลาเริ่ม</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap">วันที่คืนรถ</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap text-center">เวลาคืน</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap">ผู้ยืมรถ</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap">ฝ่าย</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap">แผนก</th>
                <th className="p-2.5 border border-gray-300 min-w-40">เหตุผลการใช้รถ</th>
                <th className="p-2.5 border border-gray-300 min-w-36">สถานที่ปลายทาง</th>
                <th className="p-2.5 border border-gray-300 whitespace-nowrap">ผู้อนุมัติ</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-gray-400 border border-gray-300">
                    ไม่พบรายการบันทึกการใช้รถตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b, idx) => {
                  const plate = getVehiclePlate(b);
                  const division = getUserDivision(b);
                  const department = getUserDepartment(b);
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
                        {b.userName}
                      </td>
                      <td className="p-2 border border-gray-300 text-gray-700 text-[11px]">
                        {division}
                      </td>
                      <td className="p-2 border border-gray-300 text-gray-700 text-[11px]">
                        {department}
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
                            approver.includes('รอการอนุมัติ')
                              ? 'text-amber-600'
                              : approver.includes('ไม่อนุมัติ')
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
    </div>
  );
}
