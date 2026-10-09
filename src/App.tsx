import React, { useState, useEffect } from 'react';
import { Vehicle, User, Booking, BookingStatus, RolePermissionsMatrix, AppMenuKey, AuditLogEntry } from './types';
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
  saveMultipleUsers,
  deleteUser,
  getBookings,
  saveBooking,
  deleteBooking,
  getRolePermissions,
  saveRolePermissions,
  getOrganizationSettings,
  subscribeToBookings,
  subscribeToUsers,
  subscribeToVehicles,
  mergeBookingsLists,
  fetchServerBookings,
  getDeletedBookingIds,
  saveLocalStoredBookings,
  areBookingListsEqual,
  getAuditLogs,
  getLocalAuditLogs,
  recordAuditLog,
  subscribeToAuditLogs,
} from './lib/firebase';

import BookingSystem from './components/BookingSystem';
import VehicleManagement from './components/VehicleManagement';
import UserRegistration from './components/UserRegistration';
import MonthlyCalendar from './components/MonthlyCalendar';
import LoginPage from './components/LoginPage';
import FleetReport from './components/FleetReport';
import AuditLogView from './components/AuditLogView';
import BookingManual from './components/BookingManual';
import LineShareApprovalModal from './components/LineShareApprovalModal';
import LineQuickApproveModal from './components/LineQuickApproveModal';
import {
  triggerServerLineApprovalPush,
  getLineModuleEnabled,
  setLineModuleEnabled,
} from './utils/lineApprovalUtils';
import { translations, Language } from './utils/translations';
import {
  isUserAdmin,
  getUserRoles,
  getRoleBadgeInfo,
  canUserViewBooking,
  hasRole,
  getStoredRolePermissions,
  saveStoredRolePermissions,
  getUserEffectiveMenuPermission,
} from './utils/userHelpers';
import { getRealTodayStr, generateNextJobNumber, getBookingJobNumber } from './utils/dateHelpers';
import { doesBookingMatchVehicle, isBookingActiveStatus } from './utils/vehicleAlerts';

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
  BookOpen,
  History,
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
          const deletedSet = getDeletedBookingIds();
          return parsed
            .filter((b: Booking) => b && b.id && !deletedSet.has(b.id))
            .map((b: Booking) => ({
              ...b,
              jobNumber: getBookingJobNumber(b),
            }));
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
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => getLocalAuditLogs());

  const getCurrentActorRole = (u?: User | null) => {
    if (!u) return 'System';
    return getUserRoles(u).join(', ');
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setUsers((prev) => {
      const next = prev.some((u) => u.id === user.id)
        ? prev.map((u) => (u.id === user.id ? user : u))
        : [...prev, user];
      localStorage.setItem('car_booking_users', JSON.stringify(next));
      return next;
    });
    localStorage.setItem('car_booking_current_user', JSON.stringify(user));
    setIsLoginPageOpen(false);
    recordAuditLog({
      category: 'AUTH',
      action: 'เข้าสู่ระบบ (Login)',
      actorId: user.id,
      actorName: user.name,
      actorRole: getCurrentActorRole(user),
      actorDepartment: user.department,
      targetLabel: user.username || user.email,
      details: `ผู้ใช้งาน "${user.name}" (${user.department}) เข้าสู่ระบบ`,
      channel: 'Web',
    }).catch(() => {});
  };

  const handleLogout = () => {
    if (currentUser) {
      recordAuditLog({
        category: 'AUTH',
        action: 'ออกจากระบบ (Logout)',
        actorId: currentUser.id,
        actorName: currentUser.name,
        actorRole: getCurrentActorRole(currentUser),
        actorDepartment: currentUser.department,
        targetLabel: currentUser.username || currentUser.email,
        details: `ผู้ใช้งาน "${currentUser.name}" ออกจากระบบ`,
        channel: 'Web',
      }).catch(() => {});
    }
    setCurrentUser(null);
    localStorage.removeItem('car_booking_current_user');
    setIsLoginPageOpen(true);
  };

  const [activeTab, setActiveTab] = useState<'calendar' | 'booking' | 'vehicles' | 'users' | 'report' | 'audit' | 'manual'>('calendar');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCloudSynced, setIsCloudSynced] = useState(false);

  // Role Permissions Matrix state
  const [rolePermissions, setRolePermissions] = useState<RolePermissionsMatrix>(() => {
    return getStoredRolePermissions();
  });

  const handleUpdateRolePermissions = async (newMatrix: RolePermissionsMatrix) => {
    setRolePermissions(newMatrix);
    saveStoredRolePermissions(newMatrix);
    recordAuditLog({
      category: 'PERMISSION',
      action: 'บันทึกตารางกำหนดสิทธิ์การใช้งาน',
      actorId: currentUser?.id,
      actorName: currentUser?.name || 'Admin',
      actorRole: getCurrentActorRole(currentUser),
      actorDepartment: currentUser?.department,
      targetLabel: 'Role Permissions Matrix',
      details: 'อัปเดตสิทธิ์การเข้าถึงเมนู (ดูอย่างเดียว / แก้ไขได้) ของแต่ละบทบาทผู้ใช้งาน',
      channel: 'Web',
    }).catch(() => {});
    try {
      await saveRolePermissions(newMatrix);
    } catch (e) {
      console.error('Failed to save role permissions to cloud:', e);
    }
  };

  // Fetch real-time/latest data from Firestore & Server on Mount + Real-time Subscriptions
  useEffect(() => {
    let isMounted = true;

    async function loadCloudData() {
      try {
        setIsLoading(true);
        const [dbVehicles, dbUsers, dbBookings, dbRolePerms, , dbAuditLogs] = await Promise.all([
          getVehicles(),
          getUsers(),
          getBookings(),
          getRolePermissions(),
          getOrganizationSettings(),
          getAuditLogs(),
        ]);
        if (!isMounted) return;
        setVehicles(dbVehicles);
        setUsers(dbUsers);
        setBookings((prev) => mergeBookingsLists([prev, dbBookings]));
        if (dbRolePerms) {
          setRolePermissions(dbRolePerms);
        }
        if (dbAuditLogs) {
          setAuditLogs(dbAuditLogs);
        }
        setIsCloudSynced(true);

        // Sync currentUser with latest cloud user profile (roles, department, division)
        setCurrentUser((prevUser) => {
          if (!prevUser || dbUsers.length === 0) return prevUser;
          const matched = dbUsers.find(
            (u) =>
              u.id === prevUser.id ||
              (prevUser.email && u.email.toLowerCase() === prevUser.email.toLowerCase()) ||
              (prevUser.username &&
                u.username &&
                u.username.toLowerCase() === prevUser.username.toLowerCase())
          );
          return matched || prevUser;
        });
      } catch (error) {
        console.error('Error fetching data from Firestore:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCloudData();

    const unsubBookings = subscribeToBookings((cloudBookings) => {
      if (!isMounted) return;
      setBookings((prev) => {
        const merged = mergeBookingsLists([prev, cloudBookings]);
        return areBookingListsEqual(prev, merged) ? prev : merged;
      });
    });

    const unsubUsers = subscribeToUsers((cloudUsers) => {
      if (!isMounted) return;
      setUsers(cloudUsers);
      setCurrentUser((prevUser) => {
        if (!prevUser || cloudUsers.length === 0) return prevUser;
        const matched = cloudUsers.find(
          (u) =>
            u.id === prevUser.id ||
            (prevUser.email && u.email.toLowerCase() === prevUser.email.toLowerCase()) ||
            (prevUser.username &&
              u.username &&
              u.username.toLowerCase() === prevUser.username.toLowerCase())
        );
        return matched || prevUser;
      });
    });

    const unsubVehicles = subscribeToVehicles((cloudVehicles) => {
      if (!isMounted) return;
      setVehicles(cloudVehicles);
    });

    const unsubAuditLogs = subscribeToAuditLogs((cloudLogs) => {
      if (!isMounted) return;
      setAuditLogs(cloudLogs);
    });

    const handleLocalAuditEvent = () => {
      if (!isMounted) return;
      setAuditLogs(getLocalAuditLogs());
    };
    window.addEventListener('audit-log-updated', handleLocalAuditEvent);

    // Periodic server sync so cross-session/cross-user bookings stay 100% synchronized
    const syncInterval = setInterval(async () => {
      if (!isMounted) return;
      const serverData = await fetchServerBookings();
      if (!isMounted) return;
      if (serverData.bookings.length > 0 || serverData.deletedIds.length > 0) {
        setBookings((prev) => {
          const merged = mergeBookingsLists([prev, serverData.bookings], serverData.deletedIds);
          return areBookingListsEqual(prev, merged) ? prev : merged;
        });
      }
    }, 4000);

    return () => {
      isMounted = false;
      unsubBookings();
      unsubUsers();
      unsubVehicles();
      unsubAuditLogs();
      window.removeEventListener('audit-log-updated', handleLocalAuditEvent);
      clearInterval(syncInterval);
    };
  }, []);

  // Sync state to local storage for quick offline / startup response
  useEffect(() => {
    try {
      localStorage.setItem('car_booking_vehicles', JSON.stringify(vehicles));
    } catch {
      // ignore quota error
    }
  }, [vehicles]);

  useEffect(() => {
    try {
      localStorage.setItem('car_booking_users', JSON.stringify(users));
    } catch {
      // ignore quota error
    }
  }, [users]);

  useEffect(() => {
    saveLocalStoredBookings(bookings);
  }, [bookings]);

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem('car_booking_current_user', JSON.stringify(currentUser));
      } else {
        localStorage.removeItem('car_booking_current_user');
      }
    } catch {
      // ignore quota error
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
    setUsers((prev) => {
      const updatedUsers = [...prev, newUser];
      localStorage.setItem('car_booking_users', JSON.stringify(updatedUsers));
      return updatedUsers;
    });
    setToastMessage(`เพิ่มผู้ใช้งาน "${newUser.name}" (Username: ${newUser.username}) เรียบร้อยแล้ว`);
    if (!currentUser) {
      setCurrentUser(newUser);
    }
    try {
      await saveUser(newUser);
    } catch (e) {
      console.error('Cloud save failed', e);
    }
    recordAuditLog({
      category: 'USER',
      action: 'เพิ่มผู้ใช้งานใหม่',
      actorId: currentUser?.id,
      actorName: currentUser?.name || 'Admin',
      actorRole: getCurrentActorRole(currentUser),
      actorDepartment: currentUser?.department,
      targetId: newUser.id,
      targetLabel: `${newUser.name} (${newUser.department})`,
      details: `สร้างบัญชีผู้ใช้งาน "${newUser.name}" แผนก ${newUser.department}${newUser.division ? ` ฝ่าย ${newUser.division}` : ''}`,
      channel: 'Web',
    }).catch(() => {});
  };

  const handleAddMultipleUsers = async (newUsersList: Omit<User, 'id'>[]) => {
    const createdUsers: User[] = newUsersList.map((userData, index) => ({
      ...userData,
      id: `user-${Date.now()}-${index}`,
    }));
    setUsers((prev) => {
      const updatedUsers = [...prev, ...createdUsers];
      localStorage.setItem('car_booking_users', JSON.stringify(updatedUsers));
      return updatedUsers;
    });
    try {
      for (const u of createdUsers) {
        await saveUser(u);
      }
    } catch (e) {
      console.error('Cloud save multiple users failed', e);
    }
    recordAuditLog({
      category: 'USER',
      action: 'นำเข้าข้อมูลผู้ใช้งานหลายรายการ',
      actorId: currentUser?.id,
      actorName: currentUser?.name || 'Admin',
      actorRole: getCurrentActorRole(currentUser),
      actorDepartment: currentUser?.department,
      targetLabel: `จำนวน ${createdUsers.length} รายชื่อ`,
      details: `นำเข้าข้อมูลผู้ใช้งานจำนวน ${createdUsers.length} รายการ`,
      channel: 'Web',
    }).catch(() => {});
  };

  const handleEditUser = async (updatedUser: User) => {
    const stampedUser: User & { updatedAt?: string } = {
      ...updatedUser,
      updatedAt: new Date().toISOString(),
    };
    setUsers((prev) => {
      const next = prev.map((u) => (u.id === stampedUser.id ? stampedUser : u));
      try {
        localStorage.setItem('car_booking_users', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setCurrentUser((prev) => (prev?.id === stampedUser.id ? stampedUser : prev));

    let bookingsToSave: Booking[] = [];
    setBookings((prev) => {
      const next = prev.map((b) => {
        if (b.userId === stampedUser.id) {
          const updatedB: Booking = {
            ...b,
            userName: stampedUser.name,
            userPhone: stampedUser.phone,
            userDepartment: stampedUser.department,
            userDivision: stampedUser.division,
            requesterLineId: stampedUser.lineUserId || b.requesterLineId,
          };
          bookingsToSave.push(updatedB);
          return updatedB;
        }
        return b;
      });
      saveLocalStoredBookings(next);
      return next;
    });

    try {
      await saveUser(stampedUser);
      for (const b of bookingsToSave) {
        await saveBooking(b);
      }
    } catch (e) {
      console.error('Cloud edit user failed', e);
    }
    recordAuditLog({
      category: 'USER',
      action: 'แก้ไขข้อมูลผู้ใช้งาน',
      actorId: currentUser?.id,
      actorName: currentUser?.name || 'Admin',
      actorRole: getCurrentActorRole(currentUser),
      actorDepartment: currentUser?.department,
      targetId: stampedUser.id,
      targetLabel: `${stampedUser.name} (${stampedUser.department})`,
      details: `อัปเดตข้อมูลผู้ใช้งาน "${stampedUser.name}" แผนก ${stampedUser.department}${stampedUser.division ? ` ฝ่าย ${stampedUser.division}` : ''}`,
      channel: 'Web',
    }).catch(() => {});
  };

  const handleEditMultipleUsers = async (updatedUsersList: User[]) => {
    if (updatedUsersList.length === 0) return;
    const nowIso = new Date().toISOString();
    const stampedMap = new Map<string, User & { updatedAt?: string }>();
    for (const u of updatedUsersList) {
      stampedMap.set(u.id, { ...u, updatedAt: nowIso });
    }

    setUsers((prev) => {
      const next = prev.map((u) => stampedMap.get(u.id) || u);
      try {
        localStorage.setItem('car_booking_users', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    setCurrentUser((prev) => (prev && stampedMap.has(prev.id) ? stampedMap.get(prev.id)! : prev));

    let bookingsToSave: Booking[] = [];
    setBookings((prev) => {
      const next = prev.map((b) => {
        const matchedU = stampedMap.get(b.userId);
        if (matchedU) {
          const updatedB: Booking = {
            ...b,
            userName: matchedU.name,
            userPhone: matchedU.phone,
            userDepartment: matchedU.department,
            userDivision: matchedU.division,
            requesterLineId: matchedU.lineUserId || b.requesterLineId,
          };
          bookingsToSave.push(updatedB);
          return updatedB;
        }
        return b;
      });
      saveLocalStoredBookings(next);
      return next;
    });

    try {
      await saveMultipleUsers(Array.from(stampedMap.values()));
      for (const b of bookingsToSave) {
        await saveBooking(b);
      }
    } catch (e) {
      console.error('Cloud edit multiple users failed', e);
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
    const target = users.find((u) => u.id === userId);
    setUsers(users.filter((u) => u.id !== userId));
    if (currentUser?.id === userId) {
      const remaining = users.filter((u) => u.id !== userId);
      setCurrentUser(remaining.length > 0 ? remaining[0] : null);
    }
    recordAuditLog({
      category: 'USER',
      action: 'ลบผู้ใช้งาน',
      actorId: currentUser?.id,
      actorName: currentUser?.name || 'Admin',
      actorRole: getCurrentActorRole(currentUser),
      actorDepartment: currentUser?.department,
      targetId: userId,
      targetLabel: target ? `${target.name} (${target.department})` : userId,
      details: `ลบบัญชีผู้ใช้งาน "${target?.name || userId}" ออกจากระบบ`,
      channel: 'Web',
    }).catch(() => {});
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
    recordAuditLog({
      category: 'VEHICLE',
      action: 'เพิ่มยานพาหนะใหม่',
      actorId: currentUser?.id,
      actorName: currentUser?.name || 'Admin',
      actorRole: getCurrentActorRole(currentUser),
      actorDepartment: currentUser?.department,
      targetId: newVehicle.id,
      targetLabel: `${newVehicle.brand} ${newVehicle.model} (${newVehicle.plateNumber})`,
      details: `เพิ่มรถใหม่ ${newVehicle.brand} ${newVehicle.model} ทะเบียน ${newVehicle.plateNumber}`,
      channel: 'Web',
    }).catch(() => {});
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

    recordAuditLog({
      category: 'VEHICLE',
      action: 'แก้ไขข้อมูลยานพาหนะ',
      actorId: currentUser?.id,
      actorName: currentUser?.name || 'Admin',
      actorRole: getCurrentActorRole(currentUser),
      actorDepartment: currentUser?.department,
      targetId: updatedVehicle.id,
      targetLabel: newVehicleName,
      details: `อัปเดตข้อมูลรถ ${newVehicleName} (สถานะ: ${updatedVehicle.status}${
        updatedVehicle.currentMileage !== undefined
          ? `, เลขไมล์: ${updatedVehicle.currentMileage.toLocaleString()} กม.`
          : ''
      })`,
      channel: 'Web',
    }).catch(() => {});

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
    const targetVeh = vehicles.find((v) => v.id === vehicleId);
    setVehicles(vehicles.filter((v) => v.id !== vehicleId));
    const updatedBookings = bookings.map((b) =>
      b.vehicleId === vehicleId && (b.status === 'Pending' || b.status === 'Approved')
        ? { ...b, status: 'Cancelled' as BookingStatus }
        : b
    );
    setBookings(updatedBookings);

    recordAuditLog({
      category: 'VEHICLE',
      action: 'ลบยานพาหนะ',
      actorId: currentUser?.id,
      actorName: currentUser?.name || 'Admin',
      actorRole: getCurrentActorRole(currentUser),
      actorDepartment: currentUser?.department,
      targetId: vehicleId,
      targetLabel: targetVeh
        ? `${targetVeh.brand} ${targetVeh.model} (${targetVeh.plateNumber})`
        : vehicleId,
      details: `ลบรถยนต์ ${
        targetVeh ? `${targetVeh.brand} ${targetVeh.model} (${targetVeh.plateNumber})` : vehicleId
      } ออกจากระบบ`,
      channel: 'Web',
    }).catch(() => {});

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

  // Handlers for Booking with Firebase + Server + LocalStorage persistence
  const handleAddBooking = async (newBookingData: Omit<Booking, 'id' | 'createdAt'>) => {
    const createdAtIso = new Date().toISOString();
    const jobNumber = newBookingData.jobNumber || generateNextJobNumber(bookings, createdAtIso);
    const newBooking: Booking = {
      ...newBookingData,
      id: `b-${Date.now()}`,
      jobNumber,
      createdAt: createdAtIso,
    };

    // 1. Update React state and persist immediately
    setBookings((prev) => mergeBookingsLists([prev, [newBooking]]));
    setToastMessage(
      newBooking.status === 'Approved'
        ? `บันทึกและอนุมัติใบงาน ${jobNumber} เรียบร้อยแล้ว`
        : `บันทึกคำขอจองรถ (ใบงาน ${jobNumber}) เรียบร้อยแล้ว รอคุณ ${newBooking.assignedApproverName || 'ผู้อนุมัติ'} พิจารณา`
    );

    const todayStr = getRealTodayStr();
    const start = newBooking.startDate.substring(0, 10);
    const end = newBooking.endDate.substring(0, 10);

    let matchedApprovedVehicle: Vehicle | undefined;
    if (newBooking.status === 'Approved' && todayStr >= start && todayStr <= end) {
      setVehicles((prev) =>
        prev.map((v) => {
          if (v.id === newBooking.vehicleId) {
            const updated: Vehicle = { ...v, status: 'In Use' };
            matchedApprovedVehicle = updated;
            return updated;
          }
          return v;
        })
      );
    }

    // 2. Persist booking to LocalStorage, Express Server, and Firestore first
    try {
      await saveBooking(newBooking);
      if (matchedApprovedVehicle) {
        await saveVehicle(matchedApprovedVehicle);
      }
    } catch (e) {
      console.error('Cloud save booking failed', e);
    }

    recordAuditLog({
      id: `hist-create-${newBooking.id}`,
      timestamp: createdAtIso,
      category: 'BOOKING',
      action: 'สร้างใบงานขอใช้รถ',
      actorId: currentUser?.id || newBooking.userId,
      actorName: newBooking.userName || currentUser?.name || 'ผู้ขอใช้รถ',
      actorRole: getCurrentActorRole(currentUser),
      actorDepartment: newBooking.userDepartment || currentUser?.department,
      targetId: jobNumber,
      targetLabel: `${jobNumber} (${newBooking.vehicleName})`,
      details: `สร้างคำขอใช้รถ ${newBooking.vehicleName} ไปยัง "${newBooking.destination}" (${newBooking.purpose})`,
      channel: 'Web',
    }).catch(() => {});

    // 3. Automatically push notification to Approve 1's LINE ID from User Management
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
              `บันทึกใบงาน ${jobNumber} และส่งต่อให้ ${newBooking.assignedApproverName || 'Approve 1'}${targetLineId ? ` (LINE ID: ${targetLineId})` : ''} พิจารณาอนุมัติเรียบร้อยแล้ว`
            );
          }
        })
        .catch(() => {});
    }
  };

  // Auto-sync vehicle currentMileage and status whenever bookings change
  useEffect(() => {
    if (vehicles.length === 0) return;
    let hasVehicleUpdates = false;
    const vehiclesToSave: Vehicle[] = [];

    const nextVehicles = vehicles.map((v) => {
      const relatedBookings = bookings.filter(
        (b) => b.status !== 'Cancelled' && doesBookingMatchVehicle(b, v)
      );

      let maxRecordedMileage = v.currentMileage || 0;
      for (const b of relatedBookings) {
        if (typeof b.endMileage === 'number' && b.endMileage > maxRecordedMileage) {
          maxRecordedMileage = b.endMileage;
        } else if (typeof b.startMileage === 'number' && b.startMileage > maxRecordedMileage) {
          maxRecordedMileage = b.startMileage;
        }
      }

      const hasActiveMission = relatedBookings.some((b) => isBookingActiveStatus(b.status));
      let nextStatus = v.status;
      if (v.status !== 'Maintenance') {
        nextStatus = hasActiveMission ? 'In Use' : 'Available';
      }

      const mileageChanged = maxRecordedMileage > (v.currentMileage || 0);
      const statusChanged = nextStatus !== v.status;

      if (mileageChanged || statusChanged) {
        hasVehicleUpdates = true;
        const updatedVeh: Vehicle = {
          ...v,
          status: nextStatus,
          ...(mileageChanged ? { currentMileage: maxRecordedMileage } : {}),
        };
        vehiclesToSave.push(updatedVeh);
        return updatedVeh;
      }
      return v;
    });

    if (hasVehicleUpdates) {
      setVehicles(nextVehicles);
      for (const veh of vehiclesToSave) {
        saveVehicle(veh).catch(() => {});
      }
    }
  }, [bookings, vehicles]);

  const handleUpdateBookingStatus = async (
    bookingId: string,
    status: BookingStatus,
    extraData?: Partial<Booking>
  ) => {
    let approverName: string | undefined = undefined;
    let approvedAt: string | undefined = undefined;
    let rejectionMeta: Partial<Booking> = {};

    const existing = bookings.find((b) => b.id === bookingId);

    if (status === 'Approved') {
      const stage1Name = extraData?.stage1ApprovedBy || existing?.stage1ApprovedBy;
      const stage2Name = extraData?.stage2ApprovedBy || currentUser?.name || 'ผู้ดูแลรถ';
      approverName = stage1Name ? `${stage1Name} (ผู้จัดการ) & ${stage2Name} (ผู้ดูแลรถ)` : `${stage2Name}`;
      approvedAt = new Date().toISOString();
    } else if (status === 'Cancelled') {
      const inferredStage: 1 | 2 =
        extraData?.rejectedStage ||
        (existing?.status === 'Pending_Approve2' || existing?.stage1ApprovedBy ? 2 : 1);
      const stageLabel = inferredStage === 2 ? 'ผู้ดูแลรถ' : 'ผู้จัดการ';
      const defaultRejecter =
        inferredStage === 2
          ? existing?.stage2ApproverName || currentUser?.name || stageLabel
          : existing?.assignedApproverName || currentUser?.name || stageLabel;
      rejectionMeta = {
        rejectedStage: inferredStage,
        rejectedBy: extraData?.rejectedBy || `${defaultRejecter} (${stageLabel} Reject)`,
        rejectedAt: extraData?.rejectedAt || new Date().toISOString(),
      };
    }

    const updatedBookings = bookings.map((b) => {
      if (b.id !== bookingId) return b;
      return {
        ...b,
        status,
        ...(approverName ? { approverName, approvedAt } : {}),
        ...rejectionMeta,
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
          users.find((u) => hasRole(u, 'Approve 2'));
        const targetStage2LineId = booking.stage2ApproverLineId || stage2Approver?.lineUserId;
        triggerServerLineApprovalPush({
          booking,
          stage: 2,
          approverUser: stage2Approver,
          approverName: booking.stage2ApproverName || stage2Approver?.name || 'ผู้ดูแลรถ',
          targetLineId: targetStage2LineId,
        }).catch(() => {});
      }
      setToastMessage(
        `ผู้จัดการอนุมัติ (ใบงาน ${jobNo}) สำเร็จ! ส่งต่อคำขอให้ผู้ดูแลรถ (${booking.stage2ApproverName || 'ผู้ดูแลรถ'}) พิจารณา`
      );
    } else if (status === 'Approved') {
      if (isLineModuleEnabled) {
        const reqUser = users.find((u) => u.id === booking.userId);
        const targetReqLineId = booking.requesterLineId || reqUser?.lineUserId;
        triggerServerLineApprovalPush({
          booking,
          stage: 'approved',
          approverUser: reqUser,
          approverName: booking.stage2ApprovedBy || booking.approverName || 'ผู้ดูแลรถ',
          targetLineId: targetReqLineId,
        }).catch(() => {});
      }
      setToastMessage(
        `อนุมัติใบงาน ${jobNo} (${booking.vehicleName}) เรียบร้อยแล้ว (อนุมัติครบ 2 ขั้น)`
      );
    } else if (status === 'Completed') {
      if (isLineModuleEnabled) {
        const operatorUsers = users.filter((u) => hasRole(u, 'Operator'));
        const approve2Users = users.filter(
          (u) => hasRole(u, 'Approve 2') || u.id === booking.stage2ApproverId
        );
        const notifyUsers = Array.from(new Set([...approve2Users, ...operatorUsers]));
        const targetLineIds = Array.from(
          new Set(
            [
              booking.stage2ApproverLineId,
              ...notifyUsers.map((u) => u.lineUserId),
            ]
              .filter(Boolean)
              .map((id) => String(id).trim())
              .filter(Boolean)
          )
        );
        const notifyNames =
          notifyUsers.map((u) => u.name).join(', ') ||
          booking.stage2ApproverName ||
          'Operator & ผู้ดูแลรถ';

        triggerServerLineApprovalPush({
          booking,
          stage: 'completed',
          approverUser: approve2Users[0] || operatorUsers[0] || null,
          approverName: notifyNames,
          targetLineId: targetLineIds[0] || booking.stage2ApproverLineId,
          targetLineIds,
        }).catch(() => {});
      }
      const newMileageText =
        extraData?.endMileage !== undefined
          ? ` อัปเดตเลขไมล์รถเป็น ${extraData.endMileage.toLocaleString()} km.`
          : '';
      setToastMessage(
        `เสร็จสิ้นภารกิจใบงาน ${jobNo}${newMileageText} และส่ง LINE แจ้งเตือน Operator & ผู้ดูแลรถ (Approve 2) เรียบร้อยแล้ว`
      );
    } else if (status === 'Cancelled') {
      const isUserSelfCancel = Boolean(
        extraData?.rejectedBy && extraData.rejectedBy.includes('ผู้จองยกเลิก')
      );
      if (isLineModuleEnabled && booking.rejectionReason && !isUserSelfCancel) {
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
        isUserSelfCancel
          ? `ยกเลิกการจองใบงาน ${jobNo} เรียบร้อยแล้ว`
          : booking.rejectionReason
          ? `ไม่อนุมัติใบงาน ${jobNo} (เหตุผล: ${booking.rejectionReason}) และแจ้งเตือนผู้จองเรียบร้อยแล้ว`
          : `ยกเลิก/ปฏิเสธใบงาน ${jobNo} เรียบร้อยแล้ว`
      );
    }

    // Immediately compute atomic vehicle update (both mileage & status) so state never overwrites mileage
    const todayStr = getRealTodayStr();
    const start = booking.startDate.substring(0, 10);
    const end = booking.endDate.substring(0, 10);
    const newMileageToApply =
      extraData?.endMileage !== undefined
        ? extraData.endMileage
        : extraData?.startMileage !== undefined
        ? extraData.startMileage
        : undefined;

    let vehicleToSave: Vehicle | undefined;
    setVehicles((prevVehicles) =>
      prevVehicles.map((v) => {
        const isTargetVehicle =
          v.id === booking.vehicleId ||
          (booking.plateNumber && v.plateNumber === booking.plateNumber);
        if (!isTargetVehicle) return v;

        let nextStatus = v.status;
        if (status === 'Approved' && todayStr >= start && todayStr <= end) {
          nextStatus = 'In Use';
        } else if (status === 'Cancelled' || status === 'Completed') {
          const otherActive = updatedBookings.some(
            (b) =>
              b.id !== bookingId &&
              (b.vehicleId === v.id || (b.plateNumber && b.plateNumber === v.plateNumber)) &&
              b.status === 'Approved' &&
              todayStr >= b.startDate.substring(0, 10) &&
              todayStr <= b.endDate.substring(0, 10)
          );
          if (!otherActive && v.status === 'In Use') {
            nextStatus = 'Available';
          }
        }

        const nextMileage =
          newMileageToApply !== undefined ? newMileageToApply : v.currentMileage;

        if (nextStatus !== v.status || nextMileage !== v.currentMileage) {
          const updatedVeh: Vehicle = {
            ...v,
            status: nextStatus,
            ...(nextMileage !== undefined ? { currentMileage: nextMileage } : {}),
          };
          vehicleToSave = updatedVeh;
          return updatedVeh;
        }
        return v;
      })
    );

    try {
      await saveBooking(booking);
      if (vehicleToSave) {
        await saveVehicle(vehicleToSave);
      }
    } catch (e) {
      console.error('Cloud update booking failed', e);
    }

    // Record Audit Log for status/checklist update
    const channelUsed = extraData?.approvedVia === 'LINE' ? 'LINE' : 'Web';
    if (extraData?.startMileage !== undefined && status === 'Approved') {
      recordAuditLog({
        id: `hist-start-trip-${booking.id}`,
        category: 'TRIP',
        action: 'บันทึกไมล์และน้ำมันก่อนเดินทาง',
        actorId: currentUser?.id || booking.userId,
        actorName: currentUser?.name || booking.userName,
        actorRole: getCurrentActorRole(currentUser),
        actorDepartment: currentUser?.department || booking.userDepartment,
        targetId: jobNo,
        targetLabel: `${jobNo} (${booking.vehicleName})`,
        details: `บันทึกไมล์เริ่มต้น ${extraData.startMileage.toLocaleString()} กม. | ระดับน้ำมันเริ่มต้น: ${
          extraData.startFuelLevel || booking.startFuelLevel || '-'
        }`,
        channel: 'Web',
      }).catch(() => {});
    } else if (status === 'Pending_Approve2') {
      recordAuditLog({
        id: `hist-approve1-${booking.id}`,
        category: 'APPROVAL',
        action: 'อนุมัติขั้นที่ 1 (ผู้จัดการ)',
        actorId: currentUser?.id,
        actorName:
          extraData?.stage1ApprovedBy ||
          currentUser?.name ||
          booking.assignedApproverName ||
          'Approve 1',
        actorRole: getCurrentActorRole(currentUser) || 'Approve 1',
        actorDepartment: currentUser?.department || booking.userDepartment,
        targetId: jobNo,
        targetLabel: `${jobNo} (${booking.vehicleName})`,
        details: `อนุมัติใบงาน ${jobNo} ขั้นที่ 1 ส่งต่อให้ผู้ดูแลรถ (${booking.stage2ApproverName || 'Approve 2'})`,
        channel: channelUsed,
      }).catch(() => {});
    } else if (status === 'Approved') {
      recordAuditLog({
        id: `hist-approve2-${booking.id}`,
        category: 'APPROVAL',
        action: 'อนุมัติขั้นที่ 2 (ผู้ดูแลรถ)',
        actorId: currentUser?.id,
        actorName:
          extraData?.stage2ApprovedBy ||
          currentUser?.name ||
          booking.stage2ApproverName ||
          'Approve 2',
        actorRole: getCurrentActorRole(currentUser) || 'Approve 2',
        actorDepartment: currentUser?.department,
        targetId: jobNo,
        targetLabel: `${jobNo} (${booking.vehicleName})`,
        details: `อนุมัติใบงาน ${jobNo} ครบ 2 ขั้นตอน พร้อมออกเดินทาง`,
        channel: channelUsed,
      }).catch(() => {});
    } else if (status === 'Completed') {
      recordAuditLog({
        id: `hist-end-trip-${booking.id}`,
        category: 'TRIP',
        action: 'คืนรถและเสร็จสิ้นภารกิจ',
        actorId: currentUser?.id || booking.userId,
        actorName: currentUser?.name || booking.userName,
        actorRole: getCurrentActorRole(currentUser),
        actorDepartment: currentUser?.department || booking.userDepartment,
        targetId: jobNo,
        targetLabel: `${jobNo} (${booking.vehicleName})`,
        details: `คืนรถเสร็จสิ้นภารกิจ | ไมล์สิ้นสุด: ${
          booking.endMileage !== undefined ? `${booking.endMileage.toLocaleString()} กม.` : '-'
        } | ระดับน้ำมันคืนรถ: ${booking.endFuelLevel || '-'}`,
        channel: 'Web',
      }).catch(() => {});
    } else if (status === 'Cancelled') {
      recordAuditLog({
        id: `hist-cancel-${booking.id}`,
        category: 'APPROVAL',
        action: booking.rejectionReason ? 'ไม่อนุมัติคำขอใช้รถ' : 'ยกเลิกใบงานขอใช้รถ',
        actorId: currentUser?.id,
        actorName: booking.rejectedBy || currentUser?.name || booking.userName,
        actorRole: getCurrentActorRole(currentUser),
        actorDepartment: currentUser?.department || booking.userDepartment,
        targetId: jobNo,
        targetLabel: `${jobNo} (${booking.vehicleName})`,
        details: booking.rejectionReason
          ? `ไม่อนุมัติใบงาน ${jobNo} เหตุผล: "${booking.rejectionReason}"`
          : `ยกเลิกรายการจองใบงาน ${jobNo}`,
        channel: channelUsed,
      }).catch(() => {});
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!isUserAdmin(currentUser)) {
      setToastMessage('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่มีสิทธิ์ลบข้อมูลการยืมรถ');
      return;
    }
    const targetBooking = bookings.find((b) => b.id === bookingId);
    const jobNo = targetBooking ? getBookingJobNumber(targetBooking) : bookingId;
    setBookings((prev) => prev.filter((b) => b.id !== bookingId));
    setToastMessage('ลบข้อมูลการยืมรถออกจากระบบเรียบร้อยแล้ว');
    recordAuditLog({
      category: 'BOOKING',
      action: 'ลบใบงานขอใช้รถ',
      actorId: currentUser?.id,
      actorName: currentUser?.name || 'Admin',
      actorRole: getCurrentActorRole(currentUser),
      actorDepartment: currentUser?.department,
      targetId: jobNo,
      targetLabel: targetBooking ? `${jobNo} (${targetBooking.vehicleName})` : jobNo,
      details: `ลบใบงาน ${jobNo} ของผู้จอง "${targetBooking?.userName || '-'}" ออกจากระบบ`,
      channel: 'Web',
    }).catch(() => {});
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

  // Compute effective permissions for each menu according to RolePermissionsMatrix
  const calendarPerm = getUserEffectiveMenuPermission(currentUser, 'calendar', rolePermissions);
  const bookingPerm = getUserEffectiveMenuPermission(currentUser, 'booking', rolePermissions);
  const vehiclesPerm = getUserEffectiveMenuPermission(currentUser, 'vehicles', rolePermissions);
  const reportPerm = getUserEffectiveMenuPermission(currentUser, 'report', rolePermissions);
  const usersPerm = getUserEffectiveMenuPermission(currentUser, 'users', rolePermissions);

  const canAccessMenu = (key: AppMenuKey) => {
    const perm = getUserEffectiveMenuPermission(currentUser, key, rolePermissions);
    if (key === 'users' && isUserAdmin(currentUser)) return true;
    return perm.viewOnly || perm.canEdit;
  };

  useEffect(() => {
    if (!currentUser) return;
    if (activeTab === 'manual' || activeTab === 'audit') return;
    if (!canAccessMenu(activeTab)) {
      const orderedKeys: AppMenuKey[] = ['calendar', 'booking', 'vehicles', 'report', 'users'];
      const firstAllowed = orderedKeys.find((k) => canAccessMenu(k));
      if (firstAllowed && firstAllowed !== activeTab) {
        setActiveTab(firstAllowed);
      }
    }
  }, [currentUser, rolePermissions, activeTab]);

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
            {canAccessMenu('calendar') && (
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
                {calendarPerm.viewOnly && !calendarPerm.canEdit && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-amber-500/30">
                    ดูอย่างเดียว
                  </span>
                )}
              </button>
            )}

            {canAccessMenu('booking') && (
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
                {bookingPerm.viewOnly && !bookingPerm.canEdit && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-amber-500/30">
                    ดูอย่างเดียว
                  </span>
                )}
                {bookings.filter(
                  (b) =>
                    (b.status === 'Pending' || b.status === 'Pending_Approve2') &&
                    canUserViewBooking(b, currentUser, users)
                ).length > 0 && (
                  <span className="bg-amber-500 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {
                      bookings.filter(
                        (b) =>
                          (b.status === 'Pending' || b.status === 'Pending_Approve2') &&
                          canUserViewBooking(b, currentUser, users)
                      ).length
                    }
                  </span>
                )}
              </button>
            )}

            {canAccessMenu('vehicles') && (
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
                <span className="flex-1 text-left">{t.navVehicles} ({vehicles.length})</span>
                {vehiclesPerm.viewOnly && !vehiclesPerm.canEdit && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-amber-500/30">
                    ดูอย่างเดียว
                  </span>
                )}
              </button>
            )}

            {canAccessMenu('report') && (
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
                <span className="flex-1 text-left">{t.navReport}</span>
                {reportPerm.viewOnly && !reportPerm.canEdit && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-amber-500/30">
                    ดูอย่างเดียว
                  </span>
                )}
              </button>
            )}

            {canAccessMenu('users') && (
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
                <span className="flex-1 text-left">{t.navUsers}</span>
                {usersPerm.viewOnly && !usersPerm.canEdit && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-amber-500/30">
                    ดูอย่างเดียว
                  </span>
                )}
              </button>
            )}

            {(canAccessMenu('report') || canAccessMenu('users') || isUserAdmin(currentUser)) && (
              <button
                id="nav-tab-audit"
                onClick={() => {
                  setActiveTab('audit');
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  activeTab === 'audit'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/10'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <History className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">
                  {language === 'en' ? 'Audit Log' : 'ประวัติระบบ (Audit Log)'}
                </span>
              </button>
            )}

            <button
              id="nav-tab-manual"
              onClick={() => {
                setActiveTab('manual');
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'manual'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/10'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">
                {language === 'en' ? 'Booking Manual' : 'คู่มือการจองรถ'}
              </span>
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
                  canEdit={calendarPerm.canEdit}
                  viewOnly={calendarPerm.viewOnly}
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
                  canEdit={bookingPerm.canEdit}
                  viewOnly={bookingPerm.viewOnly}
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
                  canEdit={vehiclesPerm.canEdit}
                  viewOnly={vehiclesPerm.viewOnly}
                  onAddVehicle={handleAddVehicle}
                  onEditVehicle={handleEditVehicle}
                  onDeleteVehicle={handleDeleteVehicle}
                />
              )}

              {activeTab === 'users' && (
                <UserRegistration
                  users={users}
                  currentUser={currentUser}
                  canEdit={usersPerm.canEdit}
                  viewOnly={usersPerm.viewOnly}
                  rolePermissions={rolePermissions}
                  onUpdateRolePermissions={handleUpdateRolePermissions}
                  onSelectUser={handleSelectUser}
                  onAddUser={handleAddUser}
                  onAddMultipleUsers={handleAddMultipleUsers}
                  onEditUser={handleEditUser}
                  onEditMultipleUsers={handleEditMultipleUsers}
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
                  canEdit={reportPerm.canEdit}
                  viewOnly={reportPerm.viewOnly}
                />
              )}

              {activeTab === 'audit' && (
                <AuditLogView
                  auditLogs={auditLogs}
                  bookings={bookings}
                  users={users}
                  vehicles={vehicles}
                  currentUser={currentUser}
                  language={language}
                />
              )}

              {activeTab === 'manual' && (
                <BookingManual
                  language={language}
                  onNavigateTab={(tab) => setActiveTab(tab)}
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
