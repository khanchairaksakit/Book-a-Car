import React, { useState } from 'react';
import { Vehicle, VehicleType, VehicleStatus, User, Booking } from '../types';
import {
  Plus,
  Edit2,
  Trash2,
  ShieldAlert,
  SlidersHorizontal,
  X,
  AlertCircle,
  Gauge,
  Calendar,
  Disc,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  UserCheck,
  MapPin,
  CircleUser,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  getVehicleAlerts,
  formatMileage,
  formatThaiDate,
  formatTripDateTime,
  getLatestVehicleUsage,
  getDaysRemaining,
} from '../utils/vehicleAlerts';

interface VehicleManagementProps {
  vehicles: Vehicle[];
  bookings?: Booking[];
  currentUser: User | null;
  onAddVehicle: (vehicle: Omit<Vehicle, 'id'>) => void;
  onEditVehicle: (vehicle: Vehicle) => void;
  onDeleteVehicle: (vehicleId: string) => void;
}

export default function VehicleManagement({
  vehicles,
  bookings = [],
  currentUser,
  onAddVehicle,
  onEditVehicle,
  onDeleteVehicle,
}: VehicleManagementProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formTab, setFormTab] = useState<'general' | 'maintenance'>('general');

  // Form Fields: General
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [type, setType] = useState<VehicleType>('Sedan');
  const [capacity, setCapacity] = useState<number>(5);
  const [status, setStatus] = useState<VehicleStatus>('Available');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  // Form Fields: Maintenance & Alerts
  const [currentMileage, setCurrentMileage] = useState<string>('0');
  const [mileageAlertThreshold, setMileageAlertThreshold] = useState<string>('10000');
  const [taxExpiryDate, setTaxExpiryDate] = useState<string>('');
  const [taxAlertDaysBefore, setTaxAlertDaysBefore] = useState<string>('30');
  const [tireAlertMileage, setTireAlertMileage] = useState<string>('50000');
  const [tireInfo, setTireInfo] = useState<string>('');
  const [tireChangeDate, setTireChangeDate] = useState<string>('');

  // Quick Mileage Update Modal
  const [quickMileageVehicle, setQuickMileageVehicle] = useState<Vehicle | null>(null);
  const [quickMileageVal, setQuickMileageVal] = useState<string>('');

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [alertFilter, setAlertFilter] = useState<string>('All');
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);

  const isAdmin = currentUser?.role === 'Admin';

  const resetForm = () => {
    setBrand('');
    setModel('');
    setPlateNumber('');
    setType('Sedan');
    setCapacity(5);
    setStatus('Available');
    setImageUrl('');
    setDescription('');
    setCurrentMileage('0');
    setMileageAlertThreshold('10000');
    setTaxExpiryDate('');
    setTaxAlertDaysBefore('30');
    setTireAlertMileage('50000');
    setTireInfo('');
    setTireChangeDate('');
    setError('');
    setFormTab('general');
  };

  const startEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setBrand(vehicle.brand);
    setModel(vehicle.model);
    setPlateNumber(vehicle.plateNumber);
    setType(vehicle.type);
    setCapacity(vehicle.capacity);
    setStatus(vehicle.status);
    setImageUrl(vehicle.imageUrl);
    setDescription(vehicle.description || '');

    // Maintenance fields
    setCurrentMileage(vehicle.currentMileage !== undefined ? String(vehicle.currentMileage) : '0');
    setMileageAlertThreshold(vehicle.mileageAlertThreshold !== undefined ? String(vehicle.mileageAlertThreshold) : '10000');
    setTaxExpiryDate(vehicle.taxExpiryDate || '');
    setTaxAlertDaysBefore(vehicle.taxAlertDaysBefore !== undefined ? String(vehicle.taxAlertDaysBefore) : '30');
    setTireAlertMileage(vehicle.tireAlertMileage !== undefined ? String(vehicle.tireAlertMileage) : '50000');
    setTireInfo(vehicle.tireInfo || '');
    setTireChangeDate(vehicle.tireChangeDate || '');

    setFormTab('general');
    setIsAdding(true);
  };

  const handleCapacityChange = (val: string) => {
    const num = parseInt(val, 10);
    setCapacity(isNaN(num) ? 5 : num);
  };

  const handleTypeChange = (newType: VehicleType) => {
    setType(newType);
    if (newType === 'Sedan') setCapacity(5);
    if (newType === 'SUV') setCapacity(7);
    if (newType === 'Van') setCapacity(11);
    if (newType === 'Pickup') setCapacity(5);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand.trim() || !model.trim() || !plateNumber.trim()) {
      setError('กรุณากรอกยี่ห้อ รุ่น และเลขทะเบียนรถยนต์');
      setFormTab('general');
      return;
    }

    // Default image if blank
    const defaultImg = {
      Sedan: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&q=80&w=600',
      SUV: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&q=80&w=600',
      Van: 'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?auto=format&fit=crop&q=80&w=600',
      Pickup: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=600',
    }[type];

    const finalImageUrl = imageUrl.trim() || defaultImg;

    const parsedMileage = parseInt(currentMileage, 10);
    const parsedMileageThreshold = parseInt(mileageAlertThreshold, 10);
    const parsedTaxDaysBefore = parseInt(taxAlertDaysBefore, 10);
    const parsedTireMileage = parseInt(tireAlertMileage, 10);

    const vehicleData = {
      brand: brand.trim(),
      model: model.trim(),
      plateNumber: plateNumber.trim(),
      type,
      capacity,
      status,
      imageUrl: finalImageUrl,
      description: description.trim(),
      currentMileage: !isNaN(parsedMileage) ? parsedMileage : undefined,
      mileageAlertThreshold: !isNaN(parsedMileageThreshold) ? parsedMileageThreshold : undefined,
      taxExpiryDate: taxExpiryDate || undefined,
      taxAlertDaysBefore: !isNaN(parsedTaxDaysBefore) ? parsedTaxDaysBefore : 30,
      tireAlertMileage: !isNaN(parsedTireMileage) ? parsedTireMileage : undefined,
      tireInfo: tireInfo.trim() || undefined,
      tireChangeDate: tireChangeDate || undefined,
    };

    if (editingVehicle) {
      onEditVehicle({
        ...editingVehicle,
        ...vehicleData,
      });
      setEditingVehicle(null);
    } else {
      onAddVehicle(vehicleData);
    }

    setIsAdding(false);
    resetForm();
  };

  const handleQuickMileageSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMileageVehicle) return;
    const num = parseInt(quickMileageVal, 10);
    if (isNaN(num) || num < 0) return;

    onEditVehicle({
      ...quickMileageVehicle,
      currentMileage: num,
    });

    setQuickMileageVehicle(null);
    setQuickMileageVal('');
  };

  // Filter logic
  const filteredVehicles = vehicles.filter((v) => {
    const matchType = typeFilter === 'All' || v.type === typeFilter;
    const matchStatus = statusFilter === 'All' || v.status === statusFilter;
    
    if (alertFilter === 'HasAlerts') {
      const alerts = getVehicleAlerts(v);
      return matchType && matchStatus && alerts.length > 0;
    }
    if (alertFilter === 'Critical') {
      const alerts = getVehicleAlerts(v);
      return matchType && matchStatus && alerts.some((a) => a.severity === 'critical');
    }
    if (alertFilter === 'Normal') {
      const alerts = getVehicleAlerts(v);
      return matchType && matchStatus && alerts.length === 0;
    }

    return matchType && matchStatus;
  });

  const getStatusText = (st: VehicleStatus) => {
    switch (st) {
      case 'Available': return '🟢 ว่างพร้อมใช้งาน';
      case 'In Use': return '🔵 กำลังเดินทาง';
      case 'Maintenance': return '🔴 ซ่อมบำรุง';
      default: return st;
    }
  };

  const typeLabels: { [key in VehicleType]: string } = {
    Sedan: 'รถเก๋ง (Sedan)',
    SUV: 'รถอเนกประสงค์ (SUV)',
    Van: 'รถตู้ (Van)',
    Pickup: 'รถกระบะ (Pickup)',
  };

  // Summary counts of maintenance alerts across all vehicles
  const totalFleetAlerts = vehicles.reduce((acc, v) => acc + getVehicleAlerts(v).length, 0);
  const criticalFleetAlerts = vehicles.reduce(
    (acc, v) => acc + getVehicleAlerts(v).filter((a) => a.severity === 'critical').length,
    0
  );

  return (
    <div className="space-y-6" id="vehicle-management-section">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 tracking-tight">การจัดการกองรถยนต์ส่วนกลาง</h2>
          <p className="text-sm text-gray-500 mt-1">
            จัดการข้อมูลรถยนต์ เลขไมล์ วันหมดอายุภาษี รอบเปลี่ยนยาง และระบบแจ้งเตือนการบำรุงรักษา
          </p>
        </div>
        <button
          id="btn-add-vehicle"
          onClick={() => {
            setEditingVehicle(null);
            resetForm();
            setIsAdding(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มรถยนต์ใหม่</span>
        </button>
      </div>

      {/* Fleet Alert Banner if any warnings */}
      {totalFleetAlerts > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 font-bold shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                แจ้งเตือนการบำรุงรักษากองรถยนต์ ({totalFleetAlerts} รายการ)
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                มีรถยนต์ {criticalFleetAlerts > 0 ? `${criticalFleetAlerts} รายการเร่งด่วน` : ''} ที่ถึงกำหนดหรือใกล้ถึงรอบเปลี่ยนยาง เช็คระยะเลขไมล์ หรือต่อภาษีประจำปี
              </p>
            </div>
          </div>
          <button
            onClick={() => setAlertFilter(alertFilter === 'HasAlerts' ? 'All' : 'HasAlerts')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
              alertFilter === 'HasAlerts'
                ? 'bg-amber-600 text-white'
                : 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-100'
            }`}
          >
            {alertFilter === 'HasAlerts' ? 'แสดงรถทั้งหมด' : 'กรองดูเฉพาะรถที่มีแจ้งเตือน'}
          </button>
        </div>
      )}

      {/* Role Reminder */}
      {!isAdmin && (
        <div id="role-admin-warning" className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <span className="font-bold">จำลองสิทธิ์แอดมิน:</span> ปัจจุบันคุณไม่ได้เข้าสู่ระบบด้วยสิทธิ์ <span className="underline font-semibold">แอดมิน (Admin)</span> ระบบอนุญาตให้แอดมินเท่านั้นเป็นผู้ลงทะเบียน ลบ หรือแก้ไขข้อมูลยานพาหนะ
            <div className="mt-1">
              💡 คุณสามารถเปลี่ยนโปรไฟล์จำลองเป็นแอดมิน (เช่น <span className="font-semibold">คุณสมชาย ใจดี</span>) ได้อย่างสะดวกที่เมนู <span className="font-semibold">"ลงทะเบียนผู้ใช้งาน"</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-semibold text-gray-700 uppercase">ตัวกรองข้อมูลรถยนต์:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Vehicle Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">ประเภทรถ:</span>
            <select
              id="filter-vehicle-type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">ทั้งหมด</option>
              <option value="Sedan">รถเก๋ง (Sedan)</option>
              <option value="SUV">รถอเนกประสงค์ (SUV)</option>
              <option value="Van">รถตู้ (Van)</option>
              <option value="Pickup">รถกระบะ (Pickup)</option>
            </select>
          </div>

          {/* Vehicle Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">สถานะ:</span>
            <select
              id="filter-vehicle-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">ทั้งหมด</option>
              <option value="Available">🟢 ว่าง</option>
              <option value="In Use">🔵 กำลังใช้งาน</option>
              <option value="Maintenance">🔴 ซ่อมบำรุง</option>
            </select>
          </div>

          {/* Alerts Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">การแจ้งเตือน:</span>
            <select
              id="filter-vehicle-alerts"
              value={alertFilter}
              onChange={(e) => setAlertFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="All">การแจ้งเตือนทั้งหมด</option>
              <option value="HasAlerts">⚠️ มีรายการแจ้งเตือน</option>
              <option value="Critical">🚨 ถึงกำหนดเร่งด่วน</option>
              <option value="Normal">🟢 สภาพปกติ</option>
            </select>
          </div>
        </div>
      </div>

      {/* Vehicles Display Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVehicles.map((vehicle) => {
          const alerts = getVehicleAlerts(vehicle);
          const hasCritical = alerts.some((a) => a.severity === 'critical');
          const hasWarning = alerts.some((a) => a.severity === 'warning');

          const daysToTax = getDaysRemaining(vehicle.taxExpiryDate);

          return (
            <div
              key={vehicle.id}
              id={`vehicle-card-${vehicle.id}`}
              className={`bg-white rounded-xl border overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group ${
                hasCritical
                  ? 'border-rose-300 ring-1 ring-rose-200'
                  : hasWarning
                  ? 'border-amber-300'
                  : 'border-gray-200'
              }`}
            >
              {/* Vehicle Image Aspect Ratio */}
              <div className="aspect-video relative overflow-hidden bg-gray-100">
                <img
                  src={vehicle.imageUrl}
                  alt={`${vehicle.brand} ${vehicle.model}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                />
                <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-md text-xs font-semibold shadow-xs">
                  {getStatusText(vehicle.status)}
                </div>
                <div className="absolute top-3 right-3 bg-indigo-600 text-white px-2.5 py-1 rounded-md text-xs font-semibold shadow-xs">
                  {typeLabels[vehicle.type] || vehicle.type}
                </div>

                {/* Overall Alert Badge on Image if active */}
                {alerts.length > 0 && (
                  <div
                    className={`absolute bottom-3 left-3 px-2.5 py-1 rounded-md text-xs font-bold shadow-sm flex items-center gap-1.5 ${
                      hasCritical
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-amber-500 text-white'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>แจ้งเตือน {alerts.length} รายการ</span>
                  </div>
                )}
              </div>

              {/* Card Content */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg leading-tight">
                        {vehicle.brand} {vehicle.model}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {vehicle.capacity} ที่นั่ง • {typeLabels[vehicle.type] || vehicle.type}
                      </p>
                    </div>
                    <span className="px-2 py-1 border border-indigo-100 bg-indigo-50 text-indigo-700 font-mono text-xs font-bold rounded-md shrink-0">
                      {vehicle.plateNumber}
                    </span>
                  </div>

                  {/* 3 Maintenance Tracking Panels */}
                  <div className="space-y-2 pt-1">
                    {/* 1. Mileage Indicator */}
                    <div className="bg-slate-50 border border-slate-200/70 p-2.5 rounded-lg flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                          <Gauge className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800 flex items-center gap-1">
                            <span>เลขไมล์ปัจจุบัน</span>
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {vehicle.mileageAlertThreshold
                              ? `เช็คระยะที่: ${formatMileage(vehicle.mileageAlertThreshold)}`
                              : 'ยังไม่กำหนดรอบเช็ค'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold font-mono text-gray-900 text-sm">
                          {formatMileage(vehicle.currentMileage)}
                        </div>
                        {vehicle.currentMileage && vehicle.mileageAlertThreshold && (
                          <div className="text-[10px] text-gray-500">
                            {vehicle.currentMileage >= vehicle.mileageAlertThreshold ? (
                              <span className="text-rose-600 font-bold">เกินกำหนดเช็ค</span>
                            ) : (
                              <span>เหลือ {Math.max(0, vehicle.mileageAlertThreshold - vehicle.currentMileage).toLocaleString()} กม.</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 2. Tax Expiry Indicator */}
                    <div className="bg-slate-50 border border-slate-200/70 p-2.5 rounded-lg flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                          <Calendar className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800">
                            <span>วันหมดอายุภาษี/พ.ร.บ.</span>
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {formatThaiDate(vehicle.taxExpiryDate)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {daysToTax !== null ? (
                          daysToTax < 0 ? (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 font-bold text-[10px] rounded-md border border-rose-200">
                              หมดอายุแล้ว ({Math.abs(daysToTax)} วัน)
                            </span>
                          ) : daysToTax <= (vehicle.taxAlertDaysBefore || 30) ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 font-bold text-[10px] rounded-md border border-amber-200">
                              เหลือ {daysToTax} วัน
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-semibold text-[10px] rounded-md border border-emerald-200">
                              เหลือ {daysToTax} วัน
                            </span>
                          )
                        ) : (
                          <span className="text-gray-400 text-[11px]">ไม่ระบุ</span>
                        )}
                      </div>
                    </div>

                    {/* 3. Tires Indicator */}
                    <div className="bg-slate-50 border border-slate-200/70 p-2.5 rounded-lg flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                          <Disc className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate max-w-[150px]">
                          <div className="font-semibold text-gray-800">
                            <span>ยางรถยนต์</span>
                          </div>
                          <div className="text-[11px] text-gray-500 truncate" title={vehicle.tireInfo || 'ยางมาตรฐาน'}>
                            {vehicle.tireInfo || 'ยางมาตรฐาน'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {vehicle.tireAlertMileage ? (
                          <div className="text-[11px] font-mono text-gray-700">
                            รอบ: {formatMileage(vehicle.tireAlertMileage)}
                          </div>
                        ) : vehicle.tireChangeDate ? (
                          <div className="text-[11px] text-gray-600">
                            เปลี่ยน: {formatThaiDate(vehicle.tireChangeDate)}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[11px]">ไม่ระบุ</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Active Alert Warning Callouts */}
                  {alerts.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {alerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`p-2 rounded-lg text-xs flex items-start gap-2 border ${
                            alert.severity === 'critical'
                              ? 'bg-rose-50 border-rose-200 text-rose-800'
                              : 'bg-amber-50 border-amber-200 text-amber-800'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="font-bold">{alert.title}</span>
                            <p className="text-[11px] leading-tight opacity-90">{alert.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 4. ผู้ใช้งานล่าสุด (Latest User / Trip Info) */}
                  {(() => {
                    const latestUsage = getLatestVehicleUsage(vehicle.id, bookings);
                    return (
                      <div
                        id={`card-latest-user-${vehicle.id}`}
                        className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between text-gray-700 font-semibold text-[11px] border-b border-slate-200/60 pb-1">
                          <span className="flex items-center gap-1.5 text-indigo-700 font-bold">
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>ผู้ใช้งานล่าสุด</span>
                          </span>
                          {latestUsage && (
                            <span className="text-[10px] text-gray-500 font-normal">
                              {vehicle.status === 'In Use' ? '🔵 กำลังใช้งาน' : latestUsage.status === 'Completed' ? 'เสร็จสิ้น' : 'อนุมัติแล้ว'}
                            </span>
                          )}
                        </div>

                        {latestUsage ? (
                          <div className="space-y-1.5 text-xs pt-0.5">
                            <div className="flex items-center gap-2 text-gray-800">
                              <CircleUser className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <div className="flex items-baseline gap-1.5 min-w-0">
                                <span className="font-semibold text-gray-900 truncate">
                                  {latestUsage.userName}
                                </span>
                                {latestUsage.userPhone && (
                                  <span className="text-gray-400 text-[10px] font-mono shrink-0">
                                    ({latestUsage.userPhone})
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-gray-600 text-[11px]">
                              <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span className="truncate">
                                {formatTripDateTime(latestUsage.startDate, latestUsage.endDate)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-gray-600 text-[11px]">
                              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <span
                                className="truncate text-gray-700 font-medium"
                                title={latestUsage.destination}
                              >
                                {latestUsage.destination}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-400 italic py-0.5">ยังไม่มีประวัติการใช้งาน</p>
                        )}
                      </div>
                    );
                  })()}

                  {vehicle.description && (
                    <p className="text-xs text-gray-500 line-clamp-1">
                      {vehicle.description}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 border-t border-gray-100 pt-4 mt-2">
                  <button
                    id={`btn-quick-mileage-${vehicle.id}`}
                    onClick={() => {
                      setQuickMileageVehicle(vehicle);
                      setQuickMileageVal(String(vehicle.currentMileage || 0));
                    }}
                    className="py-1.5 px-2.5 border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="บันทึกเลขไมล์ปัจจุบันหลังเดินทาง"
                  >
                    <Gauge className="w-3.5 h-3.5" />
                    <span>อัปเดตไมล์</span>
                  </button>
                  <button
                    id={`btn-edit-vehicle-icon-${vehicle.id}`}
                    onClick={() => {
                      startEdit(vehicle);
                    }}
                    className="flex-1 py-1.5 px-3 border border-gray-200 hover:bg-slate-50 text-gray-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>แก้ไขข้อมูล/แจ้งเตือน</span>
                  </button>
                  <button
                    id={`btn-delete-vehicle-icon-${vehicle.id}`}
                    onClick={() => {
                      setDeletingVehicle(vehicle);
                    }}
                    className="py-1.5 px-2.5 border border-red-100 text-red-600 hover:bg-red-50/50 hover:border-red-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    title="ลบรถยนต์"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Vehicle Modal Dialog with Tabs */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 my-8 space-y-4 max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                    {editingVehicle ? '✏️' : '🚗'}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">
                      {editingVehicle ? 'แก้ไขข้อมูลรถยนต์ & การแจ้งเตือน' : 'เพิ่มรถยนต์คันใหม่เข้าระบบ'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {editingVehicle
                        ? `ทะเบียน: ${editingVehicle.plateNumber} (${editingVehicle.brand} ${editingVehicle.model})`
                        : 'กรอกรายละเอียดรถยนต์และตั้งค่าการแจ้งเตือนบำรุงรักษา'}
                    </p>
                  </div>
                </div>
                <button
                  id="btn-close-vehicle-form"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingVehicle(null);
                    resetForm();
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* If editing a vehicle, display latest user usage info banner */}
              {editingVehicle && (() => {
                const latestUsage = getLatestVehicleUsage(editingVehicle.id, bookings);
                return (
                  <div
                    id="edit-modal-latest-user-banner"
                    className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 shrink-0 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs border-b border-slate-200/60 pb-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-indigo-700">
                        <UserCheck className="w-4 h-4" />
                        <span>ผู้ใช้งานล่าสุดของรถคันนี้ (Latest Trip)</span>
                      </div>
                      {latestUsage && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                          {editingVehicle.status === 'In Use' ? '🔵 กำลังใช้งาน' : latestUsage.status === 'Completed' ? 'เสร็จสิ้น' : 'อนุมัติแล้ว'}
                        </span>
                      )}
                    </div>

                    {latestUsage ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs pt-0.5">
                        <div className="flex items-start gap-2 bg-white p-2.5 rounded-lg border border-slate-100 shadow-xs">
                          <CircleUser className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="text-[10px] text-gray-500 block">ผู้ใช้</span>
                            <span className="font-semibold text-gray-900 block truncate">
                              {latestUsage.userName}
                            </span>
                            {latestUsage.userPhone && (
                              <span className="text-[10px] text-gray-400 font-mono block">
                                {latestUsage.userPhone}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-2 bg-white p-2.5 rounded-lg border border-slate-100 shadow-xs">
                          <Clock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="text-[10px] text-gray-500 block">วันเวลา</span>
                            <span className="font-semibold text-gray-900 block text-[11px] leading-tight">
                              {formatTripDateTime(latestUsage.startDate, latestUsage.endDate)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 bg-white p-2.5 rounded-lg border border-slate-100 shadow-xs">
                          <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="text-[10px] text-gray-500 block">สถานที่ไป</span>
                            <span
                              className="font-semibold text-gray-900 block truncate text-[11px]"
                              title={latestUsage.destination}
                            >
                              {latestUsage.destination}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic py-1">รถยนต์คันนี้ยังไม่มีบันทึกประวัติการใช้งาน</p>
                    )}
                  </div>
                );
              })()}

              {/* Form Navigation Tabs */}
              <div className="flex border-b border-gray-200 shrink-0 gap-4">
                <button
                  type="button"
                  id="tab-form-general"
                  onClick={() => setFormTab('general')}
                  className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer relative ${
                    formTab === 'general'
                      ? 'text-indigo-600 border-b-2 border-indigo-600 font-bold'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>1. ข้อมูลทั่วไปของรถ</span>
                </button>
                <button
                  type="button"
                  id="tab-form-maintenance"
                  onClick={() => setFormTab('maintenance')}
                  className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer relative ${
                    formTab === 'maintenance'
                      ? 'text-indigo-600 border-b-2 border-indigo-600 font-bold'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>2. เลขไมล์ ภาษี ยางรถ & แจ้งเตือน</span>
                  <span className="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 text-[10px] rounded-full font-bold">
                    ใหม่
                  </span>
                </button>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 flex items-center gap-2 shrink-0">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form Content - Scrollable */}
              <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-1">
                {formTab === 'general' ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                          ยี่ห้อ (Brand) <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="car-input-brand"
                          type="text"
                          value={brand}
                          onChange={(e) => setBrand(e.target.value)}
                          placeholder="เช่น Toyota"
                          className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                          รุ่น (Model) <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="car-input-model"
                          type="text"
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          placeholder="เช่น Camry, Fortuner"
                          className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                        ป้ายทะเบียน <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="car-input-plate"
                        type="text"
                        value={plateNumber}
                        onChange={(e) => setPlateNumber(e.target.value)}
                        placeholder="เช่น กข 1234 กรุงเทพฯ"
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">ประเภทรถยนต์</label>
                        <select
                          id="car-input-type"
                          value={type}
                          onChange={(e) => handleTypeChange(e.target.value as VehicleType)}
                          className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                        >
                          <option value="Sedan">รถเก๋ง (Sedan)</option>
                          <option value="SUV">รถอเนกประสงค์ (SUV)</option>
                          <option value="Van">รถตู้ (Van)</option>
                          <option value="Pickup">รถกระบะ (Pickup)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                          ความจุ (ที่นั่ง) <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="car-input-capacity"
                          type="number"
                          min={1}
                          max={20}
                          value={capacity}
                          onChange={(e) => handleCapacityChange(e.target.value)}
                          className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">สถานะรถยนต์</label>
                      <select
                        id="car-input-status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as VehicleStatus)}
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                      >
                        <option value="Available">🟢 ว่างพร้อมใช้งาน</option>
                        <option value="In Use">🔵 กำลังเดินทาง</option>
                        <option value="Maintenance">🔴 ซ่อมบำรุง</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">ลิงก์รูปภาพรถ (URL)</label>
                      <input
                        id="car-input-img"
                        type="url"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="ปล่อยว่างเพื่อสุ่มรูปตัวอย่างให้อัตโนมัติ"
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                      />
                      <span className="text-[10px] text-gray-400 mt-1 block">
                        หากไม่ใส่ลิงก์ ระบบจะเลือกภาพมาตรฐานของประเภทรถให้โดยอัตโนมัติ
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">คำอธิบาย / หมายเหตุ</label>
                      <textarea
                        id="car-input-desc"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                        placeholder="รายละเอียดเพิ่มเติม เช่น มี Easy Pass, เติมน้ำมันเบนซิน 95 เท่านั้น"
                        className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                      />
                    </div>
                  </div>
                ) : (
                  /* Maintenance & Alerts Tab */
                  <div className="space-y-5">
                    {/* 1. Mileage section */}
                    <div className="bg-slate-50/80 border border-slate-200 p-4 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                        <Gauge className="w-4 h-4" />
                        <span>1. ข้อมูลเลขไมล์ & การเช็คระยะ</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            เลขไมล์ปัจจุบัน (กม.) <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="car-input-mileage"
                            type="number"
                            min={0}
                            value={currentMileage}
                            onChange={(e) => setCurrentMileage(e.target.value)}
                            placeholder="เช่น 45000"
                            className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                            required
                          />
                          <span className="text-[10px] text-gray-500 mt-1 block">
                            เลขกิโลเมตรบนหน้าปัดรถยนต์ปัจจุบัน
                          </span>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            แจ้งเตือนเมื่อเลขไมล์ถึง (กม.)
                          </label>
                          <input
                            id="car-input-mileage-threshold"
                            type="number"
                            min={0}
                            value={mileageAlertThreshold}
                            onChange={(e) => setMileageAlertThreshold(e.target.value)}
                            placeholder="เช่น 50000"
                            className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                          />
                          <span className="text-[10px] text-gray-500 mt-1 block">
                            กำหนดรอบเช็คระยะ/เปลี่ยนถ่ายน้ำมันเครื่อง
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 2. Tax section */}
                    <div className="bg-slate-50/80 border border-slate-200 p-4 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                        <Calendar className="w-4 h-4" />
                        <span>2. ภาษีรถยนต์ประจำปี & พ.ร.บ.</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            วันหมดอายุภาษีประจำปี
                          </label>
                          <input
                            id="car-input-tax-expiry"
                            type="date"
                            value={taxExpiryDate}
                            onChange={(e) => setTaxExpiryDate(e.target.value)}
                            className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                          />
                          <span className="text-[10px] text-gray-500 mt-1 block">
                            วันที่ระบุในป้ายภาษีหน้ารถ
                          </span>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            แจ้งเตือนล่วงหน้า (วัน)
                          </label>
                          <input
                            id="car-input-tax-alert-days"
                            type="number"
                            min={1}
                            max={90}
                            value={taxAlertDaysBefore}
                            onChange={(e) => setTaxAlertDaysBefore(e.target.value)}
                            placeholder="30"
                            className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                          />
                          <span className="text-[10px] text-gray-500 mt-1 block">
                            ค่าเริ่มต้นแจ้งเตือน 30 วันก่อนหมดอายุ
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Tires section */}
                    <div className="bg-slate-50/80 border border-slate-200 p-4 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                        <Disc className="w-4 h-4" />
                        <span>3. ข้อมูลยางรถยนต์ & รอบเปลี่ยนยาง</span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            ข้อมูลยางรถยนต์ / ยี่ห้อ / ขนาดยาง
                          </label>
                          <input
                            id="car-input-tire-info"
                            type="text"
                            value={tireInfo}
                            onChange={(e) => setTireInfo(e.target.value)}
                            placeholder="เช่น Michelin Primacy 4 (215/55R17)"
                            className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              วันที่เปลี่ยนยางล่าสุด
                            </label>
                            <input
                              id="car-input-tire-change-date"
                              type="date"
                              value={tireChangeDate}
                              onChange={(e) => setTireChangeDate(e.target.value)}
                              className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                            />
                            <span className="text-[10px] text-gray-500 mt-1 block">
                              บันทึกวันที่นำรถเข้าเปลี่ยนยางรอบล่าสุด
                            </span>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1">
                              แจ้งเตือนเปลี่ยนยางเมื่อเลขไมล์ถึง (กม.)
                            </label>
                            <input
                              id="car-input-tire-mileage"
                              type="number"
                              min={0}
                              value={tireAlertMileage}
                              onChange={(e) => setTireAlertMileage(e.target.value)}
                              placeholder="เช่น 60000"
                              className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                            />
                            <span className="text-[10px] text-gray-500 mt-1 block">
                              ระบบจะแจ้งเตือนเมื่อเลขไมล์ของรถวิ่งถึงระยะทางนี้
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit & Cancel Buttons */}
                <div className="flex items-center gap-3 pt-3 border-t border-gray-100 shrink-0">
                  <button
                    id="btn-cancel-vehicle"
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingVehicle(null);
                      resetForm();
                    }}
                    className="flex-1 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg transition-colors cursor-pointer text-center"
                  >
                    ยกเลิก
                  </button>
                  <button
                    id="btn-save-vehicle"
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-xs cursor-pointer text-center"
                  >
                    {editingVehicle ? 'บันทึกแก้ไขข้อมูล' : 'บันทึกเพิ่มรถใหม่'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Mileage Update Modal */}
      {quickMileageVehicle && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">อัปเดตเลขไมล์ด่วน</h3>
                <p className="text-xs text-gray-500 font-mono">
                  {quickMileageVehicle.brand} {quickMileageVehicle.model} ({quickMileageVehicle.plateNumber})
                </p>
              </div>
            </div>

            <form onSubmit={handleQuickMileageSave} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  เลขไมล์ปัจจุบัน (กิโลเมตร)
                </label>
                <input
                  id="input-quick-mileage-val"
                  type="number"
                  min={0}
                  value={quickMileageVal}
                  onChange={(e) => setQuickMileageVal(e.target.value)}
                  placeholder="เช่น 49500"
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-base font-mono font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                  autoFocus
                  required
                />
                {quickMileageVehicle.mileageAlertThreshold && (
                  <span className="text-[11px] text-gray-500 mt-1 block">
                    รอบเช็คระยะถัดไป: {quickMileageVehicle.mileageAlertThreshold.toLocaleString()} กม.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  id="btn-cancel-quick-mileage"
                  onClick={() => {
                    setQuickMileageVehicle(null);
                    setQuickMileageVal('');
                  }}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  id="btn-confirm-quick-mileage"
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
                >
                  บันทึกเลขไมล์
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Vehicle Custom Modal */}
      {deletingVehicle && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center font-bold text-lg shrink-0">
                🚘
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">ยืนยันลบข้อมูลรถยนต์</h3>
                <p className="text-xs text-gray-500">คุณต้องการลบรถคันนี้ออกจากระบบส่วนกลางใช่หรือไม่?</p>
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-gray-700 space-y-1">
              <p><strong className="font-semibold text-gray-900">ยี่ห้อ/รุ่น:</strong> {deletingVehicle.brand} {deletingVehicle.model}</p>
              <p><strong className="font-semibold text-gray-900">ทะเบียน:</strong> {deletingVehicle.plateNumber}</p>
              <p><strong className="font-semibold text-gray-900">ประเภท:</strong> {typeLabels[deletingVehicle.type] || deletingVehicle.type}</p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                id="btn-cancel-delete-vehicle"
                onClick={() => setDeletingVehicle(null)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                id="btn-confirm-delete-vehicle"
                onClick={() => {
                  onDeleteVehicle(deletingVehicle.id);
                  setDeletingVehicle(null);
                }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                ยืนยันลบรถ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
