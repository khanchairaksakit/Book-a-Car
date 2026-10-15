import React, { useState, useEffect, useMemo } from 'react';
import { User, PasswordPolicy } from '../types';
import {
  getUserPasswordExpiryInfo,
  formatThaiDateShort,
} from '../utils/passwordPolicyUtils';
import {
  getUserRoles,
  getRoleBadgeInfo,
  isUserAdmin,
} from '../utils/userHelpers';
import {
  X,
  User as UserIcon,
  Phone,
  Mail,
  Building,
  KeyRound,
  Shield,
  Clock,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Save,
  MessageCircle,
  Hash,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  policy: PasswordPolicy;
  onSaveUser: (updatedUser: User) => Promise<void> | void;
  onOpenChangePasswordModal: () => void;
}

export default function UserProfileModal({
  isOpen,
  onClose,
  currentUser,
  policy,
  onSaveUser,
  onOpenChangePasswordModal,
}: UserProfileModalProps) {
  // Form states (editable by user)
  const [name, setName] = useState(currentUser.name || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [lineUserId, setLineUserId] = useState(currentUser.lineUserId || '');

  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state whenever modal opens or currentUser updates
  useEffect(() => {
    if (isOpen) {
      setName(currentUser.name || '');
      setPhone(currentUser.phone || '');
      setEmail(currentUser.email || '');
      setLineUserId(currentUser.lineUserId || '');
      setError('');
    }
  }, [isOpen, currentUser]);

  const expiryInfo = useMemo(
    () => getUserPasswordExpiryInfo(currentUser, policy),
    [currentUser, policy]
  );

  const roles = useMemo(() => getUserRoles(currentUser), [currentUser]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('กรุณากรอกชื่อ-นามสกุล');
      return;
    }

    if (!phone.trim()) {
      setError('กรุณากรอกเบอร์โทรศัพท์');
      return;
    }

    if (!email.trim()) {
      setError('กรุณากรอกอีเมล');
      return;
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }

    setIsSaving(true);
    try {
      const updatedUser: User = {
        ...currentUser,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        lineUserId: lineUserId.trim() || undefined,
      };

      await onSaveUser(updatedUser);
      onClose();
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        id="user-profile-modal-backdrop"
        className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 sm:p-6 text-white flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/90 text-white flex items-center justify-center font-bold text-base shadow-inner border border-indigo-400/30">
                {currentUser.name ? currentUser.name.substring(0, 2) : 'US'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    โปรไฟล์ผู้ใช้งาน (User Profile)
                  </h3>
                  {isUserAdmin(currentUser) && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/25 border border-purple-400/40 text-purple-200">
                      <Shield className="w-3 h-3" />
                      Admin
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {roles.map((r) => {
                    const b = getRoleBadgeInfo(r, false);
                    return (
                      <span
                        key={r}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/10 text-slate-200 border border-white/10"
                      >
                        {b.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="button"
              id="close-user-profile-modal-btn"
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Password Expiry Alert inside Profile */}
            {expiryInfo.expiryDays > 0 && (
              <div
                className={`p-3.5 rounded-2xl border text-xs flex items-start justify-between gap-3 ${
                  expiryInfo.isExpired
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : expiryInfo.isExpiringSoon
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {expiryInfo.isExpired ? (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  ) : expiryInfo.isExpiringSoon ? (
                    <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold">
                      {expiryInfo.isExpired
                        ? 'รหัสผ่านของคุณหมดอายุแล้ว'
                        : expiryInfo.isExpiringSoon
                        ? `แจ้งเตือน: รหัสผ่านใกล้หมดอายุ (เหลืออีก ${expiryInfo.daysRemaining} วัน)`
                        : `รหัสผ่านมีผลใช้งานปกติ (เหลืออีก ${expiryInfo.daysRemaining} วัน)`}
                    </div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      เปลี่ยนล่าสุด: <strong>{formatThaiDateShort(expiryInfo.startDate)}</strong>
                      {expiryInfo.expiryDate && (
                        <> • วันหมดอายุ: <strong>{formatThaiDateShort(expiryInfo.expiryDate)}</strong></>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenChangePasswordModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-xl transition-colors cursor-pointer shrink-0 shadow-2xs"
                >
                  <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                  <span>เปลี่ยนรหัสผ่าน</span>
                </button>
              </div>
            )}

            {/* Profile Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* รหัสพนักงาน (เปลี่ยนเองไม่ได้) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  <span>รหัสพนักงาน</span>
                  <span className="text-[10px] text-slate-400 font-normal">(เปลี่ยนเองไม่ได้)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={currentUser.employeeCode || '-'}
                    disabled
                    readOnly
                    className="w-full pl-3 pr-8 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono text-slate-500 cursor-not-allowed select-none"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                </div>
              </div>

              {/* Username สำหรับเข้าสู่ระบบ (เปลี่ยนเองไม่ได้) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Username สำหรับเข้าสู่ระบบ</span>
                  <span className="text-[10px] text-slate-400 font-normal">(สำหรับล็อกอิน)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={currentUser.username || currentUser.email.split('@')[0]}
                    disabled
                    readOnly
                    className="w-full pl-3 pr-8 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono text-slate-500 cursor-not-allowed select-none"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                </div>
              </div>

              {/* ชื่อ-นามสกุล (เปลี่ยนเองได้) */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-indigo-600" />
                    <span>ชื่อ-นามสกุล</span>
                    <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[10px] text-indigo-600 font-semibold">(แก้ไขเองได้)</span>
                </label>
                <input
                  id="profile-input-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="กรอกชื่อและนามสกุล"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs font-medium"
                  required
                />
              </div>

              {/* เบอร์โทร (เปลี่ยนเองได้ - หน้านี้แสดงเบอร์จริง) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-indigo-600" />
                    <span>เบอร์โทรศัพท์</span>
                    <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[10px] text-indigo-600 font-semibold">(แก้ไขเองได้)</span>
                </label>
                <input
                  id="profile-input-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="เช่น 086-553-2511"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  required
                />
                <p className="text-[10px] text-slate-500">
                  * หน้าโปรไฟล์แสดงเบอร์จริงของคุณ (ในหน้าอื่นๆ ระบบจะซ่อนเบอร์เป็น 08x-xxx-x511 เพื่อความปลอดภัย)
                </p>
              </div>

              {/* อีเมล (เปลี่ยนเองได้) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-600" />
                    <span>อีเมล</span>
                    <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[10px] text-indigo-600 font-semibold">(แก้ไขเองได้)</span>
                </label>
                <input
                  id="profile-input-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="เช่น user@company.com"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                  required
                />
              </div>

              {/* แผนก (เปลี่ยนเองไม่ได้) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>แผนก</span>
                  <span className="text-[10px] text-slate-400 font-normal">(เปลี่ยนเองไม่ได้)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={currentUser.department || '-'}
                    disabled
                    readOnly
                    className="w-full pl-3 pr-8 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 cursor-not-allowed select-none"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                </div>
              </div>

              {/* ฝ่าย (เปลี่ยนเองไม่ได้) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>ฝ่าย</span>
                  <span className="text-[10px] text-slate-400 font-normal">(เปลี่ยนเองไม่ได้)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={currentUser.division || '-'}
                    disabled
                    readOnly
                    className="w-full pl-3 pr-8 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 cursor-not-allowed select-none"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                </div>
              </div>

              {/* ID Line (แก้ไขเองได้) */}
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ID Line (LINE User ID)</span>
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold">(แก้ไขเองได้)</span>
                </label>
                <input
                  id="profile-input-line-id"
                  type="text"
                  value={lineUserId}
                  onChange={(e) => setLineUserId(e.target.value)}
                  placeholder="กรอก ID Line หรือ LINE User ID เพื่อรับแจ้งเตือนอนุมัติ"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-2xs font-mono"
                />
                <p className="text-[10px] text-slate-500">
                  * ใช้สำหรับรับข้อความแจ้งเตือนผลการจองและการอนุมัติใบงานผ่าน LINE
                </p>
              </div>
            </div>

            {/* Change Password Button Section */}
            <div className="pt-2 border-t border-slate-100">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      ความปลอดภัยและรหัสผ่าน
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      ต้องการเปลี่ยนรหัสผ่านใหม่? กดปุ่มเพื่อเปิดหน้าต่างเปลี่ยนรหัสผ่าน
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  id="btn-open-change-password-popup"
                  onClick={onOpenChangePasswordModal}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-xl transition-all cursor-pointer shadow-2xs shrink-0"
                >
                  <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                  <span>เปลี่ยนรหัสผ่าน</span>
                </button>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                id="btn-cancel-profile"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                id="btn-save-profile"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลส่วนตัว'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
