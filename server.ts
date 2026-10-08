import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '25mb' }));

interface WebhookActionItem {
  id: string;
  bookingId: string;
  stage: number;
  action: 'approve' | 'reject';
  lineUserId?: string;
  timestamp: string;
  processed: boolean;
}

interface RecentLineEvent {
  id: string;
  type: string;
  sourceType?: string;
  userId?: string;
  groupId?: string;
  text?: string;
  postbackData?: string;
  timestamp: string;
}

const pendingWebhookActions: WebhookActionItem[] = [];
const recentLineEvents: RecentLineEvent[] = [];
const knownGroupIds = new Set<string>();
if (process.env.LINE_GROUP_ID && process.env.LINE_GROUP_ID.trim()) {
  knownGroupIds.add(process.env.LINE_GROUP_ID.trim());
}

// Persistent server-side booking store in os.tmpdir() to prevent workspace file-watcher freezes
const BOOKINGS_STORE_FILE = path.join(os.tmpdir(), 'ax_car_bookings_store.json');
const LEGACY_BOOKINGS_STORE_FILE = path.join(__dirname, 'data', 'bookings_store.json');
const ORG_SETTINGS_STORE_FILE = path.join(os.tmpdir(), 'ax_car_org_settings_store.json');

interface OrganizationSettingsData {
  departments: string[];
  divisions: string[];
  updatedAt: string;
}

function readOrgSettingsStore(): OrganizationSettingsData | null {
  try {
    if (fs.existsSync(ORG_SETTINGS_STORE_FILE)) {
      const raw = fs.readFileSync(ORG_SETTINGS_STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.departments) && Array.isArray(parsed.divisions)) {
        return {
          departments: parsed.departments,
          divisions: parsed.divisions,
          updatedAt: parsed.updatedAt || '',
        };
      }
    }
  } catch (err) {
    console.error('Error reading org settings store:', err);
  }
  return null;
}

function writeOrgSettingsStore(data: OrganizationSettingsData): void {
  fs.promises
    .writeFile(ORG_SETTINGS_STORE_FILE, JSON.stringify(data), 'utf-8')
    .catch((err) => {
      console.error('Error writing org settings store:', err);
    });
}

let serverOrgSettingsStore: OrganizationSettingsData | null = readOrgSettingsStore();

interface BookingsStoreData {
  bookings: Record<string, any>;
  deletedIds: string[];
}

function readBookingsStore(): BookingsStoreData {
  try {
    const fileToRead = fs.existsSync(BOOKINGS_STORE_FILE)
      ? BOOKINGS_STORE_FILE
      : fs.existsSync(LEGACY_BOOKINGS_STORE_FILE)
      ? LEGACY_BOOKINGS_STORE_FILE
      : null;
    if (fileToRead) {
      const raw = fs.readFileSync(fileToRead, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        bookings: parsed?.bookings && typeof parsed.bookings === 'object' ? parsed.bookings : {},
        deletedIds: Array.isArray(parsed?.deletedIds) ? parsed.deletedIds : [],
      };
    }
  } catch (err) {
    console.error('Error reading bookings store:', err);
  }
  return { bookings: {}, deletedIds: [] };
}

function writeBookingsStore(store: BookingsStoreData): void {
  fs.promises
    .writeFile(BOOKINGS_STORE_FILE, JSON.stringify(store), 'utf-8')
    .catch((err) => {
      console.error('Error writing bookings store:', err);
    });
}

let serverBookingsStore: BookingsStoreData = readBookingsStore();

function upsertServerBooking(booking: any): void {
  if (!booking || !booking.id) return;
  serverBookingsStore.bookings[booking.id] = {
    ...(serverBookingsStore.bookings[booking.id] || {}),
    ...booking,
    updatedAtServer: new Date().toISOString(),
  };
  serverBookingsStore.deletedIds = serverBookingsStore.deletedIds.filter((id) => id !== booking.id);
  writeBookingsStore(serverBookingsStore);
}

function deleteServerBooking(bookingId: string): void {
  if (!bookingId) return;
  delete serverBookingsStore.bookings[bookingId];
  if (!serverBookingsStore.deletedIds.includes(bookingId)) {
    serverBookingsStore.deletedIds.push(bookingId);
  }
  writeBookingsStore(serverBookingsStore);
}

