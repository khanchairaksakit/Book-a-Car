import * as XLSX from 'xlsx';
import { User, UserRole } from '../types';

export interface ParsedUserRow {
  employeeCode: string;
  name: string;
  department: string;
  division: string;
  phone: string;
  email: string;
  roles: UserRole[];
  username: string;
  password?: string;
  isValid: boolean;
  errors: string[];
}

/**
 * Generates and triggers download of a standardized Excel template for users
 */
export function downloadUserExcelTemplate(): void {
  const sampleData = [
    {
      'รหัสพนักงาน': 'EMP005',
      'ชื่อ-นามสกุล': 'ประสิทธิ์ วงศ์สว่าง',
      'แผนก': 'ฝ่ายผลิต (Production)',
      'ฝ่าย': 'ฝ่ายปฏิบัติการและการผลิต',
      'เบอร์โทร': '089-123-9999',
      'อีเมล': 'prasit.w@company.com',
      'บทบาท (User, Approve, Admin)': 'User, Approve',
      'รหัสผ่าน (Password)': 'password123',
    },
    {
      'รหัสพนักงาน': 'EMP006',
      'ชื่อ-นามสกุล': 'กานดา ชูจิต',
      'แผนก': 'การตลาด (Marketing)',
      'ฝ่าย': 'ฝ่ายพัฒนาธุรกิจและการตลาด',
      'เบอร์โทร': '084-567-8888',
      'อีเมล': 'kanda.c@company.com',
      'บทบาท (User, Approve, Admin)': 'User',
      'รหัสผ่าน (Password)': 'password123',
    },
    {
      'รหัสพนักงาน': 'EMP007',
      'ชื่อ-นามสกุล': 'อภิสิทธิ์ มั่นคง',
      'แผนก': 'ตรวจสอบภายใน (Audit)',
      'ฝ่าย': 'ฝ่ายบริหารและตรวจสอบ',
      'เบอร์โทร': '086-777-6655',
      'อีเมล': 'apisit.m@company.com',
      'บทบาท (User, Operator, Approve 1, Approve 2, Admin)': 'Admin, Operator, Approve 1, Approve 2, User',
      'รหัสผ่าน (Password)': 'password123',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);

  // Set column widths for readability
  worksheet['!cols'] = [
    { wch: 16 }, // รหัสพนักงาน
    { wch: 26 }, // ชื่อ-นามสกุล
    { wch: 26 }, // แผนก
    { wch: 30 }, // ฝ่าย
    { wch: 18 }, // เบอร์โทร
    { wch: 28 }, // อีเมล
    { wch: 30 }, // บทบาท
    { wch: 22 }, // รหัสผ่าน
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'User_Template');

  XLSX.writeFile(workbook, 'Template_User_Import.xlsx');
}

/**
 * Parses uploaded Excel / CSV file into user rows with validation
 */
export async function parseUserExcelFile(file: File, existingUsers: User[] = []): Promise<ParsedUserRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        if (!worksheet) {
          resolve([]);
          return;
        }

        const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        const parsedRows: ParsedUserRow[] = rawRows.map((row) => {
          // Normalize column headers to support both Thai and English keys
          const employeeCode = String(
            row['รหัสพนักงาน'] || row['employeeCode'] || row['Employee ID'] || row['EmpID'] || ''
          ).trim();
          
          const name = String(
            row['ชื่อ-นามสกุล'] || row['ชื่อ - นามสกุล'] || row['ชื่อสกุล'] || row['name'] || row['Name'] || ''
          ).trim();

          const department = String(
            row['แผนก'] || row['department'] || row['Department'] || ''
          ).trim();

          const division = String(
            row['ฝ่าย'] || row['division'] || row['Division'] || ''
          ).trim();

          const phone = String(
            row['เบอร์โทร'] || row['เบอร์โทรศัพท์'] || row['phone'] || row['Phone'] || row['Telephone'] || ''
          ).trim();

          const email = String(
            row['อีเมล'] || row['email'] || row['Email'] || row['E-mail'] || ''
          ).trim();

          const rawRoles = String(
            row['บทบาท (User, Operator, Approve 1, Approve 2, Admin)'] ||
            row['บทบาท (User, Approve 1, Approve 2, Admin)'] ||
            row['บทบาท (User, Approve, Admin)'] ||
            row['บทบาท'] ||
            row['roles'] ||
            row['Roles'] ||
            row['role'] ||
            ''
          ).trim();

          const password = String(
            row['รหัสผ่าน (Password)'] || row['รหัสผ่าน'] || row['password'] || row['Password'] || 'password123'
          ).trim() || 'password123';

          // Extract roles
          const roles: UserRole[] = [];
          const lowerRoles = rawRoles.toLowerCase();
          if (lowerRoles.includes('admin') || lowerRoles.includes('ผู้ดูแล')) roles.push('Admin');
          if (lowerRoles.includes('operator') || lowerRoles.includes('เจ้าหน้าที่')) roles.push('Operator');
          const hasApp2 =
            lowerRoles.includes('approve 2') ||
            lowerRoles.includes('approve2') ||
            lowerRoles.includes('อนุมัติ 2') ||
            lowerRoles.includes('ลำดับ 2') ||
            lowerRoles.includes('ลำดับที่ 2') ||
            lowerRoles.includes('ขั้นที่ 2') ||
            lowerRoles.includes('ขั้น 2');
          if (hasApp2) {
            roles.push('Approve 2');
          }
          const hasExplicitApp1 =
            lowerRoles.includes('approve 1') ||
            lowerRoles.includes('approve1') ||
            lowerRoles.includes('อนุมัติ 1') ||
            lowerRoles.includes('ลำดับ 1') ||
            lowerRoles.includes('ลำดับที่ 1') ||
            lowerRoles.includes('ขั้นที่ 1') ||
            lowerRoles.includes('ขั้น 1');
          const hasGenericApprove =
            (lowerRoles.includes('approve') || lowerRoles.includes('อนุมัติ')) && !hasApp2;
          if (hasExplicitApp1 || hasGenericApprove) {
            roles.push('Approve 1');
          }
          if (lowerRoles.includes('user') || lowerRoles.includes('ผู้ใช้') || roles.length === 0) roles.push('User');

          // Generate default username from email prefix or employee code
          let username = email ? email.split('@')[0].toLowerCase() : employeeCode.toLowerCase();
          if (!username) {
            username = 'user_' + Math.random().toString(36).substring(2, 7);
          }

          // Validation
          const errors: string[] = [];
          if (!name) errors.push('กรุณาระบุชื่อ-นามสกุล');
          if (!department) errors.push('กรุณาระบุแผนก');
          if (!email) errors.push('กรุณาระบุอีเมล');
          else if (!email.includes('@')) errors.push('รูปแบบอีเมลไม่ถูกต้อง');

          // Check duplicate with existing in DB
          if (email && existingUsers.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
            errors.push('อีเมลนี้มีอยู่ในระบบแล้ว');
          }
          if (employeeCode && existingUsers.some((u) => u.employeeCode && u.employeeCode.toLowerCase() === employeeCode.toLowerCase())) {
            errors.push('รหัสพนักงานนี้มีอยู่ในระบบแล้ว');
          }

          return {
            employeeCode,
            name,
            department,
            division: division || '-',
            phone: phone || '-',
            email,
            roles,
            username,
            password,
            isValid: errors.length === 0,
            errors,
          };
        });

        // Filter out empty rows (where all essential fields are empty)
        const validRows = parsedRows.filter((r) => r.name || r.email || r.employeeCode);
        resolve(validRows);
      } catch (err) {
        console.error('Error parsing Excel file:', err);
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
