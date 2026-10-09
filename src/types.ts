/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type VehicleType = 'Sedan' | 'SUV' | 'Van' | 'Pickup';
export type VehicleStatus = 'Available' | 'In Use' | 'Maintenance';

export type FuelLevel = 'เต็มถัง' | '3/4' | '1/2' | '1/4' | 'ใกล้หมด';

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

export type UserRole = 'User' | 'Operator' | 'Approve 1' | 'Approve 2' | 'Admin' | 'Approve';

export type AppMenuKey = 'calendar' | 'booking' | 'vehicles' | 'report' | 'users';

export interface MenuPermissionSetting {
  viewOnly: boolean; // ดูได้อย่างเดียว
  canEdit: boolean;  // แก้ไขได้
}

export type StandardRole = 'User' | 'Operator' | 'Approve 1' | 'Approve 2' | 'Admin';

export type RolePermissionsMatrix = Record<
  StandardRole,
  Record<AppMenuKey, MenuPermissionSetting>
>;

export interface User {
  id: string;
  employeeCode?: string; // รหัสพนักงาน
  name: string; // ชื่อ-นามสกุล
  department: string; // แผนก
  division?: string; // ฝ่าย
  phone: string; // เบอร์โทร
  email: string; // อีเมล
  roles?: UserRole[]; // บทบาทการใช้งาน (User, Operator, Approve 1, Approve 2, Admin)
  role?: 'User' | 'Admin'; // legacy fallback
  username?: string; // สำหรับล็อกอินด้วย user
  password?: string; // รหัสผ่านสำหรับล็อกอิน
  lineUserId?: string; // LINE User ID หรือ LINE ID สำหรับรับแจ้งเตือนอนุมัติ
}

export interface Booking {
  id: string;
  jobNumber?: string; // หมายเลขใบงาน เช่น AX-20261005-001
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
  assignedApproverId?: string; // ID ของผู้อนุมัติขั้นที่ 1 ที่ถูกเลือก (Approve 1 ในแผนก/ฝ่ายเดียวกัน)
  assignedApproverName?: string; // ชื่อของผู้อนุมัติขั้นที่ 1 ที่ถูกเลือก
  assignedApproverLineId?: string; // LINE ID ของผู้อนุมัติขั้นที่ 1
  stage2ApproverId?: string; // ID ของผู้อนุมัติขั้นที่ 2 ที่กำหนดไว้
  stage2ApproverName?: string; // ชื่อของผู้อนุมัติขั้นที่ 2 ที่กำหนดไว้
  stage2ApproverLineId?: string; // LINE ID ของผู้อนุมัติขั้นที่ 2
  requesterLineId?: string; // LINE ID ของผู้ขอใช้รถ (User) สำหรับรับแจ้งเตือนผลการอนุมัติ
  stage1ApprovedBy?: string; // ผู้ทำการอนุมัติขั้นที่ 1
  stage1ApprovedAt?: string; // วันที่อนุมัติขั้นที่ 1
  stage2ApprovedBy?: string; // ผู้ทำการอนุมัติขั้นที่ 2 (Approve 2)
  stage2ApprovedAt?: string; // วันที่อนุมัติขั้นที่ 2
  approverName?: string; // สรุปชื่อผู้อนุมัติ
  approvedAt?: string; // วันที่อนุมัติเสร็จสิ้น
  approvedVia?: 'LINE' | 'Web'; // ช่องทางที่กดอนุมัติ
  lineNotifiedAt?: string; // เวลาที่ส่งขออนุมัติผ่าน LINE ล่าสุด

  // Rejection Details (กรณีไม่อนุมัติ ต้องระบุเหตุผล)
  rejectionReason?: string; // เหตุผลที่ไม่อนุมัติ
  rejectedBy?: string; // ชื่อผู้ที่กดไม่อนุมัติ
  rejectedAt?: string; // วันเวลาที่กดไม่อนุมัติ
  rejectedStage?: 1 | 2; // ขั้นตอนที่ไม่อนุมัติ (1 = Approve 1, 2 = Approve 2)

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

export type AuditLogCategory =
  | 'AUTH'
  | 'BOOKING'
  | 'APPROVAL'
  | 'TRIP'
  | 'VEHICLE'
  | 'USER'
  | 'ORGANIZATION'
  | 'PERMISSION';

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO string
  category: AuditLogCategory;
  action: string;
  actorId?: string;
  actorName: string;
  actorRole?: string;
  actorDepartment?: string;
  targetId?: string;
  targetLabel?: string;
  details: string;
  channel?: 'Web' | 'LINE' | 'System';
}

