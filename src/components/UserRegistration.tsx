import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  UserRole,
  AppMenuKey,
  StandardRole,
  RolePermissionsMatrix,
} from '../types';
import { Language } from '../utils/translations';
import {
  getUserRoles,
  hasRole,
  getRoleBadgeInfo,
  STANDARD_ROLES,
  MENU_DEFINITIONS,
  DEFAULT_ROLE_PERMISSIONS,
  isUserAdmin,
} from '../utils/userHelpers';
import {
  downloadUserExcelTemplate,
  parseUserExcelFile,
  ParsedUserRow,
} from '../utils/excelUserUtils';
import {
  getStoredDepartments,
  saveStoredDepartments,
  getStoredDivisions,
  saveStoredDivisions,
  addCustomDepartment,
  addCustomDivision,
} from '../utils/organizationUtils';
import {
  getOrganizationSettings,
  saveOrganizationSettings,
  subscribeToOrganizationSettings,
} from '../lib/firebase';
import DepartmentDivisionModal, { DeptDivRenameItem } from './DepartmentDivisionModal';
import {
  UserCheck,
  Shield,
  Trash2,
  Edit2,
  X,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  KeyRound,
  Mail,
  Phone,
  AtSign,
  Download,
  Upload,
  FileSpreadsheet,
  Check,
  CheckCircle2,
  Building2,
  BadgeAlert,
  Search,
  FolderTree,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserRegistrationProps {
  users: User[];
  currentUser: User | null;
  onSelectUser: (user: User) => void;
  onAddUser?: (user: Omit<User, 'id'>) => void | Promise<void>;
  onAddMultipleUsers?: (newUsers: Omit<User, 'id'>[]) => void | Promise<void>;
  onEditUser: (user: User) => void | Promise<void>;
  onEditMultipleUsers?: (users: User[]) => void | Promise<void>;
  onDeleteUser: (userId: string) => void | Promise<void>;
  language?: Language;
  isLineModuleEnabled?: boolean;
  rolePermissions?: RolePermissionsMatrix;
  onUpdateRolePermissions?: (matrix: RolePermissionsMatrix) => void;
  canEdit?: boolean;
  viewOnly?: boolean;
  onlyShowPermissionsMatrix?: boolean;
}

export default function UserRegistration({
  users,
  currentUser,
  onSelectUser,
  onAddUser,
  onAddMultipleUsers,
  onEditUser,
  onEditMultipleUsers,
  onDeleteUser,
  language = 'th',
  isLineModuleEnabled = true,
  rolePermissions = DEFAULT_ROLE_PERMISSIONS,
  onUpdateRolePermissions,
  canEdit = true,
  viewOnly = false,
  onlyShowPermissionsMatrix = false,
}: UserRegistrationProps) {
  const hasEditPermission = canEdit && !viewOnly;
  const canModifyPermissionsMatrix = isUserAdmin(currentUser);
  const [permissionSavedNotice, setPermissionSavedNotice] = useState<string>('');

  const handleToggleMatrixPermission = (
    role: StandardRole,
    menuKey: AppMenuKey,
    field: 'viewOnly' | 'canEdit'
  ) => {
    if (!canModifyPermissionsMatrix || !onUpdateRolePermissions) return;

    const currentCell = rolePermissions[role]?.[menuKey] || {
      viewOnly: false,
      canEdit: false,
    };

    let nextCell = { ...currentCell };
    if (field === 'viewOnly') {
      const nextViewOnly = !currentCell.viewOnly;
      nextCell = {
        viewOnly: nextViewOnly,
        canEdit: nextViewOnly ? false : currentCell.canEdit,
      };
    } else {
      const nextCanEdit = !currentCell.canEdit;
      nextCell = {
        viewOnly: nextCanEdit ? false : currentCell.viewOnly,
        canEdit: nextCanEdit,
      };
    }

    const updatedMatrix: RolePermissionsMatrix = {
      ...rolePermissions,
      [role]: {
        ...rolePermissions[role],
        [menuKey]: nextCell,
      },
    };

    onUpdateRolePermissions(updatedMatrix);
    const menuLabel = MENU_DEFINITIONS.find((m) => m.key === menuKey)?.label || menuKey;
    const statusText = nextCell.canEdit
      ? 'แก้ไขได้'
      : nextCell.viewOnly
      ? 'ดูได้อย่างเดียว'
      : 'ปิดการเข้าถึง';
    setPermissionSavedNotice(`อัปเดตสิทธิ์ "${role}" ในเมนู "${menuLabel}" เป็น [${statusText}] เรียบร้อยแล้ว`);
    setTimeout(() => {
      setPermissionSavedNotice('');
    }, 3000);
  };

  const handleResetMatrixPermissions = () => {
    if (!canModifyPermissionsMatrix || !onUpdateRolePermissions) return;
    onUpdateRolePermissions(JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS)));
    setPermissionSavedNotice('รีเซ็ตตารางกำหนดสิทธิกลับเป็นค่าเริ่มต้นเรียบร้อยแล้ว');
    setTimeout(() => {
      setPermissionSavedNotice('');
    }, 3000);
  };
  const [isEditing, setIsEditing] = useState<User | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form Fields
  const [employeeCode, setEmployeeCode] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [division, setDivision] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [isUsernameManuallyEdited, setIsUsernameManuallyEdited] = useState(false);
  const [password, setPassword] = useState('password123');
  const [lineUserId, setLineUserId] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [roles, setRoles] = useState<UserRole[]>(['User']);
  const [error, setError] = useState('');

  // UI States
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [deptFilter, setDeptFilter] = useState<string>('All');
  const [divFilter, setDivFilter] = useState<string>('All');

  // Custom Departments & Divisions States
  const [departments, setDepartments] = useState<string[]>(() => getStoredDepartments());
  const [divisions, setDivisions] = useState<string[]>(() => getStoredDivisions());
  const departmentsRef = useRef<string[]>(departments);
  const divisionsRef = useRef<string[]>(divisions);
  const [isDeptDivModalOpen, setIsDeptDivModalOpen] = useState(false);

  useEffect(() => {
    departmentsRef.current = departments;
  }, [departments]);

  useEffect(() => {
    divisionsRef.current = divisions;
  }, [divisions]);

  // Sync departments and divisions from Firestore and Server (timestamp-ordered, never unioning old items back)
  useEffect(() => {
    let mounted = true;
    getOrganizationSettings().then(({ departments: cloudDepts, divisions: cloudDivs }) => {
      if (!mounted) return;
      departmentsRef.current = cloudDepts;
      divisionsRef.current = cloudDivs;
      setDepartments(cloudDepts);
      setDivisions(cloudDivs);
    });

    const unsub = subscribeToOrganizationSettings(({ departments: cloudDepts, divisions: cloudDivs }) => {
      if (!mounted) return;
      departmentsRef.current = cloudDepts;
      divisionsRef.current = cloudDivs;
      setDepartments(cloudDepts);
      setDivisions(cloudDivs);
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  // Excel Upload States
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importingFileName, setImportingFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedUserRow[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState('');

  const isEn = language === 'en';

  const resetForm = () => {
    setEmployeeCode('');
    setName('');
    setDepartment('');
    setDivision('');
    setPhone('');
    setEmail('');
    setUsername('');
    setIsUsernameManuallyEdited(false);
    setPassword('password123');
    setLineUserId('');
    setRoles(['User']);
    setError('');
    setShowFormPassword(false);
    setIsAddingNew(false);
    setIsEditing(null);
  };

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  // Toggle role checkbox (1 user can have multiple roles)
  const handleToggleRole = (roleToToggle: UserRole) => {
    setRoles((prev) => {
      let next: UserRole[];
      if (prev.includes(roleToToggle)) {
        next = prev.filter((r) => r !== roleToToggle);
      } else {
        next = [...prev, roleToToggle];
      }
      // Ensure at least one role is selected
      if (next.length === 0) {
        return [roleToToggle];
      }
      return next;
    });
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    // Only auto-derive username from email if the user has not manually entered a username
    if (!isUsernameManuallyEdited && (!username || username === email.split('@')[0])) {
      const derived = val.split('@')[0].toLowerCase();
      setUsername(derived);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const finalDept = department.trim();
    const finalDiv = division.trim();

    if (!name.trim() || !finalDept || !phone.trim() || !email.trim()) {
      setError(isEn ? 'Please fill in all required fields (*)' : 'กรุณากรอกข้อมูลให้ครบถ้วนทุกช่องที่มีดอกจัน (*)');
      return;
    }

    const cleanUsername = (username.trim() || name.trim() || email.split('@')[0] || `user${Date.now() % 10000}`).toLowerCase();
    const cleanPassword = password.trim() || 'password123';
    const effectiveRoles = roles.length > 0 ? roles : (['User'] as UserRole[]);

    // Validate unique username and email
    const duplicateUser = users.find(
      (u) =>
        (((u.username && u.username.toLowerCase() === cleanUsername) ||
          (u.email && u.email.toLowerCase() === email.trim().toLowerCase())) &&
          (isEditing ? u.id !== isEditing.id : true))
    );

    if (duplicateUser) {
      setError(
        isEn
          ? 'Username or Email is already used by another account'
          : 'ชื่อผู้ใช้ (Username) หรือ อีเมล นี้มีในระบบแล้ว กรุณาใช้ชื่ออื่น'
      );
      return;
    }

    const legacyRole = effectiveRoles.includes('Admin') ? 'Admin' : 'User';

    if (isEditing) {
      await onEditUser({
        ...isEditing,
        employeeCode: employeeCode.trim() || isEditing.employeeCode || `EMP-${String(users.length).padStart(3, '0')}`,
        name: name.trim(),
        department: finalDept,
        division: finalDiv,
        phone: phone.trim(),
        email: email.trim(),
        username: cleanUsername,
        password: cleanPassword,
        lineUserId: lineUserId.trim() || undefined,
        roles: effectiveRoles,
        role: legacyRole,
      });
      setImportSuccessMsg(isEn ? `Updated "${name.trim()}" successfully!` : `บันทึกการแก้ไข "${name.trim()}" เรียบร้อยแล้ว`);
      setTimeout(() => setImportSuccessMsg(''), 4000);
      resetForm();
    } else if (isAddingNew && onAddUser) {
      await onAddUser({
        employeeCode: employeeCode.trim() || `EMP-${String(users.length + 1).padStart(3, '0')}`,
        name: name.trim(),
        department: finalDept,
        division: finalDiv,
        phone: phone.trim(),
        email: email.trim(),
        username: cleanUsername,
        password: cleanPassword,
        lineUserId: lineUserId.trim() || undefined,
        roles: effectiveRoles,
        role: legacyRole,
      });
      setImportSuccessMsg(
        isEn
          ? `User "${name.trim()}" added successfully!`
          : `เพิ่มผู้ใช้งาน "${name.trim()}" สำเร็จแล้ว! (Username: ${cleanUsername})`
      );
      setTimeout(() => setImportSuccessMsg(''), 5000);
      resetForm();
    }
  };

  const startEdit = (user: User) => {
    const latestDepts = getStoredDepartments();
    const latestDivs = getStoredDivisions();
    departmentsRef.current = latestDepts;
    divisionsRef.current = latestDivs;
    setDepartments(latestDepts);
    setDivisions(latestDivs);
    setIsAddingNew(false);
    setIsEditing(user);
    setEmployeeCode(user.employeeCode || '');
    setName(user.name);
    const matchedDept = latestDepts.find(
      (d) => d.trim().toLowerCase() === (user.department || '').trim().toLowerCase()
    );
    const matchedDiv = latestDivs.find(
      (d) => d.trim().toLowerCase() === (user.division || '').trim().toLowerCase()
    );
    setDepartment(matchedDept || latestDepts[0] || '');
    setDivision(matchedDiv || '');
    setPhone(user.phone);
    setEmail(user.email);
    setUsername(user.username || user.email.split('@')[0]);
    setIsUsernameManuallyEdited(true);
    setPassword(user.password || 'password123');
    setLineUserId(user.lineUserId || '');
    setRoles(getUserRoles(user));
    setError('');
  };

  const startAddNew = () => {
    const latestDepts = getStoredDepartments();
    const latestDivs = getStoredDivisions();
    departmentsRef.current = latestDepts;
    divisionsRef.current = latestDivs;
    setDepartments(latestDepts);
    setDivisions(latestDivs);
    setIsEditing(null);
    setIsAddingNew(true);
    setEmployeeCode(`EMP-${String(users.length + 1).padStart(3, '0')}`);
    setName('');
    setDepartment(latestDepts[0] || '');
    setDivision(latestDivs[0] || '');
    setPhone('');
    setEmail('');
    setUsername('');
    setIsUsernameManuallyEdited(false);
    setPassword('password123');
    setLineUserId('');
    setRoles(['User']);
    setError('');
  };

  // Handle Excel File Selection
  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportingFileName(file.name);
    setError('');

    try {
      const rows = await parseUserExcelFile(file, users);
      setParsedRows(rows);
      setIsImportModalOpen(true);
    } catch (err) {
      console.error('Error reading Excel file:', err);
      setError(isEn ? 'Failed to read Excel file. Please use the official template.' : 'ไม่สามารถอ่านไฟล์ Excel ได้ กรุณาใช้ไฟล์ Template ที่ระบบสร้างให้');
    } finally {
      setImportLoading(false);
      // Reset input value so same file can be re-selected if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Confirm Excel Import
  const handleConfirmImport = () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) return;

    const newUsersToCreate: Omit<User, 'id'>[] = validRows.map((r, i) => ({
      employeeCode: r.employeeCode || `EMP${String(users.length + i + 1).padStart(3, '0')}`,
      name: r.name,
      department: r.department,
      division: r.division,
      phone: r.phone,
      email: r.email,
      username: r.username,
      password: r.password || 'password123',
      roles: r.roles.length > 0 ? r.roles : ['User'],
      role: r.roles.includes('Admin') ? 'Admin' : 'User',
    }));

    if (onAddMultipleUsers) {
      onAddMultipleUsers(newUsersToCreate);
    } else if (onAddUser) {
      newUsersToCreate.forEach((u) => onAddUser(u));
    }

    setImportSuccessMsg(
      isEn
        ? `Successfully imported ${validRows.length} users!`
        : `นำเข้าข้อมูลผู้ใช้งานเรียบร้อยแล้ว จำนวน ${validRows.length} ท่าน`
    );
    setIsImportModalOpen(false);
    setParsedRows([]);

    setTimeout(() => {
      setImportSuccessMsg('');
    }, 4000);
  };

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'All') {
      if (!hasRole(u, roleFilter as UserRole)) return false;
    }
    if (deptFilter !== 'All') {
      if ((u.department || '').trim().toLowerCase() !== deptFilter.trim().toLowerCase()) return false;
    }
    if (divFilter !== 'All') {
      if ((u.division || '').trim().toLowerCase() !== divFilter.trim().toLowerCase()) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = u.name.toLowerCase().includes(q);
      const matchCode = (u.employeeCode || '').toLowerCase().includes(q);
      const matchDept = u.department.toLowerCase().includes(q);
      const matchDiv = (u.division || '').toLowerCase().includes(q);
      const matchEmail = u.email.toLowerCase().includes(q);
      const matchUser = (u.username || '').toLowerCase().includes(q);
      return matchName || matchCode || matchDept || matchDiv || matchEmail || matchUser;
    }
    return true;
  });

  const handleSaveAllOrganization = async (
    newDepts: string[],
    newDivs: string[],
    deptRenames: DeptDivRenameItem[],
    divRenames: DeptDivRenameItem[]
  ) => {
    const prevDepts = departmentsRef.current;
    const prevDivs = divisionsRef.current;

    departmentsRef.current = newDepts;
    divisionsRef.current = newDivs;
    setDepartments(newDepts);
    setDivisions(newDivs);

    await saveOrganizationSettings(newDepts, newDivs);

    // Update filters if renamed or deleted
    let nextDeptFilter = deptFilter;
    for (const r of deptRenames) {
      if (nextDeptFilter.trim().toLowerCase() === r.oldName.trim().toLowerCase()) {
        nextDeptFilter = r.newName;
      }
    }
    if (
      nextDeptFilter !== 'All' &&
      !newDepts.some((d) => d.trim().toLowerCase() === nextDeptFilter.trim().toLowerCase())
    ) {
      nextDeptFilter = 'All';
    }
    if (nextDeptFilter !== deptFilter) {
      setDeptFilter(nextDeptFilter);
    }

    let nextDivFilter = divFilter;
    for (const r of divRenames) {
      if (nextDivFilter.trim().toLowerCase() === r.oldName.trim().toLowerCase()) {
        nextDivFilter = r.newName;
      }
    }
    if (
      nextDivFilter !== 'All' &&
      !newDivs.some((d) => d.trim().toLowerCase() === nextDivFilter.trim().toLowerCase())
    ) {
      nextDivFilter = 'All';
    }
    if (nextDivFilter !== divFilter) {
      setDivFilter(nextDivFilter);
    }

    // Update currently open Add/Edit User form fields if affected
    let nextFormDept = department;
    for (const r of deptRenames) {
      if (nextFormDept.trim().toLowerCase() === r.oldName.trim().toLowerCase()) {
        nextFormDept = r.newName;
      }
    }
    if (
      nextFormDept &&
      !newDepts.some((d) => d.trim().toLowerCase() === nextFormDept.trim().toLowerCase())
    ) {
      nextFormDept = newDepts[0] || '';
    }
    if (nextFormDept !== department) {
      setDepartment(nextFormDept);
    }

    let nextFormDiv = division;
    for (const r of divRenames) {
      if (nextFormDiv.trim().toLowerCase() === r.oldName.trim().toLowerCase()) {
        nextFormDiv = r.newName;
      }
    }
    if (
      nextFormDiv &&
      !newDivs.some((d) => d.trim().toLowerCase() === nextFormDiv.trim().toLowerCase())
    ) {
      nextFormDiv = '';
    }
    if (nextFormDiv !== division) {
      setDivision(nextFormDiv);
    }

    // Update users whose department or division was renamed or deleted
    const deletedDepts = prevDepts.filter(
      (oldD) =>
        !newDepts.some((newD) => newD.trim().toLowerCase() === oldD.trim().toLowerCase()) &&
        !deptRenames.some((r) => r.oldName.trim().toLowerCase() === oldD.trim().toLowerCase())
    );
    const deletedDivs = prevDivs.filter(
      (oldDiv) =>
        !newDivs.some((newDiv) => newDiv.trim().toLowerCase() === oldDiv.trim().toLowerCase()) &&
        !divRenames.some((r) => r.oldName.trim().toLowerCase() === oldDiv.trim().toLowerCase())
    );

    const updatedUsers: User[] = [];
    users.forEach((u) => {
      let userDept = u.department || '';
      let userDiv = u.division || '';
      let changed = false;

      for (const r of deptRenames) {
        if (userDept.trim().toLowerCase() === r.oldName.trim().toLowerCase()) {
          userDept = r.newName;
          changed = true;
        }
      }
      if (
        userDept &&
        deletedDepts.some((delD) => delD.trim().toLowerCase() === userDept.trim().toLowerCase())
      ) {
        userDept = newDepts[0] || '';
        changed = true;
      }

      for (const r of divRenames) {
        if (userDiv.trim().toLowerCase() === r.oldName.trim().toLowerCase()) {
          userDiv = r.newName;
          changed = true;
        }
      }
      if (
        userDiv &&
        deletedDivs.some((delDiv) => delDiv.trim().toLowerCase() === userDiv.trim().toLowerCase())
      ) {
        userDiv = '';
        changed = true;
      }

      if (changed) {
        updatedUsers.push({
          ...u,
          department: userDept,
          division: userDiv,
        });
      }
    });

    if (updatedUsers.length > 0) {
      if (onEditMultipleUsers) {
        await onEditMultipleUsers(updatedUsers);
      } else if (onEditUser) {
        for (const u of updatedUsers) {
          await onEditUser(u);
        }
      }
    }

    setImportSuccessMsg(
      isEn
        ? 'Saved department and division settings!'
        : 'บันทึกข้อมูลแผนกและฝ่ายเรียบร้อยแล้ว'
    );
    setTimeout(() => setImportSuccessMsg(''), 4000);
  };

  return (
    <div className="space-y-6" id="user-registration-section">
      {/* Top Header & Actions */}
      {!onlyShowPermissionsMatrix && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2 flex-wrap">
              <span>{isEn ? 'User Directory & Role Management' : 'กำหนดผู้ใช้งานและตารางกำหนดสิทธิ (User & Permission Management)'}</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                {users.length} {isEn ? 'Users' : 'บัญชี'}
              </span>
              {!hasEditPermission && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  🔒 โหมดดูได้อย่างเดียว (View Only)
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {isEn
                ? 'Configure employee details, department, division, and multi-roles (User, Operator, Approve 1, Approve 2, Admin) along with the Role Permissions Matrix.'
                : 'กำหนดข้อมูลพนักงาน แผนก ฝ่าย บทบาทการใช้งาน (User, Operator, Approve 1, Approve 2, Admin) และตารางกำหนดสิทธิการใช้งานแต่ละเมนู'}
            </p>
          </div>

          {/* Action Buttons: Add, Download Template, Upload Excel */}
          {hasEditPermission && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Download Template Button */}
              <button
                id="btn-download-excel-template"
                type="button"
                onClick={downloadUserExcelTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-200 shadow-2xs"
                title="ดาวน์โหลดไฟล์แบบฟอร์ม Excel (.xlsx) สำหรับกรอกข้อมูลผู้ใช้งาน"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>{isEn ? 'Excel Template' : 'ดาวน์โหลด Template Excel'}</span>
              </button>

              {/* Upload Excel Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleExcelFileChange}
                className="hidden"
                id="excel-file-uploader-input"
              />
              <button
                id="btn-upload-user-excel"
                type="button"
                disabled={importLoading}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                title="อัปโหลดไฟล์ Excel เพื่อนำเข้ารายชื่อผู้ใช้งานหลายคนพร้อมกัน"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{importLoading ? (isEn ? 'Reading...' : 'กำลังอ่านไฟล์...') : (isEn ? 'Import Excel' : 'นำเข้าจาก Excel')}</span>
              </button>

              {/* Manage Departments and Divisions Button */}
              <button
                id="btn-manage-departments-divisions"
                type="button"
                onClick={() => setIsDeptDivModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-indigo-200 shadow-2xs"
                title="กำหนดและจัดการรายชื่อแผนกและฝ่ายเอง"
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isEn ? 'Manage Dept & Div' : '🏢 กำหนดแผนกและฝ่าย'}</span>
                <span className="text-[10px] bg-indigo-200/80 text-indigo-800 px-1.5 py-0.2 rounded-full font-bold">
                  {departments.length + divisions.length}
                </span>
              </button>

              {/* Add Manual User Button */}
              {onAddUser && (
                <button
                  id="btn-add-user-modal"
                  onClick={startAddNew}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isEn ? 'Add User' : 'เพิ่มผู้ใช้งาน'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ROLE PERMISSIONS MATRIX TABLE (ตารางกำหนดสิทธิ) */}
      <div
        id="role-permissions-matrix-section"
        className="bg-white rounded-2xl border border-indigo-100 shadow-xs overflow-hidden"
      >
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Shield className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base sm:text-lg font-bold tracking-tight text-white">
                ตารางกำหนดสิทธิการใช้งานตามบทบาท (Role Permissions Matrix)
              </h3>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                5 เมนู × 5 บทบาท
              </span>
            </div>
            <p className="text-xs text-slate-300">
              ติ๊กเลือกช่อง <strong className="text-amber-300">ดูได้อย่างเดียว</strong> หรือ{' '}
              <strong className="text-emerald-300">แก้ไขได้</strong> ในแต่ละเมนูและบทบาท ระบบจะปรับสิทธิ์การแสดงผลและการทำงานตามที่เลือกทันที
            </p>
          </div>

          {!canModifyPermissionsMatrix && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-200 rounded-xl text-xs font-bold border border-amber-400/30 shrink-0 self-start sm:self-auto">
              <Lock className="w-3.5 h-3.5" />
              <span>เฉพาะบทบาท Admin เท่านั้นที่ปรับแก้ไขได้</span>
            </div>
          )}
        </div>

        {permissionSavedNotice && (
          <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{permissionSavedNotice}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/90 border-b border-gray-200 text-gray-800">
                <th className="py-3.5 px-4 font-bold text-xs min-w-[210px] border-r border-gray-200">
                  เมนูการใช้งาน (Menu)
                </th>
                {STANDARD_ROLES.map((role) => {
                  const badge = getRoleBadgeInfo(role, isEn);
                  return (
                    <th
                      key={role}
                      className="py-3 px-3 font-bold text-center min-w-[155px] border-r border-gray-200 last:border-r-0"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {role}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {MENU_DEFINITIONS.map((menu, idx) => (
                <tr
                  key={menu.key}
                  className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50/70' : 'bg-slate-50/40 hover:bg-slate-50/90'}
                >
                  <td className="py-3.5 px-4 border-r border-gray-200 align-middle">
                    <div className="font-bold text-gray-900 text-xs sm:text-sm">
                      {menu.label}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                      {menu.description}
                    </div>
                  </td>

                  {STANDARD_ROLES.map((role) => {
                    const cell = rolePermissions[role]?.[menu.key] || {
                      viewOnly: false,
                      canEdit: false,
                    };
                    return (
                      <td
                        key={`${menu.key}-${role}`}
                        className="py-3 px-3 border-r border-gray-200 last:border-r-0 align-middle"
                      >
                        <div className="flex flex-col gap-2 max-w-[145px] mx-auto">
                          {/* Checkbox 1: ดูได้อย่างเดียว */}
                          <label
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all ${
                              !canModifyPermissionsMatrix
                                ? 'cursor-not-allowed opacity-75'
                                : 'cursor-pointer'
                            } ${
                              cell.viewOnly
                                ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold shadow-2xs'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-amber-200'
                            }`}
                          >
                            <input
                              id={`perm-check-${menu.key}-${role.replace(/\s+/g, '')}-viewOnly`}
                              type="checkbox"
                              checked={cell.viewOnly}
                              disabled={!canModifyPermissionsMatrix}
                              onChange={() =>
                                handleToggleMatrixPermission(role, menu.key, 'viewOnly')
                              }
                              className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                            <span className="text-[11px] leading-tight select-none">
                              ดูได้อย่างเดียว
                            </span>
                          </label>

                          {/* Checkbox 2: แก้ไขได้ */}
                          <label
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all ${
                              !canModifyPermissionsMatrix
                                ? 'cursor-not-allowed opacity-75'
                                : 'cursor-pointer'
                            } ${
                              cell.canEdit
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold shadow-2xs'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-200'
                            }`}
                          >
                            <input
                              id={`perm-check-${menu.key}-${role.replace(/\s+/g, '')}-canEdit`}
                              type="checkbox"
                              checked={cell.canEdit}
                              disabled={!canModifyPermissionsMatrix}
                              onChange={() =>
                                handleToggleMatrixPermission(role, menu.key, 'canEdit')
                              }
                              className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span className="text-[11px] leading-tight select-none">
                              แก้ไขได้
                            </span>
                          </label>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Success Notification Banner */}
      {!onlyShowPermissionsMatrix && (
        <>
          {importSuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{importSuccessMsg}</span>
            </div>
          )}

      {/* Active User Banner */}
      {currentUser && (
        <div id="active-user-banner" className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0">
              {currentUser.name.substring(0, 2)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-gray-900 text-sm">{currentUser.name}</span>
                {currentUser.employeeCode && (
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-slate-200/80 text-slate-800 rounded-md">
                    {currentUser.employeeCode}
                  </span>
                )}
                {/* Display All Roles */}
                <div className="flex items-center gap-1">
                  {getUserRoles(currentUser).map((r) => {
                    const badge = getRoleBadgeInfo(r, isEn);
                    return (
                      <span
                        key={r}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.bg} ${badge.text} ${badge.border}`}
                      >
                        {badge.label}
                      </span>
                    );
                  })}
                </div>
                <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 font-mono font-semibold rounded-md border border-indigo-200">
                  @{currentUser.username || currentUser.email.split('@')[0]}
                </span>
              </div>
              <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-gray-800">{currentUser.department}</span>
                {currentUser.division && <span>• ฝ่าย: {currentUser.division}</span>}
                <span>• {isEn ? 'Email:' : 'อีเมล:'} {currentUser.email}</span>
                {currentUser.phone && (
                  <span>
                    • {isEn ? 'Tel:' : 'โทร:'}{' '}
                    <a
                      href={`tel:${currentUser.phone.replace(/[^0-9+]/g, '')}`}
                      className="text-emerald-700 hover:text-emerald-800 font-mono font-bold hover:underline"
                      title={`กดเพื่อโทรออก ${currentUser.phone}`}
                    >
                      📞 {currentUser.phone}
                    </a>
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-indigo-100 text-xs font-semibold text-indigo-700 shadow-2xs">
            🟢 {isEn ? 'Currently Logged In' : 'โปรไฟล์ที่กำลังเข้าสู่ระบบ'}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isEn ? 'Search name, emp ID, department, division...' : 'ค้นหาชื่อ, รหัสพนักงาน, แผนก, ฝ่าย...'}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Department Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 font-medium shrink-0">{isEn ? 'Dept:' : 'แผนก:'}</span>
            <select
              id="filter-select-department"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-50 border border-gray-300 rounded-lg font-medium text-gray-800 focus:ring-1 focus:ring-indigo-500 outline-hidden max-w-[150px] truncate"
            >
              <option value="All">{isEn ? 'All Departments' : 'ทุกแผนก'}</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Division Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 font-medium shrink-0">{isEn ? 'Div:' : 'ฝ่าย:'}</span>
            <select
              id="filter-select-division"
              value={divFilter}
              onChange={(e) => setDivFilter(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-50 border border-gray-300 rounded-lg font-medium text-gray-800 focus:ring-1 focus:ring-indigo-500 outline-hidden max-w-[150px] truncate"
            >
              <option value="All">{isEn ? 'All Divisions' : 'ทุกฝ่าย'}</option>
              {divisions.map((div) => (
                <option key={div} value={div}>
                  {div}
                </option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-1 flex-wrap">
            {['All', 'User', 'Operator', 'Approve 1', 'Approve 2', 'Admin'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  roleFilter === r
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {r === 'All' ? (isEn ? 'All' : 'ทั้งหมด') : r}
              </button>
            ))}
          </div>

          {/* Clear Filters Button if any active */}
          {(roleFilter !== 'All' || deptFilter !== 'All' || divFilter !== 'All' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setRoleFilter('All');
                setDeptFilter('All');
                setDivFilter('All');
                setSearchQuery('');
              }}
              className="px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 rounded-lg font-semibold transition-colors cursor-pointer"
            >
              {isEn ? 'Clear Filters' : 'ล้างตัวกรอง'}
            </button>
          )}
        </div>
      </div>

      {/* User Selection and Management List */}
      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
              <UserPlus className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">
                {isEn ? 'No users found' : 'ไม่พบรายชื่อผู้ใช้งานตามเงื่อนไขที่เลือก'}
              </h3>
              <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                {searchQuery || roleFilter !== 'All'
                  ? isEn
                    ? 'Try clearing the search or role filter'
                    : 'ลองล้างคำค้นหาหรือเปลี่ยนตัวกรองบทบาท'
                  : isEn
                  ? 'Get started by creating a new user or importing from Excel'
                  : 'เริ่มต้นโดยการเพิ่มผู้ใช้งานใหม่ หรือนำเข้าจากไฟล์ Excel'}
              </p>
            </div>
            {onAddUser && (
              <button
                type="button"
                onClick={startAddNew}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer hover:scale-[1.02]"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isEn ? 'Add First User' : 'เพิ่มผู้ใช้งานใหม่'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((user) => {
              const isActive = currentUser?.id === user.id;
              const userPass = user.password || 'password123';
              const userHandle = user.username || user.email.split('@')[0];
              const isPasswordVisible = visiblePasswords[user.id];
              const userRoleList = getUserRoles(user);

              return (
                <div
                  key={user.id}
                  id={`user-card-${user.id}`}
                  className={`relative p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                    isActive
                      ? 'bg-indigo-50/40 border-indigo-400 ring-2 ring-indigo-400/20 shadow-xs'
                      : 'bg-white border-gray-200 hover:border-gray-300 shadow-xs'
                  }`}
                >
                  <div>
                    {/* Header with Avatar, Name, Employee Code */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 ${
                            userRoleList.includes('Admin')
                              ? 'bg-purple-600'
                              : userRoleList.includes('Approve')
                              ? 'bg-blue-600'
                              : 'bg-indigo-600'
                          }`}
                        >
                          {user.name.substring(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-gray-900 text-sm leading-snug truncate" title={user.name}>
                            {user.name}
                          </h4>
                          <span className="text-[11px] font-mono text-gray-500 font-semibold">
                            {user.employeeCode ? `[${user.employeeCode}]` : '-'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Department & Division Badges */}
                    <div className="mb-3 space-y-1 text-xs">
                      <div className="flex items-center gap-1 text-gray-700">
                        <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-900 truncate">
                          {isEn ? 'Dept:' : 'แผนก:'} {user.department}
                        </span>
                      </div>
                      {user.division && (
                        <div className="text-[11px] text-gray-500 pl-4.5 truncate">
                          <span>{isEn ? 'Div:' : 'ฝ่าย:'} {user.division}</span>
                        </div>
                      )}
                    </div>

                    {/* Multi-Roles Badges (User, Approve, Admin) */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                      <span className="text-[10px] text-gray-400 font-bold uppercase mr-1">บทบาท:</span>
                      {userRoleList.map((r) => {
                        const badge = getRoleBadgeInfo(r, isEn);
                        return (
                          <span
                            key={r}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            {badge.label}
                          </span>
                        );
                      })}
                    </div>

                    {/* Dedicated Credentials Box for this User */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 mb-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 font-medium flex items-center gap-1">
                          <AtSign className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Username:</span>
                        </span>
                        <span className="font-mono font-bold text-indigo-900 bg-white px-2 py-0.5 rounded border border-indigo-100 text-[11px]">
                          {userHandle}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 font-medium flex items-center gap-1">
                          <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                          <span>Password:</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-gray-800 bg-white px-2 py-0.5 rounded border border-gray-200 text-[11px]">
                            {isPasswordVisible ? userPass : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(user.id)}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                            title={isPasswordVisible ? 'Hide' : 'Show'}
                          >
                            {isPasswordVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
                        <span className="text-gray-500 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-gray-400" />
                          <span>{isEn ? 'Email:' : 'อีเมล:'}</span>
                        </span>
                        <span className="text-gray-700 truncate max-w-[140px] font-medium" title={user.email}>
                          {user.email}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-gray-500 mb-3 flex items-center justify-between gap-2">
                      {user.phone ? (
                        <a
                          href={`tel:${user.phone.replace(/[^0-9+]/g, '')}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-mono font-semibold hover:underline bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200"
                          title={`กดเพื่อโทรออก ${user.phone}`}
                        >
                          <Phone className="w-3 h-3 text-emerald-600" />
                          <span>{isEn ? 'Tel:' : 'โทร:'} {user.phone}</span>
                        </a>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span>{isEn ? 'Tel:' : 'โทร:'} -</span>
                        </span>
                      )}
                      {isLineModuleEnabled && hasEditPermission && (
                        user.lineUserId ? (
                          <button
                            type="button"
                            onClick={() => startEdit(user)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#06C755]/15 hover:bg-[#06C755]/25 text-[#059440] border border-[#06C755]/30 truncate max-w-[145px] cursor-pointer"
                            title={`คลิกเพื่อแก้ไข LINE ID (${user.lineUserId})`}
                          >
                            💬 LINE: {user.lineUserId}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(user)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 cursor-pointer"
                            title="คลิกเพื่อเพิ่ม LINE ID สำหรับรับแจ้งเตือน"
                          >
                            + ระบุ LINE ID
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Current Logged-in' : 'บัญชีที่เข้าสู่ระบบอยู่'}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400 font-mono">
                        {user.employeeCode || user.username || ''}
                      </span>
                    )}

                    {hasEditPermission && (
                      <div className="flex items-center gap-1">
                        <button
                          id={`btn-edit-user-${user.id}`}
                          onClick={() => startEdit(user)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                          title={isEn ? 'Edit Info & Roles' : 'แก้ไขข้อมูลและบทบาท'}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`btn-delete-user-${user.id}`}
                          onClick={() => setDeletingUser(user)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                          title={isEn ? 'Delete Account' : 'ลบผู้ใช้'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit User Modal Dialog */}
      <AnimatePresence>
        {(isEditing || isAddingNew) && (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={resetForm}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 my-8 space-y-4 max-h-[90vh] flex flex-col z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold shadow-xs">
                    {isEditing ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">
                      {isEditing
                        ? isEn
                          ? 'Edit User & Roles'
                          : 'แก้ไขข้อมูลและบทบาทหน้าที่'
                        : isEn
                        ? 'Add New User Account'
                        : 'เพิ่มผู้ใช้งานใหม่'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {isEditing
                        ? `รหัส: ${isEditing.employeeCode || isEditing.id} (${isEditing.name})`
                        : 'กรอกรายละเอียดพนักงานและกำหนดบทบาทสิทธิ์การใช้งานในระบบ'}
                    </p>
                  </div>
                </div>
                <button
                  id="btn-close-user-form"
                  onClick={resetForm}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 shrink-0">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form id="user-registration-form" onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-3.5">
                <div className="flex-1 overflow-y-auto pr-1 space-y-3.5">
                  {/* Employee ID */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {isEn ? 'Employee ID' : 'รหัสพนักงาน'}
                    </label>
                    <input
                      id="user-input-emp-code"
                      type="text"
                      value={employeeCode}
                      onChange={(e) => setEmployeeCode(e.target.value)}
                      placeholder="เช่น EMP-001"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {isEn ? 'Full Name' : 'ชื่อ-นามสกุล'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="user-input-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={isEn ? 'e.g. Somchai Jaidee' : 'เช่น สมชาย ใจดี'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                      required
                    />
                  </div>

                  {/* Department (แผนก) - ดึงข้อมูลจากกำหนดแผนกและฝ่ายเท่านั้น */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-gray-700">
                        {isEn ? 'Department' : 'แผนก'} <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[10px] text-gray-400">
                        {isEn ? 'From Department & Division Settings' : 'ดึงข้อมูลจากเมนู "กำหนดแผนกและฝ่าย"'}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <select
                        id="user-input-dept"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white font-medium text-gray-900 cursor-pointer"
                        required
                      >
                        <option value="">
                          {isEn ? '-- Select Department --' : '-- เลือกแผนกจากระบบ --'}
                        </option>
                        {departments.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Division (ฝ่าย) - ดึงข้อมูลจากกำหนดแผนกและฝ่ายเท่านั้น */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-gray-700">
                        {isEn ? 'Division / Section' : 'ฝ่าย'}
                      </label>
                      <span className="text-[10px] text-gray-400">
                        {isEn ? 'From Department & Division Settings' : 'ดึงข้อมูลจากเมนู "กำหนดแผนกและฝ่าย"'}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <select
                        id="user-input-division"
                        value={division}
                        onChange={(e) => setDivision(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white font-medium text-gray-900 cursor-pointer"
                      >
                        <option value="">
                          {isEn ? '-- Select Division --' : '-- เลือกฝ่ายจากระบบ --'}
                        </option>
                        {divisions.map((div) => (
                          <option key={div} value={div}>
                            {div}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Multi-Roles Selection: User, Approve 1, Approve 2, Admin */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-gray-800">
                        {isEn ? 'User Roles (Multi-Select)' : 'กำหนดบทบาทผู้ใช้งาน (เลือกได้มากกว่า 1 บทบาท)'} <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[10px] text-gray-500">เลือกอย่างน้อย 1 บทบาท</span>
                    </div>

                    <div className="space-y-2 pt-1">
                      {/* Role 1: User */}
                      <label
                        className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
                          roles.includes('User')
                            ? 'bg-white border-slate-400 shadow-2xs'
                            : 'border-transparent hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={roles.includes('User')}
                          onChange={() => handleToggleRole('User')}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">
                            User (ผู้ใช้งานทั่วไป)
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            ขอยื่นจองรถยนต์ และดูสถานะคำขอของตนเอง
                          </span>
                        </div>
                      </label>

                      {/* Role 2: Operator */}
                      <label
                        className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
                          roles.includes('Operator')
                            ? 'bg-amber-50/70 border-amber-400 shadow-2xs'
                            : 'border-transparent hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={roles.includes('Operator')}
                          onChange={() => handleToggleRole('Operator')}
                          className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-amber-900 block">
                            Operator (เจ้าหน้าที่ดูแลรถส่วนกลาง)
                          </span>
                          <span className="text-[10px] text-amber-700 block">
                            จัดการข้อมูลรถยนต์ ตรวจสอบสถานะ และดูแลรายงานการใช้รถตามตารางกำหนดสิทธิ
                          </span>
                        </div>
                      </label>

                      {/* Role 3: Approve 1 */}
                      <label
                        className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
                          roles.includes('Approve 1') || roles.includes('Approve' as any)
                            ? 'bg-blue-50/70 border-blue-400 shadow-2xs'
                            : 'border-transparent hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={roles.includes('Approve 1') || roles.includes('Approve' as any)}
                          onChange={() => handleToggleRole('Approve 1')}
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-blue-900 block">
                            Approve 1 (ผู้อนุมัติขั้นที่ 1)
                          </span>
                          <span className="text-[10px] text-blue-600 block">
                            อนุมัติคำขอจองรถยนต์ของพนักงานในฝ่ายเดียวกัน
                          </span>
                        </div>
                      </label>

                      {/* Role 3: Approve 2 */}
                      <label
                        className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
                          roles.includes('Approve 2')
                            ? 'bg-emerald-50/70 border-emerald-400 shadow-2xs'
                            : 'border-transparent hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={roles.includes('Approve 2')}
                          onChange={() => handleToggleRole('Approve 2')}
                          className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-emerald-900 block">
                            Approve 2 (ผู้อนุมัติขั้นที่ 2)
                          </span>
                          <span className="text-[10px] text-emerald-600 block">
                            อนุมัติคำขอจองรถยนต์ในขั้นสุดท้ายต่อจาก Approve 1
                          </span>
                        </div>
                      </label>

                      {/* Role 4: Admin */}
                      <label
                        className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
                          roles.includes('Admin')
                            ? 'bg-purple-50/70 border-purple-400 shadow-2xs'
                            : 'border-transparent hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={roles.includes('Admin')}
                          onChange={() => handleToggleRole('Admin')}
                          className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-purple-900 block">
                            Admin (ผู้ดูแลระบบ)
                          </span>
                          <span className="text-[10px] text-purple-600 block">
                            จัดการรถ ยานพาหนะ ผู้ใช้งาน และดูรายงานทั้งหมด
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Username Input */}
                  <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/80 space-y-1.5">
                    <label className="block text-xs font-bold text-indigo-900">
                      <span className="flex items-center gap-1.5">
                        <AtSign className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Username สำหรับเข้าสู่ระบบ</span> <span className="text-red-500">*</span>
                      </span>
                    </label>
                    <input
                      id="user-input-username"
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setIsUsernameManuallyEdited(true);
                        setUsername(e.target.value);
                      }}
                      placeholder="เช่น somchai หรือ admin"
                      className="w-full px-3 py-1.5 border border-indigo-200 bg-white rounded-lg text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                      required
                    />
                    <p className="text-[10px] text-indigo-600">
                      ใช้เข้าสู่ระบบด้วย Username คู่กับ Password
                    </p>
                  </div>

                  {/* Password Input */}
                  <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100/80 space-y-1.5">
                    <label className="block text-xs font-bold text-amber-900">
                      <span className="flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                        <span>Password รหัสผ่านเข้าสู่ระบบ</span> <span className="text-red-500">*</span>
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        id="user-input-password"
                        type={showFormPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="password123"
                        className="w-full pl-3 pr-10 py-1.5 border border-amber-200 bg-white rounded-lg text-xs font-mono focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowFormPassword(!showFormPassword)}
                        className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Work Email */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {isEn ? 'Work Email' : 'อีเมลองค์กร (ล็อกอินด้วยเมลนี้ได้)'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="user-input-email"
                      type="email"
                      value={email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      placeholder="user@company.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                      required
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {isEn ? 'Phone Number' : 'เบอร์โทรศัพท์'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="user-input-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="081-xxx-xxxx"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                      required
                    />
                  </div>

                  {/* LINE ID / LINE User ID */}
                  {isLineModuleEnabled && (
                    <div className="bg-[#06C755]/10 p-3 rounded-xl border border-[#06C755]/30 space-y-1">
                      <label className="block text-xs font-bold text-[#059440]">
                        💬 LINE ID หรือ LINE User ID (สำหรับรับการแจ้งเตือนผ่าน LINE)
                      </label>
                      <input
                        id="user-input-line-id"
                        type="text"
                        value={lineUserId}
                        onChange={(e) => setLineUserId(e.target.value)}
                        placeholder="เช่น @somchai หรือ U1234567890abcdef... (เว้นว่างได้)"
                        className="w-full px-3 py-1.5 border border-[#06C755]/40 bg-white rounded-lg text-xs focus:ring-1 focus:ring-[#06C755] focus:outline-hidden"
                      />
                      <p className="text-[10px] text-emerald-700">
                        ใช้สำหรับเชื่อมต่อการแจ้งเตือนคำขอและผลการจองรถผ่าน LINE
                      </p>
                    </div>
                  )}
                </div>

                {/* Modal Footer directly inside <form> so submit works natively across all browsers */}
                <div className="flex items-center gap-3 pt-3 border-t border-gray-100 shrink-0">
                  <button
                    id="btn-cancel-user-form"
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer text-center"
                  >
                    {isEn ? 'Cancel' : 'ยกเลิก'}
                  </button>
                  <button
                    id="btn-submit-user-form"
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer text-center"
                  >
                    {isEditing
                      ? isEn
                        ? 'Save Changes'
                        : 'บันทึกการแก้ไข'
                      : isEn
                      ? 'Create User'
                      : 'สร้างบัญชีผู้ใช้'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Excel Import Preview Modal */}
      {isImportModalOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => {
            setIsImportModalOpen(false);
            setParsedRows([]);
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <FileSpreadsheet className="w-5 h-5" />
                <h3 className="font-bold text-gray-900 text-base">
                  {isEn ? 'Preview Users from Excel File' : 'ตรวจสอบข้อมูลผู้ใช้งานจากไฟล์ Excel ก่อนนำเข้า'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setParsedRows([]);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-gray-600 flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <p>
                  <strong>ไฟล์:</strong> {importingFileName}
                </p>
                <p className="text-[11px] text-gray-500">
                  พบข้อมูลทั้งหมด <strong>{parsedRows.length}</strong> แถว (พร้อมนำเข้า{' '}
                  <strong className="text-emerald-600">{parsedRows.filter((r) => r.isValid).length}</strong> คน,
                  ข้อผิดพลาด{' '}
                  <strong className="text-red-500">{parsedRows.filter((r) => !r.isValid).length}</strong> แถว)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadUserExcelTemplate}
                  className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium cursor-pointer"
                >
                  {isEn ? 'Re-download Template' : 'ดาวน์โหลด Template อีกครั้ง'}
                </button>
              </div>
            </div>

            {/* Table of Parsed Rows */}
            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-gray-800 font-bold sticky top-0 border-b border-gray-200">
                  <tr>
                    <th className="p-2.5">สถานะ</th>
                    <th className="p-2.5">รหัสพนักงาน</th>
                    <th className="p-2.5">ชื่อ-นามสกุล</th>
                    <th className="p-2.5">แผนก</th>
                    <th className="p-2.5">ฝ่าย</th>
                    <th className="p-2.5">เบอร์โทร</th>
                    <th className="p-2.5">อีเมล</th>
                    <th className="p-2.5">บทบาท</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parsedRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={row.isValid ? 'hover:bg-slate-50' : 'bg-red-50/50 hover:bg-red-50'}
                    >
                      <td className="p-2.5 whitespace-nowrap">
                        {row.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3" /> พร้อมนำเข้า
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full"
                            title={row.errors.join(', ')}
                          >
                            <AlertCircle className="w-3 h-3" /> {row.errors[0] || 'ข้อผิดพลาด'}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 font-mono text-[11px]">{row.employeeCode || '-'}</td>
                      <td className="p-2.5 font-bold text-gray-900">{row.name}</td>
                      <td className="p-2.5 text-gray-700">{row.department}</td>
                      <td className="p-2.5 text-gray-700">{row.division}</td>
                      <td className="p-2.5 text-gray-700">
                        {row.phone ? (
                          <a
                            href={`tel:${row.phone.replace(/[^0-9+]/g, '')}`}
                            className="text-emerald-700 hover:underline font-mono font-semibold"
                          >
                            {row.phone}
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-2.5 text-gray-700">{row.email}</td>
                      <td className="p-2.5">
                        <div className="flex flex-wrap gap-1">
                          {row.roles.map((r) => (
                            <span
                              key={r}
                              className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-200 text-slate-800 rounded"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                ระบบจะนำเข้าเฉพาะแถวที่สถานะเป็น <strong className="text-emerald-600">พร้อมนำเข้า</strong>
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setParsedRows([]);
                  }}
                  className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  {isEn ? 'Cancel' : 'ยกเลิก'}
                </button>
                <button
                  type="button"
                  disabled={parsedRows.filter((r) => r.isValid).length === 0}
                  onClick={handleConfirmImport}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isEn
                      ? `Confirm Import (${parsedRows.filter((r) => r.isValid).length} Users)`
                      : `ยืนยันนำเข้า (${parsedRows.filter((r) => r.isValid).length} ท่าน)`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Custom Modal */}
      {deletingUser && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setDeletingUser(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center font-bold text-lg shrink-0">
                🗑️
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">
                  {isEn ? 'Confirm Delete User' : 'ยืนยันลบผู้ใช้งาน'}
                </h3>
                <p className="text-xs text-gray-500">
                  {isEn
                    ? 'Are you sure you want to remove this account from the directory?'
                    : 'คุณต้องการลบรายชื่อผู้ใช้งานนี้ออกจากระบบใช่หรือไม่?'}
                </p>
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-gray-700 space-y-1">
              <p><strong className="font-semibold text-gray-900">{isEn ? 'Name:' : 'ชื่อ-นามสกุล:'}</strong> {deletingUser.name}</p>
              <p><strong className="font-semibold text-gray-900">Username:</strong> @{deletingUser.username || deletingUser.email.split('@')[0]}</p>
              <p><strong className="font-semibold text-gray-900">{isEn ? 'Department:' : 'แผนก:'}</strong> {deletingUser.department}</p>
              <p><strong className="font-semibold text-gray-900">{isEn ? 'Email:' : 'อีเมล:'}</strong> {deletingUser.email}</p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                id="btn-cancel-delete-user"
                onClick={() => setDeletingUser(null)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                {isEn ? 'Cancel' : 'ยกเลิก'}
              </button>
              <button
                id="btn-confirm-delete-user"
                onClick={() => {
                  onDeleteUser(deletingUser.id);
                  setDeletingUser(null);
                }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                {isEn ? 'Confirm Delete' : 'ยืนยันลบผู้ใช้'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Department & Division Customization Modal */}
      <DepartmentDivisionModal
        isOpen={isDeptDivModalOpen}
        onClose={() => setIsDeptDivModalOpen(false)}
        departments={departments}
        divisions={divisions}
        users={users}
        onSaveDepartments={(newDepts) => {
          departmentsRef.current = newDepts;
          setDepartments(newDepts);
          saveOrganizationSettings(newDepts, divisionsRef.current).catch(() => {});
        }}
        onSaveDivisions={(newDivs) => {
          divisionsRef.current = newDivs;
          setDivisions(newDivs);
          saveOrganizationSettings(departmentsRef.current, newDivs).catch(() => {});
        }}
        onSaveAll={handleSaveAllOrganization}
        onDepartmentAdded={(addedDept) => {
          if (isAddingNew || isEditing) {
            setDepartment(addedDept);
          }
        }}
        onDivisionAdded={(addedDiv) => {
          if (isAddingNew || isEditing) {
            setDivision(addedDiv);
          }
        }}
        language={language}
      />
        </>
      )}
    </div>
  );
}
