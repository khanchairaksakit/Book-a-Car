import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocFromServer,
  onSnapshot,
} from 'firebase/firestore';
import { Vehicle, User, Booking, RolePermissionsMatrix, AuditLogEntry } from '../types';
import { INITIAL_VEHICLES, INITIAL_USERS, INITIAL_BOOKINGS } from '../data/mockData';
import {
  DEFAULT_ROLE_PERMISSIONS,
  normalizeRolePermissionsMatrix,
  getStoredRolePermissions,
  saveStoredRolePermissions,
} from '../utils/userHelpers';
import {
  getStoredDepartments,
  saveStoredDepartments,
  getStoredDivisions,
  saveStoredDivisions,
  getStoredOrgUpdatedAt,
  saveStoredOrgUpdatedAt,
  getStoredOrgVersion,
  saveStoredOrgVersion,
  safeLocalStorageSet,
} from '../utils/organizationUtils';
import { compressDataUrlIfNeeded } from '../utils/imageCompression';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
let firestoreInstance;
try {
  const databaseId = (firebaseConfig as any).firestoreDatabaseId;
  firestoreInstance = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
} catch (err) {
  console.warn('Falling back to default Firestore database:', err);
  firestoreInstance = getFirestore(app);
}
export const db = firestoreInstance;

// Connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'vehicles', 'connection-test'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

// Vehicles CRUD and seeding
export async function getVehicles(): Promise<Vehicle[]> {
  try {
    const colRef = collection(db, 'vehicles');
    const snapshot = await getDocs(colRef);
    
    if (snapshot.empty) {
      console.log('Seeding initial vehicles to Firestore...');
      const batch = writeBatch(db);
      for (const vehicle of INITIAL_VEHICLES) {
        const docRef = doc(db, 'vehicles', vehicle.id);
        batch.set(docRef, vehicle);
      }
      await batch.commit();
      return INITIAL_VEHICLES;
    }
    
    const vehicles: Vehicle[] = [];
    snapshot.forEach((doc) => {
      vehicles.push(doc.data() as Vehicle);
    });
    return vehicles;
  } catch (error) {
    console.error('Error fetching vehicles from Firestore:', error);
    return INITIAL_VEHICLES;
  }
}

// Helper to strip undefined fields recursively so Firestore setDoc never fails on undefined values
function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanFirestoreData(item)) as unknown as T;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (value !== undefined) {
      cleaned[key] = cleanFirestoreData(value);
    }
  }
  return cleaned as T;
}

export async function saveVehicle(vehicle: Vehicle): Promise<void> {
  const cleaned = cleanFirestoreData(vehicle);
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('car_booking_vehicles');
      const list: Vehicle[] = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list)) {
        const idx = list.findIndex((v) => v.id === cleaned.id);
        if (idx >= 0) {
          list[idx] = cleaned;
        } else {
          list.push(cleaned);
        }
        localStorage.setItem('car_booking_vehicles', JSON.stringify(list));
      }
    } catch {
      // ignore
    }
  }
  const docRef = doc(db, 'vehicles', cleaned.id);
  await setDoc(docRef, cleaned);
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  const docRef = doc(db, 'vehicles', vehicleId);
  await deleteDoc(docRef);
}

