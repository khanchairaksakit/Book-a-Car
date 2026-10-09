import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Car,
  Gauge,
  KeyRound,
  Search,
  Printer,
  ArrowRight,
  UserCheck,
  Shield,
  MessageCircle,
  Fuel,
  Camera,
  XCircle,
  HelpCircle,
  Building2,
} from 'lucide-react';
import { Language } from '../utils/translations';

interface BookingManualProps {
  language?: Language;
  onNavigateTab?: (tab: 'calendar' | 'booking' | 'vehicles' | 'users' | 'report') => void;
}

type ManualRoleFilter = 'all' | 'requester' | 'approver' | 'admin';

interface ManualStep {
  id: string;
  number: string;
  roleCategory: ManualRoleFilter[];
  roleLabelTh: string;
  roleLabelEn: string;
  titleTh: string;
  titleEn: string;
  summaryTh: string;
  summaryEn: string;
  detailsTh: string[];
  detailsEn: string[];
  tipsTh?: string;
  tipsEn?: string;
  actionTab?: 'calendar' | 'booking' | 'vehicles' | 'users' | 'report';
  actionLabelTh?: string;
  actionLabelEn?: string;
}

const MANUAL_STEPS: ManualStep[] = [
  {
    id: 'step-login',
    number: '01',
    roleCategory: ['all', 'requester', 'approver', 'admin'],
    roleLabelTh: 'ทุกสิทธิ์การใช้งาน · เตรียมความพร้อม',
    roleLabelEn: 'All Roles · Getting Started',
    titleTh: 'การเข้าสู่ระบบและตรวจสอบสิทธิ์การใช้งาน',
    titleEn: 'Signing In & Checking Account Permissions',
    summaryTh:
      'เข้าสู่ระบบด้วยชื่อผู้ใช้ (Username) หรืออีเมลองค์กร พร้อมรหัสผ่านที่ได้รับจากผู้ดูแลระบบ',
    summaryEn:
      'Sign in using your corporate Username or Email and password assigned by the administrator.',
    detailsTh: [
      'กรอก Username หรือ Email และรหัสผ่านในหน้าเข้าสู่ระบบ หรือเลือกบัญชีจากรายการด่วน (กรณีทดสอบระบบ)',
      'ตรวจสอบชื่อ-นามสกุล แผนก/ฝ่าย และบทบาทสิทธิ์ของคุณได้ที่แถบด้านซ้ายบน (เช่น ผู้ขอใช้รถ, ผู้จัดการ, ผู้ดูแลรถ, ผู้ดูแลระบบ)',
      'หากต้องการรับแจ้งเตือนผ่าน LINE สามารถผูก LINE User ID ได้ที่เมนูจัดการผู้ใช้งาน หรือหน้าต่างแจ้งเตือน LINE',
    ],
    detailsEn: [
      'Enter your Username or Corporate Email and Password on the Sign-In screen.',
      'Verify your name, department/division, and assigned roles in the left navigation sidebar.',
      'Link your LINE User ID to receive real-time LINE Flex Message notifications.',
    ],
    tipsTh: 'ระบบแยกการมองเห็นใบงานตามแผนก/ฝ่าย โดยผู้ขอใช้รถจะเห็นใบงานของตนเองและในแผนกที่เกี่ยวข้อง',
    tipsEn: 'Bookings are filtered by department/division visibility rules.',
  },
  {
    id: 'step-booking',
    number: '02',
    roleCategory: ['all', 'requester'],
    roleLabelTh: 'ผู้ขอใช้รถ (Operator) · การสร้างคำขอ',
    roleLabelEn: 'Requester (Operator) · Creating a Request',
    titleTh: 'การเลือกวันเวลาและสร้างใบงานขอใช้รถยนต์ส่วนกลาง',
    titleEn: 'Selecting Dates & Submitting a Vehicle Request',
    summaryTh:
      'ตรวจสอบตารางรถว่างในเมนู "ปฏิทินการจองรถยนต์" และกรอกรายละเอียดการเดินทางเพื่อออกเลขใบงานอัตโนมัติ',
    summaryEn:
      'Check vehicle availability on the Booking Calendar and submit trip details to generate an automatic job number.',
    detailsTh: [
      'ไปที่เมนู "ปฏิทินการจองรถยนต์" แล้วคลิกเลือกวันที่ต้องการเดินทางบนปฏิทิน หรือกดปุ่ม "+ จองรถยนต์ส่วนกลาง"',
      'ระบุวัน-เวลาเริ่มต้น และวัน-เวลาสิ้นสุดภารกิจ ระบบจะคัดกรองเฉพาะรถยนต์ส่วนกลางที่ "ว่าง" ในช่วงเวลานั้นให้เลือก',
      'เลือกรถยนต์ที่ต้องการ ระบุสถานที่ปลายทาง จำนวนผู้โดยสาร เบอร์โทรศัพท์ติดต่อ และวัตถุประสงค์ของการเดินทาง',
      'เลือกผู้อนุมัติลำดับที่ 1 (ผู้จัดการ) และผู้อนุมัติลำดับที่ 2 (ผู้ดูแลรถ) จากนั้นกดปุ่มยืนยันการจอง',
      'ระบบจะสร้างเลขที่ใบงานอัตโนมัติในรูปแบบ AX-YYYYMMDD-XXX (เช่น AX-20261008-001) พร้อมส่งแจ้งเตือนไปยังผู้จัดการทาง LINE ทันที',
    ],
    detailsEn: [
      'Open "Booking Calendar" and click on your desired departure date or the "+ Book Vehicle" button.',
      'Select start and end date/time; the system automatically filters available vehicles for that slot.',
      'Select a vehicle, enter destination, passenger count, contact phone, and trip purpose.',
      'Confirm Approver 1 (Manager) and Approver 2 (Fleet Controller), then submit.',
      'An automatic job number (AX-YYYYMMDD-XXX) is generated and sent via LINE to the Manager.',
    ],
    tipsTh: 'ไม่สามารถเลือกเวลาสิ้นสุดที่ย้อนหลังกว่าเวลาเริ่มต้น หรือจองซ้อนทับกับใบงานที่ได้รับอนุมัติแล้วได้',
    tipsEn: 'Overlapping time slots on the same vehicle are automatically prevented.',
    actionTab: 'calendar',
    actionLabelTh: 'ไปที่หน้าปฏิทินการจองรถ',
    actionLabelEn: 'Open Booking Calendar',
  },
  {
    id: 'step-approval',
    number: '03',
    roleCategory: ['all', 'approver', 'requester'],
    roleLabelTh: 'ผู้จัดการ & ผู้ดูแลรถ · การพิจารณาอนุมัติ 2 ขั้นตอน',
    roleLabelEn: 'Manager & Fleet Controller · 2-Stage Approval Workflow',
    titleTh: 'ขั้นตอนการอนุมัติคำขอใช้รถยนต์ส่วนกลาง (2 ลำดับขั้น)',
    titleEn: 'Two-Stage Approval Process (Manager & Fleet Controller)',
    summaryTh:
      'ใบงานทุกใบต้องผ่านการพิจารณาจาก "ผู้จัดการ" (ลำดับที่ 1) และ "ผู้ดูแลรถ" (ลำดับที่ 2) ก่อนนำรถออกใช้งาน',
    summaryEn:
      'Every request passes through Stage 1 (Manager) and Stage 2 (Fleet Controller) before the vehicle is cleared for departure.',
    detailsTh: [
      'ขั้นที่ 1 (รอผู้จัดการ): ผู้จัดการตรวจสอบความเหมาะสมของภารกิจในแผนก/ฝ่าย กด "อนุมัติ" หรือ "ไม่อนุมัติ" (พร้อมระบุเหตุผล) ได้จากเมนู "ตรวจสอบสถานะ" หรือกดผ่านการ์ดแจ้งเตือนใน LINE',
      'ขั้นที่ 2 (รอผู้ดูแลรถ): เมื่อผู้จัดการอนุมัติแล้ว ระบบจะส่งแจ้งเตือนไปยัง "ผู้ดูแลรถ" เพื่อตรวจสอบความพร้อมของรถยนต์และกดอนุมัติขั้นสุดท้าย',
      'เมื่ออนุมัติครบทั้ง 2 ขั้นตอน สถานะใบงานจะเปลี่ยนเป็น "อนุมัติแล้ว (พร้อมใช้งาน)" และแจ้งเตือนกลับไปยังผู้ขอใช้รถทันที',
      'กรณีไม่อนุมัติ (Reject) ในขั้นตอนใดขั้นตอนหนึ่ง สถานะจะเปลี่ยนเป็น "ผู้จัดการ Reject" หรือ "ผู้ดูแลรถ Reject" พร้อมแสดงเหตุผลในใบงาน',
    ],
    detailsEn: [
      'Stage 1 (Pending Manager): The Manager reviews trip necessity and approves or rejects with a reason via "Check Status" or LINE.',
      'Stage 2 (Pending Fleet Controller): Once Stage 1 is approved, the Fleet Controller verifies vehicle readiness and grants final approval.',
      'Upon Stage 2 approval, the booking status becomes "Approved (Ready for Use)" and notifies the requester.',
      'If rejected at either stage, the status updates with the specific rejection reason.',
    ],
    tipsTh: 'ผู้อนุมัติสามารถกดลิงก์จาก LINE Flex Message เพื่อเข้าสู่หน้าพิจารณาใบงานและกดอนุมัติหรือไม่อนุมัติได้ทันที',
    tipsEn: 'Approvers can act directly from the LINE Flex Message notification link.',
    actionTab: 'booking',
    actionLabelTh: 'ไปที่หน้าตรวจสอบสถานะ',
    actionLabelEn: 'Open Status & Approvals',
  },
  {
    id: 'step-departure',
    number: '04',
    roleCategory: ['all', 'requester'],
    roleLabelTh: 'ผู้ขอใช้รถ (Operator) · ก่อนออกเดินทาง',
    roleLabelEn: 'Requester (Operator) · Pre-Departure Record',
    titleTh: 'การบันทึกข้อมูลก่อนออกเดินทาง (เลขไมล์เริ่มต้น & ระดับน้ำมัน)',
    titleEn: 'Recording Pre-Departure Data (Start Mileage & Fuel Gauge)',
    summaryTh:
      'เมื่อใบงานได้รับอนุมัติครบ 2 ขั้นตอนแล้ว ก่อนนำรถออกเดินทางให้บันทึกเลขไมล์เริ่มต้นและระดับน้ำมันเริ่มต้น',
    summaryEn:
      'Before departing in an approved vehicle, record the starting odometer mileage and fuel level.',
    detailsTh: [
      'ไปที่เมนู "ตรวจสอบสถานะ" หรือดูที่การ์ดใบงานที่ได้รับอนุมัติแล้วในหน้าปฏิทิน กดปุ่ม "บันทึกข้อมูลก่อนออกเดินทาง"',
      'เลขไมล์เริ่มต้น (km.): ระบบจะดึงเลขไมล์ล่าสุดของรถคันนั้นมาแสดงให้อัตโนมัติ โดยผู้ใช้งานสามารถตรวจสอบและปรับแก้ตัวเลขให้ตรงกับหน้าปัดจริงได้',
      'ระดับน้ำมันเริ่มต้น: เลือกตัวเลือกระดับน้ำมัน (เต็มถัง, 3/4, 1/2, 1/4, ใกล้หมด) โดยเข็มกราฟิกหน้าปัดระดับน้ำมันจะขยับตามตัวเลือกที่เลือกทันที',
      'กดปุ่ม "บันทึกข้อมูลออกเดินทาง" (ขั้นตอนนี้ไม่ต้องถ่ายภาพ เพื่อให้สะดวกรวดเร็วในการออกเดินทาง)',
    ],
    detailsEn: [
      'In "Check Status" or on the Calendar active trip banner, click "Record Pre-Departure Info".',
      'Starting Mileage (km.): Automatically pre-filled from the vehicle’s current odometer, editable if needed.',
      'Starting Fuel Level: Select Full, 3/4, 1/2, or 1/4 — the interactive fuel gauge needle moves to match your selection.',
      'Click Save to confirm departure (no photo upload required at departure).',
    ],
    tipsTh: 'การบันทึกข้อมูลก่อนออกเดินทางเป็นขั้นตอนบังคับก่อนที่จะสามารถกดคืนรถเมื่อเสร็จสิ้นภารกิจได้',
    tipsEn: 'Pre-departure mileage and fuel must be recorded before you can complete and return the vehicle.',
    actionTab: 'booking',
    actionLabelTh: 'ไปที่รายการใบงานเพื่อบันทึกออกเดินทาง',
    actionLabelEn: 'Go to Bookings',
  },
  {
    id: 'step-return',
    number: '05',
    roleCategory: ['all', 'requester', 'approver'],
    roleLabelTh: 'ผู้ขอใช้รถ (Operator) · เสร็จสิ้นภารกิจและคืนรถ',
    roleLabelEn: 'Requester (Operator) · Mission Complete & Vehicle Return',
    titleTh: 'การยืนยันคืนรถยนต์ส่วนกลางและอัปเดตเลขไมล์อัตโนมัติ',
    titleEn: 'Returning the Vehicle, Key Drop Photo & Auto Mileage Sync',
    summaryTh:
      'เมื่อกลับมาถึงบริษัท ให้บันทึกเลขไมล์สิ้นสุด ระดับน้ำมัน และถ่ายภาพขณะหย่อนกุญแจลงตู้เพื่อจบภารกิจ',
    summaryEn:
      'Upon returning, enter the ending mileage, fuel level, and capture a photo of returning the key to the drop box.',
    detailsTh: [
      'กดปุ่ม "เสร็จสิ้นภารกิจ & คืนรถยนต์ส่วนกลาง" ในใบงานที่บันทึกข้อมูลออกเดินทางเรียบร้อยแล้ว',
      'กรอก "เลขไมล์สิ้นสุด (km.)" โดยต้องมีค่าไม่น้อยกว่าเลขไมล์เริ่มต้น ระบบจะคำนวณระยะทางที่ใช้เดินทางในภารกิจให้อัตโนมัติ',
      'เลือกระดับน้ำมันคงเหลือจากหน้าปัดกราฟิกระดับน้ำมัน (เต็มถัง, 3/4, 1/2, 1/4, ใกล้หมด)',
      'ถ่ายภาพหลักฐาน "เฉพาะขณะหย่อนกุญแจลงตู้คืนกุญแจ" (สามารถเปิดกล้องถ่ายสดหรืออัปโหลดรูปภาพ)',
      'เมื่อกดยืนยันคืนรถแล้ว: (1) ระบบจะอัปเดตเลขไมล์ล่าสุดไปยังเมนู "จัดการข้อมูลรถยนต์" อัตโนมัติ และ (2) ส่ง LINE แจ้งเตือนยืนยันการคืนรถไปยังผู้ขอใช้รถ (Operator) และผู้ดูแลรถ (Approve 2) ทันที',
    ],
    detailsEn: [
      'Click "Complete Mission & Return Vehicle" on your active booking.',
      'Enter the Ending Mileage (must be >= starting mileage); total distance traveled is calculated automatically.',
      'Select the ending fuel level on the interactive fuel gauge.',
      'Take or upload a photo of dropping the vehicle key into the return box.',
      'Upon confirmation: (1) the vehicle’s master mileage in Fleet Management updates automatically, and (2) LINE notifications are sent to both the Operator and Fleet Controller (Approve 2).',
    ],
    tipsTh: 'เลขไมล์ที่กรอกตอนคืนรถจะไปอัปเดตฐานข้อมูลรถยนต์ทันที เพื่อให้ผู้จองคนถัดไปเห็นเลขไมล์ล่าสุดเสมอ',
    tipsEn: 'The ending mileage automatically updates the vehicle master record for the next driver.',
  },
  {
    id: 'step-cancel-admin',
    number: '06',
    roleCategory: ['all', 'requester', 'admin'],
    roleLabelTh: 'นโยบายการยกเลิกใบงาน & การตั้งค่าระบบ',
    roleLabelEn: 'Cancellation Policy & System Administration',
    titleTh: 'การยกเลิกการจอง การลบข้อมูล และการจัดการแผนก/ฝ่าย',
    titleEn: 'Cancelling Bookings, Admin Deletion & Department Management',
    summaryTh:
      'เข้าใจความแตกต่างระหว่าง "การยกเลิกใบงาน" (ผู้ขอใช้รถทำได้) และ "การลบข้อมูลออกจากระบบ" (เฉพาะผู้ดูแลระบบ)',
    summaryEn:
      'Understand the distinction between cancelling a booking (allowed for requesters) and permanently deleting records (Admin only).',
    detailsTh: [
      'การยกเลิกใบงาน (Cancel): ผู้ขอใช้รถสามารถกด "ยกเลิกการจอง" ในใบงานของตนเองที่ยังไม่ได้นำรถออกเดินทางได้ (สถานะจะเปลี่ยนเป็นยกเลิก แต่ประวัติใบงานยังอยู่ในระบบเพื่อความโปร่งใส)',
      'การลบใบงานออกจากระบบ (Delete): ห้ามผู้ใช้งานทั่วไปลบข้อมูลการยืมรถเองโดยเด็ดขาด สิทธิ์การลบใบงานออกจากฐานข้อมูลสงวนไว้สำหรับ "ผู้ดูแลระบบ (Admin)" เท่านั้น',
      'การกำหนดแผนกและฝ่าย (สำหรับ Admin): ในเมนู "กำหนดผู้ใช้งาน" กดปุ่ม "กำหนดแผนก / ฝ่าย" เมื่อทำการเพิ่ม แก้ไข หรือลบแผนก/ฝ่ายแล้ว ต้องกดปุ่ม "บันทึกข้อมูล" เพื่อยืนยันการเปลี่ยนแปลงทุกครั้ง',
      'การเพิ่มผู้ใช้งานใหม่: ระบบจะดึงรายชื่อฝ่ายและแผนกจากหน้ากำหนดแผนกและฝ่ายมาให้เลือกในรูปแบบตัวเลือก (Dropdown) เพื่อให้โครงสร้างองค์กรตรงกันทั้งระบบ',
    ],
    detailsEn: [
      'Cancelling a Booking: Requesters can cancel their own upcoming trips before departure.',
      'Deleting a Record: Standard users cannot delete booking records; permanent deletion is strictly restricted to Administrators.',
      'Department & Division Setup (Admin): In User Management > Department/Division Setup, click "Save Changes" after adding, editing, or removing items.',
      'Adding Users: Department and division fields pull directly from the saved organization structure.',
    ],
    actionTab: 'users',
    actionLabelTh: 'ไปที่หน้ากำหนดผู้ใช้งาน',
    actionLabelEn: 'Open User Management',
  },
];

