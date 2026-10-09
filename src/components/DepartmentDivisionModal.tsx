import React, { useState, useEffect } from 'react';
import { Building2, FolderTree, Plus, Trash2, Edit2, Check, X, Search, Users, AlertCircle, Save } from 'lucide-react';
import { User } from '../types';

export interface DeptDivRenameItem {
  oldName: string;
  newName: string;
}

interface DepartmentDivisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: string[];
  divisions: string[];
  users: User[];
  onSaveDepartments: (newDepts: string[]) => void;
  onSaveDivisions: (newDivs: string[]) => void;
  onSaveAll?: (
    newDepts: string[],
    newDivs: string[],
    deptRenames: DeptDivRenameItem[],
    divRenames: DeptDivRenameItem[]
  ) => Promise<void> | void;
  onDepartmentAdded?: (deptName: string) => void;
  onDivisionAdded?: (divName: string) => void;
  onRenameDepartment?: (oldName: string, newName: string) => void;
  onRenameDivision?: (oldName: string, newName: string) => void;
  language?: 'th' | 'en';
}

export default function DepartmentDivisionModal({
  isOpen,
  onClose,
  departments,
  divisions,
  users,
  onSaveDepartments,
  onSaveDivisions,
  onSaveAll,
  onDepartmentAdded,
  onDivisionAdded,
  onRenameDepartment,
  onRenameDivision,
  language = 'th',
}: DepartmentDivisionModalProps) {
  const isEn = language === 'en';
  const [activeTab, setActiveTab] = useState<'departments' | 'divisions'>('departments');

  // Local draft lists so edits/deletions/additions are confirmed via the Save button
  const [draftDepartments, setDraftDepartments] = useState<string[]>(departments);
  const [draftDivisions, setDraftDivisions] = useState<string[]>(divisions);
  const [pendingDeptRenames, setPendingDeptRenames] = useState<DeptDivRenameItem[]>([]);
  const [pendingDivRenames, setPendingDivRenames] = useState<DeptDivRenameItem[]>([]);
  const [lastAddedDept, setLastAddedDept] = useState<string | null>(null);
  const [lastAddedDiv, setLastAddedDiv] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showUnsavedCloseConfirm, setShowUnsavedCloseConfirm] = useState(false);

  // New item inputs
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newDivisionName, setNewDivisionName] = useState('');

  // Editing item
  const [editingItem, setEditingItem] = useState<{
    type: 'department' | 'division';
    oldName: string;
    newName: string;
  } | null>(null);

  // Search filter inside modal
  const [filterQuery, setFilterQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sync draft state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDraftDepartments(departments);
      setDraftDivisions(divisions);
      setPendingDeptRenames([]);
      setPendingDivRenames([]);
      setLastAddedDept(null);
      setLastAddedDiv(null);
      setHasUnsavedChanges(false);
      setShowUnsavedCloseConfirm(false);
      setEditingItem(null);
      setNewDepartmentName('');
      setNewDivisionName('');
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen]);

  // Keep draft synced with incoming props if user hasn't made unsaved edits yet
  useEffect(() => {
    if (isOpen && !hasUnsavedChanges && !editingItem) {
      setDraftDepartments(departments);
      setDraftDivisions(divisions);
    }
  }, [departments, divisions, isOpen, hasUnsavedChanges, editingItem]);

  if (!isOpen) return null;

  // Department counts (accounting for pending renames)
  const getDeptUserCount = (deptName: string) => {
    const renameEntry = pendingDeptRenames.find(
      (r) => r.newName.trim().toLowerCase() === deptName.trim().toLowerCase()
    );
    const lookupName = renameEntry ? renameEntry.oldName : deptName;
    return users.filter(
      (u) =>
        (u.department || '').trim().toLowerCase() === lookupName.trim().toLowerCase() ||
        (u.department || '').trim().toLowerCase() === deptName.trim().toLowerCase()
    ).length;
  };

  // Division counts (accounting for pending renames)
  const getDivUserCount = (divName: string) => {
    const renameEntry = pendingDivRenames.find(
      (r) => r.newName.trim().toLowerCase() === divName.trim().toLowerCase()
    );
    const lookupName = renameEntry ? renameEntry.oldName : divName;
    return users.filter(
      (u) =>
        (u.division || '').trim().toLowerCase() === lookupName.trim().toLowerCase() ||
        (u.division || '').trim().toLowerCase() === divName.trim().toLowerCase()
    ).length;
  };

  const recordDeptRename = (
    list: DeptDivRenameItem[],
    oldName: string,
    newName: string
  ): DeptDivRenameItem[] => {
    const existingIdx = list.findIndex((item) => item.newName === oldName);
    if (existingIdx >= 0) {
      const updated = [...list];
      updated[existingIdx] = { oldName: updated[existingIdx].oldName, newName };
      return updated;
    }
    return [...list, { oldName, newName }];
  };

  const recordDivRename = (
    list: DeptDivRenameItem[],
    oldName: string,
    newName: string
  ): DeptDivRenameItem[] => {
    const existingIdx = list.findIndex((item) => item.newName === oldName);
    if (existingIdx >= 0) {
      const updated = [...list];
      updated[existingIdx] = { oldName: updated[existingIdx].oldName, newName };
      return updated;
    }
    return [...list, { oldName, newName }];
  };

  const handleAddDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setShowUnsavedCloseConfirm(false);
    const trimmed = newDepartmentName.trim();
    if (!trimmed) {
      setErrorMsg(isEn ? 'Please enter a department name' : 'กรุณาระบุชื่อแผนก');
      return;
    }
    if (draftDepartments.some((d) => d.trim().toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(isEn ? 'This department already exists' : 'แผนกนี้มีอยู่ในรายการแล้ว');
      return;
    }
    const updated = [...draftDepartments, trimmed];
    setDraftDepartments(updated);
    setLastAddedDept(trimmed);
    setHasUnsavedChanges(true);
    setNewDepartmentName('');
  };

  const handleAddDivision = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setShowUnsavedCloseConfirm(false);
    const trimmed = newDivisionName.trim();
    if (!trimmed) {
      setErrorMsg(isEn ? 'Please enter a division name' : 'กรุณาระบุชื่อฝ่าย');
      return;
    }
    if (draftDivisions.some((d) => d.trim().toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(isEn ? 'This division already exists' : 'ฝ่ายนี้มีอยู่ในรายการแล้ว');
      return;
    }
    const updated = [...draftDivisions, trimmed];
    setDraftDivisions(updated);
    setLastAddedDiv(trimmed);
    setHasUnsavedChanges(true);
    setNewDivisionName('');
  };

  const commitPendingEditToDraft = (
    currentDepts: string[] = draftDepartments,
    currentDivs: string[] = draftDivisions,
    currentDeptRenames: DeptDivRenameItem[] = pendingDeptRenames,
    currentDivRenames: DeptDivRenameItem[] = pendingDivRenames
  ): {
    nextDepts: string[];
    nextDivs: string[];
    nextDeptRenames: DeptDivRenameItem[];
    nextDivRenames: DeptDivRenameItem[];
    changed: boolean;
  } => {
    let nextDepts = [...currentDepts];
    let nextDivs = [...currentDivs];
    let nextDeptRenames = [...currentDeptRenames];
    let nextDivRenames = [...currentDivRenames];
    let changed = false;

    if (!editingItem) {
      return { nextDepts, nextDivs, nextDeptRenames, nextDivRenames, changed };
    }

    const { type, oldName, newName } = editingItem;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingItem(null);
      return { nextDepts, nextDivs, nextDeptRenames, nextDivRenames, changed };
    }

    if (type === 'department') {
      if (!nextDepts.some((d) => d.toLowerCase() === trimmed.toLowerCase() && d !== oldName)) {
        nextDepts = nextDepts.map((d) => (d === oldName || d.trim() === oldName.trim() ? trimmed : d));
        nextDeptRenames = recordDeptRename(nextDeptRenames, oldName, trimmed);
        changed = true;
      }
    } else {
      if (!nextDivs.some((d) => d.toLowerCase() === trimmed.toLowerCase() && d !== oldName)) {
        nextDivs = nextDivs.map((d) => (d === oldName || d.trim() === oldName.trim() ? trimmed : d));
        nextDivRenames = recordDivRename(nextDivRenames, oldName, trimmed);
        changed = true;
      }
    }

    setDraftDepartments(nextDepts);
    setDraftDivisions(nextDivs);
    setPendingDeptRenames(nextDeptRenames);
    setPendingDivRenames(nextDivRenames);
    if (changed) {
      setHasUnsavedChanges(true);
    }
    setEditingItem(null);
    return { nextDepts, nextDivs, nextDeptRenames, nextDivRenames, changed };
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    setErrorMsg('');
    setSuccessMsg('');
    setShowUnsavedCloseConfirm(false);
    const { type, oldName, newName } = editingItem;
    const trimmed = newName.trim();
    if (!trimmed) {
      setErrorMsg(isEn ? 'Name cannot be empty' : 'ชื่อต้องไม่เว้นว่าง');
      return;
    }

    if (trimmed === oldName) {
      setEditingItem(null);
      return;
    }

    if (type === 'department') {
      if (draftDepartments.some((d) => d.toLowerCase() === trimmed.toLowerCase() && d !== oldName)) {
        setErrorMsg(isEn ? 'This department name already exists' : 'มีชื่อแผนกนี้อยู่แล้ว');
        return;
      }
      const updated = draftDepartments.map((d) => (d === oldName || d.trim() === oldName.trim() ? trimmed : d));
      setDraftDepartments(updated);
      setPendingDeptRenames((prev) => recordDeptRename(prev, oldName, trimmed));
      setHasUnsavedChanges(true);
    } else {
      if (draftDivisions.some((d) => d.toLowerCase() === trimmed.toLowerCase() && d !== oldName)) {
        setErrorMsg(isEn ? 'This division name already exists' : 'มีชื่อฝ่ายนี้อยู่แล้ว');
        return;
      }
      const updated = draftDivisions.map((d) => (d === oldName || d.trim() === oldName.trim() ? trimmed : d));
      setDraftDivisions(updated);
      setPendingDivRenames((prev) => recordDivRename(prev, oldName, trimmed));
      setHasUnsavedChanges(true);
    }

    setEditingItem(null);
  };

  const handleDeleteDepartment = (deptName: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    setShowUnsavedCloseConfirm(false);
    const updated = draftDepartments.filter((d) => d !== deptName);
    setDraftDepartments(updated);
    setHasUnsavedChanges(true);
  };

  const handleDeleteDivision = (divName: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    setShowUnsavedCloseConfirm(false);
    const updated = draftDivisions.filter((d) => d !== divName);
    setDraftDivisions(updated);
    setHasUnsavedChanges(true);
  };

  // Explicit Save Button handler to confirm all additions, edits, and deletions
  const handleConfirmSave = async (closeAfterSave = false) => {
    setErrorMsg('');
    setShowUnsavedCloseConfirm(false);

    // 1. Commit any open inline edit first
    let {
      nextDepts,
      nextDivs,
      nextDeptRenames,
      nextDivRenames,
    } = commitPendingEditToDraft(
      draftDepartments,
      draftDivisions,
      pendingDeptRenames,
      pendingDivRenames
    );

    // 2. Also include any text typed in the Add input boxes if user didn't click "+ เพิ่ม" yet
    const pendingDept = newDepartmentName.trim();
    let finalAddedDept = lastAddedDept;
    if (pendingDept && !nextDepts.some((d) => d.trim().toLowerCase() === pendingDept.toLowerCase())) {
      nextDepts = [...nextDepts, pendingDept];
      finalAddedDept = pendingDept;
      setDraftDepartments(nextDepts);
      setNewDepartmentName('');
    }

    const pendingDiv = newDivisionName.trim();
    let finalAddedDiv = lastAddedDiv;
    if (pendingDiv && !nextDivs.some((d) => d.trim().toLowerCase() === pendingDiv.toLowerCase())) {
      nextDivs = [...nextDivs, pendingDiv];
      finalAddedDiv = pendingDiv;
      setDraftDivisions(nextDivs);
      setNewDivisionName('');
    }

    setIsSaving(true);
    try {
      if (onSaveAll) {
        await onSaveAll(nextDepts, nextDivs, nextDeptRenames, nextDivRenames);
      } else {
        onSaveDepartments(nextDepts);
        onSaveDivisions(nextDivs);
        nextDeptRenames.forEach((r) => onRenameDepartment?.(r.oldName, r.newName));
        nextDivRenames.forEach((r) => onRenameDivision?.(r.oldName, r.newName));
      }

      if (finalAddedDept && onDepartmentAdded) {
        onDepartmentAdded(finalAddedDept);
      }
      if (finalAddedDiv && onDivisionAdded) {
        onDivisionAdded(finalAddedDiv);
      }

      setPendingDeptRenames([]);
      setPendingDivRenames([]);
      setLastAddedDept(null);
      setLastAddedDiv(null);
      setHasUnsavedChanges(false);
      setSuccessMsg(
        isEn
          ? 'Saved department and division settings successfully!'
          : 'บันทึกข้อมูลแผนกและฝ่ายเรียบร้อยแล้ว'
      );
      setTimeout(() => setSuccessMsg(''), 4000);

      if (closeAfterSave) {
        onClose();
      }
    } catch (err) {
      console.error('Error saving department/division settings:', err);
      setErrorMsg(
        isEn ? 'Failed to save changes. Please try again.' : 'เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่อีกครั้ง'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestClose = () => {
    const hasPendingInlineEdit =
      editingItem && editingItem.newName.trim() !== '' && editingItem.newName.trim() !== editingItem.oldName;
    const hasPendingTypedNew =
      newDepartmentName.trim() !== '' || newDivisionName.trim() !== '';

    if (hasUnsavedChanges || hasPendingInlineEdit || hasPendingTypedNew) {
      setShowUnsavedCloseConfirm(true);
      return;
    }
    onClose();
  };

  const handleDiscardAndClose = () => {
    setDraftDepartments(departments);
    setDraftDivisions(divisions);
    setPendingDeptRenames([]);
    setPendingDivRenames([]);
    setHasUnsavedChanges(false);
    setShowUnsavedCloseConfirm(false);
    setEditingItem(null);
    onClose();
  };

  const filteredDepartments = draftDepartments.filter((d) =>
    d.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const filteredDivisions = draftDivisions.filter((d) =>
    d.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const hasAnyPendingChanges =
    hasUnsavedChanges ||
    Boolean(editingItem && editingItem.newName.trim() !== '' && editingItem.newName.trim() !== editingItem.oldName) ||
    newDepartmentName.trim() !== '' ||
    newDivisionName.trim() !== '';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[60] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={handleRequestClose}
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight">
                {isEn ? 'Department & Division Management' : 'กำหนดและจัดการแผนก / ฝ่าย'}
              </h3>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                {isEn
                  ? 'Define custom departments and divisions, then click Save to confirm'
                  : 'เมื่อเพิ่ม แก้ไข หรือลบแผนกและฝ่ายแล้ว กรุณากดปุ่ม "บันทึกข้อมูล" เพื่อยืนยัน'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRequestClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-4 pb-2 bg-slate-50 border-b border-gray-200 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-2 p-1 bg-gray-200/80 rounded-2xl text-xs font-bold">
            <button
              type="button"
              id="tab-btn-departments"
              onClick={() => {
                commitPendingEditToDraft();
                setActiveTab('departments');
                setErrorMsg('');
                setFilterQuery('');
              }}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'departments'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FolderTree className="w-4 h-4" />
              <span>{isEn ? 'Departments' : 'แผนก (Departments)'}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-600 font-mono">
                {draftDepartments.length}
              </span>
            </button>

            <button
              type="button"
              id="tab-btn-divisions"
              onClick={() => {
                commitPendingEditToDraft();
                setActiveTab('divisions');
                setErrorMsg('');
                setFilterQuery('');
              }}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'divisions'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>{isEn ? 'Divisions' : 'ฝ่าย (Divisions)'}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-600 font-mono">
                {draftDivisions.length}
              </span>
            </button>
          </div>

          {hasAnyPendingChanges && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>{isEn ? 'Unsaved changes - click Save below' : 'มีการแก้ไขที่ยังไม่ได้กดบันทึก'}</span>
            </span>
          )}
        </div>

        {/* Unsaved Close Confirmation Prompt */}
        {showUnsavedCloseConfirm && (
          <div className="mx-5 mt-3 p-3.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                {isEn
                  ? 'You have unsaved changes. Please click Save to confirm or Discard to cancel.'
                  : 'คุณมีการแก้ไขหรือลบข้อมูลที่ยังไม่ได้ยืนยัน กรุณากด "บันทึกและยืนยัน" เพื่อบันทึกข้อมูล'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDiscardAndClose}
                className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-xl font-semibold cursor-pointer"
              >
                {isEn ? 'Discard' : 'ไม่บันทึก'}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmSave(true)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isEn ? 'Save & Close' : 'บันทึกและยืนยัน'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Notifications */}
        {errorMsg && (
          <div className="mx-5 mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-5 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2 font-semibold animate-in fade-in">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Add New Input Card */}
        <div className="p-5 pb-3">
          {activeTab === 'departments' ? (
            <form onSubmit={handleAddDepartment} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="input-new-department"
                  type="text"
                  value={newDepartmentName}
                  onChange={(e) => setNewDepartmentName(e.target.value)}
                  placeholder={isEn ? 'Enter new department name (e.g. แผนกลูกค้าสัมพันธ์)...' : 'พิมพ์ชื่อแผนกใหม่ที่ต้องการเพิ่ม (เช่น แผนกการตลาดดิจิทัล)...'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium text-gray-900"
                />
              </div>
              <button
                type="submit"
                id="btn-add-department"
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>{isEn ? 'Add Department' : 'เพิ่มแผนก'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleAddDivision} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="input-new-division"
                  type="text"
                  value={newDivisionName}
                  onChange={(e) => setNewDivisionName(e.target.value)}
                  placeholder={isEn ? 'Enter new division name (e.g. ฝ่ายกลยุทธ์และการลงทุน)...' : 'พิมพ์ชื่อฝ่ายใหม่ที่ต้องการเพิ่ม (เช่น ฝ่ายกลยุทธ์และการลงทุน)...'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium text-gray-900"
                />
              </div>
              <button
                type="submit"
                id="btn-add-division"
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>{isEn ? 'Add Division' : 'เพิ่มฝ่าย'}</span>
              </button>
            </form>
          )}

          {/* Quick Filter Search */}
          <div className="mt-3 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={isEn ? 'Filter list...' : `ค้นหาในรายการ${activeTab === 'departments' ? 'แผนก' : 'ฝ่าย'}...`}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50/80 border border-gray-200 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-hidden"
            />
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
          {activeTab === 'departments' ? (
            filteredDepartments.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs">
                {filterQuery ? (isEn ? 'No department matching your search' : 'ไม่พบแผนกที่ค้นหา') : (isEn ? 'No departments added yet' : 'ยังไม่มีข้อมูลแผนก')}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredDepartments.map((dept) => {
                  const userCount = getDeptUserCount(dept);
                  const isEditing = editingItem?.type === 'department' && editingItem.oldName === dept;

                  return (
                    <div
                      key={dept}
                      className="p-3 bg-white border border-gray-200 hover:border-indigo-300 rounded-2xl flex items-center justify-between gap-2 shadow-2xs group transition-all"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <input
                            type="text"
                            value={editingItem.newName}
                            onChange={(e) => setEditingItem({ ...editingItem, newName: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveEdit();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setEditingItem(null);
                              }
                            }}
                            className="flex-1 px-2.5 py-1 text-xs border border-indigo-500 rounded-lg outline-hidden bg-indigo-50/30 text-gray-900 font-medium"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                            title="ตกลง"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingItem(null)}
                            className="p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg cursor-pointer"
                            title="ยกเลิก"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-semibold text-gray-900 block truncate" title={dept}>
                                {dept}
                              </span>
                              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                <Users className="w-3 h-3 text-gray-400" />
                                <span>{userCount} {isEn ? 'members' : 'คน'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                commitPendingEditToDraft();
                                setEditingItem({ type: 'department', oldName: dept, newName: dept });
                              }}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="แก้ไขชื่อแผนก"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDepartment(dept)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="ลบแผนก"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            filteredDivisions.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs">
                {filterQuery ? (isEn ? 'No division matching your search' : 'ไม่พบฝ่ายที่ค้นหา') : (isEn ? 'No divisions added yet' : 'ยังไม่มีข้อมูลฝ่าย')}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredDivisions.map((div) => {
                  const userCount = getDivUserCount(div);
                  const isEditing = editingItem?.type === 'division' && editingItem.oldName === div;

                  return (
                    <div
                      key={div}
                      className="p-3 bg-white border border-gray-200 hover:border-indigo-300 rounded-2xl flex items-center justify-between gap-2 shadow-2xs group transition-all"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <input
                            type="text"
                            value={editingItem.newName}
                            onChange={(e) => setEditingItem({ ...editingItem, newName: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveEdit();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setEditingItem(null);
                              }
                            }}
                            className="flex-1 px-2.5 py-1 text-xs border border-indigo-500 rounded-lg outline-hidden bg-indigo-50/30 text-gray-900 font-medium"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                            title="ตกลง"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingItem(null)}
                            className="p-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg cursor-pointer"
                            title="ยกเลิก"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-semibold text-gray-900 block truncate" title={div}>
                                {div}
                              </span>
                              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                <Users className="w-3 h-3 text-gray-400" />
                                <span>{userCount} {isEn ? 'members' : 'คน'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                commitPendingEditToDraft();
                                setEditingItem({ type: 'division', oldName: div, newName: div });
                              }}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="แก้ไขชื่อฝ่าย"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDivision(div)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="ลบฝ่าย"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Footer with Explicit Save Button */}
        <div className="p-4 bg-slate-50 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-500 shrink-0">
          <p className="text-gray-600 font-medium">
            {hasAnyPendingChanges ? (
              <span className="text-amber-700 font-semibold">
                {isEn
                  ? '⚠️ Please click "Save Changes" to confirm your edits or deletions.'
                  : '⚠️ มีการเพิ่ม แก้ไข หรือลบข้อมูล กรุณากดปุ่ม "บันทึกข้อมูล" เพื่อยืนยัน'}
              </span>
            ) : (
              <span>
                {isEn
                  ? 'Click "Save Changes" after modifying departments or divisions.'
                  : 'เมื่อเพิ่ม แก้ไข หรือลบแผนกและฝ่ายแล้ว กดปุ่ม "บันทึกข้อมูล" เพื่อยืนยัน'}
              </span>
            )}
          </p>
          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              id="btn-close-dept-div-modal"
              onClick={handleRequestClose}
              className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-xl font-semibold cursor-pointer transition-all"
            >
              {isEn ? 'Close' : 'ปิดหน้าต่าง'}
            </button>
            <button
              type="button"
              id="btn-save-dept-div-modal"
              disabled={isSaving}
              onClick={() => handleConfirmSave(false)}
              className={`px-5 py-2 rounded-xl font-bold cursor-pointer transition-all shadow-sm flex items-center gap-1.5 ${
                hasAnyPendingChanges
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400/50'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>
                {isSaving
                  ? isEn
                    ? 'Saving...'
                    : 'กำลังบันทึก...'
                  : isEn
                  ? 'Save Changes'
                  : 'บันทึกข้อมูล'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
