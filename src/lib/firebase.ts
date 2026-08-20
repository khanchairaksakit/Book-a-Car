import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocFromServer
} from 'firebase/firestore';
import { Vehicle, User, Booking } from '../types';
import { INITIAL_VEHICLES, INITIAL_USERS, INITIAL_BOOKINGS } from '../data/mockData';
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
      users.push(doc.data() as User);
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
      console.log('Seeding initial bookings to Firestore...');
      const batch = writeBatch(db);
      for (const booking of INITIAL_BOOKINGS) {
        const docRef = doc(db, 'bookings', booking.id);
        batch.set(docRef, booking);
      }
      await batch.commit();
      return INITIAL_BOOKINGS;
    }
    
    const bookings: Booking[] = [];
    snapshot.forEach((doc) => {
      bookings.push(doc.data() as Booking);
    });
    return bookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('Error fetching bookings from Firestore:', error);
    return INITIAL_BOOKINGS;
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
