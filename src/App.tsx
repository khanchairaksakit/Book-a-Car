import React, { useState, useEffect } from 'react';
import { Vehicle, User, Booking, BookingStatus } from './types';
import {
  INITIAL_VEHICLES,
  INITIAL_USERS,
  INITIAL_BOOKINGS,
} from './data/mockData';
import {
  getVehicles,
  saveVehicle,
  deleteVehicle,
  getUsers,
  saveUser,
  deleteUser,
  getBookings,
  saveBooking,
  deleteBooking,
} from './lib/firebase';

import BookingSystem from './components/BookingSystem';
import VehicleManagement from './components/VehicleManagement';
import UserRegistration from './components/UserRegistration';
import MonthlyCalendar from './components/MonthlyCalendar';
import LoginPage from './components/LoginPage';
import FleetReport from './components/FleetReport';
import LineShareApprovalModal from './components/LineShareApprovalModal';
import LineQuickApproveModal from './components/LineQuickApproveModal';
import {
  triggerServerLineApprovalPush,
  getLineModuleEnabled,
  setLineModuleEnabled,
} from './utils/lineApprovalUtils';
import { translations, Language } from './utils/translations';
import { isUserAdmin, getUserRoles, getRoleBadgeInfo, canUserViewBooking, hasRole } from './utils/userHelpers';
import { getRealTodayStr, generateNextJobNumber, getBookingJobNumber } from './utils/dateHelpers';