// Default Channel ID & Secret provided by user for AX Car Reservation (@479mbfhu)
const DEFAULT_LINE_CHANNEL_ID = '2011862878';
const DEFAULT_LINE_CHANNEL_SECRET = 'a8b9df358ad9e7faf57041e2641e3ad1';
const DEFAULT_APP_URL = 'https://ais-pre-mlfwobw4wmpyzxvnmmwv5v-416326471534.asia-southeast1.run.app';

let cachedOAuthToken: { token: string; expiresAt: number } | null = null;

async function getLineAccessToken(): Promise<string> {
  const envToken = (process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
  if (envToken && envToken !== 'MY_LINE_CHANNEL_ACCESS_TOKEN') {
    return envToken;
  }

  if (cachedOAuthToken && Date.now() < cachedOAuthToken.expiresAt) {
    return cachedOAuthToken.token;
  }

  const channelId = (process.env.LINE_CHANNEL_ID || DEFAULT_LINE_CHANNEL_ID).trim();
  const channelSecret = (process.env.LINE_CHANNEL_SECRET || DEFAULT_LINE_CHANNEL_SECRET).trim();

  if (!channelId || !channelSecret) {
    return '';
  }

  try {
    const resp = await fetch('https://api.line.me/v2/oauth/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: channelId,
        client_secret: channelSecret,
      }),
    });

    if (!resp.ok) {
      console.error('Failed to issue LINE access token:', resp.status);
      return '';
    }

    const data = (await resp.json()) as { access_token?: string; expires_in?: number };
    if (data.access_token) {
      const expiresInMs = ((data.expires_in || 86400) - 300) * 1000;
      cachedOAuthToken = {
        token: data.access_token,
        expiresAt: Date.now() + Math.max(expiresInMs, 60000),
      };
      return data.access_token;
    }
  } catch (err) {
    console.error('Error requesting LINE OAuth access token:', err);
  }
  return '';
}

