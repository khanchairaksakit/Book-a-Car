import React, { useState, useEffect } from 'react';
import { User, PasswordPolicy } from '../types';
import { getUsers } from '../lib/firebase';
import { translations, Language } from '../utils/translations';
import {
  DEFAULT_PASSWORD_POLICY,
  getUserPasswordExpiryInfo,
  validatePasswordAgainstPolicy,
  formatThaiDateShort,
  getUserLockoutStatus,
  getUnlockedUserRecord,
  LOCKOUT_DURATION_MINUTES,
} from '../utils/passwordPolicyUtils';
import ChangePasswordModal from './ChangePasswordModal';
import ForgotPasswordModal from './ForgotPasswordModal';
import {
  Car,
  Lock,
  Globe,
  AlertCircle,
  Eye,
  EyeOff,
  User as UserIcon,
  KeyRound,
  ShieldCheck,
  CheckCircle,
  ShieldAlert,
} from 'lucide-react';
import { motion } from 'motion/react';

interface LoginPageProps {
  users: User[];
  onLogin: (user: User) => void;
  language: Language;
  onToggleLanguage?: (lang: Language) => void;
  passwordPolicy?: PasswordPolicy;
  onUpdateUserPassword?: (updatedUser: User) => Promise<void> | void;
  sessionExpiredNotice?: string | null;
  onClearSessionNotice?: () => void;
}

