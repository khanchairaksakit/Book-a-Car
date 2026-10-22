import { getGoogleAccessToken, googleSignIn, getCachedGoogleUser } from '../lib/firebase';
import { User as FirebaseUser } from 'firebase/auth';

export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  fromName?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  userEmail?: string;
}

/**
 * Creates a base64url-encoded RFC 2822 email message for Gmail API users.messages.send
 */
function createRawEmail(options: SendEmailOptions, fromEmail?: string): string {
  const { to, subject, htmlBody, fromName = 'ระบบจองรถส่วนกลาง' } = options;
  const cleanSubject = subject.trim();
  
  // UTF-8 Subject encode: =?utf-8?B?...?=
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(cleanSubject)))}?=`;
  const fromHeader = fromEmail
    ? `From: =?utf-8?B?${btoa(unescape(encodeURIComponent(fromName)))}?= <${fromEmail}>`
    : `From: =?utf-8?B?${btoa(unescape(encodeURIComponent(fromName)))}?= <me>`;

  const messageParts = [
    fromHeader,
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    htmlBody,
  ];

  const rawMessage = messageParts.join('\r\n');
  
  // Base64URL encoding (RFC 4648 §5)
  return btoa(unescape(encodeURIComponent(rawMessage)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sends an email using the Gmail REST API (users.messages.send)
 * Requires access token with https://www.googleapis.com/auth/gmail.send scope.
 */
export async function sendGmailMessage(options: SendEmailOptions): Promise<SendEmailResult> {
  let token = await getGoogleAccessToken();
  let user: FirebaseUser | null = getCachedGoogleUser();

  if (!token) {
    // Attempt interactive sign in if token is missing
    try {
      const authResult = await googleSignIn();
      if (!authResult || !authResult.accessToken) {
        return {
          success: false,
          error: 'กรุณาเข้าสู่ระบบด้วย Google เพื่ออนุญาตให้แอปส่งอีเมลผ่าน Gmail',
        };
      }
      token = authResult.accessToken;
      user = authResult.user;
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'การยืนยันตัวตน Google ล้มเหลว',
      };
    }
  }

  try {
    const raw = createRawEmail(options, user?.email || undefined);
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => null);
      console.error('Gmail API send error:', errJson);
      if (response.status === 401) {
        return {
          success: false,
          error: 'สิทธิ์การเชื่อมต่อ Gmail หมดอายุ กรุณาเข้าสู่ระบบ Google ใหม่อีกครั้ง',
        };
      }
      return {
        success: false,
        error: errJson?.error?.message || `Gmail API Error (${response.status})`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      messageId: result.id,
      userEmail: user?.email || undefined,
    };
  } catch (error: any) {
    console.error('Error sending email via Gmail:', error);
    return {
      success: false,
      error: error?.message || 'เกิดข้อผิดพลาดในการส่งอีเมลผ่าน Gmail',
    };
  }
}

/**
 * Formats a clean HTML template for password reset email
 */
export function buildPasswordResetEmailHtml({
  recipientName,
  resetUrl,
  userEmail,
  appName = 'ระบบจองรถส่วนกลาง',
}: {
  recipientName: string;
  resetUrl: string;
  userEmail: string;
  appName?: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>รีเซตรหัสผ่าน - ${appName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px; color: #1e293b;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
    
    <!-- Header -->
    <div style="background-color: #1e1b4b; padding: 28px 32px; text-align: left;">
      <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: bold; letter-spacing: -0.01em;">
        🚗 ${appName}
      </h1>
      <p style="color: #cbd5e1; margin: 6px 0 0 0; font-size: 13px;">
        คำขอตั้งค่ารหัสผ่านใหม่ (Password Reset Request)
      </p>
    </div>

    <!-- Body -->
    <div style="padding: 32px 32px 24px 32px;">
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
        เรียน คุณ <strong>${recipientName}</strong>,
      </p>
      <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
        ระบบได้รับคำขอตั้งค่ารหัสผ่านใหม่สำหรับบัญชีผู้ใช้งานอีเมล <strong style="color: #4f46e5; font-family: monospace;">${userEmail}</strong> กรุณากดปุ่มด้านล่างนี้เพื่อเข้าสู่หน้าตั้งรหัสผ่านใหม่ของคุณ:
      </p>

      <!-- Primary Action Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" target="_blank" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
          🔑 กดที่นี่เพื่อตั้งรหัสผ่านใหม่
        </a>
      </div>

      <div style="background-color: #f1f5f9; border-radius: 12px; padding: 16px; margin: 24px 0; font-size: 12px; line-height: 1.6; color: #64748b;">
        <p style="margin: 0 0 8px 0; font-weight: bold; color: #334155;">
          ⏱️ ข้อมูลสำคัญ:
        </p>
        <ul style="margin: 0; padding-left: 20px;">
          <li>ลิงก์นี้มีอายุการใช้งาน <strong>15 นาที</strong> นับจากเวลาที่ส่ง</li>
          <li>เมื่อตั้งรหัสผ่านใหม่สำเร็จ ระบบจะปลดล็อคบัญชีให้อัตโนมัติ</li>
          <li>หากปุ่มด้านบนกดไม่ได้ สามารถคัดลอกลิงก์ด้านล่างไปวางในเบราว์เซอร์ได้:</li>
        </ul>
        <div style="margin-top: 8px; word-break: break-all; font-family: monospace; font-size: 11px; color: #4f46e5;">
          ${resetUrl}
        </div>
      </div>

      <p style="margin: 24px 0 0 0; font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px;">
        หากคุณไม่ได้เป็นผู้ขอรีเซตรหัสผ่าน กรุณาละเว้นอีเมลนี้ รหัสผ่านเดิมของคุณจะยังคงปลอดภัยและไม่มีการเปลี่ยนแปลงใดๆ
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 16px 32px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
      อีเมลนี้ถูกส่งโดยอัตโนมัติจาก ${appName}
    </div>
  </div>
</body>
</html>`;
}