// Users CRUD and seeding
export async function getUsers(): Promise<User[]> {
  try {
    const colRef = collection(db, 'users');
    const snapshot = await getDocs(colRef);
    
    if (snapshot.empty) {
      console.log('Seeding initial users to Firestore...');
      const batch = writeBatch(db);
      for (const user of INITIAL_USERS) {
        const docRef = doc(db, 'users', user.id);
        batch.set(docRef, user);
      }
      await batch.commit();
      return INITIAL_USERS;
    }
    
    const localUsersRaw = typeof window !== 'undefined' ? localStorage.getItem('car_booking_users') : null;
    const localUsersMap = new Map<string, User & { updatedAt?: string }>();
    if (localUsersRaw) {
      try {
        const parsed = JSON.parse(localUsersRaw);
        if (Array.isArray(parsed)) {
          parsed.forEach((u: any) => {
            if (u && u.id) localUsersMap.set(u.id, u);
          });
        }
      } catch {
        // ignore
      }
    }

    const users: User[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as User & { updatedAt?: string };
      const initialMatch = INITIAL_USERS.find(
        (u) => u.id === data.id || u.email.toLowerCase() === data.email.toLowerCase()
      );
      const localMatch = localUsersMap.get(data.id);
      const useLocal =
        localMatch &&
        localMatch.updatedAt &&
        (!data.updatedAt || localMatch.updatedAt > data.updatedAt);
      const source = useLocal ? localMatch : data;

      const resolvedRoles =
        Array.isArray(source.roles) && source.roles.length > 0
          ? source.roles
          : source.role === 'Admin'
          ? ['Admin', 'User']
          : ['User'];
      const mergedUser: User = {
        ...source,
        employeeCode: source.employeeCode || initialMatch?.employeeCode || `EMP-${data.id.substring(data.id.length - 3)}`,
        division: source.division !== undefined ? source.division : (initialMatch?.division || 'ฝ่ายบริหารทั่วไป'),
        roles: resolvedRoles as any,
        username: source.username || initialMatch?.username || source.email.split('@')[0],
        password: source.password || initialMatch?.password || 'password123',
      };
      users.push(mergedUser);
      if (useLocal) {
        setDoc(doc(db, 'users', mergedUser.id), cleanFirestoreData(mergedUser)).catch(() => {});
      }
    });
    return users;
  } catch (error) {
    console.error('Error fetching users from Firestore:', error);
    return INITIAL_USERS;
  }
}

export async function saveUser(user: User): Promise<void> {
  const updatedAt = new Date().toISOString();
  const cleaned = cleanFirestoreData({
    ...user,
    updatedAt,
  });
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('car_booking_users');
      const list: User[] = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list)) {
        const idx = list.findIndex((u) => u.id === cleaned.id);
        if (idx >= 0) {
          list[idx] = cleaned;
        } else {
          list.push(cleaned);
        }
        safeLocalStorageSet('car_booking_users', JSON.stringify(list));
      }
    } catch {
      // ignore
    }
  }
  const docRef = doc(db, 'users', cleaned.id);
  await setDoc(docRef, cleaned);
}

export async function saveMultipleUsers(usersToSave: User[]): Promise<void> {
  if (usersToSave.length === 0) return;
  const updatedAt = new Date().toISOString();
  const cleanedUsers = usersToSave.map((u) =>
    cleanFirestoreData({
      ...u,
      updatedAt,
    })
  );
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('car_booking_users');
      const list: User[] = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list)) {
        for (const cu of cleanedUsers) {
          const idx = list.findIndex((u) => u.id === cu.id);
          if (idx >= 0) {
            list[idx] = cu;
          } else {
            list.push(cu);
          }
        }
        safeLocalStorageSet('car_booking_users', JSON.stringify(list));
      }
    } catch {
      // ignore
    }
  }
  const batch = writeBatch(db);
  for (const cu of cleanedUsers) {
    batch.set(doc(db, 'users', cu.id), cu);
  }
  await batch.commit();
}

export async function deleteUser(userId: string): Promise<void> {
  const docRef = doc(db, 'users', userId);
  await deleteDoc(docRef);
}

const DELETED_BOOKINGS_STORAGE_KEY = 'car_booking_deleted_booking_ids';

export function getDeletedBookingIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DELETED_BOOKINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {
    // ignore
  }
  return new Set();
}

