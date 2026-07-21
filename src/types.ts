/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type VehicleType = 'Sedan' | 'SUV' | 'Van' | 'Pickup';
export type VehicleStatus = 'Available' | 'In Use' | 'Maintenance';
export type BookingStatus = 'Pending' | 'Approved' | 'Cancelled' | 'Completed';

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  plateNumber: string;
  type: VehicleType;
  capacity: number;
  status: VehicleStatus;
  imageUrl: string;
  description?: string;
}

export interface User {
  id: string;
  name: string;
  department: string;
  phone: string;
  email: string;
  role: 'User' | 'Admin';
}

export interface Booking {
  id: string;
  vehicleId: string;
  userId: string;
  userName: string;
  userPhone?: string;
  vehicleName: string; // brand + model + plateNumber
  startDate: string; // ISO String or YYYY-MM-DDTHH:mm
  endDate: string; // ISO String or YYYY-MM-DDTHH:mm
  purpose: string;
  destination: string;
  passengersCount: number;
  status: BookingStatus;
  createdAt: string;
}