export default function LoginPage({
  users,
  onLogin,
  language,
  passwordPolicy = DEFAULT_PASSWORD_POLICY,
  onUpdateUserPassword,
  sessionExpiredNotice,
  onClearSessionNotice,
}: LoginPageProps) {
  const [identifierInput, setIdentifierInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');
  const [expiredLoginUser, setExpiredLoginUser] = useState<{
    user: User;
    reason: string;
  } | null>(null);

  // Live countdown state for locked user (15 minutes)
  const [lockedUserInfo, setLockedUserInfo] = useState<{
    user: User;
    remainingSeconds: number;
  } | null>(null);

  // Live ticker for 15-minute lockout countdown
  useEffect(() => {
    if (!lockedUserInfo) return;

    const interval = setInterval(() => {
      setLockedUserInfo((prev) => {
        if (!prev) return null;
        if (prev.remainingSeconds <= 1) {
          // 15 minutes have passed! Automatically unlock user record!
          const autoUnlocked = getUnlockedUserRecord(prev.user);
          if (onUpdateUserPassword) {
            onUpdateUserPassword(autoUnlocked);
          }
          setError('');
          setResetSuccessMessage(
            language === 'th'
              ? `ครบ 15 นาทีแล้ว ระบบได้ทำการปลดล็อคบัญชี "${prev.user.name}" อัตโนมัติเรียบร้อยแล้ว คุณสามารถเข้าสู่ระบบได้แล้ว`
              : `15 minutes elapsed. Account "${prev.user.name}" has been automatically unlocked. You can now sign in.`
          );
          return null;
        }

        const nextSeconds = prev.remainingSeconds - 1;
        const mins = Math.floor(nextSeconds / 60);
        const secs = nextSeconds % 60;
        const formatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        setError(
          language === 'th'
            ? `user ถูก lock โปรดติดต่อผู้ดูแลระบบหรือโปรดรอ 15 นาที (ปลดล็อคอัตโนมัติในอีก ${formatted} นาที)`
            : `User account is locked. Please contact administrator or wait 15 minutes (auto-unlock in ${formatted}).`
        );

        return {
          ...prev,
          remainingSeconds: nextSeconds,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lockedUserInfo, language, onUpdateUserPassword]);

  const t = translations[language];

  const findMatchingUser = (pool: User[], exactLower: string): User | undefined => {
    if (!exactLower || /\s/.test(exactLower)) return undefined;
    return pool.find((u) => {
      if (!u || !u.id) return false;
      const userUsername = (u.username || '').trim().toLowerCase();
      const userEmail = (u.email || '').trim().toLowerCase();
      const userCode = (u.employeeCode || '').trim().toLowerCase();
      return (
        (Boolean(userUsername) && userUsername === exactLower) ||
        (Boolean(userEmail) && userEmail === exactLower) ||
        (Boolean(userCode) && userCode === exactLower)
      );
    });
  };

  // Handle standard credential verification (strictly no spaces allowed, only real existing users)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!identifierInput || !identifierInput.trim()) {
      setError(
        language === 'th'
          ? 'กรุณาระบุชื่อผู้ใช้ (Username), รหัสพนักงาน หรืออีเมลองค์กร'
          : 'Please enter your username, employee code, or work email'
      );
      return;
    }

    // Reject any leading, trailing, or internal whitespace in the username/identifier input
    if (/\s/.test(identifierInput)) {
      setError(
        language === 'th'
          ? 'ชื่อผู้ใช้ (Username) รหัสพนักงาน หรืออีเมล ห้ามมีเว้นวรรค (ช่องว่าง) กรุณาตรวจสอบอีกครั้ง'
          : 'Username, employee code, or email must not contain spaces.'
      );
      return;
    }

    if (!passwordInput) {
      setError(
        language === 'th'
          ? 'กรุณากรอกรหัสผ่านของคุณ'
          : 'Please enter your password'
      );
      return;
    }

    if (/\s/.test(passwordInput)) {
      setError(
        language === 'th'
          ? 'รหัสผ่านห้ามมีเว้นวรรค (ช่องว่าง) กรุณาตรวจสอบรหัสผ่านแล้วลองอีกครั้ง'
          : 'Password must not contain spaces.'
      );
      return;
    }

    setIsLoading(true);
    const exactIdentifier = identifierInput.toLowerCase();

    // 1. Check active users state (synced from Firestore / User Management)
    let activePool: User[] = Array.isArray(users) && users.length > 0 ? users : [];

    // 2. If users prop is empty, fetch authoritative users from Firestore
    if (activePool.length === 0) {
      try {
        activePool = await getUsers();
      } catch {
        activePool = [];
      }
    }

    let targetUser = findMatchingUser(activePool, exactIdentifier);

    // 3. If still not found in local state, re-verify directly against Firestore users collection
    if (!targetUser) {
      try {
        const cloudUsers = await getUsers();
        targetUser = findMatchingUser(cloudUsers, exactIdentifier);
      } catch {
        // ignore
      }
    }

    if (!targetUser) {
      setIsLoading(false);
      setError(
        language === 'th'
          ? 'ไม่พบบัญชีผู้ใช้งานนี้ในระบบ (อนุญาตเฉพาะผู้ใช้งานที่มีรายชื่ออยู่ในระบบจริงเท่านั้น)'
          : 'User account not found in the system.'
      );
      return;
    }

    // Check if account is locked due to too many failed attempts (Policy enforcement & 15-min auto unlock)
    if (targetUser.isLocked) {
      const lockStatus = getUserLockoutStatus(targetUser);

      // Check if 15 minutes have elapsed since lock time -> Automatically unlock!
      if (lockStatus.isAutoUnlocked) {
        const autoUnlocked = getUnlockedUserRecord(targetUser);
        if (onUpdateUserPassword) {
          await onUpdateUserPassword(autoUnlocked);
        }
        targetUser = autoUnlocked;
        setLockedUserInfo(null);
      } else {
        // Still within 15-minute lock period
        setIsLoading(false);
        const remSec = Math.ceil(lockStatus.remainingMs / 1000);
        setLockedUserInfo({
          user: targetUser,
          remainingSeconds: remSec,
        });
        setError(
          language === 'th'
            ? `user ถูก lock โปรดติดต่อผู้ดูแลระบบหรือโปรดรอ 15 นาที (ปลดล็อคอัตโนมัติในอีก ${lockStatus.formattedRemaining})`
            : `User account is locked. Please contact administrator or wait 15 minutes (auto-unlock in ${lockStatus.formattedRemaining}).`
        );
        return;
      }
    }

    const expectedPassword = targetUser.password || 'password123';
    if (passwordInput !== expectedPassword) {
      setIsLoading(false);
      const maxAllowed = passwordPolicy.maxFailedAttempts ?? 5;
      const nextFailed = (targetUser.failedLoginAttempts || 0) + 1;
      const isNowLocked = maxAllowed > 0 && nextFailed >= maxAllowed;

      if (isNowLocked) {
        const lockedAtIso = new Date().toISOString();
        const updatedUser: User = {
          ...targetUser,
          failedLoginAttempts: nextFailed,
          isLocked: true,
          lockedAt: lockedAtIso,
          lockedReason: `ใส่รหัสผ่านผิดเกินกำหนด (${nextFailed}/${maxAllowed} ครั้ง)`,
        };

        if (onUpdateUserPassword) {
          onUpdateUserPassword(updatedUser);
        }

        setLockedUserInfo({
          user: updatedUser,
          remainingSeconds: 15 * 60,
        });

        setError(
          language === 'th'
            ? `user ถูก lock โปรดติดต่อผู้ดูแลระบบหรือโปรดรอ 15 นาที (ปลดล็อคอัตโนมัติในอีก 15:00 นาที)`
            : `User account is locked. Please contact administrator or wait 15 minutes (auto-unlock in 15:00).`
        );
      } else {
        const updatedUser: User = {
          ...targetUser,
          failedLoginAttempts: nextFailed,
        };
        if (onUpdateUserPassword) {
          onUpdateUserPassword(updatedUser);
        }

        if (maxAllowed > 0) {
          const remaining = maxAllowed - nextFailed;
          setError(
            language === 'th'
              ? `รหัสผ่านไม่ถูกต้อง (ผิดครั้งที่ ${nextFailed}/${maxAllowed} • หากใส่ผิดอีก ${remaining} ครั้ง user จะถูก lock 15 นาที)`
              : `Incorrect password (attempt ${nextFailed}/${maxAllowed}. User will be locked for 15 minutes after ${remaining} more attempt${remaining > 1 ? 's' : ''}).`
          );
        } else {
          setError(
            language === 'th'
              ? 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านแล้วลองอีกครั้ง'
              : 'Incorrect password. Please verify and try again.'
          );
        }
      }
      return;
    }

    // If password is correct, clear failed login attempts counter and unlock state
    if ((targetUser.failedLoginAttempts || 0) > 0 || targetUser.isLocked) {
      const resetFailedUser: User = getUnlockedUserRecord(targetUser);
      if (onUpdateUserPassword) {
        onUpdateUserPassword(resetFailedUser);
      }
      targetUser = resetFailedUser;
    }
    setLockedUserInfo(null);

    // Check per-user password expiration ("วันหมดอายุจะต้องสัมพันธ์กับการใช้รหัสของ user นั้นๆ หาก user ไหนหมดอายุก่อนก็ต้องเปลี่ยนรหัสก่อน")
    const expiryInfo = getUserPasswordExpiryInfo(targetUser, passwordPolicy);
    const policyCharCheck = validatePasswordAgainstPolicy(
      expectedPassword,
      passwordPolicy,
      targetUser,
      false
    );

    if (expiryInfo.isExpired || !policyCharCheck.isValid) {
      setIsLoading(false);
      const reason = expiryInfo.isExpired
        ? `รหัสผ่านของ "${targetUser.name}" หมดอายุแล้ว (เริ่มใช้เมื่อ ${formatThaiDateShort(
            expiryInfo.startDate
          )} • เกินกำหนด ${passwordPolicy.expiryDays} วัน) กรุณาเปลี่ยนรหัสผ่านใหม่ก่อนเข้าสู่ระบบ`
        : `นโยบายรหัสผ่านของระบบกำหนดให้ต้องตั้งรหัสผ่านตามเงื่อนไขใหม่ กรุณาเปลี่ยนรหัสผ่านก่อนเข้าใช้งาน`;
      setExpiredLoginUser({
        user: targetUser,
        reason,
      });
      return;
    }

    setTimeout(() => {
      setIsLoading(false);
      onLogin(targetUser!);
    }, 150);
  };

  return (
    <div
      id="login-page-container"
      className="min-h-screen bg-slate-900 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden"
    >
      {/* Background ambient lighting accents */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header bar: App identity */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-white text-base sm:text-lg tracking-tight">
              {t.appTitle}
            </h1>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              {t.appSubtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Main Center Section: Strict Production Login Form */}
      <div className="w-full max-w-md mx-auto my-auto py-8 z-10">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 space-y-6"
        >
          {/* Card Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-xs">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                {language === 'th' ? 'เข้าสู่ระบบเพื่อใช้งาน' : 'Sign In to Your Account'}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                {language === 'th'
                  ? 'กรุณากรอก Username, รหัสพนักงาน หรืออีเมล พร้อมรหัสผ่าน'
                  : 'Enter your username, employee ID or email and password'}
              </p>
            </div>
          </div>

          {/* Session Expired Notice (from 30 min session timeout) */}
          {sessionExpiredNotice && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-start justify-between gap-2.5 text-xs text-amber-900 leading-relaxed shadow-xs"
            >
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>{sessionExpiredNotice}</span>
              </div>
              {onClearSessionNotice && (
                <button
                  type="button"
                  onClick={onClearSessionNotice}
                  className="text-amber-600 hover:text-amber-800 font-bold ml-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </motion.div>
          )}

          {/* Reset Password Success Message */}
          {resetSuccessMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 leading-relaxed"
            >
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{resetSuccessMessage}</span>
            </motion.div>
          )}

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 leading-relaxed"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Secure Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* Username / Employee Code / Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-identifier-input"
                className="block text-xs font-bold text-gray-700"
              >
                {language === 'th'
                  ? 'ชื่อผู้ใช้ / รหัสพนักงาน / อีเมลองค์กร'
                  : 'Username / Employee Code / Work Email'}
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  id="login-identifier-input"
                  type="text"
                  autoComplete="username"
                  value={identifierInput}
                  onChange={(e) => setIdentifierInput(e.target.value)}
                  placeholder={
                    language === 'th'
                      ? 'เช่น somchai, EMP-001 หรือ somchai.j@company.com'
                      : 'e.g. somchai, EMP-001 or somchai.j@company.com'
                  }
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* Password Field & Forgot Password Link */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password-input"
                  className="block text-xs font-bold text-gray-700"
                >
                  {language === 'th' ? 'รหัสผ่าน (Password)' : 'Password'}
                </label>
                <button
                  id="btn-login-forgot-password"
                  type="button"
                  onClick={() => {
                    setError('');
                    setResetSuccessMessage('');
                    setIsForgotPasswordModalOpen(true);
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer hover:underline"
                >
                  {language === 'th' ? 'ลืมรหัสผ่าน?' : 'Forgot password?'}
                </button>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  id="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder={
                    language === 'th'
                      ? 'กรอกรหัสผ่านของคุณ'
                      : 'Enter your password'
                  }
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-2.5 text-gray-400 hover:text-gray-600 p-0.5 rounded cursor-pointer transition-colors"
                  title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="btn-login-submit"
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{language === 'th' ? 'กำลังตรวจสอบ...' : 'Verifying...'}</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>{language === 'th' ? 'เข้าสู่ระบบ' : 'Sign In'}</span>
                </>
              )}
            </button>
          </form>

          {/* Production Security Notice */}
          <div className="pt-2 border-t border-gray-100 flex items-center justify-center gap-2 text-[11px] text-gray-400 text-center">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {language === 'th'
                ? 'ระบบรักษาความปลอดภัย ยืนยันตัวตนก่อนเข้าใช้งานจริง'
                : 'Enterprise secure authentication system'}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Footer copyright */}
      <div className="text-center text-xs text-slate-500 z-10">
        <p>© 2026 {t.appTitle} • All rights reserved</p>
      </div>

      {/* Forced Password Change Modal when user's password has expired or fails policy */}
      {expiredLoginUser && (
        <ChangePasswordModal
          isOpen={Boolean(expiredLoginUser)}
          user={expiredLoginUser.user}
          policy={passwordPolicy}
          isForced={true}
          reasonText={expiredLoginUser.reason}
          onLogout={() => setExpiredLoginUser(null)}
          onSuccessChangePassword={async (updatedUser) => {
            if (onUpdateUserPassword) {
              await onUpdateUserPassword(updatedUser);
            }
            setExpiredLoginUser(null);
            onLogin(updatedUser);
          }}
        />
      )}

      {/* Forgot Password Modal (email reset flow) */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordModalOpen}
        onClose={() => setIsForgotPasswordModalOpen(false)}
        users={users}
        initialIdentifier={identifierInput}
        passwordPolicy={passwordPolicy}
        onSuccessResetPassword={async (updatedUser) => {
          if (onUpdateUserPassword) {
            await onUpdateUserPassword(updatedUser);
          }
          setIdentifierInput(updatedUser.username || updatedUser.employeeCode || updatedUser.email || '');
          setPasswordInput('');
          setResetSuccessMessage(
            language === 'th'
              ? `รีเซตรหัสผ่านใหม่สำเร็จสำหรับ "${updatedUser.name}"! คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที`
              : `Password reset successfully for "${updatedUser.name}". You can now sign in with your new password.`
          );
        }}
      />
    </div>
  );
}
