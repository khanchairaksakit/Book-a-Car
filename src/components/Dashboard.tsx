import React from 'react';
import { Vehicle, Booking, VehicleType } from '../types';
import {
  Car,
  Calendar,
  CheckCircle,
  Clock,
  TrendingUp,
  Award,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

interface DashboardProps {
  vehicles: Vehicle[];
  bookings: Booking[];
  onNavigateToBookings: () => void;
  onNavigateToVehicles: () => void;
}

export default function Dashboard({
  vehicles,
  bookings,
  onNavigateToBookings,
  onNavigateToVehicles,
}: DashboardProps) {
  // 1. Calculate high-level stats
  const totalVehicles = vehicles.length;
  const availableVehicles = vehicles.filter((v) => v.status === 'Available').length;
  const maintenanceVehicles = vehicles.filter((v) => v.status === 'Maintenance').length;
  const inUseVehicles = vehicles.filter((v) => v.status === 'In Use').length;

  const activeBookingsToday = bookings.filter((b) => {
    const todayStr = '2026-07-20'; // Base reference date in Thai local time metadata
    const start = b.startDate.substring(0, 10);
    const end = b.endDate.substring(0, 10);
    return todayStr >= start && todayStr <= end && b.status === 'Approved';
  }).length;

  const pendingApprovals = bookings.filter((b) => b.status === 'Pending').length;

  // 2. Prepare monthly booking trends data
  const monthNamesThai = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ];

  // Group by month
  const monthlyDataMap: { [key: number]: { month: string; bookings: number; approved: number } } = {};
  // Pre-populate months from Jan to Jul (1 to 7)
  for (let i = 0; i < 12; i++) {
    monthlyDataMap[i] = { month: monthNamesThai[i], bookings: 0, approved: 0 };
  }

  bookings.forEach((b) => {
    const date = new Date(b.startDate);
    const month = date.getMonth(); // 0-indexed
    if (month >= 0 && month < 12) {
      monthlyDataMap[month].bookings += 1;
      if (b.status === 'Approved' || b.status === 'Completed') {
        monthlyDataMap[month].approved += 1;
      }
    }
  });

  // Limit data to Jan - Jul (which has mock data) for visual focus
  const monthlyTrendData = Object.values(monthlyDataMap).slice(0, 7);

  // 3. Prepare Vehicle Type Distribution
  const typeMap: { [key in VehicleType]: { name: string; value: number } } = {
    Sedan: { name: 'รถเก๋ง (Sedan)', value: 0 },
    SUV: { name: 'รถอเนกประสงค์ (SUV)', value: 0 },
    Van: { name: 'รถตู้ (Van)', value: 0 },
    Pickup: { name: 'รถกระบะ (Pickup)', value: 0 },
  };

  bookings.forEach((b) => {
    if (b.status === 'Completed' || b.status === 'Approved') {
      const vehicle = vehicles.find((v) => v.id === b.vehicleId);
      if (vehicle && typeMap[vehicle.type]) {
        typeMap[vehicle.type].value += 1;
      }
    }
  });

  const typeDistributionData = Object.values(typeMap).filter((item) => item.value > 0);

  // 4. Most booked vehicle stats
  const carBookingCounts: { [key: string]: { name: string; count: number; plate: string } } = {};
  vehicles.forEach((v) => {
    carBookingCounts[v.id] = { name: `${v.brand} ${v.model}`, plate: v.plateNumber, count: 0 };
  });

  bookings.forEach((b) => {
    if (b.status === 'Completed' || b.status === 'Approved') {
      if (carBookingCounts[b.vehicleId]) {
        carBookingCounts[b.vehicleId].count += 1;
      }
    }
  });

  const topVehicles = Object.values(carBookingCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Colors for pie chart
  const COLORS = ['#4f46e5', '#8b5cf6', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-6" id="dashboard-section">
      {/* Overview Heading */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 tracking-tight">ภาพรวมระบบจองรถยนต์ส่วนกลาง</h2>
        <p className="text-sm text-gray-500 mt-1">
          รายงานสถิติการจอง ความเคลื่อนไหว และสถานะของยานพาหนะทั้งหมดในบริษัท ณ ปัจจุบัน
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total vehicles card */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">รถยนต์ทั้งหมด</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-bold text-gray-900">{totalVehicles}</span>
              <span className="text-xs text-gray-500">คัน</span>
            </div>
            <span className="text-[10px] text-gray-500 mt-1 block">
              พร้อมใช้ {availableVehicles} • ซ่อมบำรุง {maintenanceVehicles}
            </span>
          </div>
        </div>

        {/* Available vehicles card */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">รถว่างพร้อมใช้งาน</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-bold text-emerald-600">{availableVehicles}</span>
              <span className="text-xs text-emerald-600/80">คัน</span>
            </div>
            <span className="text-[10px] text-gray-500 mt-1 block">
              คิดเป็น {totalVehicles ? Math.round((availableVehicles / totalVehicles) * 100) : 0}% ของกองรถ
            </span>
          </div>
        </div>

        {/* Active Bookings card */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">การจองในวันนี้</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-bold text-indigo-600">{activeBookingsToday}</span>
              <span className="text-xs text-indigo-600/80">รายการ</span>
            </div>
            <span className="text-[10px] text-gray-500 mt-1 block">
              อ้างอิงจากรายการที่ได้รับการอนุมัติแล้ว
            </span>
          </div>
        </div>

        {/* Pending approvals card */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">รออนุมัติ</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-bold text-amber-600">{pendingApprovals}</span>
              <span className="text-xs text-amber-600/80">รายการ</span>
            </div>
            <span className="text-[10px] text-gray-500 mt-1 block">
              ต้องการการตรวจสอบจากแอดมิน
            </span>
          </div>
        </div>
      </div>

      {/* Monthly Summary Graphs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Monthly Bookings Trend (2/3 width on desktop) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 text-base">สรุปจำนวนการจองรถยนต์ส่วนกลางรายเดือน</h3>
                <p className="text-xs text-gray-500">จำนวนการจองรวมทั้งหมดเปรียบเทียบกับรายการที่เสร็จสมบูรณ์</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>มกราคม - กรกฎาคม 2026</span>
              </div>
            </div>

            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthlyTrendData}
                  margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area
                    name="จำนวนการขอจองรถทั้งหมด"
                    type="monotone"
                    dataKey="bookings"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorBookings)"
                  />
                  <Area
                    name="การจองที่อนุมัติ/เสร็จสิ้น"
                    type="monotone"
                    dataKey="approved"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorApproved)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column: Car Type Distribution (1/3 width on desktop) */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 text-base mb-1">สัดส่วนประเภทรถที่จองสำเร็จ</h3>
            <p className="text-xs text-gray-500 mb-4">จำแนกตามความประสงค์การใช้งานและประเภทของรถ</p>

            <div className="w-full h-52 relative flex items-center justify-center">
              {typeDistributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {typeDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        fontSize: '11px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-xs text-gray-400 text-center">ไม่มีข้อมูลการจองรถในช่วงเวลานี้</div>
              )}
              {typeDistributionData.length > 0 && (
                <div className="absolute text-center">
                  <span className="text-2xl font-bold text-gray-900">
                    {typeDistributionData.reduce((acc, curr) => acc + curr.value, 0)}
                  </span>
                  <span className="text-[10px] text-gray-400 block uppercase font-semibold">การจองสำเร็จ</span>
                </div>
              )}
            </div>

            {/* Custom Legend */}
            <div className="space-y-2 mt-4">
              {typeDistributionData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-gray-600 font-medium">{item.name}</span>
                  </div>
                  <span className="font-semibold text-gray-900">{item.value} ครั้ง</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Vehicle Status Table & Most booked cars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Most Booked Cars List */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <Award className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-semibold text-gray-900 text-base">รถยนต์ที่ถูกจองใช้งานบ่อยที่สุด</h3>
              <p className="text-[11px] text-gray-400">สถิติจำนวนการใช้งานตั้งแต่เปิดระบบ</p>
            </div>
          </div>

          <div className="space-y-4">
            {topVehicles.map((car, index) => {
              const bgBadge = index === 0 ? 'bg-amber-100 text-amber-800' : index === 1 ? 'bg-slate-100 text-slate-800' : 'bg-orange-100 text-orange-800';
              return (
                <div key={car.name} className="flex items-center justify-between p-3 bg-slate-50/50 hover:bg-slate-50 rounded-lg border border-slate-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${bgBadge}`}>
                      {index + 1}
                    </span>
                    <div>
                      <h4 className="font-medium text-gray-900 text-sm">{car.name}</h4>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">{car.plate}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-indigo-600 block">{car.count} ครั้ง</span>
                    <span className="text-[10px] text-gray-400">จองเสร็จสิ้น</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Vehicle Status Checker Today */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100">
            <div>
              <h3 className="font-semibold text-gray-900 text-base">สถานะรถว่างและความพร้อมรถยนต์วันนี้</h3>
              <p className="text-[11px] text-gray-400">รายชื่อยานพาหนะและสถานะแบบเรียลไทม์</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> ว่าง ({availableVehicles})</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> กำลังวิ่ง ({inUseVehicles})</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> ซ่อมบำรุง ({maintenanceVehicles})</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="pb-3 font-semibold">รถยนต์</th>
                  <th className="pb-3 font-semibold">ป้ายทะเบียน</th>
                  <th className="pb-3 font-semibold">ประเภท</th>
                  <th className="pb-3 font-semibold">ความจุ</th>
                  <th className="pb-3 font-semibold text-right">สถานะตอนนี้</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vehicles.map((v) => {
                  let statusBadge = (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-100">
                      🟢 ว่างพร้อมใช้
                    </span>
                  );
                  if (v.status === 'In Use') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100">
                        🔵 กำลังเดินทาง
                      </span>
                    );
                  } else if (v.status === 'Maintenance') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 text-xs font-semibold rounded-full border border-rose-100">
                        🔴 ซ่อมบำรุง
                      </span>
                    );
                  }

                  const typeLabels: { [key in VehicleType]: string } = {
                    Sedan: 'รถเก๋ง (Sedan)',
                    SUV: 'รถอเนกประสงค์ (SUV)',
                    Van: 'รถตู้ (Van)',
                    Pickup: 'รถกระบะ (Pickup)',
                  };

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 font-medium text-gray-900">{v.brand} {v.model}</td>
                      <td className="py-3 font-mono text-xs text-gray-500">{v.plateNumber}</td>
                      <td className="py-3 text-xs text-gray-600">{typeLabels[v.type] || v.type}</td>
                      <td className="py-3 text-xs text-gray-600">{v.capacity} ที่นั่ง</td>
                      <td className="py-3 text-right">{statusBadge}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