function addDeletedBookingId(bookingId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const set = getDeletedBookingIds();
    set.add(bookingId);
    localStorage.setItem(DELETED_BOOKINGS_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

function getLocalStoredBookings(): Booking[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('car_booking_bookings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((b) => b && b.id);
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveLocalStoredBookings(bookings: Booking[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Store booking metadata without heavy base64 photos in localStorage so the 5MB quota
    // is never exhausted (full photos are persisted in Firestore and Express server store).
    const metadataOnly = bookings.map((b, idx) => {
      if (idx < 2) return b;
      const copy = { ...b };
      delete copy.startMileagePhoto;
      delete copy.endMileagePhoto;
      delete copy.keyReturnPhoto;
      return copy;
    });
    localStorage.setItem('car_booking_bookings', JSON.stringify(metadataOnly));
  } catch {
    try {
      const strippedAll = bookings.map((b) => {
        const copy = { ...b };
        delete copy.startMileagePhoto;
        delete copy.endMileagePhoto;
        delete copy.keyReturnPhoto;
        return copy;
      });
      localStorage.setItem('car_booking_bookings', JSON.stringify(strippedAll));
    } catch {
      // ignore
    }
  }
}

export function areBookingListsEqual(a: Booking[], b: Booking[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.status !== y.status ||
      x.startMileage !== y.startMileage ||
      x.endMileage !== y.endMileage ||
      x.startFuelLevel !== y.startFuelLevel ||
      x.endFuelLevel !== y.endFuelLevel ||
      Boolean(x.startMileagePhoto) !== Boolean(y.startMileagePhoto) ||
      Boolean(x.endMileagePhoto) !== Boolean(y.endMileagePhoto) ||
      Boolean(x.keyReturnPhoto) !== Boolean(y.keyReturnPhoto) ||
      x.stage1ApprovedBy !== y.stage1ApprovedBy ||
      x.stage2ApprovedBy !== y.stage2ApprovedBy ||
      x.rejectionReason !== y.rejectionReason ||
      x.lineNotifiedAt !== y.lineNotifiedAt
    ) {
      return false;
    }
  }
  return true;
}

function getBookingStatusRank(status?: string): number {
  switch (status) {
    case 'Completed':
      return 5;
    case 'Cancelled':
      return 4;
    case 'Approved':
      return 3;
    case 'Pending_Approve2':
      return 2;
    case 'Pending':
    default:
      return 1;
  }
}

function getBookingModificationTime(b: Booking): number {
  const timestamps = [
    (b as any).updatedAtServer,
    b.endRecordedAt,
    b.startRecordedAt,
    b.approvedAt,
    b.stage2ApprovedAt,
    b.stage1ApprovedAt,
    b.lineNotifiedAt,
    b.createdAt,
  ].filter(Boolean) as string[];

  let maxMs = 0;
  for (const ts of timestamps) {
    const ms = new Date(ts).getTime();
    if (!isNaN(ms) && ms > maxMs) maxMs = ms;
  }
  return maxMs;
}

export function normalizeSingleBooking(data: Booking): Booking {
  const normalizedJobNumber = data.jobNumber
    ? data.jobNumber.replace(/^JOB-/, 'AX-')
    : undefined;
  const userMatch = INITIAL_USERS.find((u) => u.id === data.userId);
  return {
    ...data,
    ...(normalizedJobNumber ? { jobNumber: normalizedJobNumber } : {}),
    userDepartment: data.userDepartment || userMatch?.department || '',
    userDivision: data.userDivision || userMatch?.division || '',
  };
}

export function mergeBookingsLists(
  lists: Booking[][],
  extraDeletedIds?: Iterable<string>
): Booking[] {
  const deletedSet = getDeletedBookingIds();
  if (extraDeletedIds) {
    for (const id of extraDeletedIds) {
      deletedSet.add(id);
    }
  }

  const map = new Map<string, Booking>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      if (!raw || !raw.id || deletedSet.has(raw.id)) continue;
      const item = normalizeSingleBooking(raw);
      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
      } else {
        const rankNew = getBookingStatusRank(item.status);
        const rankOld = getBookingStatusRank(existing.status);
        const timeNew = getBookingModificationTime(item);
        const timeOld = getBookingModificationTime(existing);

        if (rankNew > rankOld || (rankNew === rankOld && timeNew >= timeOld)) {
          map.set(item.id, { ...existing, ...item });
        } else {
          map.set(item.id, { ...item, ...existing });
        }
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
}

export async function fetchServerBookings(): Promise<{
  bookings: Booking[];
  deletedIds: string[];
}> {
  if (typeof window === 'undefined') return { bookings: [], deletedIds: [] };
  try {
    const resp = await fetch('/api/bookings');
    if (resp.ok) {
      const data = await resp.json();
      return {
        bookings: Array.isArray(data?.bookings) ? data.bookings : [],
        deletedIds: Array.isArray(data?.deletedIds) ? data.deletedIds : [],
      };
    }
  } catch {
    // ignore
  }
  return { bookings: [], deletedIds: [] };
}

// Bookings CRUD and seeding
export async function getBookings(): Promise<Booking[]> {
  const localBookings = getLocalStoredBookings();

  const [firestoreResult, serverResult] = await Promise.allSettled([
    (async () => {
      const colRef = collection(db, 'bookings');
      const snapshot = await getDocs(colRef);
      const list: Booking[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Booking;
        if (data && data.id) {
          list.push(normalizeSingleBooking(data));
        }
      });
      return list;
    })(),
    fetchServerBookings(),
  ]);

  const firestoreBookings =
    firestoreResult.status === 'fulfilled' ? firestoreResult.value : [];
  const serverBookings =
    serverResult.status === 'fulfilled' ? serverResult.value.bookings : [];
  const serverDeletedIds =
    serverResult.status === 'fulfilled' ? serverResult.value.deletedIds : [];

  for (const delId of serverDeletedIds) {
    addDeletedBookingId(delId);
  }

  const merged = mergeBookingsLists(
    [localBookings, serverBookings, firestoreBookings],
    serverDeletedIds
  );

  saveLocalStoredBookings(merged);

  // Backfill any missing bookings to Server & Firestore in the background
  const firestoreIds = new Set(firestoreBookings.map((b) => b.id));
  const serverIds = new Set(serverBookings.map((b) => b.id));

  for (const b of merged) {
    if (!firestoreIds.has(b.id)) {
      setDoc(doc(db, 'bookings', b.id), cleanFirestoreData(b)).catch(() => {});
    }
    if (!serverIds.has(b.id) && typeof window !== 'undefined') {
      fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking: cleanFirestoreData(b) }),
      }).catch(() => {});
    }
  }

  return merged;
}

