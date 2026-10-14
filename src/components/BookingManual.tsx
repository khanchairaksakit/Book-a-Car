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
  onNavigateTab?: (tab: 'dashboard' | 'calendar' | 'booking' | 'vehicles' | 'users' | 'report') => void;
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
  actionTab?: 'dashboard' | 'calendar' | 'booking' | 'vehicles' | 'users' | 'report';
  actionLabelTh?: string;
  actionLabelEn?: string;
}

const MANUAL_STEPS: ManualStep[] = [
  {
    id: 'step-login',
    number: '01',
    roleCategory: ['all', 'requester', 'approver', 'admin'],
    roleLabelTh: 'ทุกสิทธิ์การใช้งาน · การเข้าใช้งานระบบ',
    roleLabelEn: 'All Roles · Signing In',
    titleTh: 'การเข้าสู่ระบบและตรวจสอบสิทธิ์การใช้งาน',
    titleEn: 'Signing In & Checking Account Permissions',
    summaryTh:
      'เข้าสู่ระบบด้วยชื่อผู้ใช้ (Username) รหัสพนักงาน หรืออีเมลองค์กรที่มีอยู่ในระบบ พร้อมรหัสผ่านที่ถูกต้องโดยไม่มีเว้นวรรค',
    summaryEn:
      'Sign in using your registered corporate Username, Employee Code, or Email and password without spaces.',
    detailsTh: [
      'กรอกชื่อผู้ใช้ (Username) รหัสพนักงาน หรืออีเมล และรหัสผ่านในหน้าเข้าสู่ระบบ (ห้ามเคาะเว้นวรรคก่อนหรือหลังชื่อผู้ใช้และรหัสผ่าน โดยระบบจะอนุญาตเฉพาะผู้ใช้งานที่มีรายชื่ออยู่ในฐานข้อมูลจริงเท่านั้น)',
      'เมื่อเข้าสู่ระบบสำเร็จ ระบบจะนำท่านเข้าสู่หน้า "Dashboard" เป็นหน้าแรกโดยอัตโนมัติ เพื่อให้ตรวจสอบรายการงานหรือเอกสารที่ค้างดำเนินการได้ทันที',
      'ตรวจสอบชื่อ-นามสกุล แผนก/ฝ่าย และบทบาทสิทธิ์ของท่านได้ที่แถบเมนูด้านซ้ายบน (เช่น ผู้ขอใช้รถ, ผู้จัดการ, ผู้ดูแลรถ, ผู้ดูแลระบบ)',
      'หากต้องการรับแจ้งเตือนผ่าน LINE สามารถผูก LINE User ID ได้ที่เมนู "กำหนดผู้ใช้งาน" หรือตั้งค่าการแจ้งเตือน LINE',
    ],
    detailsEn: [
      'Enter your registered Username, Employee Code, or Email and Password without any whitespace.',
      'Upon signing in, you are automatically directed to the "Dashboard" as your home screen to review any pending tasks.',
      'Verify your name, department/division, and assigned roles in the left navigation sidebar.',
      'Link your LINE User ID to receive real-time LINE Flex Message notifications.',
    ],
    tipsTh: 'การแจ้งเตือนแบบป๊อปอัพบนหน้าจอจะแสดงเฉพาะผู้ใช้งานที่เกี่ยวข้องกับรายการนั้นๆ และจะปิดตัวเองอัตโนมัติภายใน 5 วินาที',
    tipsEn: 'In-app notifications are targeted only to relevant users and auto-dismiss after 5 seconds.',
  },
  {
    id: 'step-dashboard',
    number: '02',
    roleCategory: ['all', 'requester', 'approver', 'admin'],
    roleLabelTh: 'ทุกสิทธิ์การใช้งาน · หน้าแรกหลังเข้าสู่ระบบ (Home)',
    roleLabelEn: 'All Roles · Home Dashboard & Action Center',
    titleTh: 'การใช้งานหน้า Dashboard (ศูนย์รวมเอกสารและรายการที่ค้างดำเนินการ)',
    titleEn: 'Using the Dashboard (Pending Tasks, Documents & Fleet Overview)',
    summaryTh:
      'หน้าแรกที่ผู้ใช้งานทุกคนจะพบทันทีเมื่อเข้าสู่ระบบ รวบรวมเอกสารคำขอ ใบงานที่รออนุมัติ และภารกิจการใช้รถที่ยังดำเนินการไม่เสร็จสิ้น พร้อมภาพรวมรถยนต์ส่วนกลางในหน้าเดียว',
    summaryEn:
      'Your default landing page upon login, consolidating all pending approvals, active vehicle trips awaiting action, and real-time fleet availability.',
    detailsTh: [
      'ศูนย์รวมรายการและเอกสารที่ค้างดำเนินการ: ระบบจะคัดกรองเฉพาะใบงานหรือเอกสารที่ท่านต้องดำเนินการต่อมาแสดงให้เห็นอย่างชัดเจนที่ส่วนบนของหน้า Dashboard เพื่อให้กดเข้าไปจัดการจนเสร็จสิ้นได้ทันทีโดยไม่ต้องค้นหาเอง',
      'สำหรับผู้จัดการ (Approve 1): แสดงรายการเอกสารใบงานขอใช้รถในแผนก/ฝ่ายที่ "รอผู้จัดการอนุมัติ (ขั้นที่ 1)" สามารถกดดูรายละเอียดภารกิจและกดปุ่ม "อนุมัติ" หรือ "ไม่อนุมัติ (Reject)" ได้จากหน้า Dashboard ทันที',
      'สำหรับผู้ดูแลรถ (Approve 2): แสดงรายการเอกสารใบงานที่ผ่านผู้จัดการแล้วและ "รอผู้ดูแลรถอนุมัติ (ขั้นที่ 2)" เพื่อให้ตรวจสอบความพร้อมของรถยนต์และกดอนุมัติขั้นสุดท้ายได้อย่างรวดเร็ว',
      'สำหรับผู้ขอใช้รถ (Operator): แสดงใบงานที่อยู่ในสถานะ "กำลังใช้งาน (ยังไม่ได้คืนรถ)" เพื่อให้กด "บันทึกข้อมูลก่อนออกเดินทาง" หรือกด "เสร็จสิ้นภารกิจ & คืนรถยนต์ส่วนกลาง" ได้ทันที รวมถึงแสดงรายการคำขอของตนเองที่ยังอยู่ระหว่างรอการอนุมัติ',
      'ภาพรวมจองรถยนต์ส่วนกลาง: แสดงสรุปจำนวนรถยนต์ที่ว่างพร้อมใช้งาน รถที่กำลังปฏิบัติภารกิจ รถที่อยู่ระหว่างซ่อมบำรุง และตารางคิวการใช้รถประจำวัน เพื่อช่วยวางแผนการเดินทางได้อย่างแม่นยำ',
    ],
    detailsEn: [
      'Pending Action Center: Automatically highlights documents and bookings requiring your immediate attention right at the top of the Dashboard.',
      'For Managers (Approve 1): Displays Stage 1 pending requests with direct buttons to review details, Approve, or Reject.',
      'For Fleet Controllers (Approve 2): Displays Stage 2 pending requests ready for final vehicle check and approval.',
      'For Requesters (Operators): Shows active "In Use" trips requiring pre-departure logging or vehicle return, plus your requests currently awaiting approval.',
      'Central Fleet Overview: Displays real-time counts of available, in-use, and maintenance vehicles alongside the daily schedule.',
    ],
    tipsTh: 'หากมีตัวเลขแจ้งเตือนสีแดงหรือสีส้มปรากฏในหน้า Dashboard แปลว่าท่านมีเอกสารใบงานค้างอยู่ สามารถคลิกปุ่มบนการ์ดใบงานนั้นเพื่อดำเนินการต่อให้เสร็จสิ้นได้ทันที',
    tipsEn: 'Action cards on the Dashboard let you complete approvals, pre-departure logs, and vehicle returns in one click.',
    actionTab: 'dashboard',
    actionLabelTh: 'ไปที่หน้า Dashboard',
    actionLabelEn: 'Open Dashboard',
  },
  {
    id: 'step-booking',
    number: '03',
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
      'การแจ้งเตือนการซ่อมบำรุงรถยนต์ (Popup รับทราบ): หากรถคันที่เลือกรอบเลขไมล์ใกล้ถึงกำหนดเช็คระยะ (ก่อน 1,000 กม. หรือเลยกำหนดแล้ว), ยางใกล้ถึงกำหนดเปลี่ยน (ก่อน 1,000 กม. หรือเลยกำหนดแล้ว) หรือภาษีประจำปีใกล้หมดอายุ (ก่อนหมดอายุ 1 เดือน หรือหมดอายุแล้ว) ระบบจะแสดงหน้าต่าง Popup แจ้งเตือนรายละเอียดให้ผู้ขอจองกดปุ่ม "รับทราบและดำเนินการต่อ" (หรือเลือกเปลี่ยนรถคันอื่น)',
      'เลือกผู้อนุมัติลำดับที่ 1 (ผู้จัดการ) และผู้อนุมัติลำดับที่ 2 (ผู้ดูแลรถ) จากนั้นกดปุ่มยืนยันการจอง',
      'ระบบจะสร้างเลขที่ใบงานอัตโนมัติในรูปแบบ AX-YYYYMMDD-XXX (เช่น AX-20261008-001) พร้อมส่งรายการไปแสดงในหน้า Dashboard ของผู้อนุมัติ และส่งแจ้งเตือนทาง LINE ให้ผู้อนุมัติและผู้ดูแลรถ (พร้อมระบุสถานะแจ้งเตือนเช็คระยะ/ยาง/ภาษี หากมี) ทันที',
    ],
    detailsEn: [
      'Open "Booking Calendar" and click on your desired departure date or the "+ Book Vehicle" button.',
      'Select start and end date/time; the system automatically filters available vehicles for that slot.',
      'Select a vehicle, enter destination, passenger count, contact phone, and trip purpose.',
      'Confirm Approver 1 (Manager) and Approver 2 (Fleet Controller), then submit.',
      'An automatic job number (AX-YYYYMMDD-XXX) is generated, appearing on the Approver’s Dashboard and sent via LINE.',
    ],
    tipsTh: 'ไม่สามารถเลือกเวลาสิ้นสุดที่ย้อนหลังกว่าเวลาเริ่มต้น หรือจองซ้อนทับกับใบงานที่กำลังใช้งานอยู่ในช่วงเวลาเดียวกันได้',
    tipsEn: 'Overlapping time slots on the same vehicle are automatically prevented.',
    actionTab: 'calendar',
    actionLabelTh: 'ไปที่หน้าปฏิทินการจองรถ',
    actionLabelEn: 'Open Booking Calendar',
  },
  {
    id: 'step-approval',
    number: '04',
    roleCategory: ['all', 'approver', 'requester'],
    roleLabelTh: 'ผู้จัดการ & ผู้ดูแลรถ · การพิจารณาอนุมัติ 2 ขั้นตอน',
    roleLabelEn: 'Manager & Fleet Controller · 2-Stage Approval Workflow',
    titleTh: 'ขั้นตอนการอนุมัติคำขอใช้รถยนต์ส่วนกลาง (2 ลำดับขั้น)',
    titleEn: 'Two-Stage Approval Process (Manager & Fleet Controller)',
    summaryTh:
      'ใบงานทุกใบต้องผ่านการพิจารณาจาก "ผู้จัดการ" (ลำดับที่ 1) และ "ผู้ดูแลรถ" (ลำดับที่ 2) โดยสามารถกดอนุมัติได้จากหน้า Dashboard เมนูตรวจสอบสถานะ หรือผ่าน LINE',
    summaryEn:
      'Every request passes through Stage 1 (Manager) and Stage 2 (Fleet Controller) via the Dashboard, Check Status menu, or LINE.',
    detailsTh: [
      'ขั้นที่ 1 (รอผู้จัดการ): เมื่อผู้จัดการเข้าสู่ระบบ หน้า Dashboard จะแจ้งเตือนใบงานที่รออนุมัติทันที ผู้จัดการสามารถตรวจสอบภารกิจและกด "อนุมัติ" หรือ "ไม่อนุมัติ" (พร้อมระบุเหตุผล) ได้จากหน้า Dashboard, เมนู "ตรวจสอบสถานะ" หรือผ่านการ์ดแจ้งเตือนใน LINE',
      'ขั้นที่ 2 (รอผู้ดูแลรถ): เมื่อผู้จัดการอนุมัติแล้ว ใบงานจะถูกส่งต่อไปยังหน้า Dashboard และ LINE ของ "ผู้ดูแลรถ" เพื่อตรวจสอบความพร้อมของรถยนต์และกดอนุมัติขั้นสุดท้าย',
      'เมื่ออนุมัติครบทั้ง 2 ขั้นตอน สถานะใบงานจะเปลี่ยนเป็น "กำลังใช้งาน (ยังไม่ได้คืนรถ)" เพื่อให้ผู้ขอใช้รถบันทึกข้อมูลการเดินทางและนำรถออกปฏิบัติงานได้',
      'กรณีไม่อนุมัติ (Reject) ในขั้นตอนใดขั้นตอนหนึ่ง สถานะจะเปลี่ยนเป็น "ผู้จัดการ Reject" หรือ "ผู้ดูแลรถ Reject" พร้อมแสดงเหตุผลในใบงาน',
    ],
    detailsEn: [
      'Stage 1 (Pending Manager): Shows up immediately on the Manager’s Dashboard. The Manager reviews trip necessity and approves or rejects with a reason via Dashboard, "Check Status", or LINE.',
      'Stage 2 (Pending Fleet Controller): Once Stage 1 is approved, the Fleet Controller sees the pending task on their Dashboard and LINE to grant final approval.',
      'Upon Stage 2 approval, the booking status becomes "In Use (Not Yet Returned)" and notifies the requester.',
      'If rejected at either stage, the status updates with the specific rejection reason.',
    ],
    tipsTh: 'ในหน้าตรวจสอบสถานะ สามารถกรองดูใบงานตามสถานะ "รอผู้จัดการ", "รอผู้ดูแลรถ", "กำลังใช้งาน" (รถที่ยืมและยังไม่ได้คืน), "เสร็จสิ้น" และ "ยกเลิก" ได้อย่างสะดวก',
    tipsEn: 'Use status filters in Check Status to view Pending Manager, Pending Fleet Controller, In Use, Completed, or Cancelled bookings.',
    actionTab: 'booking',
    actionLabelTh: 'ไปที่หน้าตรวจสอบสถานะ',
    actionLabelEn: 'Open Status & Approvals',
  },
  {
    id: 'step-departure',
    number: '05',
    roleCategory: ['all', 'requester'],
    roleLabelTh: 'ผู้ขอใช้รถ (Operator) · ก่อนออกเดินทาง',
    roleLabelEn: 'Requester (Operator) · Pre-Departure Record',
    titleTh: 'การบันทึกข้อมูลก่อนออกเดินทาง (เลขไมล์เริ่มต้น & ระดับน้ำมัน)',
    titleEn: 'Recording Pre-Departure Data (Start Mileage & Fuel Gauge)',
    summaryTh:
      'เมื่อใบงานเปลี่ยนเป็นสถานะ "กำลังใช้งาน" แล้ว ก่อนนำรถออกเดินทางให้บันทึกเลขไมล์เริ่มต้นและระดับน้ำมันเริ่มต้น',
    summaryEn:
      'Before departing in an approved vehicle (status: In Use), record the starting odometer mileage and fuel level.',
    detailsTh: [
      'ที่หน้า "Dashboard" (ในหัวข้อรายการค้างดำเนินการ) หรือที่เมนู "ตรวจสอบสถานะ" กดปุ่ม "บันทึกข้อมูลก่อนออกเดินทาง" บนใบงานที่กำลังใช้งาน',
      'เลขไมล์เริ่มต้น (km.): ระบบจะดึงเลขไมล์ล่าสุดของรถคันนั้นมาแสดงให้อัตโนมัติ โดยผู้ใช้งานสามารถตรวจสอบและปรับแก้ตัวเลขให้ตรงกับหน้าปัดจริงได้',
      'ระดับน้ำมันเริ่มต้น: เลือกตัวเลือกระดับน้ำมัน (เต็มถัง, 3/4, 1/2, 1/4, ใกล้หมด) โดยเข็มกราฟิกหน้าปัดระดับน้ำมันจะขยับตามตัวเลือกที่เลือกทันที',
      'กดปุ่ม "บันทึกข้อมูลออกเดินทาง" (ขั้นตอนนี้ไม่ต้องถ่ายภาพ เพื่อให้สะดวกรวดเร็วในการออกเดินทาง)',
    ],
    detailsEn: [
      'On the "Dashboard" (under Pending Actions) or in "Check Status", click "Record Pre-Departure Info" on your active trip.',
      'Starting Mileage (km.): Automatically pre-filled from the vehicle’s current odometer, editable if needed.',
      'Starting Fuel Level: Select Full, 3/4, 1/2, or 1/4 — the interactive fuel gauge needle moves to match your selection.',
      'Click Save to confirm departure (no photo upload required at departure).',
    ],
    tipsTh: 'การบันทึกข้อมูลก่อนออกเดินทางเป็นขั้นตอนบังคับก่อนที่จะสามารถกดคืนรถเมื่อเสร็จสิ้นภารกิจได้',
    tipsEn: 'Pre-departure mileage and fuel must be recorded before you can complete and return the vehicle.',
    actionTab: 'dashboard',
    actionLabelTh: 'ไปที่หน้า Dashboard เพื่อบันทึกก่อนเดินทาง',
    actionLabelEn: 'Go to Dashboard',
  },
  {
    id: 'step-return',
    number: '06',
    roleCategory: ['all', 'requester', 'approver'],
    roleLabelTh: 'ผู้ขอใช้รถ (Operator) · เสร็จสิ้นภารกิจและคืนรถ',
    roleLabelEn: 'Requester (Operator) · Mission Complete & Vehicle Return',
    titleTh: 'การยืนยันคืนรถยนต์ส่วนกลาง การคืนรถก่อนกำหนด และอัปเดตเลขไมล์อัตโนมัติ',
    titleEn: 'Returning the Vehicle, Early Return Policy & Auto Mileage Sync',
    summaryTh:
      'เมื่อกลับมาถึงบริษัท ให้กดคืนรถจากหน้า Dashboard หรือหน้าตรวจสอบสถานะ พร้อมบันทึกเลขไมล์สิ้นสุด ระดับน้ำมัน และถ่ายภาพขณะหย่อนกุญแจลงตู้',
    summaryEn:
      'Upon returning, enter the ending mileage, fuel level, and capture a photo of returning the key to the drop box.',
    detailsTh: [
      'กดปุ่ม "เสร็จสิ้นภารกิจ & คืนรถยนต์ส่วนกลาง" จากรายการค้างในหน้า Dashboard หรือในเมนูตรวจสอบสถานะ',
      'กรณีคืนรถก่อนกำหนดเวลาสิ้นสุดที่จองไว้: ในหน้าต่างกดคืนรถ ระบบจะแสดงป้ายแจ้งเตือน "การคืนรถก่อนกำหนด หากต้องการยืมให้ขอในระบบใหม่" เพื่อให้ผู้ขอใช้รถรับทราบว่าเมื่อกดยืนยันคืนรถแล้ว ใบงานนี้จะถือว่าเสร็จสิ้นทันทีและสถานะรถจะกลับไปว่างพร้อมให้ผู้อื่นจองต่อ',
      'กรอก "เลขไมล์สิ้นสุด (km.)" โดยต้องมีค่าไม่น้อยกว่าเลขไมล์เริ่มต้น ระบบจะคำนวณระยะทางที่ใช้เดินทางในภารกิจให้อัตโนมัติ',
      'เลือกระดับน้ำมันคงเหลือจากหน้าปัดกราฟิกระดับน้ำมัน (เต็มถัง, 3/4, 1/2, 1/4, ใกล้หมด)',
      'ถ่ายภาพหลักฐาน "เฉพาะขณะหย่อนกุญแจลงตู้คืนกุญแจ" (สามารถเปิดกล้องถ่ายสดหรืออัปโหลดรูปภาพ)',
      'เมื่อกดยืนยันคืนรถแล้ว: (1) สถานะใบงานจะเปลี่ยนเป็น "เสร็จสิ้น" และรายการจะหายไปจากงานค้างในหน้า Dashboard (2) สถานะรถยนต์จะกลับมาว่างพร้อมใช้งานและอัปเดตเลขไมล์ล่าสุดไปยังเมนู "จัดการข้อมูลรถยนต์" อัตโนมัติ และ (3) ส่ง LINE แจ้งเตือนยืนยันการคืนรถ',
    ],
    detailsEn: [
      'Click "Complete Mission & Return Vehicle" from your Dashboard pending list or Check Status page.',
      'Early Return Notice: If returning before the scheduled end time, the return modal displays a notice: "Early return — if you need the vehicle again, please submit a new request." Once returned, the vehicle immediately becomes available.',
      'Enter the Ending Mileage (must be >= starting mileage); total distance traveled is calculated automatically.',
      'Select the ending fuel level on the interactive fuel gauge.',
      'Take or upload a photo of dropping the vehicle key into the return box.',
      'Upon confirmation: booking status changes to "Completed", vehicle status returns to "Available" with updated master mileage, and LINE notifications are sent.',
    ],
    tipsTh: 'หากคืนรถก่อนกำหนดและต้องการนำรถออกไปใช้งานอีกครั้งในภายหลัง จะต้องสร้างใบงานขอใช้รถใหม่ในระบบเสมอ',
    tipsEn: 'Once a vehicle is returned early, a new booking request must be submitted for any subsequent use.',
    actionTab: 'booking',
    actionLabelTh: 'ไปที่หน้าตรวจสอบสถานะ / คืนรถ',
    actionLabelEn: 'Open Check Status',
  },
  {
    id: 'step-cancel-admin',
    number: '07',
    roleCategory: ['all', 'requester', 'admin'],
    roleLabelTh: 'การจัดการระบบ · รายงานการใช้รถยนต์ & Audit Log',
    roleLabelEn: 'System Administration · Fleet Reports, Permissions & Audit Log',
    titleTh: 'การยกเลิกการจอง การกำหนดสิทธิ์เมนู รายงานการใช้รถยนต์ และ Audit Log',
    titleEn: 'Cancelling Bookings, Menu Permissions, Vehicle Usage Reports & Audit Log',
    summaryTh:
      'แนวทางการยกเลิกใบงานของผู้ขอใช้รถ และการบริหารจัดการสิทธิ์ผู้ใช้งาน รายงานการใช้รถยนต์ รวมถึงการตรวจสอบประวัติการใช้งานระบบ (Audit Log) สำหรับผู้ดูแลระบบ',
    summaryEn:
      'Guidelines for cancelling bookings, configuring role-based menu permissions, viewing Vehicle Usage Reports, and auditing system history.',
    detailsTh: [
      'การยกเลิกใบงาน (Cancel): ผู้ขอใช้รถสามารถกด "ยกเลิกการจอง" ในใบงานของตนเองที่ยังไม่ได้นำรถออกเดินทางได้ (สถานะจะเปลี่ยนเป็นยกเลิก แต่ประวัติใบงานยังอยู่ในระบบเพื่อความโปร่งใส)',
      'การลบใบงานออกจากระบบ (Delete): สิทธิ์การลบใบงานออกจากฐานข้อมูลถาวรสงวนไว้สำหรับ "ผู้ดูแลระบบ (Admin)" เท่านั้น',
      'ตารางกำหนดสิทธิ์การใช้งาน (สำหรับ Admin): ในเมนู "กำหนดผู้ใช้งาน" ผู้ดูแลระบบสามารถกำหนดสิทธิ์ให้แต่ละบทบาทมองเห็นหรือเข้าถึงเมนูต่างๆ ได้ตามต้องการ รวมถึงเมนู "รายงานการใช้รถยนต์", "ประวัติการใช้งาน (Audit Log)" และ "คู่มือการใช้งาน"',
      'รายงานการใช้รถยนต์ & Audit Log: ตรวจสอบสถิติระยะทางและประวัติการใช้รถได้ที่เมนู "รายงานการใช้รถยนต์" และตรวจสอบประวัติการทำรายการย้อนหลัง (ใครทำอะไร เวลาใด) ได้ที่เมนู "Audit Log"',
    ],
    detailsEn: [
      'Cancelling a Booking: Requesters can cancel their own upcoming trips before departure.',
      'Deleting a Record: Permanent deletion of booking records is strictly restricted to Administrators.',
      'Role Permission Matrix (Admin): Configure which roles can view each menu, including Vehicle Usage Reports, Audit Log, and User Manual.',
      'Vehicle Usage Reports & Audit Log: Analyze fleet mileage/utilization in "Vehicle Usage Reports" and track all user actions in "Audit Log".',
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
    questionTh: 'หน้า Dashboard แสดงข้อมูลอะไรบ้าง และช่วยให้ทำงานสะดวกขึ้นอย่างไร?',
    questionEn: 'What does the Dashboard show, and how does it help my workflow?',
    answerTh:
      'หน้า Dashboard เป็นหน้าแรกที่แสดงทันทีหลังเข้าสู่ระบบ โดยจะรวบรวม "รายการหรือเอกสารที่ค้างดำเนินการ" ของผู้ใช้งานท่านนั้นมาแสดงไว้ในที่เดียว เช่น ผู้จัดการและผู้ดูแลรถจะเห็นใบงานที่รออนุมัติและกดอนุมัติได้ทันที ส่วนผู้ขอใช้รถจะเห็นใบงานที่กำลังใช้งานเพื่อกดบันทึกไมล์ก่อนเดินทางหรือกดคืนรถได้ทันที พร้อมแสดงภาพรวมสถานะรถยนต์ส่วนกลางประจำวัน',
    answerEn:
      'The Dashboard is your home screen upon login. It consolidates all pending tasks and documents requiring your action (pending approvals for Approvers, active trips needing departure/return logs for Operators) alongside a live overview of fleet availability.',
  },
  {
    questionTh: 'ทำไมกดปุ่ม "เสร็จสิ้นภารกิจ & คืนรถ" ยังไม่ได้?',
    questionEn: 'Why is the "Return Vehicle" button not available yet?',
    answerTh:
      'ต้องให้ใบงานได้รับการอนุมัติครบทั้ง 2 ขั้นตอน (ผู้จัดการ และ ผู้ดูแลรถ) จนสถานะเป็น "กำลังใช้งาน (ยังไม่ได้คืนรถ)" และผู้ขอใช้รถต้องกด "บันทึกข้อมูลก่อนออกเดินทาง" (กรอกไมล์เริ่มต้นและระดับน้ำมันเริ่มต้น) ก่อน จึงจะปรากฏปุ่มยืนยันการคืนรถ',
    answerEn:
      'The booking must first be approved by both Stage 1 (Manager) and Stage 2 (Fleet Controller) to reach "In Use" status, and you must complete the "Pre-Departure Record" first.',
  },
  {
    questionTh: 'หากเสร็จภารกิจเร็วกว่ากำหนด และกดคืนรถก่อนเวลาที่จองไว้ จะเป็นอย่างไร?',
    questionEn: 'What happens if I finish my mission early and return the vehicle ahead of schedule?',
    answerTh:
      'เมื่อกดปุ่มคืนรถก่อนเวลาสิ้นสุดที่ระบุไว้ในใบงาน หน้าต่างคืนรถจะแสดงข้อความแจ้งเตือนว่า "การคืนรถก่อนกำหนด หากต้องการยืมให้ขอในระบบใหม่" เมื่อยืนยันการคืนรถแล้ว สถานะรถจะกลับมาว่างพร้อมใช้งานทันที หากท่านต้องการใช้รถอีกครั้งจะต้องสร้างใบงานขอใช้รถใหม่ในระบบ',
    answerEn:
      'When returning a vehicle ahead of schedule, the return modal displays a notice: "Early return — if you need the vehicle again, please submit a new request." Once confirmed, the vehicle immediately becomes available for others.',
  },
  {
    questionTh: 'ทำไมพิมพ์ชื่อผู้ใช้ (Username) โดยมีเว้นวรรค แล้วไม่สามารถเข้าสู่ระบบได้?',
    questionEn: 'Why can’t I sign in if there is a space in my Username or Password?',
    answerTh:
      'เพื่อความปลอดภัยและความถูกต้องของข้อมูล ระบบตรวจสอบชื่อผู้ใช้ รหัสพนักงาน อีเมล และรหัสผ่านแบบตรงตัว 100% กับฐานข้อมูลผู้ใช้งานที่มีอยู่จริง ห้ามเคาะเว้นวรรค (ช่องว่าง) ก่อนหน้า ระหว่างคำ หรือต่อท้ายชื่อผู้ใช้และรหัสผ่าน',
    answerEn:
      'For security, the system strictly validates credentials against registered users without allowing leading, trailing, or internal spaces.',
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
    questionTh: 'ผู้ใช้งานทั่วไปสามารถยกเลิกใบงานจองรถของตัวเองได้หรือไม่?',
    questionEn: 'Can a regular user cancel their own booking?',
    answerTh:
      'ยกเลิกได้ครับ ผู้ขอใช้รถสามารถกดปุ่ม "ยกเลิกการจอง" ในใบงานของตนเองที่ยังไม่เริ่มเดินทางได้ตามปกติ แต่จะไม่สามารถ "ลบใบงาน" ออกจากฐานข้อมูลได้ (การลบข้อมูลทำได้เฉพาะสิทธิ์ Admin เท่านั้น)',
    answerEn:
      'Yes. Requesters can cancel their own bookings prior to departure. Only permanent deletion of records is restricted to Admins.',
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
              <span className="tabular-nums">{isEn ? '7 Core Steps' : '7 ขั้นตอนหลัก'}</span>
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
                ? 'Complete guide covering the Home Dashboard (pending action center & fleet overview), vehicle reservation, 2-stage approval, pre-departure logging, and vehicle return confirmation.'
                : 'แนวทางการใช้งานตั้งแต่การตรวจสอบรายการค้างดำเนินการและภาพรวมรถยนต์ในหน้า Dashboard การสร้างใบงานขอใช้รถ ขั้นตอนการอนุมัติ 2 ลำดับขั้น การบันทึกเลขไมล์และระดับน้ำมันก่อนเดินทาง จนถึงการถ่ายภาพหย่อนกุญแจคืนรถ'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0 print:hidden">
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('dashboard')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <ClipboardList className="w-4 h-4" />
                <span>{isEn ? 'Go to Dashboard' : 'ไปที่หน้า Dashboard'}</span>
              </button>
            )}
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('calendar')}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <CalendarDays className="w-4 h-4" />
                <span>{isEn ? 'Start Booking Now' : 'ไปหน้าจองรถยนต์'}</span>
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

        {/* Workflow Summary Strip (6 Key Stages including Dashboard) */}
        <div className="pt-6">
          <div className="text-xs font-semibold text-slate-500 mb-3">
            {isEn ? 'End-to-End Workflow & Action Center' : 'แผนผังการใช้งานและสถานะใบงานตั้งแต่เริ่มต้นจนจบภารกิจ'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200">
              <div className="flex items-center justify-between text-xs text-indigo-700 mb-1">
                <span className="font-mono font-semibold tabular-nums">HOME</span>
                <span>Dashboard</span>
              </div>
              <div className="text-sm font-bold text-slate-900">
                {isEn ? 'Pending Actions' : 'หน้าแรก Dashboard'}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {isEn ? 'View pending tasks & fleet overview' : 'รวมเอกสาร/งานค้างที่ต้องทำ & ภาพรวมรถ'}
              </p>
            </div>

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
                {isEn ? 'Stage 1 review via Dashboard/LINE' : 'สถานะ: รอผู้จัดการ (กดได้จาก Dashboard)'}
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
                {isEn ? 'Stage 2 final vehicle check' : 'สถานะ: รอผู้ดูแลรถ อนุมัติขั้นสุดท้าย'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-mono font-semibold tabular-nums text-emerald-700">STEP 04</span>
                <span>In Use</span>
              </div>
              <div className="text-sm font-bold text-slate-900">
                {isEn ? 'In Use & Departure' : '4. กำลังใช้งาน'}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {isEn ? 'Record start mileage & fuel gauge' : 'บันทึกไมล์เริ่มต้น + ระดับน้ำมันก่อนเดินทาง'}
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
            {isEn ? 'All Steps (7)' : 'ทุกขั้นตอน (7)'}
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
                ? 'Search manual (e.g. dashboard, mileage, fuel, return)...'
                : 'ค้นหาหัวข้อคู่มือ (เช่น dashboard, งานค้าง, เลขไมล์, คืนรถ)...'
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
              ? 'Role Responsibilities & Dashboard Pending Actions Summary'
              : 'ตารางสรุปบทบาท หน้าที่ และรายการค้างดำเนินการที่แสดงในหน้า Dashboard'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isEn
              ? 'Overview of permissions and pending items displayed on the Dashboard for each user role.'
              : 'เปรียบเทียบหน้าที่หลักและรายการเอกสารค้างดำเนินการที่จะปรากฏในหน้า Dashboard ของแต่ละสิทธิ์ผู้ใช้งาน'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3.5 px-5">{isEn ? 'Role / Position' : 'บทบาท / สิทธิ์ในระบบ'}</th>
                <th className="py-3.5 px-5">{isEn ? 'Primary Responsibilities' : 'หน้าที่หลักในกระบวนการจองรถ'}</th>
                <th className="py-3.5 px-5">{isEn ? 'Pending Items Shown on Dashboard' : 'รายการค้างดำเนินการที่แสดงในหน้า Dashboard'}</th>
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
                    ? 'Active "In Use" trips awaiting pre-departure log or vehicle return, plus own requests pending approval.'
                    : 'ใบงานสถานะ "กำลังใช้งาน" ที่รอการบันทึกก่อนออกเดินทางหรือรอการกดคืนรถ และใบงานของตนเองที่อยู่ระหว่างรออนุมัติ'}
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
                    ? 'Stage 1 pending booking documents awaiting Manager approval (with direct Approve/Reject actions).'
                    : 'เอกสารใบงานที่ค้าง "รอผู้จัดการอนุมัติ (ขั้นที่ 1)" พร้อมปุ่มกดอนุมัติหรือไม่อนุมัติได้ทันที'}
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
                    ? 'Stage 2 pending booking documents cleared by Manager and awaiting final Fleet Controller approval.'
                    : 'เอกสารใบงานที่ผ่านผู้จัดการแล้วและค้าง "รอผู้ดูแลรถอนุมัติ (ขั้นที่ 2)" พร้อมปุ่มกดอนุมัติขั้นสุดท้าย'}
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
                    ? 'Manage vehicles, users, departments/divisions, role permissions, vehicle usage reports, and audit logs.'
                    : 'จัดการข้อมูลรถยนต์ กำหนดแผนก/ฝ่าย เพิ่มผู้ใช้งาน กำหนดสิทธิ์การมองเห็นเมนู ดูรายงานการใช้รถยนต์ และตรวจสอบ Audit Log'}
                </td>
                <td className="py-3.5 px-5">
                  {isEn
                    ? 'Full overview of all pending approvals, active vehicle missions, and daily fleet utilization.'
                    : 'เห็นภาพรวมรายการรออนุมัติทั้งหมด รถที่กำลังใช้งานในภารกิจ และสรุปสถานะรถยนต์ส่วนกลางทั้งองค์กร'}
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
                : 'รวบรวมข้อสงสัยในการใช้งานหน้า Dashboard การจอง การอนุมัติ และการคืนรถยนต์ส่วนกลาง'}
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
