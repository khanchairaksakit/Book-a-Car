import React, { useState, useEffect, useMemo } from 'react';
import {
  Mail,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  RefreshCw,
  User as UserIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, PasswordPolicy, PasswordResetTokenRecord } from '../types';
import {
  savePasswordResetToken,
  getPasswordResetToken,
  consumePasswordResetToken,
  validatePasswordAgainstPolicy,
  generatePasswordForPolicy,
  DEFAULT_PASSWORD_POLICY,
} from '../utils/passwordPolicyUtils';
import {
  sendGmailMessage,
  buildPasswordResetEmailHtml,
} from '../services/gmailService';
import {
  initGoogleAuth,
  googleSignIn,
  googleSignOut,
  getCachedGoogleUser,
  getGoogleAccessToken,
} from '../lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  initialIdentifier?: string;
  passwordPolicy?: PasswordPolicy;
  onSuccessResetPassword: (updatedUser: User, autoLogin?: boolean) => Promise<void> | void;
}

type ModalStep = 'lookup' | 'confirm' | 'sent_email' | 'reset_form' | 'success';

export default function ForgotPasswordModal({
  isOpen,
  onClose,
  users,
  initialIdentifier = '',
  passwordPolicy = DEFAULT_PASSWORD_POLICY,
  onSuccessResetPassword,
}: ForgotPasswordModalProps) {
  const [step, setStep] = useState<ModalStep>('lookup');
  const [identifierInput, setIdentifierInput] = useState('');
  const [matchedUser, setMatchedUser] = useState<User | null>(null);
  const [lookupError, setLookupError] = useState('');

  // Email simulation & token state
  const [activeTokenRecord, setActiveTokenRecord] = useState<PasswordResetTokenRecord | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Gmail real email sending state
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [isSendingGmail, setIsSendingGmail] = useState(false);
  const [gmailSentSuccess, setGmailSentSuccess] = useState(false);
  const [gmailSentUserEmail, setGmailSentUserEmail] = useState('');
  const [gmailError, setGmailError] = useState('');
  const [showConfirmSendGmailModal, setShowConfirmSendGmailModal] = useState(false);

  // Reset password form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetError, setResetError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const findUser = (query: string): User | undefined => {
    if (!query || !query.trim()) return undefined;
    const clean = query.trim().toLowerCase();
    return users.find((u) => {
      const uUsername = (u.username || '').trim().toLowerCase();
      const uEmail = (u.email || '').trim().toLowerCase();
      const uCode = (u.employeeCode || '').trim().toLowerCase();
      const uName = (u.name || '').trim().toLowerCase();
      return (
        (uUsername && uUsername === clean) ||
        (uEmail && uEmail === clean) ||
        (uCode && uCode === clean) ||
        (uName && uName === clean)
      );
    });
  };

  // Listen to Google Auth state
  useEffect(() => {
    const unsub = initGoogleAuth(
      (u) => {
        setGoogleUser(u);
      },
      () => {
        setGoogleUser(null);
      }
    );
    const cached = getCachedGoogleUser();
    if (cached) {
      setGoogleUser(cached);
    }
    return () => unsub();
  }, []);

  // On open, check URL resetToken or initialize identifier / matched user
  useEffect(() => {
    if (isOpen) {
      setResetError('');
      setLookupError('');
      setCopiedLink(false);
      setNewPassword('');
      setConfirmPassword('');
      setIsSubmitting(false);
      setGmailSentSuccess(false);
      setGmailError('');
      setIsSendingGmail(false);
      setShowConfirmSendGmailModal(false);

      // Check if URL has ?resetToken=...
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('resetToken');
        if (urlToken) {
          const rec = getPasswordResetToken(urlToken);
          if (rec) {
            const foundUser = users.find(
              (u) =>
                u.id === rec.userId ||
                (u.email && u.email.toLowerCase() === rec.userEmail.toLowerCase())
            );
            if (foundUser) {
              setMatchedUser(foundUser);
              setActiveTokenRecord(rec);
              setStep('reset_form');
              return;
            }
          }
        }
      }

      if (initialIdentifier && initialIdentifier.trim()) {
        const found = findUser(initialIdentifier);
        setIdentifierInput(initialIdentifier.trim());
        if (found) {
          setMatchedUser(found);
          setStep('confirm');
          return;
        }
      }
      setMatchedUser(null);
      setStep('lookup');
    }
  }, [isOpen, initialIdentifier, users]);

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError('');
    if (!identifierInput.trim()) {
      setLookupError('กรุณาระบุ Username, รหัสพนักงาน หรืออีเมล');
      return;
    }
    const found = findUser(identifierInput);
    if (!found) {
      setLookupError('ไม่พบบัญชีผู้ใช้งานนี้ในระบบ กรุณาตรวจสอบข้อมูลอีกครั้ง');
      return;
    }
    setMatchedUser(found);
    setStep('confirm');
  };

  const handleStartSendGmail = async () => {
    setGmailError('');
    if (!matchedUser || !matchedUser.email) return;

    const token = await getGoogleAccessToken();
    if (!token) {
      try {
        const authRes = await googleSignIn();
        if (authRes?.user) {
          setGoogleUser(authRes.user);
          setShowConfirmSendGmailModal(true);
        }
      } catch (err: any) {
        setGmailError(err?.message || 'การเชื่อมต่อ Google ล้มเหลว');
      }
    } else {
      setShowConfirmSendGmailModal(true);
    }
  };

  const executeSendGmail = async () => {
    if (!matchedUser || !matchedUser.email) return;
    setIsSendingGmail(true);
    setGmailError('');

    let tokenRec = activeTokenRecord;
    if (!tokenRec) {
      const token = `rst-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      tokenRec = {
        token,
        userId: matchedUser.id,
        userEmail: matchedUser.email,
        userName: matchedUser.name,
        createdAt: new Date().toISOString(),
        expiresAt,
        used: false,
      };
      savePasswordResetToken(tokenRec);
      setActiveTokenRecord(tokenRec);
    }

    const resetUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}?resetToken=${tokenRec.token}`
        : `https://car-booking-app.local/reset-password?token=${tokenRec.token}`;

    const htmlBody = buildPasswordResetEmailHtml({
      recipientName: matchedUser.name,
      resetUrl,
      userEmail: matchedUser.email,
    });

    const result = await sendGmailMessage({
      to: matchedUser.email,
      subject: `[Car Booking] ลิงก์สำหรับตั้งค่ารหัสผ่านใหม่สำหรับคุณ ${matchedUser.name}`,
      htmlBody,
    });

    setIsSendingGmail(false);
    if (result.success) {
      setGmailSentSuccess(true);
      setGmailSentUserEmail(result.userEmail || googleUser?.email || '');
      setStep('sent_email');
    } else {
      setGmailError(result.error || 'เกิดข้อผิดพลาดในการส่งอีเมลผ่าน Gmail');
    }
  };

  // Direct Reset without waiting for email
  const handleDirectReset = () => {
    if (!matchedUser) return;
    const token = `rst-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins expiry
    const record: PasswordResetTokenRecord = {
      token,
      userId: matchedUser.id,
      userEmail: matchedUser.email || '',
      userName: matchedUser.name,
      createdAt: new Date().toISOString(),
      expiresAt,
      used: false,
    };

    savePasswordResetToken(record);
    setActiveTokenRecord(record);
    setStep('reset_form');
  };

  // Generate Reset Token & show direct link panel
  const handleConfirmReset = () => {
    if (!matchedUser) return;
    if (!matchedUser.email || !matchedUser.email.trim()) {
      setLookupError('ผู้ใช้งานนี้ไม่มีอีเมลในระบบ ไม่สามารถขอรีเซตรหัสผ่านได้');
      return;
    }

    const token = `rst-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins expiry
    const record: PasswordResetTokenRecord = {
      token,
      userId: matchedUser.id,
      userEmail: matchedUser.email,
      userName: matchedUser.name,
      createdAt: new Date().toISOString(),
      expiresAt,
      used: false,
    };

    savePasswordResetToken(record);
    setActiveTokenRecord(record);
    setStep('sent_email');
  };

  const resetLinkUrl = useMemo(() => {
    if (!activeTokenRecord) return '';
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${window.location.pathname}?resetToken=${activeTokenRecord.token}`;
    }
    return `https://car-booking-app.local/reset-password?token=${activeTokenRecord.token}`;
  }, [activeTokenRecord]);

  const handleCopyLink = () => {
    if (!resetLinkUrl) return;
    navigator.clipboard?.writeText(resetLinkUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleMailto = () => {
    if (!matchedUser || !resetLinkUrl) return;
    const subject = encodeURIComponent('[Car Booking] ลิงก์สำหรับตั้งค่ารหัสผ่านใหม่');
    const body = encodeURIComponent(
      `เรียน คุณ ${matchedUser.name},\n\nนี่คือลิงก์สำหรับตั้งค่ารหัสผ่านใหม่ของคุณ (ใช้งานได้ 15 นาที):\n${resetLinkUrl}\n\nหากคุณไม่ได้เป็นผู้ร้องขอ กรุณาละเว้นข้อความนี้`
    );
    window.location.href = `mailto:${matchedUser.email}?subject=${subject}&body=${body}`;
  };

  // Policy validation for new password
  const policyValidation = useMemo(() => {
    if (!matchedUser) return { isValid: false, errors: [] };
    return validatePasswordAgainstPolicy(newPassword, passwordPolicy, matchedUser, true);
  }, [newPassword, passwordPolicy, matchedUser]);

  const handleAutoGenerateCompliantPassword = () => {
    const generated = generatePasswordForPolicy(passwordPolicy);
    setNewPassword(generated);
    setConfirmPassword(generated);
    setShowNewPassword(true);
    setShowConfirmPassword(true);
    setResetError('');
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');

    if (!matchedUser || !activeTokenRecord) {
      setResetError('ข้อมูลเซสชันรีเซตรหัสผ่านไม่ถูกต้อง');
      return;
    }

    // Verify token validity
    const currentToken = getPasswordResetToken(activeTokenRecord.token);
    if (!currentToken || currentToken.used) {
      setResetError('ลิงก์รีเซตรหัสผ่านนี้หมดอายุหรือถูกใช้งานไปแล้ว กรุณาขอลืมรหัสผ่านใหม่อีกครั้ง');
      return;
    }

    if (!newPassword) {
      setResetError('กรุณากรอกรหัสผ่านใหม่');
      return;
    }

    if (/\s/.test(newPassword)) {
      setResetError('รหัสผ่านใหม่ห้ามมีเว้นวรรค (ช่องว่าง)');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetError('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    if (!policyValidation.isValid) {
      setResetError(policyValidation.errors[0] || 'รหัสผ่านใหม่ยังไม่ผ่านเงื่อนไขนโยบายรหัสผ่าน');
      return;
    }

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const previousHistory = Array.isArray(matchedUser.passwordHistory)
        ? matchedUser.passwordHistory
        : matchedUser.password
        ? [matchedUser.password]
        : [];

      const updatedHistory = [...previousHistory, newPassword].slice(-10);

      const updatedUser: User = {
        ...matchedUser,
        password: newPassword,
        passwordUpdatedAt: nowIso,
        passwordHistory: updatedHistory,
        failedLoginAttempts: 0,
        isLocked: false,
        lockedAt: undefined,
        lockedReason: undefined,
      };

      consumePasswordResetToken(activeTokenRecord.token);
      await onSuccessResetPassword(updatedUser, true);
      setMatchedUser(updatedUser);
      setStep('success');
    } catch (err) {
      console.error(err);
      setResetError('เกิดข้อผิดพลาดในการบันทึกรหัสผ่านใหม่ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        id="forgot-password-modal-backdrop"
        className="fixed inset-0 z-90 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden my-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/80 border border-indigo-400/40 flex items-center justify-center text-white">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base">
                  {step === 'reset_form' ? 'ตั้งค่ารหัสผ่านใหม่' : 'ลืมรหัสผ่าน (Forgot Password)'}
                </h3>
                <p className="text-[11px] text-slate-300">
                  {step === 'reset_form'
                    ? 'กำหนดรหัสผ่านใหม่ตามนโยบายความปลอดภัย'
                    : 'รีเซตรหัสผ่านผ่านอีเมลที่มีในระบบ'}
                </p>
              </div>
            </div>
            <button
              id="btn-close-forgot-modal"
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* STEP 1: LOOKUP USER */}
            {step === 'lookup' && (
              <form onSubmit={handleLookupSubmit} className="space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    กรุณากรอก <strong>Username</strong>, <strong>รหัสพนักงาน</strong> หรือ <strong>อีเมลองค์กร</strong> ของคุณ เพื่อค้นหาบัญชีและส่งลิงก์รีเซตรหัสผ่าน
                  </p>
                </div>

                {lookupError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <span>{lookupError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="forgot-input-id"
                    className="block text-xs font-bold text-gray-700"
                  >
                    ชื่อผู้ใช้ / รหัสพนักงาน / อีเมล
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                    <input
                      id="forgot-input-id"
                      type="text"
                      value={identifierInput}
                      onChange={(e) => setIdentifierInput(e.target.value)}
                      placeholder="เช่น wichai, EMP-003 หรือ wichai.k@company.com"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    id="btn-forgot-search-user"
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>ค้นหาบัญชี</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: CONFIRMATION POPUP SHOWING USER EMAIL DIRECTLY */}
            {step === 'confirm' && matchedUser && (
              <div className="space-y-4">
                {/* Account overview card */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                      {matchedUser.name.slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900 truncate">
                          {matchedUser.name}
                        </span>
                        {matchedUser.employeeCode && (
                          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                            {matchedUser.employeeCode}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 block truncate">
                        {matchedUser.department} {matchedUser.division ? `• ${matchedUser.division}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Check Email Presence */}
                  {matchedUser.email && matchedUser.email.trim() ? (
                    <div className="space-y-3">
                      <div className="bg-white border border-indigo-100 rounded-xl p-3.5 space-y-1.5 shadow-2xs">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                          <Mail className="w-4 h-4 text-indigo-600" />
                          <span>อีเมลที่ลงทะเบียนไว้ในระบบ:</span>
                        </div>
                        <div className="pl-6">
                          <span
                            id="forgot-display-user-email"
                            className="text-sm sm:text-base font-bold font-mono text-indigo-600 bg-indigo-50/80 px-2.5 py-1 rounded-md border border-indigo-200 inline-block"
                          >
                            {matchedUser.email}
                          </span>
                        </div>
                      </div>

                      {/* Real Gmail Delivery Card */}
                      <div className="bg-gradient-to-r from-indigo-50/90 to-blue-50/90 border border-indigo-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-white border border-indigo-200 flex items-center justify-center shadow-2xs">
                              <Mail className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-gray-900">
                                ส่งอีเมลจริงไปยัง {matchedUser.email}
                              </h5>
                              <p className="text-[10px] text-gray-500">
                                ผ่านบริการ Google Workspace Gmail
                              </p>
                            </div>
                          </div>
                          {googleUser && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              พร้อมส่ง
                            </span>
                          )}
                        </div>

                        {gmailError && (
                          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                            <span>{gmailError}</span>
                          </div>
                        )}

                        {googleUser ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[11px] bg-white/80 p-2.5 rounded-xl border border-indigo-100">
                              <span className="text-gray-500">
                                บัญชี Google ที่เชื่อมต่อ: <strong className="text-gray-800">{googleUser.email}</strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => googleSignOut().then(() => setGoogleUser(null))}
                                className="text-[10px] text-indigo-600 hover:text-indigo-800 underline font-semibold cursor-pointer"
                              >
                                สลับบัญชี
                              </button>
                            </div>
                            <button
                              type="button"
                              id="btn-send-real-gmail"
                              disabled={isSendingGmail}
                              onClick={handleStartSendGmail}
                              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                            >
                              {isSendingGmail ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <Mail className="w-4 h-4" />
                              )}
                              <span>✉️ ส่งลิงก์ไปยังอีเมลจริง ({matchedUser.email}) ผ่าน Gmail</span>
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-[11px] text-gray-600 leading-relaxed">
                              ระบบพร้อมส่งอีเมลจริงด้วย Gmail แล้ว กดปุ่มด้านล่างเพื่อเข้าสู่ระบบ Google และสั่งส่งอีเมลตรงไปยังกล่องจดหมายจริงได้ทันที
                            </p>
                            <button
                              type="button"
                              id="btn-google-signin-send"
                              disabled={isSendingGmail}
                              onClick={handleStartSendGmail}
                              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 active:scale-98 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs hover:shadow-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
                            >
                              <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                              </svg>
                              <span>Sign in with Google เพื่อส่งอีเมลจริงผ่าน Gmail</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Instant Direct Reset Alternative */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1 text-slate-700">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span>หรือต้องการตั้งรหัสผ่านใหม่บนหน้านี้ทันที?</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-600">
                          คุณสามารถกดปุ่ม <strong>"⚡ ตั้งรหัสผ่านใหม่ทันที"</strong> เพื่อเปลี่ยนรหัสผ่านได้ทันทีโดยไม่ต้องรอเปิดกล่องอีเมล
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* User has NO EMAIL in system */
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-rose-800">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-xs font-bold block">
                            ไม่สามารถขอรีเซตรหัสผ่านได้
                          </strong>
                          <p className="text-xs mt-0.5 leading-relaxed text-rose-700">
                            ผู้ใช้งาน <strong>"{matchedUser.name}"</strong> ไม่มีข้อมูลอีเมลที่บันทึกไว้ในระบบ
                            ระบบอนุญาตให้รีเซตรหัสผ่านผ่านอีเมลที่มีในระบบเท่านั้น
                          </p>
                        </div>
                      </div>
                      <div className="text-[11px] text-rose-600 bg-white/70 p-2 rounded-lg border border-rose-200">
                        💡 กรุณาติดต่อผู้ดูแลระบบ (Admin) เพื่ออัปเดตข้อมูลอีเมลให้บัญชีของคุณก่อนทำรายการ
                      </div>
                    </div>
                  )}
                </div>

                {lookupError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <span>{lookupError}</span>
                  </div>
                )}

                {/* Confirmation Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('lookup');
                      setLookupError('');
                    }}
                    className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer order-last sm:order-first"
                  >
                    ← ค้นหาบัญชีอื่น
                  </button>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      id="btn-forgot-cancel"
                      type="button"
                      onClick={onClose}
                      className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      ยกเลิก
                    </button>

                    {matchedUser.email && matchedUser.email.trim() && (
                      <>
                        <button
                          id="btn-forgot-create-link"
                          type="button"
                          onClick={handleConfirmReset}
                          className="px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          title="สร้างลิงก์สำหรับคัดลอกหรือส่งต่อ"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>สร้างลิงก์รีเซต</span>
                        </button>

                        <button
                          id="btn-forgot-direct-reset"
                          type="button"
                          onClick={handleDirectReset}
                          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-indigo-200" />
                          <span>⚡ ตั้งรหัสผ่านใหม่ทันที (ไม่ต้องรออีเมล)</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: RESET LINK READY & DIRECT DISPATCH */}
            {step === 'sent_email' && matchedUser && activeTokenRecord && (
              <div className="space-y-4">
                {gmailSentSuccess ? (
                  /* GMAIL REAL EMAIL SUCCESS HEADER */
                  <div className="text-center space-y-1">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-2 shadow-xs">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-base text-gray-900">
                      ส่งอีเมลจริงไปยัง {matchedUser.email} สำเร็จแล้ว!
                    </h4>
                    <p className="text-xs text-gray-500">
                      ส่งออกจากบัญชี Gmail: <strong className="text-indigo-700 font-semibold">{gmailSentUserEmail || googleUser?.email}</strong>
                    </p>
                  </div>
                ) : (
                  /* DIRECT LINK READY HEADER */
                  <div className="text-center space-y-1">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mx-auto mb-2 shadow-xs">
                      <KeyRound className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-base text-gray-900">
                      ลิงก์รีเซตรหัสผ่านพร้อมใช้งานแล้ว
                    </h4>
                    <p className="text-xs text-gray-500">
                      สำหรับบัญชี: <strong className="text-indigo-700 font-semibold">{matchedUser.name}</strong> ({matchedUser.email})
                    </p>
                  </div>
                )}

                {/* Delivery Notice Card */}
                {gmailSentSuccess ? (
                  <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-4 space-y-2 text-xs text-emerald-950">
                    <div className="flex items-center gap-2 font-bold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>อีเมลส่งออกถึงเซิร์ฟเวอร์เรียบร้อยแล้ว</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-emerald-900">
                      ระบบได้ทำการส่งอีเมลจริงพร้อมปุ่มตั้งค่ารหัสผ่านใหม่ไปยัง <strong>{matchedUser.email}</strong> เรียบร้อยแล้ว (ลิงก์มีอายุ 15 นาที)
                    </p>
                    <p className="text-[11px] text-emerald-800">
                      📩 กรุณาเปิดแอปอีเมลหรือ Outlook ของคุณเพื่อตรวจสอบกล่องข้อความขาเข้า (Inbox) หรือโฟลเดอร์จดหมายขยะ (Spam/Junk) ได้เลย!
                    </p>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2 text-xs text-amber-900">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-amber-800">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>ต้องการส่งอีเมลจริงไปยัง {matchedUser.email}?</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleStartSendGmail}
                        disabled={isSendingGmail}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Mail className="w-3 h-3" />
                        <span>ส่งผ่าน Gmail จริง</span>
                      </button>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      คุณสามารถคลิกปุ่มด้านบนเพื่อสั่งส่งอีเมลจริงผ่าน Gmail หรือกดปุ่มด้านล่างเพื่อเปลี่ยนรหัสผ่านบนหน้านี้ได้ทันที
                    </p>
                  </div>
                )}

                {/* Direct Action Card */}
                <div className="bg-white border border-indigo-200 rounded-2xl p-4 space-y-3.5 shadow-sm">
                  <button
                    id="btn-open-reset-password-page"
                    type="button"
                    onClick={() => setStep('reset_form')}
                    className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>กดที่นี่เพื่อเปลี่ยนรหัสผ่านใหม่ทันที (ไม่ต้องรออีเมล)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="font-semibold text-gray-700">ลิงก์รีเซตรหัสผ่าน (อายุ 15 นาที):</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyLink}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200"
                        >
                          {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedLink ? 'คัดลอกแล้ว!' : 'คัดลอกลิงก์'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleMailto}
                          className="text-xs font-bold text-slate-600 hover:text-slate-800 flex items-center gap-1 cursor-pointer bg-slate-100 px-2 py-1 rounded-md border border-slate-200"
                          title="เปิดโปรแกรมส่งอีเมลในเครื่อง"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>เปิดใน Mail App</span>
                        </button>
                      </div>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] font-mono text-gray-700 break-all select-all">
                      {resetLinkUrl}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setStep('confirm')}
                    className="text-xs text-gray-500 hover:text-gray-700 font-semibold cursor-pointer"
                  >
                    ← ย้อนกลับ
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
                  >
                    ปิดหน้าต่าง
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: RESET PASSWORD FORM ACCORDING TO SYSTEM POLICY */}
            {step === 'reset_form' && matchedUser && (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-gray-500 block text-[11px]">ผู้ใช้งาน:</span>
                    <strong className="text-gray-900">{matchedUser.name}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-500 block text-[11px]">อีเมล:</span>
                    <strong className="font-mono text-indigo-600">{matchedUser.email}</strong>
                  </div>
                </div>

                {resetError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <span>{resetError}</span>
                  </div>
                )}

                {/* Password Policy Requirements Checklist */}
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      เงื่อนไขตามนโยบายรหัสผ่านของระบบ:
                    </span>
                    <button
                      type="button"
                      onClick={handleAutoGenerateCompliantPassword}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer shadow-2xs"
                      title="สุ่มสร้างรหัสผ่านที่ผ่านตามนโยบายทันที"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      <span>ตั้งรหัสตามนโยบาย</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className={passwordPolicy.requireLowercase ? (/[a-z]/.test(newPassword) ? 'text-emerald-600 font-bold' : 'text-slate-400') : 'text-slate-300 line-through'}>
                        {/[a-z]/.test(newPassword) && passwordPolicy.requireLowercase ? '✓' : '•'} ตัวเล็ก (a-z)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={passwordPolicy.requireUppercase ? (/[A-Z]/.test(newPassword) ? 'text-emerald-600 font-bold' : 'text-slate-400') : 'text-slate-300 line-through'}>
                        {/[A-Z]/.test(newPassword) && passwordPolicy.requireUppercase ? '✓' : '•'} ตัวใหญ่ (A-Z)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={passwordPolicy.requireNumber ? (/[0-9]/.test(newPassword) ? 'text-emerald-600 font-bold' : 'text-slate-400') : 'text-slate-300 line-through'}>
                        {/[0-9]/.test(newPassword) && passwordPolicy.requireNumber ? '✓' : '•'} ตัวเลข (0-9)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={passwordPolicy.requireSpecialChar ? (/[^a-zA-Z0-9]/.test(newPassword) ? 'text-emerald-600 font-bold' : 'text-slate-400') : 'text-slate-300 line-through'}>
                        {/[^a-zA-Z0-9]/.test(newPassword) && passwordPolicy.requireSpecialChar ? '✓' : '•'} อักขระพิเศษ (!@#)
                      </span>
                    </div>
                  </div>

                  {passwordPolicy.preventReuseCount > 0 && (
                    <div className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                      ⚠️ ห้ามใช้รหัสผ่านซ้ำกับรหัสผ่านเดิม {passwordPolicy.preventReuseCount} ครั้งล่าสุด
                    </div>
                  )}
                </div>

                {/* New Password input */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="forgot-new-password"
                    className="block text-xs font-bold text-gray-700"
                  >
                    รหัสผ่านใหม่ (New Password)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                    <input
                      id="forgot-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="กรอกรหัสผ่านใหม่ตามเงื่อนไข"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-2.5 text-gray-400 hover:text-gray-600 p-0.5"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password input */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="forgot-confirm-password"
                    className="block text-xs font-bold text-gray-700"
                  >
                    ยืนยันรหัสผ่านใหม่อีกครั้ง (Confirm Password)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                    <input
                      id="forgot-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="กรอกรหัสผ่านใหม่อีกครั้งให้ตรงกัน"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs text-gray-900 font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-2.5 text-gray-400 hover:text-gray-600 p-0.5"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('confirm')}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
                  >
                    ย้อนกลับ
                  </button>
                  <button
                    id="btn-submit-reset-password"
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>บันทึกรหัสผ่านใหม่</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 5: SUCCESS NOTICE */}
            {step === 'success' && matchedUser && (
              <div className="text-center space-y-4 py-2">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900">
                    เปลี่ยนรหัสผ่านใหม่สำเร็จ!
                  </h4>
                  <p className="text-xs text-gray-600 mt-1 max-w-sm mx-auto">
                    รหัสผ่านใหม่ของคุณบันทึกเข้าระบบเรียบร้อยแล้ว บัญชีถูกปลดล็อคและพร้อมใช้งาน คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที
                  </p>
                </div>

                <button
                  id="btn-forgot-finish-login"
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  เข้าสู่ระบบทันที
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Confirmation Modal for sending real email via Gmail API */}
      {showConfirmSendGmailModal && matchedUser && (
        <div
          id="confirm-send-gmail-modal-backdrop"
          className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          onClick={() => setShowConfirmSendGmailModal(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-gray-900">
                  ยืนยันการส่งอีเมลจริงผ่าน Gmail
                </h4>
                <p className="text-[11px] text-gray-500">
                  บริการ Google Workspace Gmail
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5 text-slate-700">
              <div>
                <span className="text-gray-400">ส่งจาก (From):</span>{' '}
                <strong className="text-gray-900">{googleUser?.email || 'บัญชี Google ของคุณ'}</strong>
              </div>
              <div>
                <span className="text-gray-400">ส่งถึง (To):</span>{' '}
                <strong className="text-indigo-600">{matchedUser.email}</strong> ({matchedUser.name})
              </div>
              <div>
                <span className="text-gray-400">หัวข้อ:</span>{' '}
                <span>[Car Booking] ลิงก์สำหรับตั้งค่ารหัสผ่านใหม่</span>
              </div>
            </div>

            <p className="text-[11px] text-gray-600 leading-relaxed">
              ระบบจะทำการสร้างและส่งลิงก์สำหรับรีเซตรหัสผ่าน (อายุ 15 นาที) ไปยังกล่องจดหมายจริงของผู้รับทันที
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmSendGmailModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                id="btn-confirm-send-gmail-action"
                onClick={() => {
                  setShowConfirmSendGmailModal(false);
                  executeSendGmail();
                }}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>ยืนยันส่งอีเมล</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