export function subscribeToBookings(onUpdate: (bookings: Booking[]) => void): () => void {
  const colRef = collection(db, 'bookings');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const firestoreList: Booking[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Booking;
        if (!data || !data.id) return;
        firestoreList.push(normalizeSingleBooking(data));
      });
      const localList = getLocalStoredBookings();
      const merged = mergeBookingsLists([localList, firestoreList]);
      saveLocalStoredBookings(merged);
      onUpdate(merged);
    },
    (error) => {
      console.error('Error in subscribeToBookings:', error);
    }
  );
}

export function subscribeToUsers(onUpdate: (users: User[]) => void): () => void {
  const colRef = collection(db, 'users');
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) return;
      const localUsersRaw = typeof window !== 'undefined' ? localStorage.getItem('car_booking_users') : null;
      const localUsersMap = new Map<string, User & { updatedAt?: string }>();
      if (localUsersRaw) {
        try {
          const parsed = JSON.parse(localUsersRaw);
          if (Array.isArray(parsed)) {
            parsed.forEach((u: any) => {
              if (u && u.id) localUsersMap.set(u.id, u);
            });
          }
        } catch {
          // ignore
        }
      }

      const list: User[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as User & { updatedAt?: string };
        const initialMatch = INITIAL_USERS.find(
          (u) => u.id === data.id || u.email.toLowerCase() === data.email.toLowerCase()
        );
        const localMatch = localUsersMap.get(data.id);
        const useLocal =
          localMatch &&
          localMatch.updatedAt &&
          (!data.updatedAt || localMatch.updatedAt > data.updatedAt);
        const source = useLocal ? localMatch : data;

        const resolvedRoles =
          Array.isArray(source.roles) && data.roles && source.roles.length > 0
            ? source.roles
            : source.role === 'Admin'
            ? ['Admin', 'User']
            : ['User'];
        list.push({
          ...source,
          employeeCode:
            source.employeeCode ||
            initialMatch?.employeeCode ||
            `EMP-${data.id.substring(data.id.length - 3)}`,
          division:
            source.division !== undefined
              ? source.division
              : initialMatch?.division || 'ฝ่ายบริหารทั่วไป',
          roles: resolvedRoles as any,
          username: source.username || initialMatch?.username || source.email.split('@')[0],
          password: source.password || initialMatch?.password || 'password123',
        });
      });
      onUpdate(list);
    },
    (error) => {
      console.error('Error in subscribeToUsers:', error);
    }
  );
}

