import React, { useState } from 'react';
import { User } from '../types';
import { Plus, UserCheck, Shield, Trash2, Edit2, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserRegistrationProps {
  users: User[];
  currentUser: User | null;
  onSelectUser: (user: User) => void;
  onAddUser: (user: Omit<User, 'id'>) => void;
  onEditUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
}

export default function UserRegistration({
  users,
  currentUser,
  onSelectUser,
  onAddUser,
  onEditUser,
  onDeleteUser,
}: UserRegistrationProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'User' | 'Admin'>('User');
  const [error, setError] = useState('');

  const resetForm = () => {
    setName('');
    setDepartment('');
    setPhone('');
    setEmail('');
    setRole('User');
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !department.trim() || !phone.trim() || !email.trim()) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วนทุกช่อง');
      return;
    }

    if (isEditing) {
      onEditUser({
        ...isEditing,
        name,
        department,
        phone,
        email,
        role,
      });
      setIsEditing(null);
    } else {
      onAddUser({
        name,
        department,
        phone,
        email,
        role,
      });
    }

    setIsAdding(false);
    resetForm();
  };

  const startEdit = (user: User) => {
    setIsEditing(user);
    setName(user.name);
    setDepartment(user.department);
    setPhone(user.phone);
    setEmail(user.email);
    setRole(user.role);
    setIsAdding(true);
  };

  const departmentsList = [
    'ฝ่ายขาย (Sales)',
    'ฝ่ายบุคคล (HR)',
    'ฝ่ายไอที (IT Support)',
    'ฝ่ายจัดซื้อ (Procurement)',
    'ฝ่ายบริหาร (Management)',
    'ฝ่ายบัญชีและการเงิน (Accounting)',
    'ฝ่ายการตลาด (Marketing)',
    'ฝ่ายปฏิบัติการ (Operations)',
  ];

  return (
    <div className="space-y-6" id="user-registration-section">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 tracking-tight">ลงทะเบียนและจัดการผู้ใช้งาน</h2>
          <p className="text-sm text-gray-500 mt-1">
            ลงทะเบียนพนักงานเพื่อรับสิทธิ์ในการจองรถยนต์ส่วนกลาง และเลือกผู้ใช้งานปัจจุบันเพื่อจำลองการทำรายการ
          </p>
        </div>
        <button
          id="btn-add-new-user"
          onClick={() => {
            setIsEditing(null);
            resetForm();
            setIsAdding(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>ลงทะเบียนพนักงานใหม่</span>
        </button>
      </div>

      {/* Active User Banner */}
      {currentUser && (
        <div id="active-user-banner" className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              {currentUser.name.substring(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 text-base">{currentUser.name}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-medium rounded-full">
                  {currentUser.role === 'Admin' ? (
                    <>
                      <Shield className="w-3 h-3" /> ผู้ดูแลระบบ
                    </>
                  ) : (
                    'พนักงานทั่วไป'
                  )}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-0.5">
                {currentUser.department} • โทร: {currentUser.phone} • อีเมล: {currentUser.email}
              </p>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-indigo-100/50 text-xs font-medium text-indigo-700">
            🟢 โปรไฟล์ที่ใช้งานอยู่ขณะนี้ (สามารถเลือกเปลี่ยนได้ด้านล่าง)
          </div>
        </div>
      )}

      {/* Grid containing registration form and users list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Selection and Management List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-medium text-gray-900 text-md">รายชื่อผู้ใช้งานทั้งหมด ({users.length} คน)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {users.map((user) => {
              const isActive = currentUser?.id === user.id;
              return (
                <div
                  key={user.id}
                  id={`user-card-${user.id}`}
                  className={`relative p-5 rounded-xl border transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-50/40 border-indigo-400 ring-2 ring-indigo-400/20'
                      : 'bg-white border-gray-200 hover:border-gray-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white ${
                        user.role === 'Admin' ? 'bg-purple-600' : 'bg-slate-500'
                      }`}>
                        {user.name.substring(0, 2)}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{user.name}</h4>
                        <span className="text-xs text-gray-500 font-medium">{user.department}</span>
                      </div>
                    </div>
                    {user.role === 'Admin' && (
                      <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-sm border border-purple-100 uppercase tracking-wider">
                        Admin
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-gray-600 mb-4 border-t border-gray-100 pt-3">
                    <p><span className="text-gray-400 font-medium">เบอร์โทร:</span> {user.phone}</p>
                    <p><span className="text-gray-400 font-medium">อีเมล:</span> {user.email}</p>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-gray-50 pt-3">
                    <button
                      id={`btn-use-profile-${user.id}`}
                      onClick={() => onSelectUser(user)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{isActive ? 'กำลังใช้งาน' : 'เลือกโปรไฟล์นี้'}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        id={`btn-edit-user-${user.id}`}
                        onClick={() => startEdit(user)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                        title="แก้ไขข้อมูล"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id={`btn-delete-user-${user.id}`}
                        onClick={() => {
                          if (confirm(`คุณต้องการลบผู้ใช้งาน ${user.name} ใช่หรือไม่?`)) {
                            onDeleteUser(user.id);
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                        title="ลบผู้ใช้"
                        disabled={isActive && users.length > 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating Modal-like sidebar for Add/Edit form */}
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4 h-fit"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="font-semibold text-gray-900 text-md">
                  {isEditing ? 'แก้ไขข้อมูลพนักงาน' : 'ลงทะเบียนพนักงานใหม่'}
                </h3>
                <button
                  id="btn-close-user-form"
                  onClick={() => {
                    setIsAdding(false);
                    setIsEditing(null);
                    resetForm();
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
                  <input
                    id="user-input-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="เช่น สมชาย สุขสบาย"
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">แผนก / ฝ่ายงาน <span className="text-red-500">*</span></label>
                  <select
                    id="user-input-dept"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-hidden bg-white"
                    required
                  >
                    <option value="">เลือกแผนก...</option>
                    {departmentsList.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                  <input
                    id="user-input-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="เช่น 081-234-5678"
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">อีเมลหน่วยงาน <span className="text-red-500">*</span></label>
                  <input
                    id="user-input-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="เช่น somchai.j@company.com"
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">บทบาทการใช้งาน</label>
                  <div className="flex gap-4 mt-1.5">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        checked={role === 'User'}
                        onChange={() => setRole('User')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>พนักงานทั่วไป (User)</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        checked={role === 'Admin'}
                        onChange={() => setRole('Admin')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>ผู้ดูแลระบบ (Admin)</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                  <button
                    id="btn-cancel-user-form"
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setIsEditing(null);
                      resetForm();
                    }}
                    className="flex-1 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg transition-colors cursor-pointer text-center"
                  >
                    ยกเลิก
                  </button>
                  <button
                    id="btn-submit-user-form"
                    type="submit"
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-xs cursor-pointer text-center"
                  >
                    {isEditing ? 'บันทึกการแก้ไข' : 'ลงทะเบียน'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