// Helper to build a rich LINE Flex Message Bubble for Approval Requests & Status Updates
function buildBookingFlexMessage(params: {
  booking: {
    id: string;
    jobNumber?: string;
    createdAt?: string;
    userName: string;
    userDepartment?: string;
    userDivision?: string;
    userPhone?: string;
    vehicleName: string;
    startDate: string;
    endDate: string;
    destination: string;
    purpose: string;
    passengersCount: number;
    status: string;
    assignedApproverName?: string;
    assignedApproverLineId?: string;
    stage2ApproverName?: string;
    stage2ApproverLineId?: string;
    requesterLineId?: string;
    stage1ApprovedBy?: string;
    stage2ApprovedBy?: string;
    rejectionReason?: string;
    rejectedBy?: string;
    rejectedStage?: number;
    startMileage?: number;
    endMileage?: number;
    startFuelLevel?: string;
    endFuelLevel?: string;
  };
  stage: 1 | 2 | 'approved' | 'rejected' | 'completed';
  approverName?: string;
  approvalUrl: string;
  rejectUrl: string;
  reviewUrl: string;
}) {
  const { booking, stage, approverName, approvalUrl, rejectUrl, reviewUrl } = params;

  const computeJobNo = () => {
    if (booking.jobNumber && booking.jobNumber.trim()) {
      return booking.jobNumber.trim().replace(/^JOB-/i, 'AX-');
    }
    const rawDate = (booking.createdAt || booking.startDate || '').substring(0, 10).replace(/-/g, '');
    const dateStamp = /^\d{8}$/.test(rawDate) ? rawDate : new Date().toISOString().substring(0, 10).replace(/-/g, '');
    const digits = (booking.id || '').replace(/\D/g, '');
    const suffix = digits.length >= 3 ? digits.slice(-3) : (booking.id || '001').slice(-3).toUpperCase();
    return `AX-${dateStamp}-${suffix.padStart(3, '0')}`;
  };
  const jobNo = computeJobNo();

  const isCompletedDone = stage === 'completed' || booking.status === 'Completed';
  const isApprovedDone = !isCompletedDone && (stage === 'approved' || booking.status === 'Approved');
  const isRejectedDone = stage === 'rejected' || booking.status === 'Cancelled';
  const isStage2 = stage === 2 || booking.status === 'Pending_Approve2';

  const headerBg = isCompletedDone
    ? '#0D9488'
    : isApprovedDone
    ? '#059669'
    : isRejectedDone
    ? '#E11D48'
    : isStage2
    ? '#2563EB'
    : '#06C755';

  const headerTitle = isCompletedDone
    ? '🏁 เสร็จสิ้นภารกิจ & คืนรถยนต์ส่วนกลางแล้ว'
    : isApprovedDone
    ? '✅ อนุมัติคำขอใช้รถเรียบร้อยแล้ว'
    : isRejectedDone
    ? '❌ คำขอใช้รถไม่ได้รับการอนุมัติ'
    : isStage2
    ? '🚗 แจ้งเตือนคำขอใช้รถ (ขั้นที่ 2: ผู้ดูแลรถ)'
    : '🚗 แจ้งเตือนคำขอใช้รถ (ขั้นที่ 1: ผู้จัดการ)';

  const headerSub = isCompletedDone
    ? `แจ้งเตือน Operator & ผู้ดูแลรถ (${approverName || booking.stage2ApproverName || 'Approve 2'})`
    : isApprovedDone
    ? `เรียนคุณ ${booking.userName}${booking.requesterLineId ? ` (${booking.requesterLineId})` : ''} • พร้อมออกเดินทาง`
    : isRejectedDone
    ? `เรียนคุณ ${booking.userName} • ไม่อนุมัติโดย ${booking.rejectedBy || 'ผู้อนุมัติ'}`
    : `เรียนคุณ ${approverName || (isStage2 ? booking.stage2ApproverName : booking.assignedApproverName) || 'ผู้อนุมัติ'} โปรดตรวจสอบในระบบ`;

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const stageNum = isStage2 ? 2 : 1;
  const rawBaseUrl = (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
    ? process.env.APP_URL
    : DEFAULT_APP_URL
  )
    .replace(/\/$/, '')
    .replace('://ais-dev-', '://ais-pre-');

  const normalizeExternalLineUri = (rawUri: string) => {
    const publicUri = rawUri.replace('://ais-dev-', '://ais-pre-');
    if (publicUri.includes('openExternalBrowser=1')) return publicUri;
    return publicUri.includes('?')
      ? `${publicUri}&openExternalBrowser=1`
      : `${publicUri}?openExternalBrowser=1`;
  };

  const safeReviewUri = normalizeExternalLineUri(
    reviewUrl && reviewUrl.startsWith('http')
      ? reviewUrl
      : `${rawBaseUrl}/?lineBookingId=${encodeURIComponent(booking.id)}&stage=${stageNum}&action=review`
  );

  const footerContents: any[] = [
    {
      type: 'button',
      style: 'primary',
      color: '#06C755',
      height: 'sm',
      action: {
        type: 'uri',
        label: '🔍 ดูรายละเอียด',
        uri: safeReviewUri,
      },
    },
  ];

  const statusContents: any[] = [
    {
      type: 'text',
      text: booking.stage1ApprovedBy
        ? `✅ ขั้นที่ 1 (ผู้จัดการ): อนุมัติโดย ${booking.stage1ApprovedBy}`
        : isRejectedDone && booking.rejectedStage === 1
        ? `❌ ขั้นที่ 1 (ผู้จัดการ): ไม่อนุมัติโดย ${booking.rejectedBy || booking.assignedApproverName || 'ผู้จัดการ'}`
        : `⏳ ขั้นที่ 1 (ผู้จัดการ): รอ ${booking.assignedApproverName || 'ผู้จัดการ'}`,
      size: 'xxs',
      color: booking.stage1ApprovedBy
        ? '#059669'
        : isRejectedDone && booking.rejectedStage === 1
        ? '#E11D48'
        : '#D97706',
      weight: 'bold',
      wrap: true,
    },
    {
      type: 'text',
      text: booking.stage2ApprovedBy
        ? `✅ ขั้นที่ 2 (ผู้ดูแลรถ): อนุมัติโดย ${booking.stage2ApprovedBy}`
        : isRejectedDone && booking.rejectedStage === 2
        ? `❌ ขั้นที่ 2 (ผู้ดูแลรถ): ไม่อนุมัติโดย ${booking.rejectedBy || booking.stage2ApproverName || 'ผู้ดูแลรถ'}`
        : isStage2
        ? `⏳ ขั้นที่ 2 (ผู้ดูแลรถ): รอ ${booking.stage2ApproverName || 'ผู้ดูแลรถ'} อนุมัติขั้นสุดท้าย`
        : `⚪ ขั้นที่ 2 (ผู้ดูแลรถ): รอส่งต่อ (${booking.stage2ApproverName || 'ผู้ดูแลรถ'})`,
      size: 'xxs',
      color: booking.stage2ApprovedBy
        ? '#059669'
        : isRejectedDone && booking.rejectedStage === 2
        ? '#E11D48'
        : isStage2
        ? '#2563EB'
        : '#94A3B8',
      weight: 'bold',
      wrap: true,
    },
  ];

  if (isCompletedDone) {
    const startM =
      booking.startMileage !== undefined ? `${booking.startMileage.toLocaleString()} km.` : '-';
    const endM =
      booking.endMileage !== undefined ? `${booking.endMileage.toLocaleString()} km.` : '-';
    statusContents.push({
      type: 'text',
      text: `🏁 คืนรถแล้ว • ไมล์: ${startM} → ${endM} • น้ำมันคืน: ${booking.endFuelLevel || '-'} • 🔑 หย่อนกุญแจลงตู้เรียบร้อย`,
      size: 'xs',
      color: '#0D9488',
      weight: 'bold',
      wrap: true,
      margin: 'xs',
    });
  }

  if (isRejectedDone && booking.rejectionReason) {
    statusContents.push({
      type: 'text',
      text: `💬 เหตุผลที่ไม่อนุมัติ: ${booking.rejectionReason}`,
      size: 'xs',
      color: '#BE123C',
      weight: 'bold',
      wrap: true,
      margin: 'xs',
    });
  }

  return {
    type: 'flex',
    altText: `[${jobNo}] ${headerTitle} - ${booking.userName} (${booking.vehicleName})`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: headerBg,
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: `📄 หมายเลขใบงาน: ${jobNo}`,
            color: '#FFFFFF',
            size: 'xs',
            weight: 'bold',
          },
          {
            type: 'text',
            text: headerTitle,
            color: '#FFFFFF',
            size: 'md',
            weight: 'bold',
            wrap: true,
            margin: 'xs',
          },
          {
            type: 'text',
            text: headerSub,
            color: '#FFFFFFEE',
            size: 'xs',
            wrap: true,
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'baseline',
            spacing: 'sm',
            contents: [
              { type: 'text', text: 'เลขที่ใบงาน:', color: '#64748B', size: 'xs', flex: 3 },
              {
                type: 'text',
                text: jobNo,
                wrap: true,
                color: '#4338CA',
                size: 'xs',
                weight: 'bold',
                flex: 7,
              },
            ],
          },
          {
            type: 'box',
            layout: 'baseline',
            spacing: 'sm',
            contents: [
              { type: 'text', text: 'ผู้ขอใช้รถ:', color: '#64748B', size: 'xs', flex: 3 },
              {
                type: 'text',
                text: `${booking.userName} (${booking.userDepartment || '-'})`,
                wrap: true,
                color: '#0F172A',
                size: 'xs',
                weight: 'bold',
                flex: 7,
              },
            ],
          },
          {
            type: 'box',
            layout: 'baseline',
            spacing: 'sm',
            contents: [
              { type: 'text', text: 'รถยนต์:', color: '#64748B', size: 'xs', flex: 3 },
              {
                type: 'text',
                text: booking.vehicleName,
                wrap: true,
                color: '#1E40AF',
                size: 'xs',
                weight: 'bold',
                flex: 7,
              },
            ],
          },
          {
            type: 'box',
            layout: 'baseline',
            spacing: 'sm',
            contents: [
              { type: 'text', text: 'เริ่มเดินทาง:', color: '#64748B', size: 'xs', flex: 3 },
              {
                type: 'text',
                text: formatDateTime(booking.startDate),
                wrap: true,
                color: '#0F172A',
                size: 'xs',
                flex: 7,
              },
            ],
          },
          {
            type: 'box',
            layout: 'baseline',
            spacing: 'sm',
            contents: [
              { type: 'text', text: 'คืนรถยนต์:', color: '#64748B', size: 'xs', flex: 3 },
              {
                type: 'text',
                text: formatDateTime(booking.endDate),
                wrap: true,
                color: '#0F172A',
                size: 'xs',
                flex: 7,
              },
            ],
          },
          {
            type: 'box',
            layout: 'baseline',
            spacing: 'sm',
            contents: [
              { type: 'text', text: 'ปลายทาง:', color: '#64748B', size: 'xs', flex: 3 },
              {
                type: 'text',
                text: `${booking.destination} (${booking.passengersCount} คน)`,
                wrap: true,
                color: '#0F172A',
                size: 'xs',
                weight: 'bold',
                flex: 7,
              },
            ],
          },
          {
            type: 'box',
            layout: 'baseline',
            spacing: 'sm',
            contents: [
              { type: 'text', text: 'ภารกิจ:', color: '#64748B', size: 'xs', flex: 3 },
              {
                type: 'text',
                text: booking.purpose,
                wrap: true,
                color: '#334155',
                size: 'xs',
                flex: 7,
              },
            ],
          },
          {
            type: 'separator',
            margin: 'md',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'sm',
            spacing: 'xs',
            contents: statusContents,
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '12px',
        contents: footerContents,
      },
    },
  };
}