export function subscribeToVehicles(onUpdate: (vehicles: Vehicle[]) => void): () => void {
  const colRef = collection(db, 'vehicles');
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) return;
      const list: Vehicle[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Vehicle);
      });
      onUpdate(list);
    },
    (error) => {
      console.error('Error in subscribeToVehicles:', error);
    }
  );
}

export async function saveBooking(booking: Booking): Promise<void> {
  const normalized = normalizeSingleBooking(booking);
  const [startPhoto, endPhoto, keyPhoto] = await Promise.all([
    compressDataUrlIfNeeded(normalized.startMileagePhoto, 800, 0.62),
    compressDataUrlIfNeeded(normalized.endMileagePhoto, 800, 0.62),
    compressDataUrlIfNeeded(normalized.keyReturnPhoto, 800, 0.62),
  ]);

  const cleaned = cleanFirestoreData({
    ...normalized,
    ...(startPhoto ? { startMileagePhoto: startPhoto } : {}),
    ...(endPhoto ? { endMileagePhoto: endPhoto } : {}),
    ...(keyPhoto ? { keyReturnPhoto: keyPhoto } : {}),
  });

  // 1. Immediately persist to localStorage
  const currentLocal = getLocalStoredBookings();
  const mergedLocal = mergeBookingsLists([currentLocal, [cleaned]]);
  saveLocalStoredBookings(mergedLocal);

  // 2. Persist to both Express Server and Firestore in parallel
  const tasks: Promise<any>[] = [
    setDoc(doc(db, 'bookings', cleaned.id), cleaned),
  ];

  if (typeof window !== 'undefined') {
    tasks.push(
      fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking: cleaned }),
      })
    );
  }

  await Promise.allSettled(tasks);
}

export async function deleteBooking(bookingId: string): Promise<void> {
  addDeletedBookingId(bookingId);
  const remaining = getLocalStoredBookings().filter((b) => b.id !== bookingId);
  saveLocalStoredBookings(remaining);

  const tasks: Promise<any>[] = [
    deleteDoc(doc(db, 'bookings', bookingId)),
  ];

  if (typeof window !== 'undefined') {
    tasks.push(
      fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
        method: 'DELETE',
      })
    );
  }

  await Promise.allSettled(tasks);
}

// Reset data in Firestore back to defaults
export async function resetFirestoreData(): Promise<{ vehicles: Vehicle[]; users: User[]; bookings: Booking[] }> {
  const vehicleSnap = await getDocs(collection(db, 'vehicles'));
  const userSnap = await getDocs(collection(db, 'users'));
  const bookingSnap = await getDocs(collection(db, 'bookings'));
  
  const batch = writeBatch(db);
  vehicleSnap.forEach((doc) => batch.delete(doc.ref));
  userSnap.forEach((doc) => batch.delete(doc.ref));
  bookingSnap.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  
  const seedBatch = writeBatch(db);
  for (const vehicle of INITIAL_VEHICLES) {
    seedBatch.set(doc(db, 'vehicles', vehicle.id), vehicle);
  }
  for (const user of INITIAL_USERS) {
    seedBatch.set(doc(db, 'users', user.id), user);
  }
  for (const booking of INITIAL_BOOKINGS) {
    seedBatch.set(doc(db, 'bookings', booking.id), booking);
  }
  await seedBatch.commit();
  
  return {
    vehicles: INITIAL_VEHICLES,
    users: INITIAL_USERS,
    bookings: INITIAL_BOOKINGS
  };
}

