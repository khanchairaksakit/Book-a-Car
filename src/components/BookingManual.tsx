import React, { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Search,
  Printer,
  ArrowRight,
  Shield,
  User as UserIcon,
  Users,
  Car,
  FileSpreadsheet,
  History,
} from 'lucide-react';
import { Language } from '../utils/translations';
import { User, AppMenuKey } from '../types';
import {
  getUserRoles,
  isUserAdmin,
  isUserApprover1,
  isUserApprover2,
} from '../utils/userHelpers';

interface BookingManualProps {
  currentUser?: User | null;
  language?: Language;
  onNavigateTab?: (tab: AppMenuKey) => void;
}

type UserManualRoleType = 'user' | 'approver1' | 'approver2';

interface ManualStep {
  id: string;
  number: string;
  roleCategory: UserManualRoleType[];
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
  actionTab?: AppMenuKey;
  actionLabelTh?: string;
  actionLabelEn?: string;
}

// Manual steps targeted specifically per role (User, Approver 1, Approver 2)
const ROLE_MANUAL_STEPS: ManualStep[] = [
  // ===================== USER / OPERATOR (ผู้ขอใช้รถ) =====================
  {
    id: 'user-step-login',
    number: '01',
    roleCategory: ['user'],
    roleLabelTh: 'ผู้ขอใช้รถ (User) · การเข้าใช้งานระบบ',
    roleLabelEn: 'Requester (User) · Sign In',
    titleTh: 'การเข้าสู่ระบบและตรวจสอบสิทธิ์การใช้งาน',
    titleEn: 'Signing In & Account Profile',
    summaryTh:
      'เข้าสู่ระบบด้วยชื่อผู้ใช้ (Username) รหัสพนักงาน หรืออีเมลองค์กร และตรวจสอบข้อมูลสิทธิ์ผู้ขอใช้รถ',
    summaryEn:
      'Sign in using your corporate Username, Employee Code, or Email and check your requester profile.',
    detailsTh: [
      'กรอกชื่อผู้ใช้ (Username) รหัสพนักงาน หรืออีเมล และรหัสผ่านในหน้าเข้าสู่ระบบ (ห้ามเคาะเว้นวรรคก่อนหรือหลังชื่อผู้ใช้และรหัสผ่าน)',
      'เมื่อเข้าสู่ระบบสำเร็จ ระบบจะนำท่านเข้าสู่หน้า "Dashboard" เป็นหน้าแรก เพื่อตรวจสอบรายการงานหรือเอกสารที่ค้างดำเนินการได้ทันที',
      'ตรวจสอบชื่อ-นามสกุล แผนก/ฝ่าย และบทบาทสิทธิ์ของท่านได้ที่แถบเมนูด้านซ้ายบน (สิทธิ์: ผู้ขอใช้รถ / User)',
      'สามารถผูกบัญชี LINE User ID เพื่อรับการแจ้งเตือนสถานะการอนุมัติและผลการพิจารณาใบงานผ่าน LINE Flex Message',
    ],
    detailsEn: [
      'Enter your Username, Employee Code, or Email and Password without any whitespace.',
      'Upon sign in, you are automatically directed to the "Dashboard" to review your pending actions.',
      'Check your name, department/division, and requester role on the top left navigation sidebar.',
      'Link your LINE User ID to receive real-time approval status updates via LINE Flex Message.',
    ],
    tipsTh: 'การแจ้งเตือนแบบป๊อปอัพบนหน้าจอจะแจ้งเตือนเฉพาะผู้ที่เกี่ยวข้อง และจะปิดตัวเองอัตโนมัติภายใน 5 วินาที',
    tipsEn: 'In-app notifications target only relevant users and automatically dismiss after 5 seconds.',
  },
  {
    id: 'user-step-dashboard',
    number: '02',
    roleCategory: ['user'],
    roleLabelTh: 'ผู้ขอใช้รถ (User) · หน้าแรกหลังเข้าสู่ระบบ (Home)',
    roleLabelEn: 'Requester (User) · Home Dashboard',
    titleTh: 'การใช้งานหน้า Dashboard (ศูนย์รวมงานค้างและภาพรวมรถว่าง)',
    titleEn: 'Using the Dashboard (Pending Tasks & Fleet Availability)',
    summaryTh:
      'หน้าแรกสำหรับผู้ขอใช้รถ รวบรวมใบงานที่กำลังใช้งาน รายการที่รออนุมัติ และภาพรวมความพร้อมของรถยนต์ส่วนกลาง',
    summaryEn:
      'Your default landing page displaying active trips, pending approval status, and central fleet availability.',
    detailsTh: [
      'รายการงานค้างดำเนินการ: ระบบจะแสดงใบงานที่อยู่ในสถานะ "กำลังใช้งาน (ยังไม่ได้คืนรถ)" เพื่อให้ท่านกด "บันทึกข้อมูลก่อนออกเดินทาง" หรือกด "เสร็จสิ้นภารกิจ & คืนรถยนต์ส่วนกลาง" ได้สะดวกรวดเร็วในคลิกเดียว',
      'ติดตามคำขอของตนเอง: แสดงรายการคำขอใช้รถของท่านที่ยังอยู่ระหว่างรอผู้จัดการ (Approve 1) หรือรอผู้ดูแลรถ (Approve 2) พิจารณาอนุมัติ',
      'ภาพรวมรถยนต์ส่วนกลาง: ตรวจสอบจำนวนรถยนต์ที่ว่างพร้อมใช้งาน รถที่ติดภารกิจ และตารางคิวการใช้รถประจำวัน เพื่อวางแผนการเดินทางได้อย่างแม่นยำ',
    ],
    detailsEn: [
      'Pending Action Center: Highlights active "In Use" trips requiring pre-departure mileage logs or vehicle return confirmation.',
      'Track Your Requests: Displays your booking requests currently pending Manager (Stage 1) or Fleet Controller (Stage 2) approval.',
      'Fleet Overview: Real-time counts of available vehicles and daily booking schedule to plan your journey.',
    ],
    tipsTh: 'หากมีตัวเลขแจ้งเตือนสีแดงหรือสีส้มบนหน้า Dashboard สามารถคลิกปุ่มบนการ์ดใบงานเพื่อดำเนินการต่อได้ทันที',
    tipsEn: 'Click action buttons directly on pending cards to complete departure logs or vehicle returns.',
    actionTab: 'dashboard',
    actionLabelTh: 'ไปที่หน้า Dashboard',
    actionLabelEn: 'Open Dashboard',
  },
  {
    id: 'user-step-booking',
    number: '03',
    roleCategory: ['user'],
    roleLabelTh: 'ผู้ขอใช้รถ (User) · การสร้างคำขอ',
    roleLabelEn: 'Requester (User) · Booking Request',
    titleTh: 'การเลือกวันเวลาและสร้างใบงานขอใช้รถยนต์ส่วนกลาง',
    titleEn: 'Selecting Dates & Submitting a Vehicle Request',
    summaryTh:
      'ตรวจสอบตารางรถว่างในเมนู "ปฏิทินการจองรถยนต์" และกรอกรายละเอียดการเดินทางเพื่อออกเลขใบงานอัตโนมัติ',
    summaryEn:
      'Check vehicle availability on the Booking Calendar and submit trip details to generate an automatic job number.',
    detailsTh: [
      'ไปที่เมนู "ปฏิทินการจองรถยนต์" แล้วคลิกเลือกวันที่ต้องการเดินทางบนปฏิทิน หรือกดปุ่ม "+ จองรถยนต์ส่วนกลาง"',
      'ระบุวัน-เวลาเริ่มต้น และวัน-เวลาสิ้นสุดภารกิจ ระบบจะคัดกรองเฉพาะรถยนต์ส่วนกลางที่ "ว่าง" ในช่วงเวลานั้นให้เลือก',
      'เลือกรถยนต์ที่ต้องการ ระบุสถานที่ปลายทาง จำนวนผู้โดยสาร เบอร์โทรศัพท์ติดต่อ และวัตถุประสงค์การเดินทาง',
      'หน้าต่างแจ้งเตือนสภาพรถ (Popup รับทราบ): หากรถคันที่เลือกรอบเลขไมล์ใกล้ถึงกำหนดเช็คระยะ (ก่อน 1,000 กม. หรือเลยกำหนด), ยางใกล้ถึงกำหนดเปลี่ยน หรือภาษีประจำปีใกล้หมดอายุ ระบบจะแสดงหน้าต่าง Popup แจ้งเตือนให้ท่านกดปุ่ม "รับทราบและดำเนินการต่อ" (หรือเลือกเปลี่ยนรถคันอื่น)',
      'เลือกผู้อนุมัติลำดับที่ 1 (ผู้จัดการ) และผู้อนุมัติลำดับที่ 2 (ผู้ดูแลรถ) จากนั้นกดปุ่มยืนยันการจอง',
      'ระบบจะสร้างเลขที่ใบงานอัตโนมัติ (AX-YYYYMMDD-XXX) พร้อมส่งรายการไปแสดงในหน้า Dashboard ของผู้อนุมัติ และส่งแจ้งเตือนทาง LINE ให้ผู้อนุมัติทันที',
    ],
    detailsEn: [
      'Open "Booking Calendar" and select your departure date or click "+ Book Vehicle".',
      'Select departure and return date/time; the system automatically filters available vehicles for that slot.',
      'Choose a vehicle, enter destination, passenger count, phone number, and trip purpose.',
      'Vehicle Maintenance Alert Popup: If the vehicle is nearing its service interval (< 1,000 km or overdue), tire replacement, or annual tax expiry, an alert popup will prompt you to acknowledge before proceeding.',
      'Select Approver 1 (Manager) and Approver 2 (Fleet Controller), then confirm booking.',
      'An automatic job number (AX-YYYYMMDD-XXX) is generated and sent to Approvers via Dashboard and LINE.',
    ],
    tipsTh: 'ระบบจะป้องกันไม่ให้เลือกเวลาสิ้นสุดย้อนหลัง หรือจองรถซ้อนทับกับช่วงเวลาที่มีผู้ใช้งานอื่นจองไว้แล้ว',
    tipsEn: 'Overlapping bookings and invalid time ranges are automatically prevented.',
    actionTab: 'calendar',
    actionLabelTh: 'ไปที่หน้าปฏิทินการจองรถ',
    actionLabelEn: 'Open Calendar',
  },
  {
    id: 'user-step-departure',
    number: '04',
    roleCategory: ['user'],
    roleLabelTh: 'ผู้ขอใช้รถ (User) · ก่อนออกเดินทาง',
    roleLabelEn: 'Requester (User) · Pre-Departure Log',
    titleTh: 'การบันทึกข้อมูลก่อนออกเดินทาง (เลขไมล์เริ่มต้น & ระดับน้ำมัน)',
    titleEn: 'Recording Pre-Departure Data (Start Mileage & Fuel Gauge)',
    summaryTh:
      'เมื่อใบงานได้รับการอนุมัติครบทั้ง 2 ขั้นตอน (สถานะ: กำลังใช้งาน) ให้บันทึกเลขไมล์เริ่มต้นและระดับน้ำมันก่อนนำรถออก',
    summaryEn:
      'Before departing in an approved vehicle (status: In Use), record the starting odometer mileage and fuel level.',
    detailsTh: [
      'ที่หน้า "Dashboard" (ในหัวข้องานค้างดำเนินการ) หรือที่เมนู "ตรวจสอบสถานะ" ให้กดปุ่ม "บันทึกข้อมูลก่อนออกเดินทาง" บนใบงานที่กำลังใช้งาน',
      'เลขไมล์เริ่มต้น (km.): ระบบจะดึงเลขไมล์ล่าสุดของรถคันนั้นมาแสดงให้อัตโนมัติ สามารถตรวจสอบและปรับแก้ตัวเลขให้ตรงกับหน้าปัดจริงได้',
      'ระดับน้ำมันเริ่มต้น: เลือกตัวเลือกระดับน้ำมัน (เต็มถัง, 3/4, 1/2, 1/4, ใกล้หมด) โดยเข็มกราฟิกหน้าปัดระดับน้ำมันจะขยับตามทันที',
      'กดปุ่ม "บันทึกข้อมูลออกเดินทาง" (ขั้นตอนนี้ไม่ต้องถ่ายภาพ เพื่อความสะดวกรวดเร็วในการออกเดินทาง)',
    ],
    detailsEn: [
      'On the "Dashboard" (under Pending Actions) or "Check Status", click "Record Pre-Departure Info" on your active booking.',
      'Starting Mileage (km.): Auto-filled from the vehicle’s current odometer, editable if needed to match the real gauge.',
      'Starting Fuel Level: Select Full, 3/4, 1/2, or 1/4 on the interactive fuel gauge.',
      'Click Save to confirm departure (no photo required at departure).',
    ],
    tipsTh: 'การบันทึกข้อมูลก่อนออกเดินทางเป็นขั้นตอนบังคับก่อนที่จะสามารถกดคืนรถเมื่อเสร็จสิ้นภารกิจได้',
    tipsEn: 'Pre-departure mileage and fuel must be recorded before you can complete vehicle return.',
    actionTab: 'dashboard',
    actionLabelTh: 'ไปที่หน้า Dashboard เพื่อบันทึกก่อนเดินทาง',
    actionLabelEn: 'Go to Dashboard',
  },
  {
    id: 'user-step-return',
    number: '05',
    roleCategory: ['user'],
    roleLabelTh: 'ผู้ขอใช้รถ (User) · เสร็จสิ้นภารกิจและคืนรถ',
    roleLabelEn: 'Requester (User) · Vehicle Return & Key Drop',
    titleTh: 'การยืนยันคืนรถยนต์ส่วนกลาง การคืนรถก่อนกำหนด และถ่ายภาพหย่อนกุญแจ',
    titleEn: 'Returning the Vehicle, Early Return Policy & Key Drop Photo',
    summaryTh:
      'เมื่อกลับมาถึงบริษัท ให้กดคืนรถจากหน้า Dashboard พร้อมกรอกเลขไมล์สิ้นสุด ระดับน้ำมัน และถ่ายภาพขณะหย่อนกุญแจลงตู้',
    summaryEn:
      'Upon returning, enter the ending mileage, fuel level, and capture a photo of returning the key to the drop box.',
    detailsTh: [
      'กดปุ่ม "เสร็จสิ้นภารกิจ & คืนรถยนต์ส่วนกลาง" จากรายการค้างในหน้า Dashboard หรือในเมนูตรวจสอบสถานะ',
      'กรณีคืนรถก่อนกำหนดเวลาสิ้นสุดที่จองไว้: หน้าต่างคืนรถจะแสดงป้ายแจ้งเตือน "การคืนรถก่อนกำหนด หากต้องการยืมให้ขอในระบบใหม่" เมื่อยืนยันคืนแล้ว สถานะรถจะกลับไปว่างพร้อมให้ผู้อื่นจองต่อทันที',
      'กรอก "เลขไมล์สิ้นสุด (km.)" โดยต้องมีค่าไม่น้อยกว่าเลขไมล์เริ่มต้น ระบบจะคำนวณระยะทางที่ใช้เดินทางในภารกิจให้อัตโนมัติ',
      'เลือกระดับน้ำมันคงเหลือจากหน้าปัดกราฟิก (เต็มถัง, 3/4, 1/2, 1/4, ใกล้หมด)',
      'ถ่ายภาพหลักฐาน "ขณะหย่อนกุญแจลงตู้คืนกุญแจ" 1 ภาพ (เปิดกล้องถ่ายสดหรืออัปโหลดรูปภาพ)',
      'เมื่อกดยืนยันคืนรถ: (1) สถานะใบงานจะเปลี่ยนเป็น "เสร็จสิ้น" (2) สถานะรถยนต์จะกลับมาว่างพร้อมอัปเดตเลขไมล์ล่าสุดเข้าสู่ฐานข้อมูลรถยนต์อัตโนมัติ และ (3) ส่ง LINE แจ้งเตือนยืนยันการคืนรถ',
    ],
    detailsEn: [
      'Click "Complete Mission & Return Vehicle" from your Dashboard pending list or Check Status page.',
      'Early Return Notice: If returning before the scheduled end time, the return modal displays: "Early return — if you need the vehicle again, please submit a new request." The car becomes immediately available upon return.',
      'Enter Ending Mileage (must be >= starting mileage); trip distance is calculated automatically.',
      'Select ending fuel level on the interactive fuel gauge.',
      'Take or upload 1 photo of dropping the key into the key return box.',
      'Upon confirmation: booking status updates to "Completed", vehicle status returns to "Available" with new odometer mileage, and LINE notification is sent.',
    ],
    tipsTh: 'หากคืนรถก่อนกำหนดและต้องการนำรถออกไปใช้งานอีกครั้งในภายหลัง จะต้องสร้างใบงานขอใช้รถใหม่ในระบบเสมอ',
    tipsEn: 'Once a vehicle is returned early, a new booking request must be submitted for any subsequent use.',
    actionTab: 'booking',
    actionLabelTh: 'ไปที่หน้าตรวจสอบสถานะ / คืนรถ',
    actionLabelEn: 'Open Status & Return',
  },
  {
    id: 'user-step-cancel',
    number: '06',
    roleCategory: ['user'],
    roleLabelTh: 'ผู้ขอใช้รถ (User) · ตรวจสอบสถานะและยกเลิก',
    roleLabelEn: 'Requester (User) · Status & Cancellation',
    titleTh: 'การตรวจสอบสถานะใบงาน และแนวทางการยกเลิกการจอง',
    titleEn: 'Tracking Booking Status & Request Cancellation',
    summaryTh:
      'ตรวจสอบความคืบหน้าของใบงานขอใช้รถ และการกดยกเลิกการจองของตนเองก่อนออกเดินทาง',
    summaryEn:
      'Track the progress of your vehicle requests and learn how to cancel upcoming trips before departure.',
    detailsTh: [
      'ไปที่เมนู "ตรวจสอบสถานะ" เพื่อติดตามว่าใบงานของท่านอยู่ในขั้นตอนใด (รอผู้จัดการ, รอผู้ดูแลรถ, กำลังใช้งาน, เสร็จสิ้น หรือ ยกเลิก)',
      'การยกเลิกการจอง (Cancel): ผู้ขอใช้รถสามารถกด "ยกเลิกการจอง" ในใบงานของตนเองที่ยังไม่ได้นำรถออกเดินทางได้ตลอดเวลา เพื่อคืนคิวรถให้ผู้อื่นใช้งาน',
      'ข้อจำกัดสิทธิ์: ผู้ขอใช้รถทั่วไปไม่สามารถลบใบงานออกจากฐานข้อมูลได้ (การลบข้อมูลถาวรสงวนไว้สำหรับผู้ดูแลระบบ Admin เท่านั้น)',
      'สามารถค้นหาใบงานของตนเองตามหมายเลขใบงาน AX-YYYYMMDD-XXX หรือกรองดูตามช่วงวันที่ได้อย่างสะดวก',
    ],
    detailsEn: [
      'Open "Check Status" to follow your request progress (Pending Manager, Pending Fleet, In Use, Completed, Cancelled).',
      'Cancelling a Booking: Requesters can cancel their own upcoming trips before departure at any time.',
      'Permission Policy: Requesters cannot permanently delete records from the system; record deletion is restricted to Administrators.',
      'Easily search by job number (AX-YYYYMMDD-XXX) or date range filter.',
    ],
    tipsTh: 'ใบงานที่ยกเลิกแล้วจะยังคงมีประวัติบันทึกอยู่ในระบบเพื่อความโปร่งใสและตรวจสอบย้อนหลังได้',
    tipsEn: 'Cancelled requests remain recorded in the system for transparency and audit compliance.',
    actionTab: 'booking',
    actionLabelTh: 'ไปที่หน้าตรวจสอบสถานะ',
    actionLabelEn: 'Open Check Status',
  },

  // ===================== APPROVER 1 (ผู้จัดการ) =====================
  {
    id: 'app1-step-login',
    number: '01',
    roleCategory: ['approver1'],
    roleLabelTh: 'ผู้จัดการ (Approve 1) · การเข้าใช้งานระบบ',
    roleLabelEn: 'Manager (Approve 1) · Sign In',
    titleTh: 'การเข้าสู่ระบบและตรวจสอบสิทธิ์ผู้อนุมัติขั้นที่ 1',
    titleEn: 'Signing In & Approver 1 Role Verification',
    summaryTh:
      'เข้าสู่ระบบด้วยบัญชีผู้จัดการ และตรวจสอบสิทธิ์การพิจารณาอนุมัติคำขอใช้รถของแผนก/ฝ่าย',
    summaryEn:
      'Sign in with your Manager account and verify your Stage 1 approval authority for your department.',
    detailsTh: [
      'เข้าสู่ระบบด้วยชื่อผู้ใช้ รหัสพนักงาน หรืออีเมล และรหัสผ่านที่ถูกต้อง',
      'ตรวจสอบบทบาทสิทธิ์ (Approve 1) และแผนก/ฝ่ายที่ท่านกำกับดูแลที่แถบเมนูด้านซ้ายบน',
      'ผูกบัญชี LINE User ID เพื่อรับการแจ้งเตือนคำขอใช้รถใหม่ของพนักงานในแผนกผ่าน LINE Flex Message พร้อมปุ่มกดอนุมัติทันที',
    ],
    detailsEn: [
      'Sign in with your registered Username, Employee Code, or Email and Password.',
      'Verify your Stage 1 Approver role and assigned department on the left navigation bar.',
      'Link your LINE User ID to receive new request notifications via LINE Flex Message with direct approval buttons.',
    ],
    tipsTh: 'ท่านสามารถอนุมัติใบงานได้ทั้งจากหน้าเว็บไซต์ Dashboard และผ่านข้อความแจ้งเตือนทาง LINE',
    tipsEn: 'You can approve bookings directly from the web Dashboard or via LINE notification cards.',
  },
  {
    id: 'app1-step-dashboard',
    number: '02',
    roleCategory: ['approver1'],
    roleLabelTh: 'ผู้จัดการ (Approve 1) · หน้าแรก Dashboard',
    roleLabelEn: 'Manager (Approve 1) · Home Dashboard',
    titleTh: 'การตรวจสอบรายการรออนุมัติในหน้า Dashboard',
    titleEn: 'Reviewing Pending Stage 1 Requests on the Dashboard',
    summaryTh:
      'ศูนย์รวมเอกสารคำขอที่รอผู้จัดการอนุมัติขั้นที่ 1 แสดงผลเด่นชัดทันทีหลังเข้าสู่ระบบ',
    summaryEn:
      'Action Center highlighting all pending Stage 1 requests requiring Manager approval right upon sign in.',
    detailsTh: [
      'ที่ส่วนบนสุดของหน้า Dashboard จะแสดงการ์ด "รายการที่ค้างดำเนินการ (รอผู้จัดการอนุมัติ)" เพื่อให้ท่านทราบทันทีว่ามีเอกสารค้างอยู่กี่ฉบับ',
      'แสดงข้อมูลสำคัญของคำขอ: เลขที่ใบงาน, ผู้ขอใช้รถ, แผนก, รถยนต์ที่ขอใช้, วันเวลาเดินทาง, และสถานที่ปลายทาง',
      'สามารถกดปุ่ม "อนุมัติ" หรือ "ไม่อนุมัติ" ได้จากหน้า Dashboard ทันทีโดยไม่ต้องเปิดไปหน้าอื่น',
    ],
    detailsEn: [
      'The top of the Dashboard prominently displays your pending Stage 1 requests count and quick cards.',
      'Review essential trip details: Job number, requester, department, vehicle, date/time, and destination.',
      'Click "Approve" or "Reject" directly from the Dashboard without opening extra pages.',
    ],
    tipsTh: 'หากไม่มีเอกสารค้าง การ์ดงานค้างจะแสดงข้อความว่าท่านไม่มีงานค้างดำเนินการในขณะนี้',
    tipsEn: 'If all requests are cleared, the dashboard confirms no pending actions.',
    actionTab: 'dashboard',
    actionLabelTh: 'ไปที่หน้า Dashboard',
    actionLabelEn: 'Open Dashboard',
  },
  {
    id: 'app1-step-approval',
    number: '03',
    roleCategory: ['approver1'],
    roleLabelTh: 'ผู้จัดการ (Approve 1) · การพิจารณาอนุมัติ',
    roleLabelEn: 'Manager (Approve 1) · Approval Workflow',
    titleTh: 'ขั้นตอนการพิจารณาอนุมัติคำขอใช้รถยนต์ส่วนกลาง (ขั้นที่ 1)',
    titleEn: 'Stage 1 Review, Approval & Rejection Process',
    summaryTh:
      'การตรวจสอบความจำเป็นของภารกิจ และการกดอนุมัติหรือปฏิเสธคำขอพร้อมระบุเหตุผล',
    summaryEn:
      'Reviewing mission necessity and approving or rejecting requests with detailed feedback.',
    detailsTh: [
      'ตรวจสอบความเหมาะสมของภารกิจ วันเวลาเดินทาง จำนวนผู้โดยสาร และความจำเป็นในการใช้รถยนต์ส่วนกลาง',
      'กรณีอนุมัติ: กดปุ่ม "อนุมัติ" ใบงานจะถูกปรับสถานะและส่งต่อไปยังขั้นตอนที่ 2 (รอผู้ดูแลรถอนุมัติ) โดยอัตโนมัติ',
      'กรณีไม่อนุมัติ (Reject): กดปุ่ม "ไม่อนุมัติ" พร้อมระบุเหตุผลการปฏิเสธอย่างชัดเจน ใบงานจะถูกปรับสถานะเป็น "ผู้จัดการ Reject" และแจ้งเตือนให้ผู้ขอทราบทันที',
      'การอนุมัติผ่าน LINE: ผู้จัดการสามารถกดอนุมัติหรือปฏิเสธผ่านการ์ด Flex Message ในแอปพลิเคชัน LINE ได้อย่างสะดวกรวดเร็วทุกที่ทุกเวลา',
    ],
    detailsEn: [
      'Check trip necessity, date/time, passenger count, and justification.',
      'Approval: Click "Approve" — the request advances to Stage 2 (Fleet Controller) automatically.',
      'Rejection: Click "Reject" and provide a mandatory reason — the requester receives an immediate update.',
      'Mobile LINE Approval: Approve or reject instantly via LINE Flex Message on your mobile device.',
    ],
    tipsTh: 'สามารถคลิกดูเบอร์โทรศัพท์ติดต่อของผู้ขอใช้รถในรายละเอียดใบงานเพื่อติดต่อสอบถามเพิ่มเติมได้ทันที',
    tipsEn: 'You can view the requester’s contact phone number inside the details modal for quick queries.',
    actionTab: 'booking',
    actionLabelTh: 'ไปที่หน้าตรวจสอบสถานะ',
    actionLabelEn: 'Open Check Status',
  },
  {
    id: 'app1-step-tracking',
    number: '04',
    roleCategory: ['approver1'],
    roleLabelTh: 'ผู้จัดการ (Approve 1) · การติดตามสถานะ',
    roleLabelEn: 'Manager (Approve 1) · Tracking & History',
    titleTh: 'การติดตามสถานะใบงานและการตรวจสอบประวัติการอนุมัติ',
    titleEn: 'Tracking Department Requests & Approval History',
    summaryTh:
      'ติดตามสถานะใบงานในแผนกหลังการอนุมัติ และดูประวัติการเดินทางย้อนหลัง',
    summaryEn:
      'Monitor post-approval trip progress and review historical department vehicle usage.',
    detailsTh: [
      'ไปที่เมนู "ตรวจสอบสถานะ" เพื่อดูภาพรวมใบงานทั้งหมดของพนักงานในแผนก/ฝ่าย',
      'กรองดูรายการตามสถานะ: รอผู้จัดการ, รอผู้ดูแลรถ, กำลังใช้งาน, เสร็จสิ้น หรือ ยกเลิก',
      'สามารถดูหมายเหตุ เหตุผลการไม่อนุมัติ และเวลาที่อนุมัติย้อนหลังได้ทุกรายการ',
    ],
    detailsEn: [
      'Open "Check Status" to see all bookings originating from your department.',
      'Filter by status: Pending Manager, Pending Fleet, In Use, Completed, or Cancelled.',
      'Review approval timestamps and rejection remarks at any time.',
    ],
    actionTab: 'booking',
    actionLabelTh: 'ไปที่หน้าตรวจสอบสถานะ',
    actionLabelEn: 'Open Check Status',
  },

  // ===================== APPROVER 2 (ผู้ดูแลรถ) =====================
  {
    id: 'app2-step-login',
    number: '01',
    roleCategory: ['approver2'],
    roleLabelTh: 'ผู้ดูแลรถ (Approve 2) · การเข้าใช้งานระบบ',
    roleLabelEn: 'Fleet Controller (Approve 2) · Sign In',
    titleTh: 'การเข้าสู่ระบบและตรวจสอบสิทธิ์ผู้ดูแลรถส่วนกลาง',
    titleEn: 'Signing In & Fleet Controller Role Verification',
    summaryTh:
      'เข้าสู่ระบบด้วยบัญชีผู้ดูแลรถเพื่อบริหารความพร้อมและอนุมัติขั้นสุดท้ายของรถยนต์ส่วนกลาง',
    summaryEn:
      'Sign in with your Fleet Controller account to manage fleet readiness and grant final approvals.',
    detailsTh: [
      'เข้าสู่ระบบด้วยบัญชีผู้ใช้งานที่มีสิทธิ์ Approve 2 (ผู้ดูแลรถ)',
      'ตรวจสอบบทบาทสิทธิ์ที่แถบเมนูด้านซ้ายบน (สิทธิ์: ผู้ดูแลรถ / Approve 2)',
      'ผูกบัญชี LINE User ID เพื่อรับการแจ้งเตือนใบงานที่ผ่านผู้จัดการแล้ว และรอผู้ดูแลรถอนุมัติขั้นสุดท้าย พร้อมการแจ้งเตือนสภาพรถ (เช็คระยะ/ยาง/ภาษี)',
    ],
    detailsEn: [
      'Sign in with your registered credentials holding Approve 2 permissions.',
      'Verify your Fleet Controller role on the top left navigation menu.',
      'Link your LINE User ID to receive Stage 2 alerts along with vehicle maintenance status indicators.',
    ],
    tipsTh: 'ผู้ดูแลรถจะได้รับการแจ้งเตือนทั้งใบงานรออนุมัติ และการแจ้งเตือนสภาพรถยนต์ที่ใกล้ถึงกำหนดเช็คระยะ/เปลี่ยนยาง/ต่อภาษี',
    tipsEn: 'Fleet Controllers receive both pending approval alerts and maintenance threshold warnings.',
  },
  {
    id: 'app2-step-dashboard',
    number: '02',
    roleCategory: ['approver2'],
    roleLabelTh: 'ผู้ดูแลรถ (Approve 2) · หน้าแรก Dashboard',
    roleLabelEn: 'Fleet Controller (Approve 2) · Home Dashboard',
    titleTh: 'การตรวจสอบรายการรออนุมัติขั้นสุดท้ายและภาพรวมยานพาหนะ',
    titleEn: 'Reviewing Stage 2 Pending Requests & Fleet Health',
    summaryTh:
      'ตรวจสอบรายการคำขอที่รอผู้ดูแลรถอนุมัติขั้นที่ 2 พร้อมติดตามความพร้อมของรถยนต์ส่วนกลางทั้งหมด',
    summaryEn:
      'Action Center for Stage 2 requests cleared by Managers, plus real-time vehicle fleet monitoring.',
    detailsTh: [
      'หน้า Dashboard จะแสดงการ์ดงานค้าง "รอผู้ดูแลรถอนุมัติ (ขั้นที่ 2)" ที่ผ่านการอนุมัติจากผู้จัดการมาแล้ว',
      'ตรวจสอบภาพรวมสถานะรถยนต์ส่วนกลาง: รถที่ว่างพร้อมใช้งาน รถที่ติดภารกิจ และรถที่อยู่ระหว่างซ่อมบำรุง',
      'ตรวจสอบแถบแจ้งเตือนซ่อมบำรุง: รถที่รอบเลขไมล์ใกล้ถึงกำหนดเช็คระยะ, รถที่ยางใกล้ถึงรอบเปลี่ยน, และรถที่ภาษีใกล้หมดอายุ',
    ],
    detailsEn: [
      'The Dashboard highlights Stage 2 pending requests that have been cleared by Stage 1 Managers.',
      'Monitor fleet distribution: Available, Active In Use, and Maintenance vehicles.',
      'Keep track of vehicle maintenance badges: Upcoming mileage checks, tire replacements, and tax expirations.',
    ],
    tipsTh: 'สามารถคลิกปุ่มอนุมัติหรือตรวจสอบสภาพรถได้โดยตรงจากหน้า Dashboard',
    tipsEn: 'Approve requests or inspect vehicle status directly from the Dashboard cards.',
    actionTab: 'dashboard',
    actionLabelTh: 'ไปที่หน้า Dashboard',
    actionLabelEn: 'Open Dashboard',
  },
  {
    id: 'app2-step-approval',
    number: '03',
    roleCategory: ['approver2'],
    roleLabelTh: 'ผู้ดูแลรถ (Approve 2) · การอนุมัติขั้นที่ 2',
    roleLabelEn: 'Fleet Controller (Approve 2) · Final Approval',
    titleTh: 'การตรวจสอบความพร้อมของรถยนต์และการอนุมัติขั้นสุดท้าย',
    titleEn: 'Fleet Readiness Check & Final Stage 2 Approval',
    summaryTh:
      'พิจารณาความพร้อมของตัวรถ ตรวจสอบเลขไมล์ซ่อมบำรุง และกดอนุมัติขั้นสุดท้ายเพื่อให้ผู้ขอนำรถออกเดินทางได้',
    summaryEn:
      'Verify physical vehicle readiness, review maintenance alerts, and grant final approval for departure.',
    detailsTh: [
      'ตรวจสอบรถยนต์ที่ขอใช้ว่าไม่มีภารกิจซ้อนทับ และพร้อมสำหรับการเดินทางตามระยะทางและปลายทางที่ระบุ',
      'ตรวจสอบสถานะแจ้งเตือนซ่อมบำรุง/ยาง/ภาษี: หากรถใกล้ถึงรอบเช็คระยะ สามารถพิจารณาความเหมาะสมของระยะทางที่ต้องเดินทาง',
      'กดปุ่ม "อนุมัติ" เพื่อเปลี่ยนสถานะใบงานเป็น "กำลังใช้งาน (ยังไม่ได้คืนรถ)" เพื่อให้ผู้ขอใช้รถบันทึกไมล์ออกเดินทางและนำรถออกได้',
      'กรณีรถไม่พร้อมหรือไม่เหมาะสม: กดปุ่ม "ไม่อนุมัติ" พร้อมระบุเหตุผล หรือประสานงานให้ผู้ขอเปลี่ยนเป็นรถคันอื่น',
    ],
    detailsEn: [
      'Confirm no scheduling conflict and that the vehicle is physically fit for the requested route.',
      'Review service alerts (mileage threshold, tires, annual tax); evaluate if the vehicle should be dispatched or serviced.',
      'Click "Approve" — status becomes "In Use", permitting the requester to log departure and take the vehicle.',
      'If unfit, click "Reject" with reasons or advise the requester to switch vehicles.',
    ],
    tipsTh: 'สามารถอนุมัติได้ทั้งจากหน้าเว็บ หรือผ่าน LINE Flex Message เช่นเดียวกัน',
    tipsEn: 'Final approval can be executed via web or via LINE Flex Message.',
    actionTab: 'booking',
    actionLabelTh: 'ไปที่หน้าตรวจสอบสถานะ',
    actionLabelEn: 'Open Check Status',
  },
  {
    id: 'app2-step-return-check',
    number: '04',
    roleCategory: ['approver2'],
    roleLabelTh: 'ผู้ดูแลรถ (Approve 2) · การคืนรถ & เลขไมล์',
    roleLabelEn: 'Fleet Controller (Approve 2) · Return Audit & Mileage',
    titleTh: 'การติดตามรถที่กำลังใช้งานและการตรวจสอบการคืนรถ',
    titleEn: 'Monitoring Active Trips & Verifying Vehicle Returns',
    summaryTh:
      'ติดตามสถานะรถยนต์ที่อยู่ระหว่างปฏิบัติงาน ตรวจสอบรูปถ่ายกุญแจ และเลขไมล์ล่าสุดเมื่อผู้ใช้งานคืนรถ',
    summaryEn:
      'Track in-transit vehicles, inspect key drop photos, and verify updated odometer mileage upon return.',
    detailsTh: [
      'ติดตามรายการรถที่สถานะ "กำลังใช้งาน" ในเมนูตรวจสอบสถานะ เพื่อทราบว่ามีรถคันใดออกปฏิบัติภารกิจอยู่บ้าง',
      'เมื่อผู้ขอใช้รถกดยืนยันคืนรถ ระบบจะอัปเดตเลขไมล์ล่าสุดไปยังเมนู "จัดการข้อมูลรถยนต์" โดยอัตโนมัติ',
      'สามารถเปิดดูภาพถ่ายหลักฐานการหย่อนกุญแจลงตู้ ระดับน้ำมันคงเหลือ และเลขไมล์สิ้นสุด เพื่อความถูกต้องเรียบร้อย',
      'หากเลขไมล์ที่บันทึกเข้ามาทำให้รถถึงรอบเช็คระยะ ระบบจะขึ้นเตือนให้ผู้ดูแลรถวางแผนส่งซ่อมบำรุงต่อไป',
    ],
    detailsEn: [
      'Track all "In Use" vehicles under Check Status to know current fleet deployments.',
      'Upon vehicle return, the new ending odometer is synced automatically into Vehicle Management.',
      'Inspect key drop photos, ending fuel levels, and distance traveled to maintain fleet accountability.',
      'If the new odometer triggers a maintenance milestone, the system automatically flags the vehicle for servicing.',
    ],
    tipsTh: 'สามารถตรวจสอบเลขไมล์และสถานะซ่อมบำรุงของรถทุกคันได้ที่เมนู "จัดการข้อมูลรถยนต์"',
    tipsEn: 'Master mileage and maintenance records can be reviewed under "Manage Vehicles".',
    actionTab: 'vehicles',
    actionLabelTh: 'ไปที่หน้าจัดการข้อมูลรถยนต์',
    actionLabelEn: 'Manage Vehicles',
  },
];

