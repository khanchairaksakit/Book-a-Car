import React, { useState, useMemo } from 'react';
import { User, UserRole } from '../types';
import { getUserRoles, getRoleBadgeInfo } from '../utils/userHelpers';
import {
  X,
  Search,
  Check,
  Shield,
  CheckCircle2,
  Users,
  Building2,
  Sparkles,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  currentUser: User | null;
  onSelectUser: (user: User) => void;
  onOpenLoginPage?: () => void;
  language: 'th' | 'en';
}

export default function UserSwitcherModal({
  isOpen,
  onClose,
  users,
  currentUser,
  onSelectUser,
  onOpenLoginPage,
  language,
}: UserSwitcherModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | UserRole>('All');

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        u.name.toLowerCase().includes(q) ||
        (u.employeeCode && u.employeeCode.toLowerCase().includes(q)) ||
        u.department.toLowerCase().includes(q) ||
        (u.division && u.division.toLowerCase().includes(q)) ||
        u.email.toLowerCase().includes(q);

      const roles = getUserRoles(u);
      const matchRole = roleFilter === 'All' || roles.includes(roleFilter);

      return matchQuery && matchRole;
    });
  }, [users, searchQuery, roleFilter]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden z-10"
        >
          {/* Header */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">
                  {language === 'th' ? 'สลับบัญชีผู้ใช้งาน' : 'Switch Active Account'}
                </h3>
                <p className="text-xs text-gray-500">
                  {language === 'th'
                    ? 'เลือกบัญชีพนักงานเพื่อสลับการใช้งานในระบบ'
                    : 'Select staff account to switch profile'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search & Filters */}
          <div className="p-4 border-b border-gray-100 space-y-3 bg-white">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  language === 'th'
                    ? 'ค้นหาด้วยชื่อ, รหัสพนักงาน, แผนก หรือฝ่าย...'
                    : 'Search by name, employee code, department, or division...'
                }
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Role Filter Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-gray-400 mr-1">
                {language === 'th' ? 'กรองตามสิทธิ์:' : 'Role:'}
              </span>
              {(['All', 'Admin', 'Approve', 'User'] as const).map((r) => {
                const isSelected = roleFilter === r;
                let label = language === 'th' ? 'ทั้งหมด' : 'All';
                if (r === 'Admin') label = language === 'th' ? 'Admin (ผู้ดูแลระบบ)' : 'Admin';
                if (r === 'Approve') label = language === 'th' ? 'Approve (ผู้อนุมัติ)' : 'Approver';
                if (r === 'User') label = language === 'th' ? 'User (ผู้ใช้งาน)' : 'User';

                return (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* User List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-96">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs">
                {language === 'th' ? 'ไม่พบรายชื่อพนักงานที่ตรงกับเงื่อนไข' : 'No staff matched your query'}
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isCurrent = currentUser?.id === u.id;
                const roles = getUserRoles(u);

                return (
                  <div
                    key={u.id}
                    onClick={() => {
                      onSelectUser(u);
                      onClose();
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isCurrent
                        ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20'
                        : 'border-gray-200 hover:border-indigo-300 hover:bg-slate-50 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                        {u.name.substring(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 text-xs">
                            {u.name}
                          </span>
                          {u.employeeCode && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {u.employeeCode}
                            </span>
                          )}
                          {isCurrent && (
                            <span className="bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                              {language === 'th' ? 'ใช้งานอยู่' : 'Active'}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-500 block truncate mt-0.5">
                          {u.department} {u.division ? `• ${u.division}` : ''}
                        </span>
                        <div className="flex items-center gap-1 flex-wrap mt-1">
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

                    <div className="shrink-0 flex items-center gap-1.5">
                      {isCurrent ? (
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check className="w-4 h-4" />
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group-hover:translate-x-1">
                          {language === 'th' ? 'เลือก' : 'Select'}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer action */}
          <div className="p-3.5 bg-slate-50 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500 text-[11px]">
              {language === 'th' ? `พนักงานทั้งหมด ${users.length} คน` : `Total ${users.length} employees`}
            </span>
            {onOpenLoginPage && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLoginPage();
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <Lock className="w-3 h-3" />
                <span>{language === 'th' ? 'ไปหน้าเข้าสู่ระบบ (Sign In)' : 'Go to Sign In Page'}</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