// Role Permissions Matrix CRUD
export async function getRolePermissions(): Promise<RolePermissionsMatrix> {
  try {
    const docRef = doc(db, 'settings', 'role_permissions');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data?.matrix) {
        const normalized = normalizeRolePermissionsMatrix(data.matrix);
        saveStoredRolePermissions(normalized);
        return normalized;
      }
    }
    const localMatrix = getStoredRolePermissions();
    await setDoc(docRef, {
      id: 'role_permissions',
      matrix: localMatrix,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
    return localMatrix;
  } catch (error) {
    console.error('Error fetching role permissions from Firestore:', error);
    return getStoredRolePermissions();
  }
}

export async function saveRolePermissions(matrix: RolePermissionsMatrix): Promise<void> {
  const normalized = normalizeRolePermissionsMatrix(matrix);
  saveStoredRolePermissions(normalized);
  try {
    const docRef = doc(db, 'settings', 'role_permissions');
    await setDoc(docRef, {
      id: 'role_permissions',
      matrix: normalized,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error saving role permissions to Firestore:', error);
  }
}

// Organization Settings (Departments & Divisions) Cloud + Server + LocalStorage Persistence
let highestKnownOrgVersion = 0;

export async function getOrganizationSettings(
  _existingUsers?: User[]
): Promise<{ departments: string[]; divisions: string[] }> {
  interface OrgCandidate {
    source: 'local' | 'server' | 'firestore';
    departments: string[];
    divisions: string[];
    version: number;
    updatedAt: string;
  }

  const [serverResult, firestoreResult] = await Promise.allSettled([
    (async () => {
      if (typeof window === 'undefined') return null;
      const resp = await fetch('/api/organization-settings');
      if (!resp.ok) return null;
      const json = await resp.json();
      const s = json?.settings;
      if (s && Array.isArray(s.departments) && Array.isArray(s.divisions)) {
        return {
          source: 'server' as const,
          departments: s.departments.map((d: string) => (d || '').trim()).filter(Boolean),
          divisions: s.divisions.map((d: string) => (d || '').trim()).filter(Boolean),
          version: typeof s.version === 'number' ? s.version : 0,
          updatedAt: String(s.updatedAt || ''),
        };
      }
      return null;
    })(),
    (async () => {
      const docRef = doc(db, 'settings', 'organization_v2');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data?.departments) && Array.isArray(data?.divisions)) {
          return {
            source: 'firestore' as const,
            departments: data.departments.map((d: string) => (d || '').trim()).filter(Boolean),
            divisions: data.divisions.map((d: string) => (d || '').trim()).filter(Boolean),
            version: typeof data.version === 'number' ? data.version : 0,
            updatedAt: String(data.updatedAt || ''),
          };
        }
      }
      return null;
    })(),
  ]);

  // Read local state AFTER awaiting network so any user edit made during network fetch wins
  const localDepts = getStoredDepartments();
  const localDivs = getStoredDivisions();
  const localUpdatedAt = getStoredOrgUpdatedAt();
  const localVersion = Math.max(getStoredOrgVersion(), highestKnownOrgVersion);

  const candidates: OrgCandidate[] = [
    {
      source: 'local',
      departments: localDepts,
      divisions: localDivs,
      version: localVersion,
      updatedAt: localUpdatedAt,
    },
  ];

  const serverCandidate = serverResult.status === 'fulfilled' ? serverResult.value : null;
  const firestoreCandidate = firestoreResult.status === 'fulfilled' ? firestoreResult.value : null;

  if (serverCandidate) candidates.push(serverCandidate);
  if (firestoreCandidate) candidates.push(firestoreCandidate);

  // Sort by version descending; on version tie, prefer 'local' first so user's browser state is never overwritten
  candidates.sort((a, b) => {
    if (b.version !== a.version) {
      return b.version - a.version;
    }
    if (a.source === 'local') return -1;
    if (b.source === 'local') return 1;
    return 0;
  });

  const winner = candidates[0];
  const finalVersion = Math.max(winner.version, localVersion);
  highestKnownOrgVersion = finalVersion;
  const finalUpdatedAt = winner.updatedAt || new Date().toISOString();
  const finalDepts = Array.from(new Set(winner.departments));
  const finalDivs = Array.from(new Set(winner.divisions));

  saveStoredDepartments(finalDepts, finalUpdatedAt, finalVersion);
  saveStoredDivisions(finalDivs, finalUpdatedAt, finalVersion);
  saveStoredOrgUpdatedAt(finalUpdatedAt);
  if (finalVersion > 0) {
    saveStoredOrgVersion(finalVersion);
  }

  // Only backfill to Server and Firestore if we have an explicit saved version > 0
  if (finalVersion > 0) {
    if (!serverCandidate || serverCandidate.version < finalVersion) {
      if (typeof window !== 'undefined') {
        fetch('/api/organization-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            departments: finalDepts,
            divisions: finalDivs,
            version: finalVersion,
            updatedAt: finalUpdatedAt,
          }),
        }).catch(() => {});
      }
    }

    if (!firestoreCandidate || firestoreCandidate.version < finalVersion) {
      setDoc(doc(db, 'settings', 'organization_v2'), {
        id: 'organization_v2',
        departments: finalDepts,
        divisions: finalDivs,
        version: finalVersion,
        updatedAt: finalUpdatedAt,
      }).catch(() => {});
    }
  }

  return { departments: finalDepts, divisions: finalDivs };
}

