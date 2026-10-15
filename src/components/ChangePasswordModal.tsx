import React, { useState, useMemo, useEffect } from 'react';
import { User, PasswordPolicy } from '../types';
import {
  validatePasswordAgainstPolicy,
  generatePasswordForPolicy,
  applyNewPasswordToUser,
  getUserPasswordExpiryInfo,
  formatThaiDateShort,
} from '../utils/passwordPolicyUtils';
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  X,
  LogOut,
  Clock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  user: User;
  policy: PasswordPolicy;
  isForced?: boolean;
  requireOldPassword?: boolean;
  reasonText?: string;
  onClose?: () => void;
  onLogout?: () => void;
  onSuccessChangePassword: (updatedUser: User) => Promise<void> | void;
}

export default function ChangePasswordModal({
  isOpen,
  user,
  policy,
  isForced = false,
  requireOldPassword = true,
  reasonText,
  onClose,
  onLogout,
  onSuccessChangePassword,
}: ChangePasswordModalProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [genOffset, setGenOffset] = useState(1);

  const shouldAskOldPassword = requireOldPassword && !isForced;

  useEffect(() => {
    if (isOpen) {
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setShowOldPass(false);
      setShowNewPass(false);
      setShowConfirmPass(false);
    }
  }, [isOpen, user.id]);

  const expiryInfo = useMemo(
    () => getUserPasswordExpiryInfo(user, policy),
    [user, policy]
  );

  const validation = useMemo(
    () => validatePasswordAgainstPolicy(newPassword, policy, user, true),
    [newPassword, policy, user]
  );

  if (!isOpen) return null;

  const handleAutoGenerate = () => {
    const generated = generatePasswordForPolicy(policy, user, genOffset);
    setGenOffset((prev) => prev + 1);
    setNewPassword(generated);
    setConfirmPassword(generated);
    setShowNewPass(true);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (shouldAskOldPassword) {
      if (!oldPassword) {
        setError('กรุณากรอกรหัสผ่านเดิม');
        return;
      }
      if (user.password && oldPassword !== user.password) {
        setError('รหัสผ่านเดิมไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
        return;
      }
      if (newPassword === oldPassword) {
        setError('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
        return;
      }
    }

    if (!newPassword) {
      setError('กรุณากรอกรหัสผ่านใหม่');
      return;
    }

    if (!validation.isValid) {
      setError(validation.errors[0] || 'รหัสผ่านใหม่ยังไม่ผ่านเงื่อนไขนโยบายรหัสผ่าน');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedFields = applyNewPasswordToUser(user, newPassword);
      const updatedUser: User = {
        ...user,
        ...updatedFields,
      };
      await onSuccessChangePassword(updatedUser);
      if (onClose && !isForced) {
        onClose();
      }
    } catch (err) {
      console.error('Failed to change password:', err);
      setError('เกิดข้อผิดพลาดในการบันทึกรหัสผ่านใหม่ กรุณาลองอีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        id="change-password-modal-backdrop"
        className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
        onClick={() => {
          if (!isForced && onClose) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-6"
        >
          {/* Header */}
          <div
            className={`p-5 text-white flex items-start justify-between gap-3 ${
              isForced
                ? 'bg-gradient-to-r from-rose-700 via-rose-800 to-slate-900'
                : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                  isForced
                    ? 'bg-rose-500/25 border-rose-400/40 text-rose-200'
                    : 'bg-indigo-500/25 border-indigo-400/40 text-indigo-200'
                }`}
              >
                {isForced ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <KeyRound className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {isForced
                    ? 'รหัสผ่านหมดอายุ - กรุณาตั้งรหัสผ่านใหม่'
                    : 'เปลี่ยนรหัสผ่าน (Change Password)'}
                </h3>
                <p className="text-xs text-slate-200 mt-0.5">
                  บัญชี: <strong>{user.name}</strong> (@{user.username || user.email.split('@')[0]})
                </p>
              </div>
            </div>

            {!isForced && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
            {/* Expiration Context Box */}
            <div
              className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
                isForced || expiryInfo.isExpired
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="font-bold flex items-center gap-1.5">
                <Clock className="w-4 h-4 shrink-0" />
                <span>
                  {reasonText ||
                    (expiryInfo.isExpired
                      ? `รหัสผ่านของคุณครบกำหนดหมดอายุ (${policy.expiryDays} วัน) กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน`
                      : policy.expiryDays > 0
                      ? `นโยบายรหัสผ่านหมดอายุทุก ${policy.expiryDays} วัน (เหลืออีก ${expiryInfo.daysRemaining} วัน)`
                      : 'ตั้งค่ารหัสผ่านใหม่ตามนโยบายความปลอดภัยของระบบ')}
                </span>
              </div>
              <div className="text-[11px] opacity-85 pl-5.5">
                เริ่มใช้รหัสผ่านล่าสุดเมื่อ: <strong>{formatThaiDateShort(expiryInfo.startDate)}</strong> (ใช้งานมาแล้ว {expiryInfo.daysElapsed} วัน)
                {expiryInfo.expiryDate && (
                  <>
                    {' '}• วันหมดอายุ: <strong>{formatThaiDateShort(expiryInfo.expiryDate)}</strong>
                  </>
                )}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Old Password Field (when required) */}
            {shouldAskOldPassword && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  รหัสผ่านเดิม (Old Password) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    id="input-change-old-password"
                    type={showOldPass ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านเดิมของคุณ"
                    className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPass(!showOldPass)}
                    className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    {showOldPass ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* New Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-800">
                  รหัสผ่านใหม่ (New Password) <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleAutoGenerate}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>ตั้งรหัสตามนโยบายอัตโนมัติ</span>
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                <input
                  id="input-change-new-password"
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านใหม่ตามเงื่อนไขด้านล่าง"
                  className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  {showNewPass ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm New Password Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                ยืนยันรหัสผ่านใหม่ (Confirm Password) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                <input
                  id="input-change-confirm-password"
                  type={showConfirmPass ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                  className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute right-3 top-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  {showConfirmPass ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Active Password Policy Checklist */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
              <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                <span>เงื่อนไขตามนโยบายรหัสผ่านที่ต้องผ่านครบทุกข้อ:</span>
                <span className="text-[10px] text-slate-500">
                  {policy.preventReuseCount > 0
                    ? `ห้ามซ้ำ ${policy.preventReuseCount} ครั้งล่าสุด`
                    : 'ตั้งรหัสซ้ำได้'}
                </span>
              </div>
              <div className="space-y-1.5">
                {validation.checks.map((chk) => (
                  <div
                    key={chk.key}
                    className={`flex items-center gap-2 text-xs font-medium ${
                      newPassword.length === 0
                        ? 'text-slate-500'
                        : chk.passed
                        ? 'text-emerald-700 font-semibold'
                        : 'text-rose-600'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                        newPassword.length === 0
                          ? 'bg-slate-200 text-slate-500'
                          : chk.passed
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-600'
                      }`}
                    >
                      {newPassword.length > 0 && chk.passed ? '✓' : '•'}
                    </span>
                    <span>{chk.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5 pt-2">
              {isForced && onLogout ? (
                <button
                  type="button"
                  onClick={onLogout}
                  className="px-4 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>ออกจากระบบ</span>
                </button>
              ) : (
                onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                )
              )}

              <button
                id="btn-submit-new-password"
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'กำลังบันทึก...'
                    : 'บันทึกรหัสผ่านใหม่'}
                </span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