// 1. Check LINE Messaging API status
app.get('/api/line/status', async (_req, res) => {
  const token = await getLineAccessToken();
  const secret = (process.env.LINE_CHANNEL_SECRET || DEFAULT_LINE_CHANNEL_SECRET).trim();
  const groupId = (process.env.LINE_GROUP_ID || '').trim();

  res.json({
    configured: Boolean(token),
    botBasicId: '@479mbfhu',
    botDisplayName: 'AX Car Reservation',
    hasChannelSecret: Boolean(secret),
    hasDefaultGroup: Boolean(groupId),
    webhookPath: '/api/line/webhook',
    recentEvents: recentLineEvents.slice(0, 15),
    pendingActionsCount: pendingWebhookActions.filter((a) => !a.processed).length,
  });
});

// 2. Send LINE Approval Request (Push Flex Message via LINE OA if token exists, and return Flex + Share links)
app.post('/api/line/send-approval', async (req, res) => {
  try {
    const {
      booking,
      stage = 1,
      approverLineId,
      targetLineIds,
      approverName,
      approvalUrl,
      rejectUrl,
      reviewUrl,
    } = req.body || {};

    if (!booking || !booking.id) {
      res.status(400).json({ error: 'Missing booking data' });
      return;
    }

    // Ensure booking is persisted on server immediately
    upsertServerBooking(booking);

    const flexMessage = buildBookingFlexMessage({
      booking,
      stage,
      approverName,
      approvalUrl: approvalUrl || '',
      rejectUrl: rejectUrl || '',
      reviewUrl: reviewUrl || '',
    });

    const token = await getLineAccessToken();
    const allTargets = Array.from(
      new Set(
        [
          ...(Array.isArray(targetLineIds) ? targetLineIds : []),
          approverLineId,
          process.env.LINE_GROUP_ID,
        ]
          .filter(Boolean)
          .map((t: string) => String(t).trim())
          .filter(Boolean)
      )
    );

    let oaPushSuccess = false;
    let oaPushMode: 'push' | 'broadcast' | 'share_only' = 'share_only';
    let oaError: string | undefined = undefined;

    if (token) {
      try {
        let hasNonUuidTarget = allTargets.length === 0;
        const pushedTargets = new Set<string>();

        for (const rawTarget of allTargets) {
          const cleanTarget = rawTarget.replace(/^@/, '');
          const isDirectLineUuid =
            (cleanTarget.startsWith('U') ||
              cleanTarget.startsWith('C') ||
              cleanTarget.startsWith('R')) &&
            cleanTarget.length >= 30;

          if (isDirectLineUuid) {
            pushedTargets.add(cleanTarget);
            const pushResp = await fetch('https://api.line.me/v2/bot/message/push', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                to: cleanTarget,
                messages: [flexMessage],
              }),
            });
            if (pushResp.ok) {
              oaPushSuccess = true;
              oaPushMode = 'push';
            } else {
              const errBody = await pushResp.text();
              oaError = `LINE Push API (${pushResp.status}): ${errBody}`;
            }
          } else {
            hasNonUuidTarget = true;
          }
        }

        // Also push to any joined LINE Groups so approvers/operators in the group receive cards immediately
        for (const gId of knownGroupIds) {
          if (pushedTargets.has(gId)) continue;
          const groupResp = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              to: gId,
              messages: [flexMessage],
            }),
          });
          if (groupResp.ok) {
            oaPushSuccess = true;
            oaPushMode = 'push';
          }
        }

        // If any target is a regular LINE Search ID (e.g. khanchai_r) or direct push failed, also broadcast to OA followers
        if (hasNonUuidTarget || !oaPushSuccess) {
          const broadcastResp = await fetch('https://api.line.me/v2/bot/message/broadcast', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              messages: [flexMessage],
            }),
          });
          if (broadcastResp.ok) {
            oaPushSuccess = true;
            if (oaPushMode === 'share_only') oaPushMode = 'broadcast';
          } else if (!oaPushSuccess) {
            const errBody = await broadcastResp.text();
            oaError = `LINE Broadcast API (${broadcastResp.status}): ${errBody}`;
          }
        }
      } catch (err: any) {
        oaError = err?.message || 'Failed to connect to LINE API';
      }
    }

    res.json({
      ok: true,
      oaPushSuccess,
      oaPushMode,
      oaError,
      flexMessage,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

// 3. LINE Official Account Webhook Endpoint
app.post('/api/line/webhook', async (req, res) => {
  try {
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    const token = await getLineAccessToken();

    for (const ev of events) {
      const userId = ev.source?.userId;
      const groupId = ev.source?.groupId || ev.source?.roomId;

      if (groupId) {
        knownGroupIds.add(groupId);
      }
      if (ev.type === 'leave' && groupId) {
        knownGroupIds.delete(groupId);
      }

      recentLineEvents.unshift({
        id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: ev.type || 'unknown',
        sourceType: ev.source?.type,
        userId,
        groupId,
        text: ev.message?.text,
        postbackData: ev.postback?.data,
        timestamp: new Date().toISOString(),
      });

      if (ev.type === 'join' && groupId && token && ev.replyToken) {
        await fetch('https://api.line.me/v2/bot/message/reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            replyToken: ev.replyToken,
            messages: [
              {
                type: 'text',
                text: `✅ เชื่อมต่อกลุ่ม LINE กับระบบจองรถยนต์ส่วนกลางเรียบร้อยแล้ว (Group ID: ${groupId})\nผู้อนุมัติในกลุ่มนี้จะได้รับการ์ดแจ้งเตือนและกดปุ่มอนุมัติได้ทันทีโดยไม่ต้องแอดเพื่อนรายคน`,
              },
            ],
          }),
        }).catch(() => {});
      }

      // Handle postback approval e.g. action=approve&bookingId=b-123&stage=1
      if (ev.type === 'postback' && ev.postback?.data) {
        const params = new URLSearchParams(ev.postback.data);
        const action = params.get('action');
        const bookingId = params.get('bookingId');
        const stage = Number(params.get('stage') || '1');

        if ((action === 'approve' || action === 'reject') && bookingId) {
          pendingWebhookActions.push({
            id: `act-${Date.now()}`,
            bookingId,
            stage,
            action,
            lineUserId: userId,
            timestamp: new Date().toISOString(),
            processed: false,
          });

          if (token && ev.replyToken) {
            const replyText =
              action === 'approve'
                ? `✅ ระบบได้รับคำสั่งอนุมัติคำขอจองรถ (${bookingId}) ขั้นที่ ${stage} ผ่าน LINE เรียบร้อยแล้ว`
                : `❌ ระบบได้รับคำสั่งไม่อนุมัติคำขอจองรถ (${bookingId}) ผ่าน LINE เรียบร้อยแล้ว`;

            await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                replyToken: ev.replyToken,
                messages: [{ type: 'text', text: replyText }],
              }),
            }).catch(() => {});
          }
        }
      } else if (ev.type === 'message' && ev.message?.type === 'text' && token && ev.replyToken) {
        const text = (ev.message.text || '').trim();
        if (text.toLowerCase() === 'id' || text.includes('รหัส') || text.includes('ผูกบัญชี')) {
          const replyMsg = `🔗 ข้อมูลสำหรับเชื่อมต่อระบบจองรถส่วนกลาง:\n• LINE User ID ของคุณ: ${userId || '-'}${
            groupId ? `\n• LINE Group ID: ${groupId}` : ''
          }\nสามารถนำรหัสนี้ไประบุในช่อง LINE ID ของผู้ใช้งานในระบบได้ทันที`;
          await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              replyToken: ev.replyToken,
              messages: [{ type: 'text', text: replyMsg }],
            }),
          }).catch(() => {});
        }
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Webhook error' });
  }
});

