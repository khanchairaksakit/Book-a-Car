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
  resetFirestoreData,
} from './lib/firebase';

import Dashboard from './components/Dashboard';
import BookingSystem from './components/BookingSystem';
import VehicleManagement from './components/VehicleManagement';
import UserRegistration from './components/UserRegistration';

import {
  LayoutDashboard,
  CalendarDays,
  Car,
  Users,
  Menu,
  X,
  Shield,
  CircleUser,
  Info,
  CloudLightning,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // 1. Optimistic states falling back to localStorage/Mock data initially
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    const saved = localStorage.getItem('car_booking_vehicles');
    return saved ? JSON.parse(saved) : INITIAL_VEHICLES;
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('car_booking_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [bookings, setBookings] = useState<Booking[]>(() => {
    const saved = localStorage.getItem('car_booking_bookings');
    return saved ? JSON.parse(saved) : INITIAL_BOOKINGS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('car_booking_current_user');
    if (saved) return JSON.parse(saved);
    const admin = INITIAL_USERS.find((u) => u.role === 'Admin');
    return admin || INITIAL_USERS[0] || null;
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'booking' | 'vehicles' | 'users'>('dashboard');
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

        // Auto-select currentUser from cloud list if matching local storage email or default to first
        const savedEmail = currentUser?.email;
        if (dbUsers.length > 0) {
          const matched = dbUsers.find((u) => u.email === savedEmail);
          if (matched) {
            setCurrentUser(matched);
          } else if (!currentUser) {
            const admin = dbUsers.find((u) => u.role === 'Admin');
            setCurrentUser(admin || dbUsers[0]);
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
  };

  const handleAddUser = async (newUserData: Omit<User, 'id'>) => {
    const newUser: User = {
      ...newUserData,
      id: `user-${Date.now()}`,
    };
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    if (!currentUser) {
      setCurrentUser(newUser);
    }
    try {
      await saveUser(newUser);
    } catch (e) {
      console.error('Cloud save failed', e);
    }
  };

  const handleEditUser = async (updatedUser: User) => {
    setUsers(users.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    if (currentUser?.id === updatedUser.id) {
      setCurrentUser(updatedUser);
    }
    const updatedBookings = bookings.map((b) =>
      b.userId === updatedUser.id
        ? { ...b, userName: updatedUser.name, userPhone: updatedUser.phone }
        : b
    );
    setBookings(updatedBookings);

    try {
      await saveUser(updatedUser);
      // Sync names on user's bookings in firestore too
      for (const b of updatedBookings) {
        if (b.userId === updatedUser.id) {
          await saveBooking(b);
        }
      }
    } catch (e) {
      console.error('Cloud edit user failed', e);
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
    const newBooking: Booking = {
      ...newBookingData,
      id: `b-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setBookings([newBooking, ...bookings]);

    const todayStr = '2026-07-20';
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

  const handleUpdateBookingStatus = async (bookingId: string, status: BookingStatus) => {
    const updatedBookings = bookings.map((b) => (b.id === bookingId ? { ...b, status } : b));
    setBookings(updatedBookings);

    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    try {
      await saveBooking({ ...booking, status });

      const todayStr = '2026-07-20';
      const start = booking.startDate.substring(0, 10);
      const end = booking.endDate.substring(0, 10);

      let updatedVehicles = [...vehicles];
      if (status === 'Approved' && todayStr >= start && todayStr <= end) {
        updatedVehicles = vehicles.map((v) =>
          v.id === booking.vehicleId ? { ...v, status: 'In Use' } : v
        );
        setVehicles(updatedVehicles);
        const matchedVehicle = updatedVehicles.find(v => v.id === booking.vehicleId);
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
          const matchedVehicle = updatedVehicles.find(v => v.id === booking.vehicleId);
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

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Helper to reset database back to original defaults inside cloud too
  const handleResetData = () => {
    setShowResetConfirm(true);
  };

  const executeResetData = async () => {
    try {
      setIsLoading(true);
      const defaults = await resetFirestoreData();
      setVehicles(defaults.vehicles);
      setUsers(defaults.users);
      setBookings(defaults.bookings);
      const admin = defaults.users.find((u) => u.role === 'Admin');
      setCurrentUser(admin || defaults.users[0]);
      setActiveTab('dashboard');
      setToastMessage('รีเซ็ตข้อมูลในระบบคลาวด์เรียบร้อยแล้ว');
    } catch (error) {
      console.error('Error resetting cloud data:', error);
      setToastMessage('เกิดข้อผิดพลาดในการรีเซ็ตข้อมูล');
    } finally {
      setIsLoading(false);
    }
  };

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
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-sm shadow-indigo-500/20">
                🚘
              </div>
              <div>
                <h1 className="font-bold text-sm tracking-tight">ระบบจองรถส่วนกลาง</h1>
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
            <div className="p-4 mx-3 my-4 bg-slate-800/50 border border-slate-800 rounded-xl">
              <span className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider block mb-1">
                ผู้ใช้จองที่ใช้งานอยู่
              </span>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs text-white">
                  {currentUser.name.substring(0, 2)}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold block truncate text-slate-200">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] text-indigo-400 block truncate font-medium">
                    {currentUser.department}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Nav Links */}
          <nav className="flex-1 px-3 space-y-1.5">
            <button
              id="nav-tab-dashboard"
              onClick={() => {
                setActiveTab('dashboard');
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/10'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span>แผงควบคุมหลัก (Dashboard)</span>
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
              <CalendarDays className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">จองรถและตรวจสถานะ</span>
              {bookings.filter((b) => b.status === 'Pending').length > 0 && (
                <span className="bg-amber-500 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {bookings.filter((b) => b.status === 'Pending').length}
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
              <span>การจัดการรถยนต์ ({vehicles.length})</span>
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
              <span>ลงทะเบียนและผู้ใช้งาน</span>
            </button>
          </nav>
        </div>

        {/* Footer Area with Reset option */}
        <div className="p-4 border-t border-slate-800/60 bg-slate-950/40 text-center space-y-2">
          <p className="text-[10px] text-slate-500 font-medium">
            สถิติจองปี 2026 • เวอร์ชัน 1.0.0
          </p>
          <button
            id="btn-reset-data-all"
            onClick={handleResetData}
            className="w-full py-1 text-[10px] font-bold text-slate-400 hover:text-red-400 hover:bg-red-950/20 rounded-md border border-slate-800 hover:border-red-900/40 transition-colors cursor-pointer"
          >
            🔄 รีเซ็ตข้อมูลเป็นค่าเริ่มต้น
          </button>
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
              <span>สถานะกองรถวันนี้: <span className="text-emerald-600 font-bold">🟢 ว่าง {vehicles.filter(v => v.status === 'Available').length} คัน</span></span>
              <span className="h-4 w-[1px] bg-gray-200" />
              {isCloudSynced ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-bold animate-fade-in">
                  <CloudLightning className="w-3.5 h-3.5 text-indigo-600 animate-pulse" /> Cloud Sync Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-bold">
                  <CloudLightning className="w-3.5 h-3.5 text-amber-500 animate-spin" /> Syncing...
                </span>
              )}
            </div>
          </div>

          {/* Quick Header Profile Display & Simulation Warning */}
          <div className="flex items-center gap-4">
            <div className="text-right hidden lg:block">
              <span className="text-[10px] text-gray-400 block font-medium">เวลาจำลองระบบ</span>
              <span className="text-xs text-gray-600 font-bold">วันจันทร์ที่ 20 กรกฎาคม 2026</span>
            </div>

            <div className="h-8 w-[1px] bg-gray-200 hidden lg:block" />

            {currentUser ? (
              <div
                id="header-profile-box"
                onClick={() => setActiveTab('users')}
                className="flex items-center gap-2 px-2.5 py-1 hover:bg-slate-50 border border-slate-100 rounded-lg transition-colors cursor-pointer"
                title="คลิกเพื่อสลับโปรไฟล์ผู้จองอื่น"
              >
                <div className="text-right hidden sm:block">
                  <span className="text-xs font-bold block text-gray-900 leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] text-gray-500 block">
                    {currentUser.department}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs text-white">
                  {currentUser.name.substring(0, 2)}
                </div>
                {currentUser.role === 'Admin' ? (
                  <Shield className="w-3.5 h-3.5 text-purple-600 hidden sm:block" />
                ) : (
                  <CircleUser className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                )}
              </div>
            ) : (
              <button
                id="header-login-prompt"
                onClick={() => setActiveTab('users')}
                className="inline-flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg font-semibold hover:bg-red-100 transition-colors cursor-pointer animate-pulse"
              >
                <Info className="w-3.5 h-3.5" />
                <span>คลิกเพื่อเลือกโปรไฟล์ผู้ใช้ก่อนจอง</span>
              </button>
            )}
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
              {activeTab === 'dashboard' && (
                <Dashboard
                  vehicles={vehicles}
                  bookings={bookings}
                  onNavigateToBookings={() => setActiveTab('booking')}
                  onNavigateToVehicles={() => setActiveTab('vehicles')}
                />
              )}

              {activeTab === 'booking' && (
                <BookingSystem
                  vehicles={vehicles}
                  bookings={bookings}
                  currentUser={currentUser}
                  onAddBooking={handleAddBooking}
                  onUpdateBookingStatus={handleUpdateBookingStatus}
                  onDeleteBooking={handleDeleteBooking}
                />
              )}

              {activeTab === 'vehicles' && (
                <VehicleManagement
                  vehicles={vehicles}
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
                  onEditUser={handleEditUser}
                  onDeleteUser={handleDeleteUser}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Custom Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-lg font-bold shrink-0">
                ⚠️
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">ยืนยันการรีเซ็ตข้อมูล</h3>
                <p className="text-xs text-gray-500">คุณต้องการรีเซ็ตข้อมูลคลาวด์กลับสู่ค่าเริ่มต้นใช่หรือไม่?</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
              ข้อมูลการจอง รายชื่อพนักงาน และรถยนต์ที่เพิ่มใหม่ทั้งหมดจะถูกลบและแทนที่ด้วยข้อมูลตัวอย่างเริ่มต้นสำหรับทดสอบระบบ
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                id="btn-cancel-reset"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                id="btn-confirm-reset"
                onClick={async () => {
                  setShowResetConfirm(false);
                  await executeResetData();
                }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                ยืนยันรีเซ็ตข้อมูล
              </button>
            </div>
          </div>
        </div>
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
