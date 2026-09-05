import { Injectable } from '@angular/core';

export interface TravelPackage {
  slug: string;
  name: string;
  tier: string;
  stars: number;
  priceNaira: number;
  currency: 'NGN';
  priceBasis: string;
  tagline: string;
  description: string;
  image: string;
  hotels: string[];
  inclusions: string[];
  exclusions: string[];
  travelDates: string;
  departureCity: string;
  nights: number | null;
  terms: string;
  checkoutEnabled: boolean;
  unavailableReason: string;
}

export interface PackageCustomer {
  fullName: string;
  email: string;
  phone: string;
}

export interface PackageBooking {
  id: string;
  packageSlug: string;
  packageName: string;
  travellers: number;
  totalAmountKobo: number;
  currency: string;
  paymentStatus: 'Pending' | 'Paid' | 'Failed' | 'Unpaid';
  fulfillmentStatus: 'Awaiting payment' | 'Payment received' | 'Contacted' | 'Confirmed' | 'Cancelled';
  customer: PackageCustomer;
  reference: string;
  createdAt: string;
  paidAt?: string;
  departureCity?: string;
  travelDate?: string;
  roomPreference?: string;
  notes?: string;
  packageSnapshot?: TravelPackage;
}

export interface PackagePayment {
  reference: string;
  accessCode?: string;
  authorizationUrl?: string;
  verified?: boolean;
  status?: string;
}

export interface PackageBookingResult {
  booking: PackageBooking;
  payment?: PackagePayment;
  bookingToken?: string;
}

export interface PackageCheckoutRequest {
  packageSlug: string;
  travellers: number;
  customer: PackageCustomer;
  departureCity: string;
  travelDate: string;
  roomPreference: string;
  notes: string;
  termsAccepted: boolean;
  idempotencyKey: string;
  bookingToken?: string;
}

export class PackageRequestError extends Error {
  constructor(message: string, public statusCode: number, public result?: PackageBookingResult) {
    super(message);
    this.name = 'PackageRequestError';
  }
}

@Injectable({ providedIn: 'root' })
export class PackageService {
  list(): Promise<{ packages: TravelPackage[] }> {
    return this.request('/api/packages');
  }

  listPackages(): Promise<{ packages: TravelPackage[] }> {
    return this.list();
  }

  get(slug: string): Promise<{ package: TravelPackage }> {
    return this.request(`/api/packages/${encodeURIComponent(slug)}`);
  }

  initialize(payload: PackageCheckoutRequest): Promise<PackageBookingResult> {
    return this.request('/api/package-bookings/initialize', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  verify(reference: string, bookingToken: string): Promise<PackageBookingResult> {
    return this.request('/api/package-bookings/verify', {
      method: 'POST',
      body: JSON.stringify({ reference, bookingToken })
    });
  }

  status(reference: string | undefined, bookingToken: string, idempotencyKey?: string): Promise<PackageBookingResult> {
    return this.request('/api/package-bookings/status', {
      method: 'POST',
      body: JSON.stringify({ ...(reference ? { reference } : { idempotencyKey }), bookingToken })
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(path, { ...init, cache: 'no-store', headers: { 'content-type': 'application/json', ...init.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new PackageRequestError(typeof data.error === 'string' ? data.error : 'Please try again.', response.status, data.booking ? data as PackageBookingResult : undefined);
    return data as T;
  }
}
