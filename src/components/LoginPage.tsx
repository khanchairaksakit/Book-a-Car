import React, { useState } from 'react';
import { User } from '../types';
import { translations, Language } from '../utils/translations';
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

  // Handle manual login submit
  const handleLogin = (e: React.FormEvent) => {
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
      return userUsername === normalized || userEmail === normalized;
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
    }, 400);
  };

  return (
    <div
      id="login-page-container"
      className="min-h-screen bg-slate-900 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden"
    >
      {/* Background ambient lighting accents */}
      <div className="absolute top-0 -left-20 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

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
      <div className="w-full max-w-lg mx-auto my-auto py-6 z-10">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 space-y-5"
        >
          {/* Form Header */}
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-2">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              {t.loginTitle}
            </h2>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {t.loginSubtitle}
            </p>
          </div>

          {/* Dual Login Mode Guide Notice */}
          <div className="p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl flex items-start gap-2.5 text-xs text-indigo-900">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed text-[11px] space-y-0.5">
              <span className="font-semibold block">{t.loginHint}</span>
              <span className="text-indigo-700 block">
                {language === 'th'
                  ? '• เข้าด้วย Username + Password หรือ Email + Password'
                  : '• Sign in with Username + Password or Email + Password'}
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username or Email input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700">
                {t.usernameOrEmail} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <AtSign className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  id="login-identifier-input"
                  type="text"
                  value={identifierInput}
                  onChange={(e) => setIdentifierInput(e.target.value)}
                  placeholder={t.usernameOrEmailPlaceholder}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-colors"
                />
              </div>
              <p className="text-[10px] text-gray-500">
                {language === 'th'
                  ? 'พิมพ์ Username (เช่น somchai) หรือ Email (เช่น somchai.j@company.com)'
                  : 'Type Username (e.g. somchai) or Email (e.g. somchai.j@company.com)'}
              </p>
            </div>

            {/* Password input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-gray-700">
                  {t.password} <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] text-indigo-600 font-medium">
                  {language === 'th' ? 'กำหนดได้ที่หน้ารายชื่อผู้ใช้งาน' : 'Configured in user directory'}
                </span>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  id="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                  title={showPassword ? 'Hide Password' : 'Show Password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              id="btn-login-submit"
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isLoading ? (
                <span>{t.loggingIn}</span>
              ) : (
                <>
                  <span>{t.loginBtn}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Subtle test credentials note */}
          <div className="pt-3 border-t border-gray-100 text-center text-[11px] text-gray-400">
            {language === 'th' ? (
              <span>💡 บัญชีสำหรับทดสอบ: <strong className="text-gray-600 font-mono">somchai</strong> / <strong className="text-gray-600 font-mono">password123</strong> (หรือดูที่เมนูรายชื่อผู้ใช้งาน)</span>
            ) : (
              <span>💡 Demo account: <strong className="text-gray-600 font-mono">somchai</strong> / <strong className="text-gray-600 font-mono">password123</strong> (or check User Directory)</span>
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
