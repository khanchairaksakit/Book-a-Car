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
import { Vehicle, User, Booking, RolePermissionsMatrix } from '../types';
import { INITIAL_VEHICLES, INITIAL_USERS, INITIAL_BOOKINGS } from '../data/mockData';
import {
  DEFAULT_ROLE_PERMISSIONS,
  normalizeRolePermissionsMatrix,
  getStoredRolePermissions,
  saveStoredRolePermissions,
} from '../utils/userHelpers';
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
  const docRef = doc(db, 'vehicles', vehicle.id);
  await setDoc(docRef, cleanFirestoreData(vehicle));
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
    
    const users: User[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as User;
      const initialMatch = INITIAL_USERS.find(
        (u) => u.id === data.id || u.email.toLowerCase() === data.email.toLowerCase()
      );
      const resolvedRoles =
        Array.isArray(data.roles) && data.roles.length > 0
          ? data.roles
          : data.role === 'Admin'
          ? ['Admin', 'User']
          : ['User'];
      users.push({
        ...data,
        employeeCode: data.employeeCode || initialMatch?.employeeCode || `EMP-${data.id.substring(data.id.length - 3)}`,
        division: data.division || initialMatch?.division || 'ฝ่ายบริหารทั่วไป',
        roles: resolvedRoles as any,
        username: data.username || initialMatch?.username || data.email.split('@')[0],
        password: data.password || initialMatch?.password || 'password123',
      });
    });
    return users;
  } catch (error) {
    console.error('Error fetching users from Firestore:', error);
    return INITIAL_USERS;
  }
}

export async function saveUser(user: User): Promise<void> {
  const docRef = doc(db, 'users', user.id);
  await setDoc(docRef, cleanFirestoreData(user));
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

function saveLocalStoredBookings(bookings: Booking[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('car_booking_bookings', JSON.stringify(bookings));
  } catch {
    // ignore
  }
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
      const list: User[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as User;
        const initialMatch = INITIAL_USERS.find(
          (u) => u.id === data.id || u.email.toLowerCase() === data.email.toLowerCase()
        );
        const resolvedRoles =
          Array.isArray(data.roles) && data.roles.length > 0
            ? data.roles
            : data.role === 'Admin'
            ? ['Admin', 'User']
            : ['User'];
        list.push({
          ...data,
          employeeCode:
            data.employeeCode ||
            initialMatch?.employeeCode ||
            `EMP-${data.id.substring(data.id.length - 3)}`,
          division: data.division || initialMatch?.division || 'ฝ่ายบริหารทั่วไป',
          roles: resolvedRoles as any,
          username: data.username || initialMatch?.username || data.email.split('@')[0],
          password: data.password || initialMatch?.password || 'password123',
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
  const cleaned = cleanFirestoreData(normalizeSingleBooking(booking));

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

