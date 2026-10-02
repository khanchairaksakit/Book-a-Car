/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type VehicleType = 'Sedan' | 'SUV' | 'Van' | 'Pickup';
export type VehicleStatus = 'Available' | 'In Use' | 'Maintenance';

export type FuelLevel = 'เต็มถัง' | '3/4' | '1/2' | '1/4';

export type BookingStatus =
  | 'Pending' // รออนุมัติขั้นที่ 1 (Approve 1)
  | 'Pending_Approve2' // รออนุมัติขั้นที่ 2 (Approve 2)
  | 'Approved' // อนุมัติเรียบร้อยแล้ว (พร้อมออกเดินทาง)
  | 'Cancelled' // ยกเลิก / ไม่อนุมัติ
  | 'Completed'; // เสร็จสิ้นภารกิจ (คืนรถและกุญแจแล้ว)

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

export type UserRole = 'User' | 'Approve 1' | 'Approve 2' | 'Admin' | 'Approve';

export interface User {
  id: string;
  employeeCode?: string; // รหัสพนักงาน
  name: string; // ชื่อ-นามสกุล
  department: string; // แผนก
  division?: string; // ฝ่าย
  phone: string; // เบอร์โทร
  email: string; // อีเมล
  roles?: UserRole[]; // บทบาทการใช้งาน (User, Approve 1, Approve 2, Admin)
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

  // Approvals (2-Stage Approval Process)
  assignedApproverId?: string; // ID ของผู้อนุมัติขั้นที่ 1 ที่ถูกเลือก (Approve 1 ในฝ่ายเดียวกัน)
  assignedApproverName?: string; // ชื่อของผู้อนุมัติขั้นที่ 1 ที่ถูกเลือก
  stage1ApprovedBy?: string; // ผู้ทำการอนุมัติขั้นที่ 1
  stage1ApprovedAt?: string; // วันที่อนุมัติขั้นที่ 1
  stage2ApprovedBy?: string; // ผู้ทำการอนุมัติขั้นที่ 2 (Approve 2)
  stage2ApprovedAt?: string; // วันที่อนุมัติขั้นที่ 2
  approverName?: string; // สรุปชื่อผู้อนุมัติ
  approvedAt?: string; // วันที่อนุมัติเสร็จสิ้น

  // Departure Checklist (ข้อมูลก่อนออกเดินทางหลังจากอนุมัติ)
  startMileage?: number; // ไมล์เริ่มต้น (km.)
  startMileagePhoto?: string; // แนบรูปถ่ายไมล์เริ่มต้น (Base64)
  startFuelLevel?: FuelLevel; // น้ำมันเริ่มต้น: 'เต็มถัง' | '3/4' | '1/2' | '1/4'
  startRecordedAt?: string; // เวลาบันทึกไมล์เริ่มต้น

  // Return Checklist (ข้อมูลเมื่อกดปุ่ม "เสร็จสิ้นภารกิจ")
  endMileage?: number; // ไมล์สิ้นสุด (km.)
  endMileagePhoto?: string; // แนบรูปถ่ายไมล์สิ้นสุด (Base64)
  endFuelLevel?: FuelLevel; // น้ำมันส่งคืน: 'เต็มถัง' | '3/4' | '1/2' | '1/4'
  keyReturnPhoto?: string; // แนบรูปหลักฐานหย่อนกุญแจลงตู้ (Base64)
  endRecordedAt?: string; // เวลาบันทึกเสร็จสิ้นภารกิจ
}
