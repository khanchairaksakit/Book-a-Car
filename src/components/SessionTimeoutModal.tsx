import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, LogOut, CheckCircle2, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SessionTimeoutModalProps {
  isOpen: boolean;
  countdown: number; // Seconds remaining (15 down to 0)
  onConfirmContinue: () => void;
  onLogout: () => void;
}

export default function SessionTimeoutModal({
  isOpen,
  countdown,
  onConfirmContinue,
  onLogout,
}: SessionTimeoutModalProps) {
  if (!isOpen) return null;

  // Calculate percentage for visual ring/progress bar (15s to 0s)
  const percent = Math.max(0, Math.min(100, (countdown / 15) * 100));

  return (
    <AnimatePresence>
      <div
        id="session-timeout-modal-backdrop"
        className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-amber-200 overflow-hidden relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top accent bar */}
          <div className="h-2 w-full bg-linear-to-r from-amber-500 via-rose-500 to-indigo-500" />

          <div className="p-6 sm:p-7 text-center space-y-5">
            {/* Warning Icon Badge */}
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-amber-100 animate-ping opacity-30" />
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-inner">
                <AlertTriangle className="w-8 h-8 text-amber-600 animate-bounce" />
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
                แจ้งเตือน: เซสชันใกล้หมดอายุ
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                ระบบตรวจพบว่าไม่มีการใช้งานนานเกินกว่า{' '}
                <strong className="text-amber-700 font-bold">30 นาที</strong>{' '}
                เพื่อความปลอดภัยของข้อมูลในระบบ ระบบจะออกจากระบบอัตโนมัติหากไม่มีการยืนยัน
              </p>
            </div>

            {/* 15-second Countdown Highlight */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-amber-900 font-medium">
                <span className="flex items-center gap-1.5 font-bold">
                  <Clock className="w-4 h-4 text-amber-600" />
                  เวลานับถอยหลังยืนยัน:
                </span>
                <span className="font-mono text-xs font-bold text-amber-700">
                  {countdown} / 15 วินาที
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-amber-200/60 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                    countdown <= 5 ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>

              {/* Big Countdown Number */}
              <div className="pt-1 flex items-center justify-center gap-2">
                <span
                  className={`text-3xl font-extrabold font-mono tracking-tight ${
                    countdown <= 5 ? 'text-rose-600 scale-110 animate-pulse' : 'text-amber-600'
                  }`}
                >
                  {countdown}
                </span>
                <span className="text-xs font-bold text-amber-800">วินาที</span>
              </div>

              <p className="text-[11px] text-amber-800/80 font-medium">
                หากไม่กดยืนยันภายใน 15 วินาที ระบบจะนำคุณออกจากระบบเพื่อความปลอดภัย
              </p>
            </div>

            {/* Question */}
            <p className="text-xs font-bold text-gray-800">
              คุณต้องการใช้งานระบบต่อหรือไม่?
            </p>

            {/* Actions Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                id="btn-session-continue"
                type="button"
                onClick={onConfirmContinue}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer ring-2 ring-emerald-400/50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ยืนยันใช้งานต่อ</span>
              </button>

              <button
                id="btn-session-logout-now"
                type="button"
                onClick={onLogout}
                className="w-full py-3 px-4 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 border border-slate-200 hover:border-rose-200 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>ออกจากระบบ</span>
              </button>
            </div>

            {/* Security footer tip */}
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400 pt-1">
              <ShieldAlert className="w-3.5 h-3.5 text-gray-400" />
              <span>ระบบรักษาความปลอดภัย Session Timeout 30 นาที</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