// 4. Poll pending webhook approval actions so the client syncs them to Firestore
app.get('/api/line/webhook-actions', (_req, res) => {
  const unprocessed = pendingWebhookActions.filter((a) => !a.processed);
  res.json({ actions: unprocessed });
});

app.post('/api/line/ack-webhook-action', (req, res) => {
  const { id } = req.body || {};
  const found = pendingWebhookActions.find((a) => a.id === id);
  if (found) {
    found.processed = true;
  }
  res.json({ ok: true });
});

// 5. Server-side Bookings Sync & Persistence Endpoints
app.get('/api/bookings', (_req, res) => {
  const list = Object.values(serverBookingsStore.bookings).filter(
    (b: any) => b && b.id && !serverBookingsStore.deletedIds.includes(b.id)
  );
  list.sort(
    (a: any, b: any) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
  res.json({
    bookings: list,
    deletedIds: serverBookingsStore.deletedIds,
  });
});

app.post('/api/bookings', (req, res) => {
  const body = req.body || {};
  if (Array.isArray(body.bookings)) {
    for (const b of body.bookings) {
      if (b && b.id && !serverBookingsStore.deletedIds.includes(b.id)) {
        upsertServerBooking(b);
      }
    }
    res.json({ ok: true, count: Object.keys(serverBookingsStore.bookings).length });
    return;
  }
  const booking = body.booking || body;
  if (!booking || !booking.id) {
    res.status(400).json({ error: 'Invalid booking payload' });
    return;
  }
  upsertServerBooking(booking);
  res.json({ ok: true, booking: serverBookingsStore.bookings[booking.id] });
});

app.delete('/api/bookings/:id', (req, res) => {
  const bookingId = req.params.id;
  deleteServerBooking(bookingId);
  res.json({ ok: true, deletedId: bookingId });
});

// 6. Server-side Organization Settings (Departments & Divisions) Sync & Persistence Endpoints
app.get('/api/organization-settings', (_req, res) => {
  res.json({
    settings: serverOrgSettingsStore,
  });
});

app.post('/api/organization-settings', (req, res) => {
  const body = req.body || {};
  const departments = Array.isArray(body.departments)
    ? body.departments.map((d: string) => String(d || '').trim()).filter(Boolean)
    : null;
  const divisions = Array.isArray(body.divisions)
    ? body.divisions.map((d: string) => String(d || '').trim()).filter(Boolean)
    : null;

  if (!departments || !divisions) {
    res.status(400).json({ error: 'Invalid organization settings payload' });
    return;
  }

  const updatedAt = body.updatedAt || new Date().toISOString();
  serverOrgSettingsStore = {
    departments: Array.from(new Set(departments)),
    divisions: Array.from(new Set(divisions)),
    updatedAt,
  };
  writeOrgSettingsStore(serverOrgSettingsStore);
  res.json({ ok: true, settings: serverOrgSettingsStore });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
