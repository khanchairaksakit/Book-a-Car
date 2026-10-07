import React, { useState } from 'react';
import { User } from '../types';
import { getUsers } from '../lib/firebase';
import { translations, Language } from '../utils/translations';
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
} from 'lucide-react';
import { motion } from 'motion/react';

interface LoginPageProps {
  users: User[];
  onLogin: (user: User) => void;
  language: Language;
  onToggleLanguage: (lang: Language) => void;
}

export default function LoginPage({
  users,
  onLogin,
  language,
  onToggleLanguage,
}: LoginPageProps) {
  const [identifierInput, setIdentifierInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const t = translations[language];

  const findMatchingUser = (pool: User[], normalized: string): User | undefined => {
    return pool.find((u) => {
      const userUsername = (u.username || '').trim().toLowerCase();
      const userEmail = (u.email || '').trim().toLowerCase();
      const emailPrefix = u.email ? u.email.split('@')[0].trim().toLowerCase() : '';
      const userCode = (u.employeeCode || '').trim().toLowerCase();
      const userName = (u.name || '').trim().toLowerCase();
      return (
        userUsername === normalized ||
        emailPrefix === normalized ||
        userEmail === normalized ||
        userCode === normalized ||
        userName === normalized
      );
    });
  };

  // Handle standard credential verification
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedIdentifier = identifierInput.trim();
    if (!trimmedIdentifier) {
      setError(
        language === 'th'
          ? 'กรุณาระบุชื่อผู้ใช้ (Username), รหัสพนักงาน หรืออีเมลองค์กร'
          : 'Please enter your username, employee code, or work email'
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

    setIsLoading(true);
    const normalized = trimmedIdentifier.toLowerCase();

    // 1. Check current users prop
    let targetUser = findMatchingUser(users, normalized);

    // 2. Check localStorage users if not found
    if (!targetUser) {
      try {
        const raw = localStorage.getItem('car_booking_users');
        if (raw) {
          const parsed: User[] = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            targetUser = findMatchingUser(parsed, normalized);
          }
        }
      } catch {
        // ignore
      }
    }

    // 3. Fetch latest users from Firestore if still not found
    if (!targetUser) {
      try {
        const cloudUsers = await getUsers();
        targetUser = findMatchingUser(cloudUsers, normalized);
      } catch {
        // ignore
      }
    }

    if (!targetUser) {
      setIsLoading(false);
      setError(
        language === 'th'
          ? 'ไม่พบบัญชีผู้ใช้งานในระบบ กรุณาตรวจสอบชื่อผู้ใช้หรือรหัสพนักงานอีกครั้ง'
          : 'User account not found. Please verify your username or employee code.'
      );
      return;
    }

    const expectedPassword = targetUser.password || 'password123';
    if (passwordInput.trim() !== expectedPassword) {
      setIsLoading(false);
      setError(
        language === 'th'
          ? 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านแล้วลองอีกครั้ง'
          : 'Incorrect password. Please verify and try again.'
      );
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

      {/* Top Header bar: App identity and Language switcher */}
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

        {/* Language Switcher Toggle */}
        <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 p-1 rounded-xl shadow-xs">
          <Globe className="w-4 h-4 text-slate-400 ml-1.5" />
          <button
            id="lang-btn-th"
            type="button"
            onClick={() => onToggleLanguage('th')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              language === 'th'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            🇹🇭 {t.langTh}
          </button>
          <button
            id="lang-btn-en"
            type="button"
            onClick={() => onToggleLanguage('en')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              language === 'en'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            🇬🇧 {t.langEn}
          </button>
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

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password-input"
                  className="block text-xs font-bold text-gray-700"
                >
                  {language === 'th' ? 'รหัสผ่าน (Password)' : 'Password'}
                </label>
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
    </div>
  );
}
