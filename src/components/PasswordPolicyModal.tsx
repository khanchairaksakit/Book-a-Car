import React, { useState, useEffect, useMemo } from 'react';
import {
  PasswordPolicy,
  PreventReuseOption,
  PasswordExpiryDaysOption,
  User,
} from '../types';
import {
  PREVENT_REUSE_OPTIONS,
  PASSWORD_EXPIRY_DAYS_OPTIONS,
  MAX_FAILED_ATTEMPTS_OPTIONS,
  DEFAULT_PASSWORD_POLICY,
  validatePasswordAgainstPolicy,
  generatePasswordForPolicy,
  getUserPasswordExpiryInfo,
  formatThaiDateShort,
  getUserPasswordHistoryList,
  getUserLockoutStatus,
} from '../utils/passwordPolicyUtils';
import {
  Shield,
  ShieldAlert,
  Lock,
  KeyRound,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  X,
  Calendar,
  History,
  UserCheck,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PasswordPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  policy: PasswordPolicy;
  users: User[];
  canEdit: boolean;
  onSavePolicy: (
    newPolicy: PasswordPolicy,
    updatedUsers?: User[]
  ) => Promise<void> | void;
}

export default function PasswordPolicyModal({
  isOpen,
  onClose,
  policy,
  users,
  canEdit,
  onSavePolicy,
}: PasswordPolicyModalProps) {
  const [draftPolicy, setDraftPolicy] = useState<PasswordPolicy>(policy);
  const [userStartDates, setUserStartDates] = useState<Record<string, string>>({});
  const [autoApplyCompliantPassword, setAutoApplyCompliantPassword] = useState<boolean>(true);
  const [testPassword, setTestPassword] = useState<string>('');
  const [visibleUserPass, setVisibleUserPass] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      setDraftPolicy(policy);
      const initialDates: Record<string, string> = {};
      users.forEach((u) => {
        const info = getUserPasswordExpiryInfo(u, policy);
        initialDates[u.id] = info.startDateIso.substring(0, 10);
      });
      setUserStartDates(initialDates);
      setTestPassword(generatePasswordForPolicy(policy));
      setSavedSuccess('');
    }
  }, [isOpen, policy, users]);

  // Update sample test password automatically whenever character policy checkboxes change
  useEffect(() => {
    if (!isOpen) return;
    setTestPassword(generatePasswordForPolicy(draftPolicy));
  }, [
    isOpen,
    draftPolicy.requireLowercase,
    draftPolicy.requireUppercase,
    draftPolicy.requireSpecialChar,
    draftPolicy.requireNumber,
  ]);

  const sampleCompliantPassword = useMemo(
    () => generatePasswordForPolicy(draftPolicy),
    [draftPolicy]
  );

  const testValidation = useMemo(
    () => validatePasswordAgainstPolicy(testPassword, draftPolicy, null, false),
    [testPassword, draftPolicy]
  );

  // Compute per-user password status & sort by who expires first ("หาก user ไหนหมดอายุก่อนก็ต้องเปลี่ยนรหัสก่อน")
  const sortedUserStatuses = useMemo(() => {
    const list = users.map((u) => {
      const customDateStr = userStartDates[u.id];
      const effectiveUser: User = customDateStr
        ? { ...u, passwordUpdatedAt: `${customDateStr}T09:00:00.000Z` }
        : u;
      const expiryInfo = getUserPasswordExpiryInfo(effectiveUser, draftPolicy);
      const charValidation = validatePasswordAgainstPolicy(
        u.password || 'password123',
        draftPolicy,
        u,
        false
      );
      const historyCount = getUserPasswordHistoryList(u).length;
      return {
        user: effectiveUser,
        expiryInfo,
        charValidation,
        historyCount,
      };
    });

    // Sort order: when expiryDays > 0, sort by earliest expiryDate (most expired / fewest days remaining first)
    return list.sort((a, b) => {
      if (draftPolicy.expiryDays > 0) {
        const aRem = a.expiryInfo.daysRemaining ?? 999999;
        const bRem = b.expiryInfo.daysRemaining ?? 999999;
        if (aRem !== bRem) return aRem - bRem;
      }
      return a.user.name.localeCompare(b.user.name, 'th');
    });
  }, [users, userStartDates, draftPolicy]);

  const nonCompliantUsersCount = useMemo(
    () => sortedUserStatuses.filter((item) => !item.charValidation.isValid).length,
    [sortedUserStatuses]
  );

  const expiredUsersCount = useMemo(
    () => sortedUserStatuses.filter((item) => item.expiryInfo.isExpired).length,
    [sortedUserStatuses]
  );

  if (!isOpen) return null;

  const handleToggleRule = (
    key: 'requireLowercase' | 'requireUppercase' | 'requireSpecialChar' | 'requireNumber'
  ) => {
    if (!canEdit) return;
    setDraftPolicy((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSelectPreventReuse = (val: PreventReuseOption) => {
    if (!canEdit) return;
    setDraftPolicy((prev) => ({
      ...prev,
      preventReuseCount: val,
    }));
  };

  const [unlockedUserIds, setUnlockedUserIds] = useState<string[]>([]);

  const handleSelectExpiryDays = (val: PasswordExpiryDaysOption) => {
    if (!canEdit) return;
    setDraftPolicy((prev) => ({
      ...prev,
      expiryDays: val,
    }));
  };

  const handleSelectMaxFailedAttempts = (val: number) => {
    if (!canEdit) return;
    setDraftPolicy((prev) => ({
      ...prev,
      maxFailedAttempts: Math.max(0, val),
    }));
  };

  const handleUnlockUser = (userId: string) => {
    if (!canEdit) return;
    setUnlockedUserIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setIsSaving(true);
    try {
      const updatedUsersList: User[] = [];

      users.forEach((u) => {
        const dateStr = userStartDates[u.id];
        const nextPasswordUpdatedAt = dateStr
          ? `${dateStr}T09:00:00.000Z`
          : u.passwordUpdatedAt || new Date().toISOString();

        const currentPass = u.password || 'password123';
        const check = validatePasswordAgainstPolicy(currentPass, draftPolicy, u, false);

        let nextPassword = currentPass;
        let nextHistory = getUserPasswordHistoryList(u);

        if (autoApplyCompliantPassword && !check.isValid) {
          nextPassword = generatePasswordForPolicy(draftPolicy, u);
          nextHistory = [nextPassword, ...nextHistory].slice(0, 15);
        }

        const dateChanged = nextPasswordUpdatedAt !== u.passwordUpdatedAt;
        const passChanged = nextPassword !== u.password;
        const historyMissing = !Array.isArray(u.passwordHistory) || u.passwordHistory.length === 0;
        const isExplicitlyUnlocked = unlockedUserIds.includes(u.id);
        const lockChanged = isExplicitlyUnlocked && (u.isLocked || (u.failedLoginAttempts ?? 0) > 0);

        if (dateChanged || passChanged || historyMissing || lockChanged) {
          updatedUsersList.push({
            ...u,
            password: nextPassword,
            passwordUpdatedAt: nextPasswordUpdatedAt,
            passwordHistory: nextHistory,
            ...(isExplicitlyUnlocked
              ? { isLocked: false, failedLoginAttempts: 0, lockedAt: undefined, lockedReason: undefined }
              : {}),
          });
        }
      });

      const finalPolicy: PasswordPolicy = {
        ...draftPolicy,
        updatedAt: new Date().toISOString(),
      };

      await onSavePolicy(
        finalPolicy,
        updatedUsersList.length > 0 ? updatedUsersList : undefined
      );

      setSavedSuccess('บันทึกการตั้งค่านโยบายรหัสผ่านสำหรับผู้ใช้งานทั้งหมดเรียบร้อยแล้ว');
      setTimeout(() => {
        setSavedSuccess('');
        onClose();
      }, 900);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefault = () => {
    if (!canEdit) return;
    setDraftPolicy({ ...DEFAULT_PASSWORD_POLICY });
  };

  const activeCount =
    (draftPolicy.requireLowercase ? 1 : 0) +
    (draftPolicy.requireUppercase ? 1 : 0) +
    (draftPolicy.requireSpecialChar ? 1 : 0) +
    (draftPolicy.requireNumber ? 1 : 0) +
    (draftPolicy.preventReuseCount > 0 ? 1 : 0) +
    (draftPolicy.expiryDays > 0 ? 1 : 0) +
    ((draftPolicy.maxFailedAttempts ?? 0) > 0 ? 1 : 0);

  return (
    <AnimatePresence>
      <div
        id="password-policy-modal-backdrop"
        className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 max-h-[92vh] flex flex-col"
        >
          {/* Modal Header */}
          <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-start sm:items-center justify-between gap-4 shrink-0">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0 shadow-inner">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">
                    นโยบายรหัสผ่านของระบบ (System Password Policy)
                  </h3>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/25 text-amber-200 border border-amber-400/30">
                    เปิดใช้งาน {activeCount} เงื่อนไข
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  ตั้งค่าการกำหนดรหัสผ่านของ User ทั้งหมดบนระบบ (สามารถเลือกตัวเลือกได้มากกว่า 1 ข้อ และระบบจะบังคับใช้ตามที่เลือกเสมอ)
                </p>
              </div>
            </div>

            <button
              id="btn-close-password-policy-modal"
              type="button"
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Success Banner */}
          {savedSuccess && (
            <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2 shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{savedSuccess}</span>
            </div>
          )}

          {/* Modal Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
            {/* Section 1: 4 Character Composition Checkboxes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-indigo-600" />
                    <span>1. เงื่อนไของค์ประกอบตัวอักษรในรหัสผ่าน (เลือกได้มากกว่า 1 ข้อ)</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ติ๊กเลือกข้อกำหนดที่ต้องการให้รหัสผ่านของ User ทุกคนต้องมีอย่างน้อย 1 ตัวอักษรในแต่ละหมวดที่เลือก
                  </p>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setDraftPolicy((prev) => ({
                          ...prev,
                          requireLowercase: true,
                          requireUppercase: true,
                          requireSpecialChar: true,
                          requireNumber: true,
                        }))
                      }
                      className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                    >
                      เลือกครบทั้ง 4 ข้อ
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: ตัวอักษรอังกฤษ ตัวเล็ก */}
                <label
                  id="policy-option-lowercase"
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all ${
                    !canEdit ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                  } ${
                    draftPolicy.requireLowercase
                      ? 'bg-indigo-50/70 border-indigo-400 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    id="checkbox-policy-lowercase"
                    type="checkbox"
                    checked={draftPolicy.requireLowercase}
                    disabled={!canEdit}
                    onChange={() => handleToggleRule('requireLowercase')}
                    className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        ตัวอักษรอังกฤษ ตัวเล็ก
                      </span>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-indigo-700">
                        a - z
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      ต้องมีตัวอักษรภาษาอังกฤษพิมพ์เล็กอย่างน้อย 1 ตัว (เช่น a, b, c)
                    </p>
                  </div>
                </label>

                {/* Option 2: ตัวอักษรอังกฤษ ตัวใหญ่ */}
                <label
                  id="policy-option-uppercase"
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all ${
                    !canEdit ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                  } ${
                    draftPolicy.requireUppercase
                      ? 'bg-indigo-50/70 border-indigo-400 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    id="checkbox-policy-uppercase"
                    type="checkbox"
                    checked={draftPolicy.requireUppercase}
                    disabled={!canEdit}
                    onChange={() => handleToggleRule('requireUppercase')}
                    className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        ตัวอักษรอังกฤษ ตัวใหญ่
                      </span>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-indigo-700">
                        A - Z
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      ต้องมีตัวอักษรภาษาอังกฤษพิมพ์ใหญ่อย่างน้อย 1 ตัว (เช่น A, B, C)
                    </p>
                  </div>
                </label>

                {/* Option 3: อักขระพิเศษ */}
                <label
                  id="policy-option-special"
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all ${
                    !canEdit ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                  } ${
                    draftPolicy.requireSpecialChar
                      ? 'bg-indigo-50/70 border-indigo-400 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    id="checkbox-policy-special"
                    type="checkbox"
                    checked={draftPolicy.requireSpecialChar}
                    disabled={!canEdit}
                    onChange={() => handleToggleRule('requireSpecialChar')}
                    className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        อักขระพิเศษ
                      </span>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-indigo-700">
                        ! @ # $ %
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      ต้องมีเครื่องหมายหรืออักขระพิเศษอย่างน้อย 1 ตัว (เช่น !@#$%^&*_-+=)
                    </p>
                  </div>
                </label>

                {/* Option 4: ตัวเลข */}
                <label
                  id="policy-option-number"
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all ${
                    !canEdit ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                  } ${
                    draftPolicy.requireNumber
                      ? 'bg-indigo-50/70 border-indigo-400 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    id="checkbox-policy-number"
                    type="checkbox"
                    checked={draftPolicy.requireNumber}
                    disabled={!canEdit}
                    onChange={() => handleToggleRule('requireNumber')}
                    className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        ตัวเลข
                      </span>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-indigo-700">
                        0 - 9
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      ต้องมีตัวเลขอารบิก (0-9) อย่างน้อย 1 ตัว
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Section 2: ห้ามซ้ำกัน xx ครั้ง (0, 3, 5, 7) & รหัสผ่านหมดอายุ xx วัน (0, 30, 60, 90, 180) & ล็อคบัญชีเมื่อใส่รหัสผิด xx ครั้ง */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Option 5: ห้ามซ้ำกัน xx ครั้ง */}
              <div
                id="policy-option-prevent-reuse"
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  draftPolicy.preventReuseCount > 0
                    ? 'bg-amber-50/50 border-amber-300 shadow-2xs'
                    : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      id="checkbox-policy-prevent-reuse"
                      type="checkbox"
                      checked={draftPolicy.preventReuseCount > 0}
                      disabled={!canEdit}
                      onChange={(e) =>
                        handleSelectPreventReuse(e.target.checked ? 3 : 0)
                      }
                      className="mt-0.5 w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <History className="w-4 h-4 text-amber-600" />
                        <span>
                          ห้ามซ้ำกัน{' '}
                          <strong className="text-amber-700 font-mono">
                            {draftPolicy.preventReuseCount}
                          </strong>{' '}
                          ครั้ง
                        </span>
                      </span>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        ตัวเลือก <strong>0, 3, 5, 7</strong> ครั้ง (หากเลือกเป็น{' '}
                        <strong>0</strong> สามารถตั้งรหัสผ่านซ้ำกันได้เสมอ)
                      </p>
                    </div>
                  </label>
                </div>

                {/* Button Selectors for 0, 3, 5, 7 */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {PREVENT_REUSE_OPTIONS.map((opt) => {
                    const isSelected = draftPolicy.preventReuseCount === opt;
                    return (
                      <button
                        key={opt}
                        id={`btn-prevent-reuse-${opt}`}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => handleSelectPreventReuse(opt)}
                        className={`py-2 px-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center ${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300 hover:bg-amber-50/40'
                        }`}
                      >
                        <span className="font-mono text-xs sm:text-sm">{opt} ครั้ง</span>
                        <span
                          className={`text-[9px] font-medium truncate max-w-full ${
                            isSelected ? 'text-amber-100' : 'text-slate-400'
                          }`}
                        >
                          {opt === 0 ? 'ซ้ำได้เสมอ' : `ห้ามซ้ำ ${opt} รอบ`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Option 6: รหัสผ่านหมดอายุ xx วัน */}
              <div
                id="policy-option-expiry-days"
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  draftPolicy.expiryDays > 0
                    ? 'bg-rose-50/50 border-rose-300 shadow-2xs'
                    : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      id="checkbox-policy-expiry-days"
                      type="checkbox"
                      checked={draftPolicy.expiryDays > 0}
                      disabled={!canEdit}
                      onChange={(e) =>
                        handleSelectExpiryDays(e.target.checked ? 30 : 0)
                      }
                      className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-rose-600" />
                        <span>
                          รหัสผ่านหมดอายุ{' '}
                          <strong className="text-rose-700 font-mono">
                            {draftPolicy.expiryDays}
                          </strong>{' '}
                          วัน
                        </span>
                      </span>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        ตัวเลือก <strong>0, 30, 60, 90, 180</strong> วัน (เลือก <strong>0</strong> = ไม่มีวันหมดอายุ)
                      </p>
                    </div>
                  </label>
                </div>

                {/* Button Selectors for 0, 30, 60, 90, 180 */}
                <div className="grid grid-cols-5 gap-1 pt-1">
                  {PASSWORD_EXPIRY_DAYS_OPTIONS.map((opt) => {
                    const isSelected = draftPolicy.expiryDays === opt;
                    return (
                      <button
                        key={opt}
                        id={`btn-expiry-days-${opt}`}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => handleSelectExpiryDays(opt)}
                        className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center ${
                          isSelected
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300 hover:bg-rose-50/40'
                        }`}
                      >
                        <span className="font-mono text-xs">{opt} วัน</span>
                        <span
                          className={`text-[9px] font-medium truncate max-w-full ${
                            isSelected ? 'text-rose-100' : 'text-slate-400'
                          }`}
                        >
                          {opt === 0 ? 'ไม่หมดอายุ' : `${opt} วัน`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Direct Numeric Input Box for Expiry Days */}
                <div className="pt-2 border-t border-rose-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-700">
                    หรือกรอกจำนวนวันหมดอายุเอง:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      id="input-policy-expiry-days"
                      type="number"
                      min={0}
                      max={365}
                      disabled={!canEdit}
                      value={draftPolicy.expiryDays}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        const clean = isNaN(v) ? 0 : Math.max(0, v);
                        handleSelectExpiryDays(clean as any);
                      }}
                      className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-xs font-mono font-bold text-center bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500 shadow-2xs"
                    />
                    <span className="text-xs text-slate-500 font-medium">วัน</span>
                  </div>
                </div>
              </div>

              {/* Option 7: กำหนดใส่รหัสผิดกี่ครั้ง User นั้นถึง Lock */}
              <div
                id="policy-option-max-failed-attempts"
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  (draftPolicy.maxFailedAttempts ?? 0) > 0
                    ? 'bg-purple-50/60 border-purple-300 shadow-2xs'
                    : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      id="checkbox-policy-failed-lock"
                      type="checkbox"
                      checked={(draftPolicy.maxFailedAttempts ?? 0) > 0}
                      disabled={!canEdit}
                      onChange={(e) =>
                        handleSelectMaxFailedAttempts(e.target.checked ? 5 : 0)
                      }
                      className="mt-0.5 w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-purple-600" />
                        <span>
                          กำหนดใส่รหัสผิด{' '}
                          <strong className="text-purple-700 font-mono">
                            {draftPolicy.maxFailedAttempts ?? 0}
                          </strong>{' '}
                          ครั้ง User ถึง Lock
                        </span>
                      </span>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        ระบุจำนวนครั้งที่อนุญาตให้ใส่รหัสผิด หากใส่ผิดครบตามจำนวน บัญชีจะถูกล็อคทันที (เลือกหรือกรอก <strong>0</strong> = ไม่ล็อค)
                      </p>
                    </div>
                  </label>
                </div>

                {/* Preset Button Selectors */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {MAX_FAILED_ATTEMPTS_OPTIONS.map((opt) => {
                    const isSelected = (draftPolicy.maxFailedAttempts ?? 0) === opt;
                    return (
                      <button
                        key={opt}
                        id={`btn-max-failed-${opt}`}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => handleSelectMaxFailedAttempts(opt)}
                        className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-purple-300 hover:bg-purple-50/40'
                        }`}
                      >
                        <span className="font-mono text-xs sm:text-sm">{opt} ครั้ง</span>
                        <span
                          className={`text-[9px] font-medium truncate max-w-full ${
                            isSelected ? 'text-purple-100' : 'text-slate-400'
                          }`}
                        >
                          {opt === 0 ? 'ไม่ล็อค' : `ผิด ${opt} ครั้ง`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Direct Numeric Input Box (similar to expiry days) */}
                <div className="pt-2 border-t border-purple-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-700">
                    หรือกรอกจำนวนครั้งเอง (เป็นตัวเลขให้กรอก):
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      id="input-policy-max-failed-attempts"
                      type="number"
                      min={0}
                      max={99}
                      disabled={!canEdit}
                      value={draftPolicy.maxFailedAttempts ?? 0}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        handleSelectMaxFailedAttempts(isNaN(v) ? 0 : Math.max(0, v));
                      }}
                      className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-xs font-mono font-bold text-center bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-purple-500 shadow-2xs"
                    />
                    <span className="text-xs text-slate-500 font-medium">ครั้ง</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Live Policy Preview & Auto-Compliance Option */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>ตัวอย่างรหัสผ่านมาตรฐานที่ระบบตั้งให้ตามเงื่อนไขที่เลือก</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    เมื่อสร้างผู้ใช้ใหม่หรือกดตั้งรหัสตามนโยบาย ระบบจะกำหนดรหัสผ่านให้ตรงตามตัวเลือกที่เปิดใช้งานเสมอ
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-700 shrink-0">
                  <span className="text-[11px] text-slate-400">รหัสผ่านตามนโยบาย:</span>
                  <span className="font-mono font-bold text-sm text-emerald-400">
                    {sampleCompliantPassword}
                  </span>
                </div>
              </div>

              {/* Test password input & live rule checks */}
              <div className="pt-2 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                    ทดสอบตรวจสอบรหัสผ่านตามนโยบายที่เลือก:
                  </label>
                  <input
                    id="input-test-password-policy"
                    type="text"
                    value={testPassword}
                    onChange={(e) => setTestPassword(e.target.value)}
                    placeholder="พิมพ์รหัสผ่านเพื่อทดสอบเงื่อนไข..."
                    className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-hidden focus:border-indigo-400"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {testValidation.checks.map((chk) => (
                    <span
                      key={chk.key}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                        chk.passed
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {chk.passed ? (
                        <Check className="w-3 h-3 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3 h-3 shrink-0" />
                      )}
                      <span>{chk.label}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Option to automatically update existing non-compliant user passwords to match the selected policy */}
              {canEdit && (
                <div className="pt-2 border-t border-slate-800">
                  <label className="flex items-start sm:items-center gap-2.5 cursor-pointer select-none">
                    <input
                      id="checkbox-auto-apply-policy-passwords"
                      type="checkbox"
                      checked={autoApplyCompliantPassword}
                      onChange={(e) => setAutoApplyCompliantPassword(e.target.checked)}
                      className="mt-0.5 sm:mt-0 w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-xs text-slate-200 font-medium">
                      หากเลือกกำหนดข้อไหน ให้ระบบตั้งค่ารหัสผ่านของ User ในระบบที่ยังไม่ผ่านเกณฑ์ตัวอักษร ({nonCompliantUsersCount} บัญชี) ให้ตรงตามที่เลือกทันที (เช่น{' '}
                      <code className="text-emerald-300 font-mono font-bold">
                        {sampleCompliantPassword}
                      </code>
                      )
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Section 4: Per-User Password Expiration & Policy Status Table */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <span>
                      2. สถานะรหัสผ่านและวันหมดอายุของ User แต่ละคน (เรียงตามผู้ที่หมดอายุก่อน)
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    วันหมดอายุจะคำนวณสัมพันธ์กับวันที่เริ่มใช้รหัสผ่านของ User คนนั้นๆ หาก User คนไหนหมดอายุก่อนจะต้องเปลี่ยนรหัสผ่านก่อนเมื่อเข้าสู่ระบบ
                  </p>
                </div>

                {draftPolicy.expiryDays > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-xl border ${
                        expiredUsersCount > 0
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {expiredUsersCount > 0
                        ? `⚠️ ต้องเปลี่ยนรหัสผ่านก่อนเข้าใช้ ${expiredUsersCount} ท่าน`
                        : '✅ รหัสผ่านยังไม่หมดอายุทุกบัญชี'}
                    </span>
                  </div>
                )}
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">ลำดับ / ผู้ใช้งาน</th>
                        <th className="py-2.5 px-3">Username / รหัสปัจจุบัน</th>
                        <th className="py-2.5 px-3">วันที่เริ่มใช้รหัสของ User</th>
                        <th className="py-2.5 px-3">วันหมดอายุรหัสผ่าน</th>
                        <th className="py-2.5 px-3">สถานะการบังคับเปลี่ยนรหัส</th>
                        <th className="py-2.5 px-3">สถานะบัญชี / ล็อค</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sortedUserStatuses.map(
                        ({ user: u, expiryInfo, charValidation, historyCount }, idx) => {
                          const isPassShown = Boolean(visibleUserPass[u.id]);
                          const displayPass =
                            autoApplyCompliantPassword && !charValidation.isValid
                              ? sampleCompliantPassword
                              : u.password || 'password123';

                          return (
                            <tr
                              key={u.id}
                              className={
                                expiryInfo.isExpired
                                  ? 'bg-rose-50/50 hover:bg-rose-50'
                                  : 'hover:bg-slate-50'
                              }
                            >
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                                      expiryInfo.isExpired
                                        ? 'bg-rose-600 text-white'
                                        : 'bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {idx + 1}
                                  </span>
                                  <div>
                                    <div className="font-bold text-slate-900">{u.name}</div>
                                    <div className="text-[10px] text-slate-500">
                                      {u.department}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-2.5 px-3 font-mono">
                                <div className="text-[11px] font-bold text-indigo-700">
                                  @{u.username || u.email.split('@')[0]}
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-[11px] text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">
                                    {isPassShown ? displayPass : '••••••••'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVisibleUserPass((prev) => ({
                                        ...prev,
                                        [u.id]: !prev[u.id],
                                      }))
                                    }
                                    className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                                    title="แสดง/ซ่อนรหัสผ่าน"
                                  >
                                    {isPassShown ? (
                                      <EyeOff className="w-3 h-3" />
                                    ) : (
                                      <Eye className="w-3 h-3" />
                                    )}
                                  </button>
                                  <span className="text-[10px] text-slate-400">
                                    (ประวัติ {historyCount})
                                  </span>
                                </div>
                              </td>

                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="date"
                                    disabled={!canEdit}
                                    value={
                                      userStartDates[u.id] ||
                                      expiryInfo.startDateIso.substring(0, 10)
                                    }
                                    onChange={(e) => {
                                      if (!e.target.value) return;
                                      setUserStartDates((prev) => ({
                                        ...prev,
                                        [u.id]: e.target.value,
                                      }));
                                    }}
                                    className="px-2 py-1 text-[11px] border border-slate-300 rounded-lg bg-white text-slate-800 font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                                  />
                                  <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                    ({expiryInfo.daysElapsed} วันที่แล้ว)
                                  </span>
                                </div>
                              </td>

                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {expiryInfo.neverExpires ? (
                                  <span className="text-slate-500 font-medium">
                                    ไม่มีวันหมดอายุ (0 วัน)
                                  </span>
                                ) : (
                                  <div>
                                    <div className="font-bold text-slate-800">
                                      {formatThaiDateShort(expiryInfo.expiryDate)}
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      รอบอายุ {draftPolicy.expiryDays} วัน
                                    </div>
                                  </div>
                                )}
                              </td>

                              <td className="py-2.5 px-3">
                                {expiryInfo.neverExpires ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>ใช้งานได้ตลอด</span>
                                  </span>
                                ) : expiryInfo.isExpired ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-300">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    <span>
                                      หมดอายุแล้ว ({Math.abs(expiryInfo.daysRemaining || 0)} วัน) • ต้องเปลี่ยนรหัสก่อน
                                    </span>
                                  </span>
                                ) : expiryInfo.isExpiringSoon ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300">
                                    <Clock className="w-3.5 h-3.5 shrink-0" />
                                    <span>ใกล้หมดอายุ (เหลือ {expiryInfo.daysRemaining} วัน)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                    <span>ปกติ (เหลือ {expiryInfo.daysRemaining} วัน)</span>
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 whitespace-nowrap">
                                {unlockedUserIds.includes(u.id) ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>ปลดล็อคแล้ว (รอกดบันทึก)</span>
                                  </span>
                                ) : u.isLocked ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-lg border border-rose-300">
                                      <Lock className="w-3 h-3 text-rose-600" />
                                      <span>ล็อคแล้ว (ผิด {u.failedLoginAttempts || 0} ครั้ง)</span>
                                    </span>
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => handleUnlockUser(u.id)}
                                        className="px-2 py-0.5 text-[10px] font-bold text-indigo-700 hover:text-white bg-indigo-50 hover:bg-indigo-600 border border-indigo-200 rounded-md transition-colors cursor-pointer"
                                      >
                                        ปลดล็อค
                                      </button>
                                    )}
                                  </div>
                                ) : (u.failedLoginAttempts ?? 0) > 0 ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                      ผิด {u.failedLoginAttempts} ครั้ง
                                    </span>
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => handleUnlockUser(u.id)}
                                        className="px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded cursor-pointer"
                                        title="รีเซ็ตจำนวนครั้งที่ใส่รหัสผิด"
                                      >
                                        รีเซ็ต
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-slate-500 font-medium">ปกติ</span>
                                )}
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  id="btn-reset-password-policy"
                  type="button"
                  onClick={handleResetDefault}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>คืนค่าเริ่มต้น</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                id="btn-cancel-password-policy"
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              {canEdit && (
                <button
                  id="btn-save-password-policy"
                  type="button"
                  disabled={isSaving}
                  onClick={handleSave}
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกนโยบายรหัสผ่าน'}</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
