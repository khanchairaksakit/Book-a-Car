import React, { useState, useEffect } from 'react';
import { Vehicle, User, Booking, BookingStatus } from './types';
import {
  INITIAL_VEHICLES,
  INITIAL_USERS,
  INITIAL_BOOKINGS,
} from './data/mockData';

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
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // 1. Initialize States from LocalStorage or Mock Data
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
    // Default to the first admin in initial users so they have full permissions on first load
    const admin = INITIAL_USERS.find((u) => u.role === 'Admin');
    return admin || INITIAL_USERS[0] || null;
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'booking' | 'vehicles' | 'users'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // 2. Synchronize States with LocalStorage
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

  // 3. Handlers for Users
  const handleSelectUser = (user: User) => {
    setCurrentUser(user);
  };

  const handleAddUser = (newUserData: Omit<User, 'id'>) => {
    const newUser: User = {
      ...newUserData,
      id: `user-${Date.now()}`,
    };
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    // If we didn't have a user, set this one as active
    if (!currentUser) {
      setCurrentUser(newUser);
    }
  };

  const handleEditUser = (updatedUser: User) => {
    setUsers(users.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    // If edited user is the active user, update active user state too
    if (currentUser?.id === updatedUser.id) {
      setCurrentUser(updatedUser);
    }
    // Update userName in their future/current bookings for accuracy
    setBookings(
      bookings.map((b) =>
        b.userId === updatedUser.id
          ? { ...b, userName: updatedUser.name, userPhone: updatedUser.phone }
          : b
      )
    );
  };

  const handleDeleteUser = (userId: string) => {
    setUsers(users.filter((u) => u.id !== userId));
    if (currentUser?.id === userId) {
      // Switch active user to someone else or null
      const remaining = users.filter((u) => u.id !== userId);
      setCurrentUser(remaining.length > 0 ? remaining[0] : null);
    }
  };

  // 4. Handlers for Vehicles (CRUD)
  const handleAddVehicle = (newVehicleData: Omit<Vehicle, 'id'>) => {
    const newVehicle: Vehicle = {
      ...newVehicleData,
      id: `car-${Date.now()}`,
    };
    setVehicles([...vehicles, newVehicle]);
  };

  const handleEditVehicle = (updatedVehicle: Vehicle) => {
    setVehicles(vehicles.map((v) => (v.id === updatedVehicle.id ? updatedVehicle : v)));
    // Also sync the vehicle name inside any existing bookings
    const newVehicleName = `${updatedVehicle.brand} ${updatedVehicle.model} (${updatedVehicle.plateNumber})`;
    setBookings(
      bookings.map((b) =>
        b.vehicleId === updatedVehicle.id
          ? { ...b, vehicleName: newVehicleName }
          : b
      )
    );
  };

  const handleDeleteVehicle = (vehicleId: string) => {
    setVehicles(vehicles.filter((v) => v.id !== vehicleId));
    // Soft delete / cancel corresponding bookings that are pending/approved and haven't finished
    setBookings(
      bookings.map((b) =>
        b.vehicleId === vehicleId && (b.status === 'Pending' || b.status === 'Approved')
          ? { ...b, status: 'Cancelled' as BookingStatus }
          : b
      )
    );
  };

  // 5. Handlers for Booking (Book/Approve/Cancel)
  const handleAddBooking = (newBookingData: Omit<Booking, 'id' | 'createdAt'>) => {
    const newBooking: Booking = {
      ...newBookingData,
      id: `b-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setBookings([newBooking, ...bookings]);

    // If booking is immediately approved, update corresponding vehicle status to "In Use" or wait until date
    // For simplicity, we keep vehicle status independent or update if it's currently in progress
    const todayStr = '2026-07-20'; // Reference date
    const start = newBooking.startDate.substring(0, 10);
    const end = newBooking.endDate.substring(0, 10);
    if (newBooking.status === 'Approved' && todayStr >= start && todayStr <= end) {
      setVehicles(
        vehicles.map((v) =>
          v.id === newBooking.vehicleId ? { ...v, status: 'In Use' } : v
        )
      );
    }
  };

  const handleUpdateBookingStatus = (bookingId: string, status: BookingStatus) => {
    setBookings(
      bookings.map((b) => (b.id === bookingId ? { ...b, status } : b))
    );

    // Side effect: If a booking is approved/cancelled/completed, sync the vehicle's current status if applicable
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    const todayStr = '2026-07-20';
    const start = booking.startDate.substring(0, 10);
    const end = booking.endDate.substring(0, 10);

    if (status === 'Approved' && todayStr >= start && todayStr <= end) {
      setVehicles(
        vehicles.map((v) =>
          v.id === booking.vehicleId ? { ...v, status: 'In Use' } : v
        )
      );
    } else if (status === 'Cancelled' || status === 'Completed') {
      // Check if there are other approved bookings currently active for this car, if not set to Available
      const otherActive = bookings.some(
        (b) =>
          b.id !== bookingId &&
          b.vehicleId === booking.vehicleId &&
          b.status === 'Approved' &&
          todayStr >= b.startDate.substring(0, 10) &&
          todayStr <= b.endDate.substring(0, 10)
      );
      if (!otherActive) {
        setVehicles(
          vehicles.map((v) =>
            v.id === booking.vehicleId && v.status === 'In Use'
              ? { ...v, status: 'Available' }
              : v
          )
        );
      }
    }
  };

  const handleDeleteBooking = (bookingId: string) => {
    setBookings(bookings.filter((b) => b.id !== bookingId));
  };

  // Helper to reset database back to original defaults
  const handleResetData = () => {
    if (confirm('คุณต้องการรีเซ็ตข้อมูลทั้งหมดกลับสู่ค่าเริ่มต้นใช่หรือไม่? (การจองและรถยนต์ที่เพิ่มใหม่จะหายไป)')) {
      setVehicles(INITIAL_VEHICLES);
      setUsers(INITIAL_USERS);
      setBookings(INITIAL_BOOKINGS);
      const admin = INITIAL_USERS.find((u) => u.role === 'Admin');
      setCurrentUser(admin || INITIAL_USERS[0]);
      setActiveTab('dashboard');
      alert('รีเซ็ตข้อมูลสำเร็จแล้ว');
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
            <div className="hidden sm:block text-xs font-semibold text-gray-400 uppercase tracking-wider">
              สถานะกองรถวันนี้: <span className="text-emerald-600 font-bold">🟢 ว่าง {vehicles.filter(v => v.status === 'Available').length} คัน</span>
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
    </div>
  );
}
