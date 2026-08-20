import React, { useState } from 'react';
import { Vehicle, VehicleType, VehicleStatus, User } from '../types';
import { Plus, Edit2, Trash2, ShieldAlert, SlidersHorizontal, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VehicleManagementProps {
  vehicles: Vehicle[];
  currentUser: User | null;
  onAddVehicle: (vehicle: Omit<Vehicle, 'id'>) => void;
  onEditVehicle: (vehicle: Vehicle) => void;
  onDeleteVehicle: (vehicleId: string) => void;
}

export default function VehicleManagement({
  vehicles,
  currentUser,
  onAddVehicle,
  onEditVehicle,
  onDeleteVehicle,
}: VehicleManagementProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  // Form Fields
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [type, setType] = useState<VehicleType>('Sedan');
  const [capacity, setCapacity] = useState<number>(5);
  const [status, setStatus] = useState<VehicleStatus>('Available');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);
  const [adminNotice, setAdminNotice] = useState<string | null>(null);

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
    setError('');
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
    setIsAdding(true);
  };

  const handleCapacityChange = (val: string) => {
    const num = parseInt(val, 10);
    setCapacity(isNaN(num) ? 5 : num);
  };

  const handleTypeChange = (newType: VehicleType) => {
    setType(newType);
    // Suggest standard capacities
    if (newType === 'Sedan') setCapacity(5);
    if (newType === 'SUV') setCapacity(7);
    if (newType === 'Van') setCapacity(11);
    if (newType === 'Pickup') setCapacity(5);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand.trim() || !model.trim() || !plateNumber.trim()) {
      setError('กรุณากรอกยี่ห้อ รุ่น และเลขทะเบียนรถยนต์');
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

    if (editingVehicle) {
      onEditVehicle({
        ...editingVehicle,
        brand,
        model,
        plateNumber,
        type,
        capacity,
        status,
        imageUrl: finalImageUrl,
        description,
      });
      setEditingVehicle(null);
    } else {
      onAddVehicle({
        brand,
        model,
        plateNumber,
        type,
        capacity,
        status,
        imageUrl: finalImageUrl,
        description,
      });
    }

    setIsAdding(false);
    resetForm();
  };

  // Filter logic
  const filteredVehicles = vehicles.filter((v) => {
    const matchType = typeFilter === 'All' || v.type === typeFilter;
    const matchStatus = statusFilter === 'All' || v.status === statusFilter;
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

  return (
    <div className="space-y-6" id="vehicle-management-section">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 tracking-tight">การจัดการกองรถยนต์ส่วนกลาง</h2>
          <p className="text-sm text-gray-500 mt-1">
            แก้ไขและเพิ่มข้อมูลรถยนต์ส่วนกลางในระบบเพื่อรองรับการจองเดินทางของพนักงาน
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
        </div>
      </div>

      {/* Vehicles Display Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVehicles.map((vehicle) => {
          return (
            <div
              key={vehicle.id}
              id={`vehicle-card-${vehicle.id}`}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group"
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
              </div>

              {/* Card Content */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-1">
                    <h4 className="font-bold text-gray-900 text-lg leading-tight">
                      {vehicle.brand} {vehicle.model}
                    </h4>
                    <span className="px-2 py-0.5 border border-indigo-100 bg-indigo-50 text-indigo-700 font-mono text-xs font-semibold rounded-md shrink-0">
                      {vehicle.plateNumber}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 line-clamp-2 h-8">
                    {vehicle.description || 'ไม่มีคำอธิบายเพิ่มเติมเกี่ยวกับยานพาหนะนี้'}
                  </p>

                  <div className="flex items-center gap-1 text-xs text-gray-600 bg-slate-50 p-2 rounded-lg">
                    <span className="font-semibold">ความจุผู้โดยสาร:</span>
                    <span>{vehicle.capacity} ที่นั่งหลัก (รวมคนขับ)</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 border-t border-gray-100 pt-4 mt-4">
                  <button
                    id={`btn-edit-vehicle-icon-${vehicle.id}`}
                    onClick={() => {
                      startEdit(vehicle);
                    }}
                    className="flex-1 py-1.5 px-3 border border-gray-200 hover:bg-slate-50 text-gray-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>แก้ไขรถ</span>
                  </button>
                  <button
                    id={`btn-delete-vehicle-icon-${vehicle.id}`}
                    onClick={() => {
                      setDeletingVehicle(vehicle);
                    }}
                    className="py-1.5 px-3 border border-red-100 text-red-600 hover:bg-red-50/50 hover:border-red-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Vehicle Modal Dialog */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 my-8 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                    {editingVehicle ? '✏️' : '🚗'}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">
                      {editingVehicle ? 'แก้ไขข้อมูลรถยนต์' : 'เพิ่มรถยนต์คันใหม่'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {editingVehicle ? `ทะเบียน: ${editingVehicle.plateNumber}` : 'กรอกรายละเอียดรถยนต์เพื่อเปิดใช้งานระบบจอง'}
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

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">ยี่ห้อ (Brand) <span className="text-red-500">*</span></label>
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
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">รุ่น (Model) <span className="text-red-500">*</span></label>
                    <input
                      id="car-input-model"
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="เช่น Camry"
                      className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">ป้ายทะเบียน <span className="text-red-500">*</span></label>
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
                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">ความจุ (ที่นั่ง) <span className="text-red-500">*</span></label>
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
                    ระบบจะเลือกรูปสวยงามจาก Unsplash ให้หากคุณไม่ได้ใส่ลิงก์
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">คำอธิบาย / หมายเหตุ</label>
                  <textarea
                    id="car-input-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    placeholder="รายละเอียดเพิ่มเติม เช่น มี Easy Pass, น้ำมันเต็มถัง"
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden"
                  />
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
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
                    {editingVehicle ? 'บันทึกแก้ไข' : 'เพิ่มรถใหม่'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
