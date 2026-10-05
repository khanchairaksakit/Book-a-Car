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
  getDocFromServer
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

export async function saveVehicle(vehicle: Vehicle): Promise<void> {
  const docRef = doc(db, 'vehicles', vehicle.id);
  await setDoc(docRef, vehicle);
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
    snapshot.forEach((doc) => {
      const data = doc.data() as User;
      const initialMatch = INITIAL_USERS.find(
        (u) => u.id === data.id || u.email.toLowerCase() === data.email.toLowerCase()
      );
      users.push({
        ...data,
        employeeCode: data.employeeCode || initialMatch?.employeeCode || `EMP-${data.id.substring(data.id.length - 3)}`,
        division: data.division || initialMatch?.division || 'ฝ่ายบริหารทั่วไป',
        roles: data.roles || initialMatch?.roles || (data.role === 'Admin' ? ['Admin', 'User'] : ['User']),
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
  await setDoc(docRef, user);
}

export async function deleteUser(userId: string): Promise<void> {
  const docRef = doc(db, 'users', userId);
  await deleteDoc(docRef);
}

// Bookings CRUD and seeding
export async function getBookings(): Promise<Booking[]> {
  try {
    const colRef = collection(db, 'bookings');
    const snapshot = await getDocs(colRef);
    
    if (snapshot.empty) {
      return [];
    }
    
    const bookings: Booking[] = [];
    const legacyCleanupBatch = writeBatch(db);
    let hasLegacyDocs = false;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Booking;
      // Purge any old test/legacy bookings created prior to AX- jobNumber format
      if (!data.jobNumber || !data.jobNumber.startsWith('AX-')) {
        legacyCleanupBatch.delete(docSnap.ref);
        hasLegacyDocs = true;
        return;
      }
      const userMatch = INITIAL_USERS.find((u) => u.id === data.userId);
      bookings.push({
        ...data,
        userDepartment: data.userDepartment || userMatch?.department || '',
        userDivision: data.userDivision || userMatch?.division || '',
      });
    });

    if (hasLegacyDocs) {
      await legacyCleanupBatch.commit().catch(() => {});
    }

    return bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('Error fetching bookings from Firestore:', error);
    return [];
  }
}

export async function saveBooking(booking: Booking): Promise<void> {
  const docRef = doc(db, 'bookings', booking.id);
  await setDoc(docRef, booking);
}

export async function deleteBooking(bookingId: string): Promise<void> {
  const docRef = doc(db, 'bookings', bookingId);
  await deleteDoc(docRef);
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