export async function saveOrganizationSettings(
  departments: string[],
  divisions: string[]
): Promise<void> {
  const updatedAt = new Date().toISOString();
  const nextVersion = Math.max(getStoredOrgVersion(), highestKnownOrgVersion) + 1;
  highestKnownOrgVersion = nextVersion;

  const cleanDepts = Array.from(new Set(departments.map((d) => (d || '').trim()).filter(Boolean)));
  const cleanDivs = Array.from(new Set(divisions.map((d) => (d || '').trim()).filter(Boolean)));

  // 1. Immediately persist to in-memory + localStorage with incremented version
  saveStoredDepartments(cleanDepts, updatedAt, nextVersion);
  saveStoredDivisions(cleanDivs, updatedAt, nextVersion);
  saveStoredOrgUpdatedAt(updatedAt);
  saveStoredOrgVersion(nextVersion);

  // 2. Persist to both Express Server and Firestore in parallel
  const payload = {
    id: 'organization_v2',
    departments: cleanDepts,
    divisions: cleanDivs,
    version: nextVersion,
    updatedAt,
  };

  const tasks: Promise<any>[] = [
    setDoc(doc(db, 'settings', 'organization_v2'), payload),
    setDoc(doc(db, 'settings', 'organization'), {
      ...payload,
      id: 'organization',
    }),
  ];

  if (typeof window !== 'undefined') {
    tasks.push(
      fetch('/api/organization-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    );
  }

  await Promise.allSettled(tasks);

  recordAuditLog({
    category: 'ORGANIZATION',
    action: 'บันทึกกำหนดแผนกและฝ่าย',
    actorName: 'ผู้ดูแลระบบ (Admin)',
    actorRole: 'Admin',
    targetLabel: `แผนก ${cleanDepts.length} รายการ / ฝ่าย ${cleanDivs.length} รายการ`,
    details: `บันทึกการตั้งค่าแผนก (${cleanDepts.join(', ') || '-'}) และฝ่าย (${cleanDivs.join(', ') || '-'}) เวอร์ชัน v${nextVersion}`,
    channel: 'Web',
  }).catch(() => {});
}

export function subscribeToOrganizationSettings(
  onUpdate: (data: { departments: string[]; divisions: string[] }) => void
): () => void {
  const docRef = doc(db, 'settings', 'organization_v2');
  return onSnapshot(
    docRef,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (!Array.isArray(data?.departments) || !Array.isArray(data?.divisions)) return;

      const cloudVersion = typeof data?.version === 'number' ? data.version : 0;
      const currentVersion = Math.max(getStoredOrgVersion(), highestKnownOrgVersion);

      // Ignore any snapshot whose version is not strictly newer than our local version (unless local is 0)
      if (currentVersion > 0 && cloudVersion <= currentVersion) {
        return;
      }
      if (cloudVersion === 0 && currentVersion > 0) {
        return;
      }

      highestKnownOrgVersion = Math.max(highestKnownOrgVersion, cloudVersion);
      const cloudUpdatedAt = String(data?.updatedAt || new Date().toISOString());

      const departments = Array.from(
        new Set(data.departments.map((d: string) => (d || '').trim()).filter(Boolean))
      );
      const divisions = Array.from(
        new Set(data.divisions.map((d: string) => (d || '').trim()).filter(Boolean))
      );

      saveStoredDepartments(departments, cloudUpdatedAt, cloudVersion);
      saveStoredDivisions(divisions, cloudUpdatedAt, cloudVersion);
      saveStoredOrgUpdatedAt(cloudUpdatedAt);
      if (cloudVersion > 0) {
        saveStoredOrgVersion(cloudVersion);
      }
      onUpdate({ departments, divisions });
    },
    (error) => {
      console.error('Error in subscribeToOrganizationSettings:', error);
    }
  );
}

// Audit Log Persistence (Firestore + LocalStorage)
const AUDIT_LOGS_STORAGE_KEY = 'car_booking_audit_logs';

export function getLocalAuditLogs(): AuditLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AUDIT_LOGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalAuditLogs(logs: AuditLogEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    const sorted = [...logs]
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
      .slice(0, 500);
    safeLocalStorageSet(AUDIT_LOGS_STORAGE_KEY, JSON.stringify(sorted));
  } catch {
    // ignore
  }
}