interface FaqItem {
  questionTh: string;
  questionEn: string;
  answerTh: string;
  answerEn: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    questionTh: 'ทำไมกดปุ่ม "เสร็จสิ้นภารกิจ & คืนรถ" ยังไม่ได้?',
    questionEn: 'Why is the "Return Vehicle" button not available yet?',
    answerTh:
      'ต้องให้ใบงานได้รับการอนุมัติครบทั้ง 2 ขั้นตอน (ผู้จัดการ และ ผู้ดูแลรถ) จนสถานะเป็น "อนุมัติแล้ว" และผู้ขอใช้รถต้องกด "บันทึกข้อมูลก่อนออกเดินทาง" (กรอกไมล์เริ่มต้นและระดับน้ำมันเริ่มต้น) ก่อน จึงจะปรากฏปุ่มยืนยันการคืนรถ',
    answerEn:
      'The booking must first be approved by both Stage 1 (Manager) and Stage 2 (Fleet Controller), and you must complete the "Pre-Departure Record" first.',
  },
  {
    questionTh: 'ผู้ใช้งานทั่วไปสามารถยกเลิกใบงานจองรถของตัวเองได้หรือไม่?',
    questionEn: 'Can a regular user cancel their own booking?',
    answerTh:
      'ยกเลิกได้ครับ ผู้ขอใช้รถสามารถกดปุ่ม "ยกเลิกการจอง" ในใบงานของตนเองที่ยังไม่เริ่มเดินทางได้ตามปกติ แต่จะไม่สามารถ "ลบใบงาน" ออกจากฐานข้อมูลได้ (การลบข้อมูลทำได้เฉพาะสิทธิ์ Admin เท่านั้น)',
    answerEn:
      'Yes. Requesters can cancel their own bookings prior to departure. Only permanent deletion of records is restricted to Admins.',
  },
  {
    questionTh: 'ตอนบันทึกก่อนออกเดินทาง และตอนคืนรถ ต้องถ่ายรูปอะไรบ้าง?',
    questionEn: 'Which photos are required at departure vs. return?',
    answerTh:
      'ตอนบันทึกก่อนออกเดินทาง "ไม่ต้องถ่ายรูป" (กรอกเฉพาะเลขไมล์เริ่มต้นและเลือกหน้าปัดน้ำมัน) ส่วนตอนคืนรถ ใช้รูปถ่ายเพียง 1 รูป คือ "ภาพถ่ายขณะหย่อนกุญแจลงตู้"',
    answerEn:
      'No photo is required before departure. Upon return, only 1 photo is required: dropping the key into the key return box.',
  },
  {
    questionTh: 'เลขไมล์เริ่มต้นมาจากไหน หากไม่ตรงกับหน้าปัดรถจริงแก้ไขได้ไหม?',
    questionEn: 'Where does the starting mileage come from, and can I edit it?',
    answerTh:
      'ระบบดึงเลขไมล์ล่าสุดของรถคันนั้นจากฐานข้อมูลมาแสดงให้อัตโนมัติ หากตัวเลขหน้าปัดจริงคลาดเคลื่อน ผู้ใช้สามารถพิมพ์แก้ไขตัวเลขไมล์เริ่มต้นได้เองก่อนกดบันทึก',
    answerEn:
      'It is automatically pulled from the vehicle’s latest recorded odometer, and you can freely edit it to match the actual dashboard reading.',
  },
];