export default function BookingManual({
  currentUser,
  language = 'th',
  onNavigateTab,
}: BookingManualProps) {
  const isEn = language === 'en';
  const [searchQuery, setSearchQuery] = useState('');

  // Determine if logged-in user is admin
  const userIsAdmin = isUserAdmin(currentUser);

  // Determine available roles for the current user
  const userRoles = useMemo(() => {
    return getUserRoles(currentUser);
  }, [currentUser]);

  const hasUserRole = userRoles.includes('User') || userRoles.includes('Operator');
  const hasApprove1Role = isUserApprover1(currentUser);
  const hasApprove2Role = isUserApprover2(currentUser);

  // Build the list of valid manual categories for this user
  const availableCategories = useMemo<UserManualRoleType[]>(() => {
    const list: UserManualRoleType[] = [];
    if (hasUserRole || (!hasApprove1Role && !hasApprove2Role)) {
      list.push('user');
    }
    if (hasApprove1Role) {
      list.push('approver1');
    }
    if (hasApprove2Role) {
      list.push('approver2');
    }
    return list;
  }, [hasUserRole, hasApprove1Role, hasApprove2Role]);

  // Active category tab (if user has multiple roles)
  const [activeCategory, setActiveCategory] = useState<UserManualRoleType>('user');

  // Synchronize active category with user's available roles
  useEffect(() => {
    if (availableCategories.length > 0 && !availableCategories.includes(activeCategory)) {
      setActiveCategory(availableCategories[0]);
    }
  }, [availableCategories, activeCategory]);

  // Filter steps according to the logged-in user's role and search query
  const displayedSteps = useMemo(() => {
    return ROLE_MANUAL_STEPS.filter((step) => {
      // Must match the selected activeCategory which is restricted to the user's roles
      const matchRole = step.roleCategory.includes(activeCategory);
      if (!matchRole) return false;

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

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
      return textPool.includes(q);
    });
  }, [activeCategory, searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  // =========================================================================
  // CASE 1: USER IS ADMIN (user ที่เป็น admin ไม่ต้องแสดงคู่มือ)
  // =========================================================================
  if (userIsAdmin) {
    return (
      <div className="space-y-6 pb-12" id="booking-manual-container">
        {/* Admin Header Banner */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700">
                <Shield className="w-4 h-4 text-indigo-600" />
                <span>{isEn ? 'System Administrator' : 'สิทธิ์ผู้ดูแลระบบ (Admin)'}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {isEn ? 'Booking Manual' : 'คู่มือการจองรถ'}
              </h1>
            </div>
            {currentUser && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 self-start sm:self-auto">
                <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>{currentUser.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold">
                  Admin
                </span>
              </div>
            )}
          </div>

          {/* Admin Notice Card: user ที่เป็น admin ไม่ต้องแสดงคู่มือ */}
          <div className="pt-8 pb-4 max-w-3xl">
            <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 border border-indigo-100 shadow-2xs space-y-5">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Shield className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  {isEn
                    ? 'No Booking Manual Required for Administrator'
                    : 'สิทธิ์ผู้ดูแลระบบ (Admin) ไม่ต้องแสดงคู่มือการจองรถ'}
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {isEn
                    ? 'You are logged in with Administrator privileges. As an Admin, you have full access to manage vehicles, configure users and permissions, inspect usage reports, and audit system activities. Standard vehicle booking guides are tailored for general users and approvers.'
                    : 'ท่านกำลังเข้าสู่ระบบด้วยสิทธิ์ผู้ดูแลระบบ (Admin) ซึ่งมีสิทธิ์บริหารจัดการระบบทั้งหมด (จัดการข้อมูลรถยนต์, กำหนดผู้ใช้งาน, ตรวจสอบรายงานการใช้รถยนต์ และประวัติระบบ Audit Log) ระบบจึงไม่ต้องแสดงคู่มือขั้นตอนการจองรถสำหรับสิทธิ์นี้'}
                </p>
              </div>

              {/* Quick links to Admin modules */}
              {onNavigateTab && (
                <div className="pt-2 border-t border-slate-200/80">
                  <div className="text-xs font-semibold text-slate-500 mb-3">
                    {isEn ? 'Quick Administrative Navigation' : 'เมนูหลักสำหรับการบริหารจัดการระบบ:'}
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onNavigateTab('dashboard')}
                      className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
                    >
                      <ClipboardList className="w-4 h-4 text-indigo-600" />
                      <span>{isEn ? 'Dashboard' : 'แดชบอร์ด (หน้าแรก)'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('users')}
                      className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
                    >
                      <Users className="w-4 h-4 text-blue-600" />
                      <span>{isEn ? 'User Management' : 'กำหนดผู้ใช้งาน'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('vehicles')}
                      className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
                    >
                      <Car className="w-4 h-4 text-emerald-600" />
                      <span>{isEn ? 'Manage Vehicles' : 'จัดการข้อมูลรถยนต์'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('report')}
                      className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                      <span>{isEn ? 'Usage Reports' : 'รายงานการใช้รถยนต์'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('audit')}
                      className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-2xs"
                    >
                      <History className="w-4 h-4 text-purple-600" />
                      <span>{isEn ? 'Audit Log' : 'ประวัติระบบ (Audit Log)'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    );
  }

  // =========================================================================
  // CASE 2: REGULAR USERS & APPROVERS (แสดงตามสิทธิของ user ที่ login)
  // =========================================================================
  const getCategoryLabel = (cat: UserManualRoleType) => {
    switch (cat) {
      case 'user':
        return isEn ? 'Requester (User)' : 'ผู้ขอใช้รถ (User)';
      case 'approver1':
        return isEn ? 'Manager (Approve 1)' : 'ผู้จัดการ (Approve 1)';
      case 'approver2':
        return isEn ? 'Fleet Controller (Approve 2)' : 'ผู้ดูแลรถ (Approve 2)';
    }
  };

  return (
    <div className="space-y-6 pb-12" id="booking-manual-container">
      {/* Top Header Card */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pb-6 border-b border-slate-200">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{isEn ? 'Standard Operating Procedure' : 'เอกสารคู่มือการใช้งานระบบ'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-indigo-700">
                {isEn
                  ? `Role: ${getCategoryLabel(activeCategory)}`
                  : `คู่มือสำหรับสิทธิ์: ${getCategoryLabel(activeCategory)}`}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums font-mono text-slate-600">
                {isEn ? `${displayedSteps.length} Steps` : `${displayedSteps.length} ขั้นตอน`}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {isEn
                ? `Booking Manual · ${getCategoryLabel(activeCategory)}`
                : `คู่มือการใช้งานระบบจองรถยนต์ส่วนกลาง · ${getCategoryLabel(activeCategory)}`}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {activeCategory === 'user' &&
                (isEn
                  ? 'Step-by-step guide for booking vehicles, checking real-time availability, recording pre-departure odometer & fuel, and confirming vehicle return with key drop photo.'
                  : 'ขั้นตอนการใช้งานสำหรับผู้ขอใช้รถ ตั้งแต่การตรวจสอบรถว่าง การสร้างคำขอจอง การบันทึกเลขไมล์และระดับน้ำมันก่อนเดินทาง จนถึงการถ่ายภาพหย่อนกุญแจคืนรถ')}
              {activeCategory === 'approver1' &&
                (isEn
                  ? 'Operational manual for Stage 1 Department Managers to review mission necessity and approve/reject bookings via Dashboard or LINE.'
                  : 'ขั้นตอนสำหรับผู้จัดการ (ผู้อนุมัติขั้นที่ 1) ในการตรวจสอบงานค้าง พิจารณาอนุมัติหรือปฏิเสธคำขอใช้รถผ่านหน้า Dashboard และ LINE')}
              {activeCategory === 'approver2' &&
                (isEn
                  ? 'Operational manual for Stage 2 Fleet Controllers to check vehicle readiness, maintenance alerts, grant final approval, and audit returns.'
                  : 'ขั้นตอนสำหรับผู้ดูแลรถ (ผู้อนุมัติขั้นที่ 2) ในการตรวจสอบความพร้อมของรถยนต์ส่วนกลาง การแจ้งเตือนเช็คระยะ/ยาง/ภาษี และการอนุมัติขั้นสุดท้าย')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0 print:hidden">
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('dashboard')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-2xs"
              >
                <ClipboardList className="w-4 h-4" />
                <span>{isEn ? 'Go to Dashboard' : 'ไปที่หน้า Dashboard'}</span>
              </button>
            )}
            {activeCategory === 'user' && onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('calendar')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <CalendarDays className="w-4 h-4" />
                <span>{isEn ? 'Open Calendar' : 'ไปหน้าจองรถยนต์'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4" />
              <span>{isEn ? 'Print / PDF' : 'พิมพ์คู่มือ / PDF'}</span>
            </button>
          </div>
        </div>

        {/* User Role Info Banner */}
        <div className="pt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <span className="font-semibold text-slate-700">
              {isEn ? 'Logged in as:' : 'เข้าสู่ระบบด้วย:'}
            </span>
            <span className="font-medium text-slate-900">{currentUser?.name || 'User'}</span>
            {currentUser?.department && (
              <>
                <span aria-hidden="true" className="text-slate-300">|</span>
                <span className="text-slate-500">{currentUser.department}</span>
              </>
            )}
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 font-medium text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>
              {isEn
                ? `Showing guide tailored for: ${getCategoryLabel(activeCategory)}`
                : `แสดงคู่มือตามสิทธิ์ของคุณ: ${getCategoryLabel(activeCategory)}`}
            </span>
          </div>
        </div>
      </section>

      {/* Role Selection (shown ONLY if user possesses more than 1 role) and Search Toolbar */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 print:hidden">
        {/* If user has multiple roles (e.g. User + Approve 1), allow toggling between THEIR roles only */}
        {availableCategories.length > 1 ? (
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <span className="text-xs font-semibold text-slate-500 px-2 py-1">
              {isEn ? 'Switch Role Guide:' : 'เลือกบทบาท:'}
            </span>
            {availableCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeCategory === cat
                    ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-100 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {getCategoryLabel(cat)}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs font-semibold text-slate-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              {isEn
                ? `Active Permission: ${getCategoryLabel(activeCategory)}`
                : `สิทธิ์การใช้งาน: ${getCategoryLabel(activeCategory)}`}
            </span>
          </div>
        )}

        {/* Search Input within the role's steps */}
        <div className="relative min-w-[260px] max-w-md w-full md:w-auto">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isEn
                ? 'Search within this guide (e.g. dashboard, mileage, return)...'
                : 'ค้นหาในคู่มือนี้ (เช่น dashboard, งานค้าง, เลขไมล์, คืนรถ)...'
            }
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-800"
          />
        </div>
      </section>

      {/* Detailed Step-by-Step Sections */}
      <section className="space-y-4">
        {displayedSteps.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-700">
              {isEn ? 'No matching manual topics found.' : 'ไม่พบหัวข้อคู่มือที่ตรงกับคำค้นหา'}
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
            >
              {isEn ? 'Clear Search' : 'ล้างคำค้นหา'}
            </button>
          </div>
        ) : (
          displayedSteps.map((step) => (
            <article
              key={step.id}
              className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 transition-colors hover:border-slate-300 shadow-2xs"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="space-y-1.5">
                  <div className="text-xs text-slate-500 font-semibold flex items-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                    <span>{isEn ? step.roleLabelEn : step.roleLabelTh}</span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                    <span className="font-mono tabular-nums text-indigo-600 mr-2">
                      {step.number}.
                    </span>
                    {isEn ? step.titleEn : step.titleTh}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {isEn ? step.summaryEn : step.summaryTh}
                  </p>
                </div>

                {step.actionTab && onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab(step.actionTab!)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start print:hidden shadow-2xs"
                  >
                    <span>{isEn ? step.actionLabelEn : step.actionLabelTh}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Step Details Checklist */}
              <div className="pt-4 space-y-2.5">
                {(isEn ? step.detailsEn : step.detailsTh).map((detail, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 leading-relaxed"
                  >
                    <span className="font-mono text-xs font-bold text-indigo-500/80 tabular-nums mt-0.5 shrink-0 bg-indigo-50 px-1.5 py-0.5 rounded">
                      {step.number}.{idx + 1}
                    </span>
                    <span>{detail}</span>
                  </div>
                ))}
              </div>

              {/* Tips Callout */}
              {(step.tipsTh || step.tipsEn) && (
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-600 bg-slate-50/70 -mx-6 -mb-6 p-4 sm:-mx-7 sm:-mb-7 sm:p-5 rounded-b-2xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800 mr-1.5">
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
    </div>
  );
}
