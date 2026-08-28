import { Injectable } from '@angular/core';

export interface DetailPair {
  0: string;
  1: string;
}

export interface TravelRequest {
  id?: string;
  type: string;
  name: string;
  email: string;
  phone: string;
  summary: string;
  status?: string;
  details: DetailPair[];
  metadata?: {
    source?: string;
    notification?: TravelRequestNotification;
    [key: string]: unknown;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface TravelRequestNotification {
  status: 'pending' | 'sent' | 'failed' | 'not_configured';
  recipients?: string[];
  provider?: string;
  messageId?: string;
  attemptedAt?: string;
  sentAt?: string;
  error?: string;
}

export interface EligibleApplicant {
  id: string;
  name: string;
  email: string;
  phone: string;
  accessCode?: string;
  category: string;
  userType?: 'basic' | 'premium' | 'staff';
  status: 'pending' | 'active' | 'blocked';
  source?: 'admin' | 'signup';
  notes: string;
  signupCompletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UploadedFileRecord {
  id?: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
}

export interface PassportParsedFields {
  surname?: string;
  firstName?: string;
  middleName?: string;
  passportNumber?: string;
  nationality?: string;
  dateOfBirth?: string;
  sex?: string;
  expirationDate?: string;
  issuingCountry?: string;
  personalNumber?: string;
}

export interface PassportParseResult {
  parsed: PassportParsedFields;
  validation?: {
    valid: boolean;
    reason: string;
    travelDate?: string;
    minAcceptableExpiry?: string;
  };
  warning?: string;
}

export interface UploadGroup {
  field: string;
  document: string;
  required: boolean;
  files: UploadedFileRecord[];
}

export interface VisaApplication {
  id: string;
  applicantId: string;
  name: string;
  email: string;
  phone: string;
  applicants: string;
  applicantCategory: string;
  userType?: 'basic' | 'premium' | 'staff';
  passportExpiry: string;
  travelDate: string;
  travelHistory: string;
  role: string;
  salary: string;
  employmentLength: string;
  notes: string;
  fee: string;
  status: 'Draft' | 'Submitted' | 'In review' | 'Missing documents' | 'Approved' | 'Declined';
  paymentStatus?: 'Unpaid' | 'Pending' | 'Paid' | 'Failed';
  paymentReference?: string;
  paymentAmount?: number;
  paymentCurrency?: string;
  paymentPaidAt?: string;
  reviewedAt?: string;
  passportDetails?: PassportParseResult | null;
  reviewConfirmed?: boolean;
  uploads?: UploadGroup[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PaystackPaymentInit {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
  amount: number;
  currency: string;
  userType?: 'basic' | 'premium' | 'staff';
  staff?: boolean;
}

export interface VisaPricing {
  basic: number;
  premium: number;
  staff: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private superHeaders(superAdminCode?: string): Record<string, string> {
    return superAdminCode ? { 'x-super-admin-code': superAdminCode } : {};
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(path, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof data.error === 'string' ? data.error : 'Request failed';
      throw new Error(message);
    }
    return data as T;
  }

  saveTravelRequest(record: TravelRequest): Promise<{ request: TravelRequest }> {
    return this.request('/api/requests', {
      method: 'POST',
      body: JSON.stringify(record)
    });
  }

  listTravelRequests(adminCode: string): Promise<{ requests: TravelRequest[] }> {
    return this.request('/api/requests', {
      headers: this.superHeaders(adminCode)
    });
  }

  updateTravelRequest(id: string, status: string, adminCode: string): Promise<{ request: TravelRequest }> {
    return this.request(`/api/requests/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: this.superHeaders(adminCode),
      body: JSON.stringify({ status })
    });
  }

  notifyTravelRequest(id: string, adminCode: string): Promise<{ request: TravelRequest; notification: TravelRequestNotification }> {
    return this.request(`/api/requests/${encodeURIComponent(id)}/notify`, {
      method: 'POST',
      headers: this.superHeaders(adminCode),
      body: JSON.stringify({})
    });
  }

  listEligible(): Promise<{ applicants: EligibleApplicant[] }> {
    return this.request('/api/eligible');
  }

  authorizeAdmin(passcode: string): Promise<{ role: 'admin' | 'super'; superAdmin: boolean }> {
    return this.request('/api/admin/authorize', {
      method: 'POST',
      body: JSON.stringify({ passcode })
    });
  }

  getVisaPricing(): Promise<{ pricing: VisaPricing }> {
    return this.request('/api/visa/pricing');
  }

  updateVisaPricing(pricing: Partial<VisaPricing>, superAdminCode: string): Promise<{ pricing: VisaPricing }> {
    return this.request('/api/visa/pricing', {
      method: 'PATCH',
      headers: this.superHeaders(superAdminCode),
      body: JSON.stringify({ pricing })
    });
  }

  signupApplicant(record: Partial<EligibleApplicant>): Promise<{ applicant: EligibleApplicant }> {
    return this.request('/api/eligible/signup', {
      method: 'POST',
      body: JSON.stringify(record)
    });
  }

  loginApplicant(email: string, accessCode: string): Promise<{ applicant: EligibleApplicant }> {
    return this.request('/api/eligible/login', {
      method: 'POST',
      body: JSON.stringify({ email, accessCode })
    });
  }

  addEligible(record: Partial<EligibleApplicant>, superAdminCode?: string): Promise<{ applicants: EligibleApplicant[] }> {
    return this.request('/api/eligible', {
      method: 'POST',
      headers: this.superHeaders(superAdminCode),
      body: JSON.stringify(record)
    });
  }

  importEligible(records: Partial<EligibleApplicant>[], superAdminCode?: string): Promise<{ count: number; applicants: EligibleApplicant[] }> {
    return this.request('/api/eligible/import', {
      method: 'POST',
      headers: this.superHeaders(superAdminCode),
      body: JSON.stringify({ records })
    });
  }

  updateEligible(id: string, fields: Partial<EligibleApplicant>, superAdminCode?: string): Promise<{ applicant: EligibleApplicant }> {
    return this.request(`/api/eligible/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: this.superHeaders(superAdminCode),
      body: JSON.stringify(fields)
    });
  }

  deleteEligible(id: string, superAdminCode?: string): Promise<{ ok: boolean }> {
    return this.request(`/api/eligible/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.superHeaders(superAdminCode)
    });
  }

  listApplications(superAdminCode: string): Promise<{ applications: VisaApplication[] }> {
    return this.request('/api/visa/applications', {
      headers: this.superHeaders(superAdminCode)
    });
  }

  getApplication(id: string): Promise<{ application: VisaApplication }> {
    return this.request(`/api/visa/applications/${encodeURIComponent(id)}`);
  }

  saveApplication(application: VisaApplication): Promise<{ application: VisaApplication }> {
    return this.request('/api/visa/applications', {
      method: 'POST',
      body: JSON.stringify(application)
    });
  }

  uploadApplicationDocument(
    applicationId: string,
    payload: { field: string; document: string; required: boolean; replaceField: boolean; file: UploadedFileRecord }
  ): Promise<{ application: VisaApplication }> {
    return this.request(`/api/visa/applications/${encodeURIComponent(applicationId)}/documents`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async downloadApplicationDocument(applicationId: string, fileId: string, superAdminCode: string): Promise<Blob> {
    const response = await fetch(`/api/visa/applications/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(fileId)}`, {
      headers: this.superHeaders(superAdminCode)
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const message = typeof data.error === 'string' ? data.error : 'Could not download the document.';
      throw new Error(message);
    }
    return response.blob();
  }

  updateApplication(id: string, fields: Partial<VisaApplication>, superAdminCode: string): Promise<{ application: VisaApplication }> {
    return this.request(`/api/visa/applications/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: this.superHeaders(superAdminCode),
      body: JSON.stringify(fields)
    });
  }

  initializePaystackPayment(application: VisaApplication, callbackUrl: string): Promise<{ application: VisaApplication; payment: PaystackPaymentInit }> {
    return this.request('/api/payments/paystack/initialize', {
      method: 'POST',
      body: JSON.stringify({ ...application, callbackUrl })
    });
  }

  verifyPaystackPayment(reference: string): Promise<{ application: VisaApplication; payment: { verified: boolean; status: string; reference: string } }> {
    return this.request('/api/payments/paystack/verify', {
      method: 'POST',
      body: JSON.stringify({ reference })
    });
  }

  parsePassport(file: UploadedFileRecord, travelDate?: string): Promise<PassportParseResult> {
    return this.request('/api/passport/parse', {
      method: 'POST',
      body: JSON.stringify({ file, travelDate })
    });
  }
}