export default function BookingManual({ language = 'th', onNavigateTab }: BookingManualProps) {
  const isEn = language === 'en';
  const [roleFilter, setRoleFilter] = useState<ManualRoleFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSteps = useMemo(() => {
    return MANUAL_STEPS.filter((step) => {
      const matchRole = roleFilter === 'all' || step.roleCategory.includes(roleFilter);
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchRole;
      const textPool = [
        step.titleTh,
        step.titleEn,
        step.summaryTh,
        step.summaryEn,
        ...step.detailsTh,
        ...step.detailsEn,
        step.tipsTh || '',
        step.tipsEn || '',
      ]
        .join(' ')
        .toLowerCase();
      return matchRole && textPool.includes(q);
    });
  }, [roleFilter, searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 pb-12" id="booking-manual-container">
      {/* Top Hero & Action Bar */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-slate-200">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{isEn ? 'Standard Operating Procedure' : 'เอกสารคู่มือมาตรฐานการปฏิบัติงาน'}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{isEn ? '6 Core Steps' : '6 ขั้นตอนหลัก'}</span>
              <span aria-hidden="true">·</span>
              <span>{isEn ? 'Corporate Fleet System' : 'สำหรับผู้ขอใช้รถ ผู้อนุมัติ และผู้ดูแลระบบ'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {isEn
                ? 'Corporate Vehicle Booking & Approval Manual'
                : 'คู่มือการใช้งานระบบจองรถยนต์ส่วนกลาง'}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              {isEn
                ? 'Step-by-step guide covering vehicle reservation, 2-stage approval (Manager & Fleet Controller), pre-departure odometer/fuel logging, and key-drop return confirmation.'
                : 'แนวทางการใช้งานตั้งแต่การตรวจสอบตารางรถว่าง การสร้างใบงานขอใช้รถ ขั้นตอนการอนุมัติ 2 ลำดับขั้น (ผู้จัดการ และ ผู้ดูแลรถ) การบันทึกเลขไมล์และระดับน้ำมันก่อนเดินทาง จนถึงการถ่ายภาพหย่อนกุญแจคืนรถ'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0 print:hidden">
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('calendar')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <CalendarDays className="w-4 h-4" />
                <span>{isEn ? 'Start Booking Now' : 'ไปหน้าจองรถยนต์ทันที'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4" />
              <span>{isEn ? 'Print Manual' : 'พิมพ์คู่มือ / PDF'}</span>
            </button>
          </div>
        </div>

        {/* Workflow Summary Strip (5 Stages) */}
        <div className="pt-6">
          <div className="text-xs font-semibold text-slate-500 mb-3">
            {isEn ? 'End-to-End Booking Lifecycle' : 'แผนผังสถานะใบงานตั้งแต่ต้นจนจบภารกิจ'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-mono font-semibold tabular-nums text-indigo-600">STEP 01</span>
                <span>Operator</span>
              </div>
              <div className="text-sm font-bold text-slate-900">
                {isEn ? 'Create Request' : '1. สร้างคำขอจองรถ'}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {isEn ? 'Select date, time & vehicle' : 'เลือกวันเวลา รถที่ว่าง และระบุภารกิจ'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-mono font-semibold tabular-nums text-amber-700">STEP 02</span>
                <span>Approve 1</span>
              </div>
              <div className="text-sm font-bold text-slate-900">
                {isEn ? 'Manager Approval' : '2. ผู้จัดการอนุมัติ'}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {isEn ? 'Stage 1 review via Web/LINE' : 'สถานะ: รอผู้จัดการ พิจารณาใบงาน'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-mono font-semibold tabular-nums text-blue-700">STEP 03</span>
                <span>Approve 2</span>
              </div>
              <div className="text-sm font-bold text-slate-900">
                {isEn ? 'Fleet Controller' : '3. ผู้ดูแลรถอนุมัติ'}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {isEn ? 'Stage 2 final vehicle check' : 'สถานะ: รอผู้ดูแลรถ อนุมัติพร้อมใช้'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-mono font-semibold tabular-nums text-emerald-700">STEP 04</span>
                <span>Pre-Trip</span>
              </div>
              <div className="text-sm font-bold text-slate-900">
                {isEn ? 'Record Departure' : '4. บันทึกก่อนเดินทาง'}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {isEn ? 'Verify start mileage & fuel gauge' : 'เช็คเลขไมล์เริ่มต้น + เลือกหน้าปัดน้ำมัน'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-mono font-semibold tabular-nums text-slate-700">STEP 05</span>
                <span>Return</span>
              </div>
              <div className="text-sm font-bold text-slate-900">
                {isEn ? 'Return & Key Photo' : '5. คืนรถ & หย่อนกุญแจ'}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {isEn ? 'End mileage + key drop photo' : 'กรอกไมล์สิ้นสุด + ถ่ายรูปหย่อนกุญแจลงตู้'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Filter & Search Toolbar */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 print:hidden">
        {/* Role Filter Segmented Controls */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              roleFilter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isEn ? 'All Steps (6)' : 'ทุกขั้นตอน (6)'}
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('requester')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              roleFilter === 'requester'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isEn ? 'For Requesters (Operator)' : 'สำหรับผู้ขอใช้รถ'}
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('approver')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              roleFilter === 'approver'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isEn ? 'For Approvers (Manager / Fleet)' : 'สำหรับผู้จัดการ / ผู้ดูแลรถ'}
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('admin')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              roleFilter === 'admin'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {isEn ? 'For Administrators' : 'สำหรับผู้ดูแลระบบ (Admin)'}
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isEn
                ? 'Search manual (e.g. mileage, fuel, LINE, cancel)...'
                : 'ค้นหาหัวข้อคู่มือ (เช่น เลขไมล์, น้ำมัน, คืนกุญแจ, ยกเลิก)...'
            }
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800"
          />
        </div>
      </section>

      {/* Detailed Step-by-Step Sections */}
      <section className="space-y-4">
        {filteredSteps.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-700">
              {isEn ? 'No matching manual topics found.' : 'ไม่พบหัวข้อคู่มือที่ตรงกับคำค้นหา'}
            </p>
            <button
              type="button"
              onClick={() => {
                setRoleFilter('all');
                setSearchQuery('');
              }}
              className="px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
            >
              {isEn ? 'Reset Filters' : 'แสดงคู่มือทั้งหมด'}
            </button>
          </div>
        ) : (
          filteredSteps.map((step) => (
            <article
              key={step.id}
              className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="space-y-1">
                  <div className="text-xs text-slate-500 font-medium">
                    {isEn ? step.roleLabelEn : step.roleLabelTh}
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                    <span className="font-mono tabular-nums text-indigo-600 mr-2">
                      {step.number}.
                    </span>
                    {isEn ? step.titleEn : step.titleTh}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600">
                    {isEn ? step.summaryEn : step.summaryTh}
                  </p>
                </div>

                {step.actionTab && onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab(step.actionTab!)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start print:hidden"
                  >
                    <span>{isEn ? step.actionLabelEn : step.actionLabelTh}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="pt-4 space-y-2.5">
                {(isEn ? step.detailsEn : step.detailsTh).map((detail, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 leading-relaxed">
                    <span className="font-mono text-xs font-bold text-slate-400 tabular-nums mt-0.5 shrink-0">
                      {step.number}.{idx + 1}
                    </span>
                    <span>{detail}</span>
                  </div>
                ))}
              </div>

              {(step.tipsTh || step.tipsEn) && (
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800 mr-1.5">
                      {isEn ? 'Important Note:' : 'ข้อควรจำ:'}
                    </span>
                    <span>{isEn ? step.tipsEn : step.tipsTh}</span>
                  </div>
                </div>
              )}
            </article>
          ))
        )}
      </section>

      {/* Role Permissions & Responsibilities Reference Table */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">
            {isEn
              ? 'Role Responsibilities & Permissions Summary'
              : 'ตารางสรุปบทบาทและหน้าที่ความรับผิดชอบในระบบ'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isEn
              ? 'Overview of permissions across Requesters, Managers, Fleet Controllers, and Administrators.'
              : 'เปรียบเทียบสิทธิ์การดำเนินการของแต่ละบทบาท เพื่อให้การใช้งานเป็นไปตามระเบียบปฏิบัติขององค์กร'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3.5 px-5">{isEn ? 'Role / Position' : 'บทบาท / สิทธิ์ในระบบ'}</th>
                <th className="py-3.5 px-5">{isEn ? 'Primary Responsibilities' : 'หน้าที่หลักในกระบวนการจองรถ'}</th>
                <th className="py-3.5 px-5">{isEn ? 'LINE Notifications Received' : 'การแจ้งเตือนผ่าน LINE ที่ได้รับ'}</th>
                <th className="py-3.5 px-5">{isEn ? 'Cancel / Delete Rights' : 'สิทธิ์การยกเลิก / ลบใบงาน'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs text-slate-700">
              <tr className="hover:bg-slate-50/80">
                <td className="py-3.5 px-5 font-bold text-slate-900 whitespace-nowrap">
                  {isEn ? 'Requester (Operator)' : 'ผู้ขอใช้รถ (Operator)'}
                </td>
                <td className="py-3.5 px-5">
                  {isEn
                    ? 'Submit booking, record start mileage/fuel before departure, record end mileage & key drop photo on return.'
                    : 'สร้างใบงานขอใช้รถ, บันทึกเลขไมล์และระดับน้ำมันก่อนเดินทาง, บันทึกไมล์สิ้นสุดและถ่ายภาพหย่อนกุญแจเมื่อคืนรถ'}
                </td>
                <td className="py-3.5 px-5">
                  {isEn
                    ? 'When approved/rejected, and upon vehicle return completion.'
                    : 'เมื่อใบงานได้รับอนุมัติ / ไม่อนุมัติ และแจ้งเตือนยืนยันเมื่อคืนรถสำเร็จ'}
                </td>
                <td className="py-3.5 px-5">
                  {isEn
                    ? 'Can Cancel own upcoming trip (Cannot Delete).'
                    : 'กดยกเลิกใบงานตนเองได้ (ห้ามลบข้อมูลออกจากระบบ)'}
                </td>
              </tr>
              <tr className="hover:bg-slate-50/80">
                <td className="py-3.5 px-5 font-bold text-slate-900 whitespace-nowrap">
                  {isEn ? 'Manager (Approver 1)' : 'ผู้จัดการ (ผู้อนุมัติลำดับที่ 1)'}
                </td>
                <td className="py-3.5 px-5">
                  {isEn
                    ? 'Review and approve/reject Stage 1 requests for their assigned department/division.'
                    : 'พิจารณาอนุมัติหรือไม่อนุมัติใบงานในขั้นที่ 1 (ตรวจสอบความจำเป็นของภารกิจในแผนก/ฝ่าย)'}
                </td>
                <td className="py-3.5 px-5">
                  {isEn
                    ? 'Immediately when a new booking is created.'
                    : 'รับแจ้งเตือนทันทีเมื่อพนักงานส่งคำขอจองรถใหม่'}
                </td>
                <td className="py-3.5 px-5">
                  {isEn
                    ? 'Can Approve or Reject Stage 1 with reason.'
                    : 'กดอนุมัติ หรือ ไม่อนุมัติ (Reject) พร้อมระบุเหตุผล'}
                </td>
              </tr>
              <tr className="hover:bg-slate-50/80">
                <td className="py-3.5 px-5 font-bold text-slate-900 whitespace-nowrap">
                  {isEn ? 'Fleet Controller (Approver 2)' : 'ผู้ดูแลรถ (ผู้อนุมัติลำดับที่ 2)'}
                </td>
                <td className="py-3.5 px-5">
                  {isEn
                    ? 'Verify vehicle availability/readiness and grant final Stage 2 approval; monitor vehicle returns.'
                    : 'ตรวจสอบความพร้อมของรถยนต์ส่วนกลาง อนุมัติขั้นที่ 2 และตรวจสอบความเรียบร้อยเมื่อมีการคืนรถ'}
                </td>
                <td className="py-3.5 px-5">
                  {isEn
                    ? 'After Manager approves Stage 1, and when the user returns the vehicle.'
                    : 'เมื่อผู้จัดการอนุมัติขั้นที่ 1 แล้ว และเมื่อผู้ใช้ยืนยันการคืนรถยนต์ส่วนกลาง'}
                </td>
                <td className="py-3.5 px-5">
                  {isEn
                    ? 'Can Approve or Reject Stage 2 with reason.'
                    : 'กดอนุมัติขั้นสุดท้าย หรือ ไม่อนุมัติ (Reject) พร้อมระบุเหตุผล'}
                </td>
              </tr>
              <tr className="hover:bg-slate-50/80">
                <td className="py-3.5 px-5 font-bold text-slate-900 whitespace-nowrap">
                  {isEn ? 'Administrator (Admin)' : 'ผู้ดูแลระบบ (Admin)'}
                </td>
                <td className="py-3.5 px-5">
                  {isEn
                    ? 'Manage vehicles, users, departments/divisions, role permissions, and fleet reports.'
                    : 'จัดการข้อมูลรถยนต์ กำหนดแผนก/ฝ่าย เพิ่มผู้ใช้งาน กำหนดสิทธิ์เมนู และดูรายงานสรุปการใช้รถ'}
                </td>
                <td className="py-3.5 px-5">
                  {isEn
                    ? 'Can monitor all LINE notification statuses across the system.'
                    : 'ตรวจสอบสถานะการส่งแจ้งเตือน LINE ได้ทุกใบงาน'}
                </td>
                <td className="py-3.5 px-5">
                  {isEn
                    ? 'Full rights including permanent record deletion.'
                    : 'มีสิทธิ์เต็ม รวมถึงเป็นสิทธิ์เดียวที่ลบใบงานออกจากระบบได้'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Frequently Asked Questions (FAQ) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <HelpCircle className="w-5 h-5 text-indigo-600 shrink-0" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isEn ? 'Frequently Asked Questions (FAQ)' : 'คำถามที่พบบ่อยและการแก้ไขปัญหาเบื้องต้น'}
            </h2>
            <p className="text-xs text-slate-500">
              {isEn
                ? 'Quick answers to common questions during vehicle booking and return.'
                : 'รวบรวมข้อสงสัยในการใช้งานระบบการจอง การอนุมัติ และการคืนรถยนต์ส่วนกลาง'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FAQ_ITEMS.map((item, index) => (
            <div
              key={index}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
            >
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                <span className="font-mono tabular-nums text-indigo-600 mr-1.5">
                  Q{index + 1}.
                </span>
                {isEn ? item.questionEn : item.questionTh}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isEn ? item.answerEn : item.answerTh}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
