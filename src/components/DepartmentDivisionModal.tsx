import React, { useState } from 'react';
import { Building2, FolderTree, Plus, Trash2, Edit2, Check, X, Search, Users, AlertCircle } from 'lucide-react';
import { User } from '../types';

interface DepartmentDivisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: string[];
  divisions: string[];
  users: User[];
  onSaveDepartments: (newDepts: string[]) => void;
  onSaveDivisions: (newDivs: string[]) => void;
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
  onDepartmentAdded,
  onDivisionAdded,
  onRenameDepartment,
  onRenameDivision,
  language = 'th',
}: DepartmentDivisionModalProps) {
  const isEn = language === 'en';
  const [activeTab, setActiveTab] = useState<'departments' | 'divisions'>('departments');

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

  if (!isOpen) return null;

  // Department counts
  const getDeptUserCount = (deptName: string) => {
    return users.filter((u) => (u.department || '').trim().toLowerCase() === deptName.trim().toLowerCase()).length;
  };

  // Division counts
  const getDivUserCount = (divName: string) => {
    return users.filter((u) => (u.division || '').trim().toLowerCase() === divName.trim().toLowerCase()).length;
  };

  const handleAddDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const trimmed = newDepartmentName.trim();
    if (!trimmed) {
      setErrorMsg(isEn ? 'Please enter a department name' : 'กรุณาระบุชื่อแผนก');
      return;
    }
    if (departments.some((d) => d.trim().toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(isEn ? 'This department already exists' : 'แผนกนี้มีอยู่ในระบบแล้ว');
      return;
    }
    const updated = [...departments, trimmed];
    onSaveDepartments(updated);
    if (onDepartmentAdded) onDepartmentAdded(trimmed);
    setNewDepartmentName('');
    setSuccessMsg(isEn ? `Added "${trimmed}" successfully` : `เพิ่มแผนก "${trimmed}" เรียบร้อยแล้ว`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleAddDivision = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const trimmed = newDivisionName.trim();
    if (!trimmed) {
      setErrorMsg(isEn ? 'Please enter a division name' : 'กรุณาระบุชื่อฝ่าย');
      return;
    }
    if (divisions.some((d) => d.trim().toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(isEn ? 'This division already exists' : 'ฝ่ายนี้มีอยู่ในระบบแล้ว');
      return;
    }
    const updated = [...divisions, trimmed];
    onSaveDivisions(updated);
    if (onDivisionAdded) onDivisionAdded(trimmed);
    setNewDivisionName('');
    setSuccessMsg(isEn ? `Added "${trimmed}" successfully` : `เพิ่มฝ่าย "${trimmed}" เรียบร้อยแล้ว`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleDoneAndClose = () => {
    // Auto-save any typed pending department or division before closing
    const pendingDept = newDepartmentName.trim();
    if (pendingDept && !departments.some((d) => d.trim().toLowerCase() === pendingDept.toLowerCase())) {
      const updatedDepts = [...departments, pendingDept];
      onSaveDepartments(updatedDepts);
      if (onDepartmentAdded) onDepartmentAdded(pendingDept);
      setNewDepartmentName('');
    }
    const pendingDiv = newDivisionName.trim();
    if (pendingDiv && !divisions.some((d) => d.trim().toLowerCase() === pendingDiv.toLowerCase())) {
      const updatedDivs = [...divisions, pendingDiv];
      onSaveDivisions(updatedDivs);
      if (onDivisionAdded) onDivisionAdded(pendingDiv);
      setNewDivisionName('');
    }
    if (editingItem && editingItem.newName.trim()) {
      handleSaveEdit();
    }
    onClose();
  };

  const handleDeleteDepartment = (deptName: string) => {
    const updated = departments.filter((d) => d !== deptName);
    onSaveDepartments(updated);
    setSuccessMsg(isEn ? `Deleted "${deptName}"` : `ลบแผนก "${deptName}" เรียบร้อยแล้ว`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleDeleteDivision = (divName: string) => {
    const updated = divisions.filter((d) => d !== divName);
    onSaveDivisions(updated);
    setSuccessMsg(isEn ? `Deleted "${divName}"` : `ลบฝ่าย "${divName}" เรียบร้อยแล้ว`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    const { type, oldName, newName } = editingItem;
    const trimmed = newName.trim();
    if (!trimmed) {
      setErrorMsg(isEn ? 'Name cannot be empty' : 'ชื่อต้องไม่เว้นว่าง');
      return;
    }

    if (type === 'department') {
      if (departments.some((d) => d.toLowerCase() === trimmed.toLowerCase() && d !== oldName)) {
        setErrorMsg(isEn ? 'This department name already exists' : 'มีชื่อแผนกนี้อยู่แล้ว');
        return;
      }
      const updated = departments.map((d) => (d === oldName ? trimmed : d));
      onSaveDepartments(updated);
      if (onRenameDepartment) {
        onRenameDepartment(oldName, trimmed);
      }
      setSuccessMsg(isEn ? `Renamed to "${trimmed}"` : `เปลี่ยนชื่อแผนกเป็น "${trimmed}" เรียบร้อยแล้ว`);
    } else {
      if (divisions.some((d) => d.toLowerCase() === trimmed.toLowerCase() && d !== oldName)) {
        setErrorMsg(isEn ? 'This division name already exists' : 'มีชื่อฝ่ายนี้อยู่แล้ว');
        return;
      }
      const updated = divisions.map((d) => (d === oldName ? trimmed : d));
      onSaveDivisions(updated);
      if (onRenameDivision) {
        onRenameDivision(oldName, trimmed);
      }
      setSuccessMsg(isEn ? `Renamed to "${trimmed}"` : `เปลี่ยนชื่อฝ่ายเป็น "${trimmed}" เรียบร้อยแล้ว`);
    }

    setEditingItem(null);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const filteredDepartments = departments.filter((d) =>
    d.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const filteredDivisions = divisions.filter((d) =>
    d.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[60] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={handleDoneAndClose}
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
                  ? 'Define custom departments and divisions for your organization'
                  : 'กำหนด เพิ่ม แก้ไข หรือลบชื่อแผนกและฝ่ายสำหรับผู้ใช้งานในองค์กร'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDoneAndClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-4 pb-2 bg-slate-50 border-b border-gray-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 p-1 bg-gray-200/80 rounded-2xl text-xs font-bold">
            <button
              type="button"
              id="tab-btn-departments"
              onClick={() => {
                setActiveTab('departments');
                setErrorMsg('');
                setFilterQuery('');
                setEditingItem(null);
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
                {departments.length}
              </span>
            </button>

            <button
              type="button"
              id="tab-btn-divisions"
              onClick={() => {
                setActiveTab('divisions');
                setErrorMsg('');
                setFilterQuery('');
                setEditingItem(null);
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
                {divisions.length}
              </span>
            </button>
          </div>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="mx-5 mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-5 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2 font-medium animate-in fade-in">
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
                            className="flex-1 px-2.5 py-1 text-xs border border-indigo-500 rounded-lg outline-hidden bg-indigo-50/30 text-gray-900 font-medium"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                            title="บันทึก"
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
                              onClick={() => setEditingItem({ type: 'department', oldName: dept, newName: dept })}
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
                            className="flex-1 px-2.5 py-1 text-xs border border-indigo-500 rounded-lg outline-hidden bg-indigo-50/30 text-gray-900 font-medium"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
                            title="บันทึก"
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
                              onClick={() => setEditingItem({ type: 'division', oldName: div, newName: div })}
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

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500 shrink-0">
          <p>
            {isEn
              ? 'Changes will be automatically saved and available across employee registration forms.'
              : 'การเพิ่มหรือแก้ไขแผนก/ฝ่ายจะถูกบันทึกและแสดงในเมนูกำหนดผู้ใช้งานทันที'}
          </p>
          <button
            type="button"
            onClick={handleDoneAndClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold cursor-pointer transition-all shadow-xs"
          >
            {isEn ? 'Done' : 'เสร็จสิ้น'}
          </button>
        </div>
      </div>
    </div>
  );
}
