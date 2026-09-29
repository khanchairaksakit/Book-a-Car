import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { translations, Language } from '../utils/translations';
import { getUserRoles, getRoleBadgeInfo } from '../utils/userHelpers';
import {
  Car,
  Lock,
  Globe,
  AlertCircle,
  ArrowRight,
  Info,
  Eye,
  EyeOff,
  AtSign,
  KeyRound,
  Zap,
  CheckCircle,
  Users,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { motion } from 'motion/react';

interface LoginPageProps {
  users: User[];
  onLogin: (user: User) => void;
  onDirectAccess?: () => void;
  language: Language;
  onToggleLanguage: (lang: Language) => void;
}

export default function LoginPage({
  users,
  onLogin,
  onDirectAccess,
  language,
  onToggleLanguage,
}: LoginPageProps) {
  const [identifierInput, setIdentifierInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  const t = translations[language];

  // Default primary user for quick direct access
  const defaultUser = users.find((u) => {
    const roles = getUserRoles(u);
    return roles.includes('Admin');
  }) || users[0];

  const handleDirectAccessClick = () => {
    if (onDirectAccess) {
      onDirectAccess();
    } else if (defaultUser) {
      onLogin(defaultUser);
    }
  };

  const handleQuickUserSelect = (targetUser: User) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLogin(targetUser);
    }, 200);
  };

  // Handle manual login submit
  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!identifierInput.trim()) {
      setError(t.errorEmptyIdentifier);
      return;
    }

    const normalized = identifierInput.trim().toLowerCase();
    const targetUser = users.find((u) => {
      const userUsername = (u.username || u.email.split('@')[0]).toLowerCase();
      const userEmail = u.email.toLowerCase();
      const userCode = (u.employeeCode || '').toLowerCase();
      return userUsername === normalized || userEmail === normalized || userCode === normalized;
    });

    if (!targetUser) {
      setError(t.errorUserNotFound);
      return;
    }

    if (!passwordInput) {
      setError(t.errorEmptyPassword);
      return;
    }

    const expectedPassword = targetUser.password || 'password123';
    if (passwordInput.trim() !== expectedPassword) {
      setError(t.errorIncorrectPassword);
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLogin(targetUser);
    }, 300);
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
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between z-10">
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

      {/* Main Center Section */}
      <div className="w-full max-w-2xl mx-auto my-auto py-6 z-10">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 space-y-6"
        >
          {/* Direct Access Guarantee Banner */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200 rounded-2xl flex items-start gap-3 shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-emerald-500/20">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div className="text-xs space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-emerald-900 text-sm">
                  {t.noGoogleAccountNotice}
                </span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                  Direct Mode
                </span>
              </div>
              <p className="text-emerald-800 text-xs">
                {t.noGoogleAccountSubtitle}
              </p>
            </div>
          </div>

          {/* Big Primary Direct Entry Button */}
          <div>
            <button
              id="btn-direct-access-primary"
              type="button"
              onClick={handleDirectAccessClick}
              disabled={isLoading}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 active:scale-[0.99] text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-3 cursor-pointer group"
            >
              <Zap className="w-5 h-5 text-amber-300 animate-bounce group-hover:scale-110 transition-transform" />
              <span>{t.directAccessBtn}</span>
              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-[11px] text-center text-slate-500 mt-2">
              {language === 'th'
                ? `เข้าสู่ระบบทันทีในฐานะ ${defaultUser?.name || 'ผู้ดูแลระบบ'} (สามารถสลับสิทธิ์ได้ตลอดเวลา)`
                : `Instant entry as ${defaultUser?.name || 'Administrator'} (Switch roles anytime)`}
            </p>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-gray-200 w-full" />
            <span className="bg-white px-3 text-xs text-gray-400 font-semibold uppercase tracking-wider shrink-0">
              {language === 'th' ? 'หรือเลือกเข้าใช้งานด้วยโปรไฟล์พนักงาน' : 'Or Select Employee Profile'}
            </span>
            <div className="border-t border-gray-200 w-full" />
          </div>

          {/* 1-Click Fast Profile Login Cards */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                {t.oneClickLogin}
              </span>
              <span className="text-[10px] text-gray-400">
                {language === 'th' ? 'คลิกที่ชื่อเพื่อเข้าสู่ระบบทันที' : 'Click to sign in instantly'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
              {users.map((u) => {
                const roles = getUserRoles(u);
                return (
                  <div
                    key={u.id}
                    id={`quick-login-card-${u.id}`}
                    onClick={() => handleQuickUserSelect(u)}
                    className="p-3 rounded-xl border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/40 bg-slate-50/70 transition-all cursor-pointer flex items-center gap-3 group text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-indigo-600 group-hover:bg-indigo-700 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                      {u.name.substring(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-gray-900 text-xs truncate group-hover:text-indigo-700">
                          {u.name}
                        </span>
                        {u.employeeCode && (
                          <span className="text-[10px] font-mono text-gray-400 shrink-0">
                            {u.employeeCode}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-500 block truncate">
                        {u.department} {u.division ? `• ${u.division}` : ''}
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {roles.map((r) => {
                          const badge = getRoleBadgeInfo(r, language === 'en');
                          return (
                            <span
                              key={r}
                              className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              {badge.label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Toggle Accordion for Manual Username/Password Form */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setShowManualForm(!showManualForm)}
              className="w-full px-4 py-3 bg-slate-50/80 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  {language === 'th'
                    ? 'เข้าสู่ระบบด้วย Username / Password (แบบระบุรหัสผ่าน)'
                    : 'Sign in with Username & Password (Traditional)'}
                </span>
              </div>
              {showManualForm ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showManualForm && (
              <div className="p-4 sm:p-5 space-y-4 border-t border-slate-200 bg-white">
                {/* Error Message */}
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleManualLogin} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-700">
                      {t.usernameOrEmail}
                    </label>
                    <div className="relative">
                      <AtSign className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        id="login-identifier-input"
                        type="text"
                        value={identifierInput}
                        onChange={(e) => setIdentifierInput(e.target.value)}
                        placeholder={t.usernameOrEmailPlaceholder}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-700">
                      {t.password}
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        id="login-password-input"
                        type={showPassword ? 'text' : 'password'}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder={t.passwordPlaceholder}
                        className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    id="btn-login-submit"
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{t.loginBtn}</span>
                  </button>
                </form>
              </div>
            )}
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