export function mergeAuditLogs(lists: AuditLogEntry[][]): AuditLogEntry[] {
  const map = new Map<string, AuditLogEntry>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (item && item.id) {
        map.set(item.id, item);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    (b.timestamp || '').localeCompare(a.timestamp || '')
  );
}

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  const local = getLocalAuditLogs();
  try {
    const colRef = collection(db, 'audit_logs');
    const snapshot = await getDocs(colRef);
    const cloudLogs: AuditLogEntry[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as AuditLogEntry;
      if (data && data.id) {
        cloudLogs.push(data);
      }
    });
    const merged = mergeAuditLogs([local, cloudLogs]);
    saveLocalAuditLogs(merged);
    return merged;
  } catch (error) {
    console.error('Error fetching audit logs from Firestore:', error);
    return local;
  }
}

export async function recordAuditLog(
  entry: Omit<AuditLogEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): Promise<AuditLogEntry> {
  const fullEntry: AuditLogEntry = cleanFirestoreData({
    id: entry.id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: entry.timestamp || new Date().toISOString(),
    category: entry.category,
    action: entry.action,
    actorId: entry.actorId,
    actorName: entry.actorName || 'ผู้ใช้งานระบบ',
    actorRole: entry.actorRole,
    actorDepartment: entry.actorDepartment,
    targetId: entry.targetId,
    targetLabel: entry.targetLabel,
    details: entry.details,
    channel: entry.channel || 'Web',
  });

  const currentLocal = getLocalAuditLogs();
  const updatedLocal = mergeAuditLogs([[fullEntry], currentLocal]);
  saveLocalAuditLogs(updatedLocal);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('audit-log-updated', { detail: fullEntry }));
  }

  try {
    await setDoc(doc(db, 'audit_logs', fullEntry.id), fullEntry);
  } catch (error) {
    console.error('Error saving audit log to Firestore:', error);
  }

  return fullEntry;
}

export function subscribeToAuditLogs(
  onUpdate: (logs: AuditLogEntry[]) => void
): () => void {
  const colRef = collection(db, 'audit_logs');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const cloudLogs: AuditLogEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as AuditLogEntry;
        if (data && data.id) {
          cloudLogs.push(data);
        }
      });
      const merged = mergeAuditLogs([getLocalAuditLogs(), cloudLogs]);
      saveLocalAuditLogs(merged);
      onUpdate(merged);
    },
    (error) => {
      console.error('Error in subscribeToAuditLogs:', error);
    }
  );
}