import {
  CalendarDays,
  Car,
  Users,
  Menu,
  X,
  Shield,
  CircleUser,
  Info,
  CloudLightning,
  ClipboardList,
  LogOut,
  Globe,
  FileText,
  Sparkles,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // Language State: 'th' or 'en'
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('car_booking_language');
    return saved === 'en' || saved === 'th' ? saved : 'th';
  });

  const handleToggleLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('car_booking_language', lang);
  };

  const t = translations[language];

  // 1. Optimistic states falling back to localStorage/Mock data initially (with production clean wipe of old bookings)
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    const isCleanResetDone = localStorage.getItem('ax_car_booking_clean_v3') === 'done';
    if (!isCleanResetDone) {
      localStorage.removeItem('car_booking_bookings');
    }
    const saved = localStorage.getItem('car_booking_vehicles');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((v: Vehicle) =>
            !isCleanResetDone && v.status === 'In Use' ? { ...v, status: 'Available' } : v
          );
        }
      } catch {
        return INITIAL_VEHICLES;
      }
    }
    return INITIAL_VEHICLES;
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('car_booking_users');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((u: User) => {
            const initialMatch = INITIAL_USERS.find(
              (iu) => iu.id === u.id || iu.email.toLowerCase() === u.email.toLowerCase()
            );
            return {
              ...u,
              username: u.username || initialMatch?.username || u.email.split('@')[0],
              password: u.password || initialMatch?.password || 'password123',
            };
          });
        }
      } catch {
        return INITIAL_USERS;
      }
    }
    return INITIAL_USERS;
  });

  const [bookings, setBookings] = useState<Booking[]>(() => {
    const isCleanResetDone = localStorage.getItem('ax_car_booking_clean_v3') === 'done';
    if (!isCleanResetDone) {
      localStorage.removeItem('car_booking_bookings');
      localStorage.setItem('ax_car_booking_clean_v3', 'done');
      return [];
    }
    const saved = localStorage.getItem('car_booking_bookings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((b: Booking) => b.jobNumber && b.jobNumber.startsWith('AX-'));
        }
      } catch {
        return [];
      }
    }
    return INITIAL_BOOKINGS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('car_booking_current_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        if (u && u.id) {
          const initialMatch = INITIAL_USERS.find(
            (iu) => iu.id === u.id || iu.email?.toLowerCase() === u.email?.toLowerCase()
          );
          return {
            ...u,
            username: u.username || initialMatch?.username || u.email?.split('@')[0] || 'user',
            password: u.password || initialMatch?.password || 'password123',
          };
        }
      } catch {
        // fallback
      }
    }
    // Production: Require logging in with username and password
    return null;
  });

  const [isLoginPageOpen, setIsLoginPageOpen] = useState(false);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('car_booking_current_user', JSON.stringify(user));
    setIsLoginPageOpen(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('car_booking_current_user');
    setIsLoginPageOpen(true);
  };

  const [activeTab, setActiveTab] = useState<'calendar' | 'booking' | 'vehicles' | 'users' | 'report'>('calendar');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCloudSynced, setIsCloudSynced] = useState(false);

  // Fetch real-time/latest data from Firestore on Mount
  useEffect(() => {
    async function loadCloudData() {
      try {
        setIsLoading(true);
        const [dbVehicles, dbUsers, dbBookings] = await Promise.all([
          getVehicles(),
          getUsers(),
          getBookings(),
        ]);
        setVehicles(dbVehicles);
        setUsers(dbUsers);
        setBookings(dbBookings);
        setIsCloudSynced(true);

        // Auto-select currentUser from cloud list if matching local storage email
        const savedEmail = currentUser?.email;
        if (dbUsers.length > 0 && savedEmail) {
          const matched = dbUsers.find((u) => u.email === savedEmail);
          if (matched) {
            setCurrentUser(matched);
          }
        }
      } catch (error) {
        console.error('Error fetching data from Firestore:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadCloudData();
  }, []);

  // Sync state to local storage for quick offline / startup response
  useEffect(() => {
    localStorage.setItem('car_booking_vehicles', JSON.stringify(vehicles));
  }, [vehicles]);

  useEffect(() => {
    localStorage.setItem('car_booking_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('car_booking_bookings', JSON.stringify(bookings));
  }, [bookings]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('car_booking_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('car_booking_current_user');
    }
  }, [currentUser]);

  // Handlers for Users with Firebase persistence
  const handleSelectUser = (user: User) => {
    setCurrentUser(user);
    setActiveTab('calendar');
  };

  const handleAddUser = async (newUserData: Omit<User, 'id'>) => {
    const newUser: User = {
      ...newUserData,
      id: `user-${Date.now()}`,
    };
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    setToastMessage(`เพิ่มผู้ใช้งาน "${newUser.name}" เรียบร้อยแล้ว`);
    if (!currentUser) {
      setCurrentUser(newUser);
    }
    try {
      await saveUser(newUser);
    } catch (e) {
      console.error('Cloud save failed', e);
    }
  };

  const handleAddMultipleUsers = async (newUsersList: Omit<User, 'id'>[]) => {
    const createdUsers: User[] = newUsersList.map((userData, index) => ({
      ...userData,
      id: `user-${Date.now()}-${index}`,
    }));
    const updatedUsers = [...users, ...createdUsers];
    setUsers(updatedUsers);
    try {
      for (const u of createdUsers) {
        await saveUser(u);
      }
    } catch (e) {
      console.error('Cloud save multiple users failed', e);
    }
  };

  const handleEditUser = async (updatedUser: User) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    setCurrentUser((prev) => (prev?.id === updatedUser.id ? updatedUser : prev));
    const updatedBookings = bookings.map((b) =>
      b.userId === updatedUser.id
        ? {
            ...b,
            userName: updatedUser.name,
            userPhone: updatedUser.phone,
            requesterLineId: updatedUser.lineUserId || b.requesterLineId,
          }
        : b
    );
    setBookings(updatedBookings);

    try {
      await saveUser(updatedUser);
      for (const b of updatedBookings) {
        if (b.userId === updatedUser.id) {
          await saveBooking(b);
        }
      }
    } catch (e) {
      console.error('Cloud edit user failed', e);
    }
  };

  const handleUpdateUserLineId = async (userId: string, lineUserId: string) => {
    const cleanLineId = lineUserId.trim();
    let targetUser: User | undefined;
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated = { ...u, lineUserId: cleanLineId };
          targetUser = updated;
          return updated;
        }
        return u;
      })
    );
    setCurrentUser((prev) => (prev?.id === userId ? { ...prev, lineUserId: cleanLineId } : prev));
    setBookings((prev) =>
      prev.map((b) => ({
        ...b,
        ...(b.userId === userId ? { requesterLineId: cleanLineId } : {}),
        ...(b.assignedApproverId === userId ? { assignedApproverLineId: cleanLineId } : {}),
        ...(b.stage2ApproverId === userId ? { stage2ApproverLineId: cleanLineId } : {}),
      }))
    );

    const existing = targetUser || users.find((u) => u.id === userId);
    if (existing) {
      try {
        await saveUser({ ...existing, lineUserId: cleanLineId });
      } catch (e) {
        console.error('Cloud update user lineUserId failed', e);
      }
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setUsers(users.filter((u) => u.id !== userId));
    if (currentUser?.id === userId) {
      const remaining = users.filter((u) => u.id !== userId);
      setCurrentUser(remaining.length > 0 ? remaining[0] : null);
    }
    try {
      await deleteUser(userId);
    } catch (e) {
      console.error('Cloud delete user failed', e);
    }
  };

  // Handlers for Vehicles with Firebase persistence
  const handleAddVehicle = async (newVehicleData: Omit<Vehicle, 'id'>) => {
    const newVehicle: Vehicle = {
      ...newVehicleData,
      id: `car-${Date.now()}`,
    };
    setVehicles([...vehicles, newVehicle]);
    try {
      await saveVehicle(newVehicle);
    } catch (e) {
      console.error('Cloud save vehicle failed', e);
    }
  };

  const handleEditVehicle = async (updatedVehicle: Vehicle) => {
    setVehicles(vehicles.map((v) => (v.id === updatedVehicle.id ? updatedVehicle : v)));
    const newVehicleName = `${updatedVehicle.brand} ${updatedVehicle.model} (${updatedVehicle.plateNumber})`;
    const updatedBookings = bookings.map((b) =>
      b.vehicleId === updatedVehicle.id
        ? { ...b, vehicleName: newVehicleName }
        : b
    );
    setBookings(updatedBookings);

    try {
      await saveVehicle(updatedVehicle);
      for (const b of updatedBookings) {
        if (b.vehicleId === updatedVehicle.id) {
          await saveBooking(b);
        }
      }
    } catch (e) {
      console.error('Cloud edit vehicle failed', e);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    setVehicles(vehicles.filter((v) => v.id !== vehicleId));
    const updatedBookings = bookings.map((b) =>
      b.vehicleId === vehicleId && (b.status === 'Pending' || b.status === 'Approved')
        ? { ...b, status: 'Cancelled' as BookingStatus }
        : b
    );
    setBookings(updatedBookings);

    try {
      await deleteVehicle(vehicleId);
      for (const b of updatedBookings) {
        if (b.vehicleId === vehicleId && b.status === 'Cancelled') {
          await saveBooking(b);
        }
      }
    } catch (e) {
      console.error('Cloud delete vehicle failed', e);
    }
  };

  // Handlers for Booking with Firebase persistence
  const handleAddBooking = async (newBookingData: Omit<Booking, 'id' | 'createdAt'>) => {
    const createdAtIso = new Date().toISOString();
    const jobNumber = newBookingData.jobNumber || generateNextJobNumber(bookings, createdAtIso);
    const newBooking: Booking = {
      ...newBookingData,
      id: `b-${Date.now()}`,
      jobNumber,
      createdAt: createdAtIso,
    };
    setBookings([newBooking, ...bookings]);

    // Automatically push notification to Approve 1's LINE ID from User Management
    if (isLineModuleEnabled && newBooking.status === 'Pending') {
      const stage1Approver = users.find((u) => u.id === newBooking.assignedApproverId);
      const targetLineId = newBooking.assignedApproverLineId || stage1Approver?.lineUserId;
      triggerServerLineApprovalPush({
        booking: newBooking,
        stage: 1,
        approverUser: stage1Approver,
        approverName: newBooking.assignedApproverName || stage1Approver?.name,
        targetLineId,
      })
        .then((res) => {
          if (res?.oaPushSuccess) {
            setToastMessage(
              `จองรถสำเร็จ (ใบงาน ${jobNumber})! ส่งแจ้งเตือนไปยัง LINE ของ ${newBooking.assignedApproverName || 'Approve 1'} (${targetLineId || 'LINE OA'}) เรียบร้อยแล้ว`
            );
          } else {
            setToastMessage(
              `บันทึกใบงาน ${jobNumber} และแจ้งเตือนไปหา ${newBooking.assignedApproverName || 'Approve 1'}${targetLineId ? ` (LINE ID: ${targetLineId})` : ''} เรียบร้อยแล้ว`
            );
          }
        })
        .catch(() => {});
    }

    const todayStr = getRealTodayStr();
    const start = newBooking.startDate.substring(0, 10);
    const end = newBooking.endDate.substring(0, 10);
    
    let updatedVehicles = [...vehicles];
    if (newBooking.status === 'Approved' && todayStr >= start && todayStr <= end) {
      updatedVehicles = vehicles.map((v) =>
        v.id === newBooking.vehicleId ? { ...v, status: 'In Use' } : v
      );
      setVehicles(updatedVehicles);
    }

    try {
      await saveBooking(newBooking);
      if (newBooking.status === 'Approved' && todayStr >= start && todayStr <= end) {
        const matchedVehicle = updatedVehicles.find(v => v.id === newBooking.vehicleId);
        if (matchedVehicle) {
          await saveVehicle(matchedVehicle);
        }
      }
    } catch (e) {
      console.error('Cloud save booking failed', e);
    }
  };

  const handleUpdateBookingStatus = async (
    bookingId: string,
    status: BookingStatus,
    extraData?: Partial<Booking>
  ) => {
    let approverName: string | undefined = undefined;
    let approvedAt: string | undefined = undefined;

    if (status === 'Approved') {
      const existing = bookings.find((b) => b.id === bookingId);
      const stage1Name = extraData?.stage1ApprovedBy || existing?.stage1ApprovedBy;
      const stage2Name = extraData?.stage2ApprovedBy || currentUser?.name || 'Approve 2';
      approverName = stage1Name ? `${stage1Name} (Approve 1) & ${stage2Name} (Approve 2)` : `${stage2Name}`;
      approvedAt = new Date().toISOString();
    }

    const updatedBookings = bookings.map((b) => {
      if (b.id !== bookingId) return b;
      return {
        ...b,
        status,
        ...(approverName ? { approverName, approvedAt } : {}),
        ...extraData,
      };
    });
    setBookings(updatedBookings);

    const booking = updatedBookings.find((b) => b.id === bookingId);
    if (!booking) return;
    const jobNo = getBookingJobNumber(booking);

    if (status === 'Pending_Approve2') {
      if (isLineModuleEnabled) {
        const stage2Approver =
          users.find((u) => u.id === booking.stage2ApproverId) ||
          users.find((u) => u.roles?.includes('Approve 2'));
        const targetStage2LineId = booking.stage2ApproverLineId || stage2Approver?.lineUserId;
        triggerServerLineApprovalPush({
          booking,
          stage: 2,
          approverUser: stage2Approver,
          approverName: booking.stage2ApproverName || stage2Approver?.name || 'Approve 2',
          targetLineId: targetStage2LineId,
        }).catch(() => {});
      }
      setToastMessage(
        isLineModuleEnabled
          ? `อนุมัติขั้นที่ 1 (ใบงาน ${jobNo}) สำเร็จ! ส่ง LINE แจ้งเตือนไปยัง Approve 2 (${booking.stage2ApproverName || 'ผู้อนุมัติขั้นที่ 2'}) เรียบร้อยแล้ว`
          : `อนุมัติขั้นที่ 1 (ใบงาน ${jobNo}) สำเร็จ! ส่งต่อคำขอให้ Approve 2 พิจารณา`
      );
    } else if (status === 'Approved') {
      if (isLineModuleEnabled) {
        const reqUser = users.find((u) => u.id === booking.userId);
        const targetReqLineId = booking.requesterLineId || reqUser?.lineUserId;
        triggerServerLineApprovalPush({
          booking,
          stage: 'approved',
          approverUser: reqUser,
          approverName: booking.stage2ApprovedBy || booking.approverName || 'Approve 2',
          targetLineId: targetReqLineId,
        }).catch(() => {});
      }
      setToastMessage(
        isLineModuleEnabled
          ? `อนุมัติใบงาน ${jobNo} (${booking.vehicleName}) ครบ 2 ขั้นตอน และส่ง LINE แจ้งเตือนผู้จอง (${booking.userName}) เรียบร้อยแล้ว`
          : `อนุมัติใบงาน ${jobNo} (${booking.vehicleName}) เรียบร้อยแล้ว (อนุมัติครบ 2 ขั้น)`
      );
    } else if (status === 'Completed') {
      setToastMessage(`เสร็จสิ้นภารกิจใบงาน ${jobNo} และบันทึกการส่งคืนรถเรียบร้อยแล้ว`);
    } else if (status === 'Cancelled') {
      if (isLineModuleEnabled && booking.rejectionReason) {
        const reqUser = users.find((u) => u.id === booking.userId);
        const targetReqLineId = booking.requesterLineId || reqUser?.lineUserId;
        triggerServerLineApprovalPush({
          booking,
          stage: 'rejected',
          approverUser: reqUser,
          approverName: booking.rejectedBy || 'ผู้อนุมัติ',
          targetLineId: targetReqLineId,
        }).catch(() => {});
      }
      setToastMessage(
        booking.rejectionReason
          ? `ไม่อนุมัติใบงาน ${jobNo} (เหตุผล: ${booking.rejectionReason}) และแจ้งเตือนผู้จองเรียบร้อยแล้ว`
          : `ยกเลิก/ปฏิเสธใบงาน ${jobNo} เรียบร้อยแล้ว`
      );
    }

    try {
      await saveBooking(booking);

      // If mileage is returned in extraData, update vehicle currentMileage
      if (extraData?.endMileage && booking.vehicleId) {
        setVehicles((prev) =>
          prev.map((v) =>
            v.id === booking.vehicleId ? { ...v, currentMileage: extraData.endMileage } : v
          )
        );
        const vToUpdate = vehicles.find((v) => v.id === booking.vehicleId);
        if (vToUpdate) {
          await saveVehicle({ ...vToUpdate, currentMileage: extraData.endMileage });
        }
      }

      const todayStr = getRealTodayStr();
      const start = booking.startDate.substring(0, 10);
      const end = booking.endDate.substring(0, 10);

      let updatedVehicles = [...vehicles];
      if (status === 'Approved' && todayStr >= start && todayStr <= end) {
        updatedVehicles = vehicles.map((v) =>
          v.id === booking.vehicleId ? { ...v, status: 'In Use' } : v
        );
        setVehicles(updatedVehicles);
        const matchedVehicle = updatedVehicles.find((v) => v.id === booking.vehicleId);
        if (matchedVehicle) {
          await saveVehicle(matchedVehicle);
        }
      } else if (status === 'Cancelled' || status === 'Completed') {
        const otherActive = updatedBookings.some(
          (b) =>
            b.id !== bookingId &&
            b.vehicleId === booking.vehicleId &&
            b.status === 'Approved' &&
            todayStr >= b.startDate.substring(0, 10) &&
            todayStr <= b.endDate.substring(0, 10)
        );
        if (!otherActive) {
          updatedVehicles = vehicles.map((v) =>
            v.id === booking.vehicleId && v.status === 'In Use'
              ? { ...v, status: 'Available' }
              : v
          );
          setVehicles(updatedVehicles);
          const matchedVehicle = updatedVehicles.find((v) => v.id === booking.vehicleId);
          if (matchedVehicle) {
            await saveVehicle(matchedVehicle);
          }
        }
      }
    } catch (e) {
      console.error('Cloud update booking failed', e);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    setBookings(bookings.filter((b) => b.id !== bookingId));
    try {
      await deleteBooking(bookingId);
    } catch (e) {
      console.error('Cloud delete booking failed', e);
    }
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // LINE Notification Module (Always enabled for notifications)
  const [isLineModuleEnabled, setIsLineModuleEnabled] = useState<boolean>(true);

  const handleToggleLineModule = (enabled: boolean) => {
    setIsLineModuleEnabled(enabled);
    setLineModuleEnabled(enabled);
  };

  // LINE Share & Quick Approval States
  const [lineShareBookingId, setLineShareBookingId] = useState<string | null>(null);
  const [lineQuickApproveState, setLineQuickApproveState] = useState<{
    bookingId: string;
    stage: 1 | 2;
    action: 'approve' | 'reject' | 'review';
    approverId?: string;
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const lineBookingId = params.get('lineBookingId');
    if (!lineBookingId) return null;
    const stageParam = params.get('stage') === '2' ? 2 : 1;
    const actionParam = params.get('action');
    const action: 'approve' | 'reject' | 'review' =
      actionParam === 'approve' || actionParam === 'reject' ? actionParam : 'review';
    const approverId = params.get('approverId') || undefined;
    return {
      bookingId: lineBookingId,
      stage: stageParam,
      action,
      approverId,
    };
  });

  const handleCloseLineQuickApprove = () => {
    setLineQuickApproveState(null);
    if (typeof window !== 'undefined' && window.location.search.includes('lineBookingId')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('lineBookingId');
      url.searchParams.delete('stage');
      url.searchParams.delete('action');
      url.searchParams.delete('approverId');
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleMarkLineNotified = async (bookingId: string) => {
    const nowIso = new Date().toISOString();
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, lineNotifiedAt: nowIso } : b))
    );
    const found = bookings.find((b) => b.id === bookingId);
    if (found) {
      try {
        await saveBooking({ ...found, lineNotifiedAt: nowIso });
      } catch {
        // ignore
      }
    }
  };

  // Sync any pending LINE OA Webhook postback actions
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const resp = await fetch('/api/line/webhook-actions');
        if (!resp.ok) return;
        const data = await resp.json();
        const actions = Array.isArray(data?.actions) ? data.actions : [];
        for (const act of actions) {
          const targetBooking = bookings.find((b) => b.id === act.bookingId);
          if (targetBooking) {
            if (act.action === 'approve') {
              if (targetBooking.status === 'Pending') {
                await handleUpdateBookingStatus(targetBooking.id, 'Pending_Approve2', {
                  stage1ApprovedBy: `${targetBooking.assignedApproverName || 'Approve 1'} (LINE OA)`,
                  stage1ApprovedAt: act.timestamp,
                  approvedVia: 'LINE',
                });
              } else if (targetBooking.status === 'Pending_Approve2') {
                await handleUpdateBookingStatus(targetBooking.id, 'Approved', {
                  stage2ApprovedBy: `Approve 2 (LINE OA)`,
                  stage2ApprovedAt: act.timestamp,
                  approvedVia: 'LINE',
                });
              }
            } else if (act.action === 'reject') {
              await handleUpdateBookingStatus(targetBooking.id, 'Cancelled', {
                approvedVia: 'LINE',
              });
            }
          }
          await fetch('/api/line/ack-webhook-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: act.id }),
          });
        }
      } catch {
        // ignore
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [bookings]);

  const activeLineShareBooking = lineShareBookingId
    ? bookings.find((b) => b.id === lineShareBookingId) || null
    : null;

  const activeLineQuickApproveBooking = lineQuickApproveState
    ? bookings.find((b) => b.id === lineQuickApproveState.bookingId) || null
    : null;

  // If not logged in or login page was explicitly opened, show the Login Page (plus LINE Quick Approve Modal if opened via LINE link)
  if (!currentUser || isLoginPageOpen) {
    return (
      <>
        <LoginPage
          users={users}
          onLogin={handleLogin}
          language={language}
          onToggleLanguage={handleToggleLanguage}
        />
        {lineQuickApproveState && activeLineQuickApproveBooking && (
          <LineQuickApproveModal
            isOpen={Boolean(lineQuickApproveState)}
            onClose={handleCloseLineQuickApprove}
            booking={activeLineQuickApproveBooking}
            users={users}
            currentUser={currentUser}
            initialStage={lineQuickApproveState.stage}
            initialAction={lineQuickApproveState.action}
            initialApproverId={lineQuickApproveState.approverId}
            onUpdateBookingStatus={handleUpdateBookingStatus}
            onUpdateUserLineId={handleUpdateUserLineId}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-gray-800" id="main-layout-container">
      {/* 1. Sidebar - Navigation on Desktop, drawer on Mobile */}
      <aside
        id="app-sidebar"
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-slate-900 text-white flex flex-col justify-between z-40 transition-transform duration-300 transform md:transform-none ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col flex-1">
          {/* Sidebar Brand Header */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800">
            <div
              id="brand-home-link"
              onClick={() => {
                setActiveTab('calendar');
                setIsSidebarOpen(false);
              }}
              className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity"
              title="กลับสู่หน้าแรก (ปฏิทินจองรถ)"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm shadow-indigo-500/20">
                🚘
              </div>
              <div>
                <h1 className="font-bold text-sm tracking-tight">{t.appTitle}</h1>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Corporate Fleet</span>
              </div>
            </div>
            {/* Mobile close button */}
            <button
              id="sidebar-close-btn"
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current Profile Summary inside Sidebar */}
          {currentUser && (
            <div className="p-3 mx-3 my-3 bg-slate-800/60 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider block">
                  {language === 'th' ? 'ผู้ใช้งานปัจจุบัน' : 'Active Account'}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
                  {currentUser.name.substring(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold block truncate text-slate-200">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] text-indigo-400 block truncate font-medium">
                    {currentUser.department}
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {getUserRoles(currentUser).map((r) => {
                      const b = getRoleBadgeInfo(r, language === 'en');
                      return (
                        <span key={r} className="text-[8px] font-semibold px-1 py-0.2 rounded bg-slate-700/80 text-slate-300">
                          {b.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-800">
                <button
                  id="sidebar-logout-btn"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-slate-300 hover:text-red-300 hover:bg-red-950/40 rounded-xl border border-slate-800 hover:border-red-900/40 transition-colors cursor-pointer"
                  title={t.logout}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t.logout}</span>
                </button>
              </div>
            </div>
          )}

          {/* Nav Links */}
          <nav className="flex-1 px-3 space-y-1.5">
            <button
              id="nav-tab-calendar"
              onClick={() => {
                setActiveTab('calendar');
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/10'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <CalendarDays className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">{t.navCalendar}</span>
            </button>

            <button
              id="nav-tab-booking"
              onClick={() => {
                setActiveTab('booking');
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'booking'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/10'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <ClipboardList className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">{t.navStatus}</span>
              {bookings.filter((b) => b.status === 'Pending' && canUserViewBooking(b, currentUser, users)).length > 0 && (
                <span className="bg-amber-500 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {bookings.filter((b) => b.status === 'Pending' && canUserViewBooking(b, currentUser, users)).length}
                </span>
              )}
            </button>

            <button
              id="nav-tab-vehicles"
              onClick={() => {
                setActiveTab('vehicles');
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'vehicles'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/10'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Car className="w-4 h-4 shrink-0" />
              <span>{t.navVehicles} ({vehicles.length})</span>
            </button>

            <button
              id="nav-tab-users"
              onClick={() => {
                setActiveTab('users');
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/10'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>{t.navUsers}</span>
            </button>

            <button
              id="nav-tab-report"
              onClick={() => {
                setActiveTab('report');
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'report'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/10'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>{t.navReport}</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/50">
          <div className="text-center">
            <p className="text-[10px] text-slate-400 font-semibold tracking-wide">
              Corporate Fleet Management
            </p>
            <p className="text-[9px] text-slate-500 mt-0.5">
              ระบบจองรถยนต์ส่วนกลาง
            </p>
          </div>
        </div>
      </aside>

      {/* Backdrop overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div
          id="sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
        />
      )}

      {/* 2. Main content block */}
      <div className="flex-1 flex flex-col min-w-0" id="main-content-block">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              id="sidebar-toggle-btn"
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <Menu className="w-5.5 h-5.5" />
            </button>
            <div className="hidden sm:flex items-center gap-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <span>{t.fleetStatusToday}: <span className="text-emerald-600 font-bold">🟢 {t.availableCount.replace('{count}', String(vehicles.filter(v => v.status === 'Available').length))}</span></span>
              <span className="h-4 w-[1px] bg-gray-200" />
              {isCloudSynced ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-bold animate-fade-in">
                  <CloudLightning className="w-3.5 h-3.5 text-indigo-600 animate-pulse" /> {t.cloudSyncActive}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-bold">
                  <CloudLightning className="w-3.5 h-3.5 text-amber-500 animate-spin" /> {t.cloudSyncing}
                </span>
              )}
            </div>
          </div>

          {/* Quick Header Profile Display & Language & Logout */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="text-right hidden xl:block">
              <span className="text-[10px] text-gray-400 block font-medium">
                {language === 'th' ? 'วันที่' : 'Date'}
              </span>
              <span className="text-xs text-gray-700 font-bold">
                {new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }).format(new Date())}
              </span>
            </div>

            {/* Language Switcher in Top Header */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-gray-200 text-xs">
              <Globe className="w-3.5 h-3.5 text-gray-400 ml-1 hidden sm:block" />
              <button
                id="header-lang-th"
                onClick={() => handleToggleLanguage('th')}
                className={`px-2 py-0.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  language === 'th' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                🇹🇭 TH
              </button>
              <button
                id="header-lang-en"
                onClick={() => handleToggleLanguage('en')}
                className={`px-2 py-0.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  language === 'en' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                🇬🇧 EN
              </button>
            </div>

            <div className="h-8 w-[1px] bg-gray-200 hidden lg:block" />

            {currentUser && (
              <div
                id="header-profile-box"
                className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl shadow-2xs"
                title={currentUser.name}
              >
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs">
                  {currentUser.name.substring(0, 2)}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-xs font-bold block text-gray-900 leading-tight">
                    {currentUser.name}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    {getUserRoles(currentUser).slice(0, 2).map((r) => (
                      <span key={r} className="text-[9px] font-semibold px-1 py-0 rounded bg-slate-200 text-slate-700">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
                {isUserAdmin(currentUser) ? (
                  <Shield className="w-3.5 h-3.5 text-purple-600 hidden sm:block" />
                ) : (
                  <CircleUser className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                )}
              </div>
            )}

            {/* Logout button in header */}
            <button
              id="header-logout-btn"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              title={t.logout}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t.logout}</span>
            </button>
          </div>
        </header>

        {/* Main dynamic container with responsive padding and animation */}
        <main className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'calendar' && (
                <MonthlyCalendar
                  vehicles={vehicles}
                  bookings={bookings}
                  currentUser={currentUser}
                  users={users}
                  onSelectUser={handleSelectUser}
                  onAddBooking={handleAddBooking}
                  onUpdateBookingStatus={handleUpdateBookingStatus}
                  onNavigateToBookingList={() => setActiveTab('booking')}
                  onNavigateToVehicles={() => setActiveTab('vehicles')}
                  isLineModuleEnabled={isLineModuleEnabled}
                  onOpenLineShare={(booking) => setLineShareBookingId(booking.id)}
                  onOpenLineQuickApprove={(booking, stage, action = 'approve') =>
                    setLineQuickApproveState({
                      bookingId: booking.id,
                      stage,
                      action,
                    })
                  }
                  onUpdateUserLineId={handleUpdateUserLineId}
                />
              )}

              {activeTab === 'booking' && (
                <BookingSystem
                  vehicles={vehicles}
                  bookings={bookings}
                  users={users}
                  currentUser={currentUser}
                  onAddBooking={handleAddBooking}
                  onUpdateBookingStatus={handleUpdateBookingStatus}
                  onDeleteBooking={handleDeleteBooking}
                  isLineModuleEnabled={isLineModuleEnabled}
                  onToggleLineModule={handleToggleLineModule}
                  onOpenLineShare={(booking) => setLineShareBookingId(booking.id)}
                  onOpenLineQuickApprove={(booking, stage, action = 'approve') =>
                    setLineQuickApproveState({
                      bookingId: booking.id,
                      stage,
                      action,
                    })
                  }
                />
              )}

              {activeTab === 'vehicles' && (
                <VehicleManagement
                  vehicles={vehicles}
                  bookings={bookings}
                  currentUser={currentUser}
                  onAddVehicle={handleAddVehicle}
                  onEditVehicle={handleEditVehicle}
                  onDeleteVehicle={handleDeleteVehicle}
                />
              )}

              {activeTab === 'users' && (
                <UserRegistration
                  users={users}
                  currentUser={currentUser}
                  onSelectUser={handleSelectUser}
                  onAddUser={handleAddUser}
                  onAddMultipleUsers={handleAddMultipleUsers}
                  onEditUser={handleEditUser}
                  onDeleteUser={handleDeleteUser}
                  language={language}
                  isLineModuleEnabled={isLineModuleEnabled}
                />
              )}

              {activeTab === 'report' && (
                <FleetReport
                  bookings={bookings}
                  vehicles={vehicles}
                  users={users}
                  currentUser={currentUser}
                  language={language}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>


      {/* LINE Share & Flex Message Approval Modal */}
      {activeLineShareBooking && (
        <LineShareApprovalModal
          isOpen={Boolean(activeLineShareBooking)}
          onClose={() => setLineShareBookingId(null)}
          booking={activeLineShareBooking}
          users={users}
          currentUser={currentUser}
          onMarkLineNotified={handleMarkLineNotified}
          onUpdateBookingStatus={handleUpdateBookingStatus}
          onUpdateUserLineId={handleUpdateUserLineId}
          onOpenQuickApprove={(b, stage, action = 'approve') => {
            setLineShareBookingId(null);
            setLineQuickApproveState({
              bookingId: b.id,
              stage,
              action,
            });
          }}
        />
      )}

      {/* LINE Booking Details Modal (Opened when clicking "ดูรายละเอียด" from LINE) */}
      {lineQuickApproveState && activeLineQuickApproveBooking && (
        <LineQuickApproveModal
          isOpen={Boolean(lineQuickApproveState)}
          onClose={handleCloseLineQuickApprove}
          booking={activeLineQuickApproveBooking}
          users={users}
          currentUser={currentUser}
          initialStage={lineQuickApproveState.stage}
          initialAction={lineQuickApproveState.action}
          initialApproverId={lineQuickApproveState.approverId}
          onUpdateBookingStatus={handleUpdateBookingStatus}
          onUpdateUserLineId={handleUpdateUserLineId}
          onNavigateToBookingList={() => {
            handleCloseLineQuickApprove();
            setActiveTab('booking');
          }}
        />
      )}

      {/* Floating Toast Message */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-800 text-xs font-semibold flex items-center gap-3 animate-fade-in">
          <span>🔔 {toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white p-0.5 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
