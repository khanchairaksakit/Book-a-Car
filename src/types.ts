/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type VehicleType = 'Sedan' | 'SUV' | 'Van' | 'Pickup';
export type VehicleStatus = 'Available' | 'In Use' | 'Maintenance';
export type BookingStatus = 'Pending' | 'Approved' | 'Cancelled' | 'Completed';

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  plateNumber: string;
  type: VehicleType;
  capacity: number;
  status: VehicleStatus;
  imageUrl: string;
  description?: string;
  
  // Maintenance & Alert Fields
  currentMileage?: number; // เลขไมล์ปัจจุบัน (กม.)
  mileageAlertThreshold?: number; // เลขไมล์แจ้งเตือนเช็คระยะรอบถัดไป (กม.)
  taxExpiryDate?: string; // วันหมดอายุภาษี (YYYY-MM-DD)
  taxAlertDaysBefore?: number; // แจ้งเตือนล่วงหน้ากี่วัน (ค่าเริ่มต้น 30 วัน)
  tireAlertMileage?: number; // เลขไมล์แจ้งเตือนเปลี่ยนยางรอบถัดไป (กม.)
  tireAlertDate?: string; // กำหนดวันเปลี่ยนยาง / เช็คสภาพยางรอบถัดไป (YYYY-MM-DD)
  tireInfo?: string; // ข้อมูลยาง เช่น ยี่ห้อ/รุ่น/ขนาด หรือ วันที่เปลี่ยนล่าสุด
  tireChangeDate?: string; // วันที่เปลี่ยนยางล่าสุด (YYYY-MM-DD)
}

export type UserRole = 'User' | 'Approve' | 'Admin';

export interface User {
  id: string;
  employeeCode?: string; // รหัสพนักงาน
  name: string; // ชื่อ-นามสกุล
  department: string; // แผนก
  division?: string; // ฝ่าย
  phone: string; // เบอร์โทร
  email: string; // อีเมล
  roles?: UserRole[]; // บทบาทการใช้งาน (User, Approve, Admin โดย 1 user เป็นได้มากกว่า 1 บทบาท)
  role?: 'User' | 'Admin'; // legacy fallback
  username?: string; // สำหรับล็อกอินด้วย user
  password?: string; // รหัสผ่านสำหรับล็อกอิน
}

export interface Booking {
  id: string;
  vehicleId: string;
  userId: string;
  userName: string;
  userPhone?: string;
  userDepartment?: string; // แผนก
  userDivision?: string; // ฝ่าย
  vehicleName: string; // brand + model + plateNumber
  plateNumber?: string; // ทะเบียนรถ
  startDate: string; // วันที่เริ่มใช้รถ (ISO or YYYY-MM-DDTHH:mm)
  endDate: string; // วันที่คืนรถ (ISO or YYYY-MM-DDTHH:mm)
  purpose: string; // เหตุผลการใช้รถ
  destination: string; // สถานที่ปลายทาง
  passengersCount: number;
  status: BookingStatus;
  createdAt: string; // วันที่เอกสาร
  approverName?: string; // ผู้อนุมัติ
  approvedAt?: string; // วันที่อนุมัติ
}
