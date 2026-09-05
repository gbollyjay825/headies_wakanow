import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';

type FulfillmentStatus = 'Awaiting payment' | 'Payment received' | 'Contacted' | 'Confirmed' | 'Cancelled';

interface PackageBooking {
  id: string;
  reference: string;
  packageSlug: string;
  packageName: string;
  customer: { fullName: string; email: string; phone: string };
  travellers: number;
  unitPriceNaira: number;
  departureCity: string;
  travelDate: string;
  roomPreference?: string;
  notes?: string;
  paymentStatus: string;
  totalAmountKobo: number;
  currency: string;
  paidAt?: string;
  fulfillmentStatus: FulfillmentStatus;
  createdAt: string;
  updatedAt: string;
  packageSnapshot?: { inclusions?: string[]; exclusions?: string[]; hotels?: string[]; terms?: string[] | string };
}

@Component({
  selector: 'app-package-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './package-admin.component.html',
  styleUrl: './package-admin.component.css'
})
export class PackageAdminComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) adminCode = '';

  bookings: PackageBooking[] = [];
  loading = false;
  error = '';
  feedback = '';
  search = '';
  paymentFilter = 'all';
  fulfillmentFilter = 'all';
  selectedId = '';
  draftStatus: FulfillmentStatus = 'Awaiting payment';
  updatingId = '';
  readonly fulfillmentStatuses: FulfillmentStatus[] = ['Awaiting payment', 'Payment received', 'Contacted', 'Confirmed', 'Cancelled'];
  private requestVersion = 0;
  private destroyed = false;

  ngOnChanges(): void {
    this.bookings = [];
    this.selectedId = '';
    if (this.adminCode) void this.loadBookings();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.requestVersion++;
  }

  get filteredBookings(): PackageBooking[] {
    const query = this.search.trim().toLowerCase();
    return this.bookings.filter((booking) => {
      if (this.paymentFilter !== 'all' && booking.paymentStatus !== this.paymentFilter) return false;
      if (this.fulfillmentFilter !== 'all' && booking.fulfillmentStatus !== this.fulfillmentFilter) return false;
      return !query || [booking.reference, booking.customer.fullName, booking.customer.email, booking.customer.phone, booking.packageName, booking.departureCity]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
  }

  get selectedBooking(): PackageBooking | null {
    return this.filteredBookings.find((booking) => booking.id === this.selectedId) || null;
  }

  get paidCount(): number {
    return this.bookings.filter((booking) => booking.paymentStatus === 'Paid').length;
  }

  get paidTotal(): number {
    return this.bookings.filter((booking) => booking.paymentStatus === 'Paid').reduce((total, booking) => total + Number(booking.totalAmountKobo || 0), 0);
  }

  get pendingCount(): number {
    return this.bookings.filter((booking) => booking.paymentStatus !== 'Paid' && booking.fulfillmentStatus !== 'Cancelled').length;
  }

  get needsAttentionCount(): number {
    return this.bookings.filter((booking) => booking.paymentStatus === 'Paid' && !['Confirmed', 'Cancelled'].includes(booking.fulfillmentStatus)).length;
  }

  async loadBookings(): Promise<void> {
    if (!this.adminCode || this.updatingId) return;
    const version = ++this.requestVersion;
    this.loading = true;
    this.error = '';
    this.feedback = '';
    try {
      const data = await this.request<{ bookings: PackageBooking[] }>('/api/package-bookings');
      if (this.destroyed || version !== this.requestVersion) return;
      this.bookings = data.bookings.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      this.reconcileSelection();
    } catch (error) {
      if (!this.destroyed && version === this.requestVersion) this.error = error instanceof Error ? error.message : 'Could not load package bookings.';
    } finally {
      if (!this.destroyed && version === this.requestVersion) this.loading = false;
    }
  }

  selectBooking(booking: PackageBooking): void {
    this.selectedId = booking.id;
    this.draftStatus = booking.fulfillmentStatus;
    this.feedback = '';
  }

  reconcileSelection(): void {
    const selected = this.filteredBookings.find((booking) => booking.id === this.selectedId) || this.filteredBookings[0];
    this.selectedId = selected?.id || '';
    this.draftStatus = selected?.fulfillmentStatus || 'Awaiting payment';
  }

  resetFilters(): void {
    this.search = '';
    this.paymentFilter = 'all';
    this.fulfillmentFilter = 'all';
    this.reconcileSelection();
  }

  statusDisabled(status: FulfillmentStatus, booking: PackageBooking): boolean {
    if (booking.paymentStatus !== 'Paid') return !['Awaiting payment', 'Cancelled'].includes(status);
    return status === 'Awaiting payment';
  }

  async saveStatus(booking: PackageBooking): Promise<void> {
    if (this.updatingId || this.loading || this.draftStatus === booking.fulfillmentStatus || this.statusDisabled(this.draftStatus, booking)) return;
    this.updatingId = booking.id;
    this.error = '';
    this.feedback = '';
    try {
      const data = await this.request<{ booking: PackageBooking }>(`/api/package-bookings/${encodeURIComponent(booking.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ fulfillmentStatus: this.draftStatus })
      });
      if (this.destroyed) return;
      this.bookings = this.bookings.map((item) => item.id === booking.id ? data.booking : item);
      this.reconcileSelection();
      this.feedback = `Booking ${booking.reference} updated to ${data.booking.fulfillmentStatus.toLowerCase()}.`;
    } catch (error) {
      if (!this.destroyed) this.error = error instanceof Error ? error.message : 'Could not update the booking.';
    } finally {
      if (!this.destroyed) this.updatingId = '';
    }
  }

  money(amount: number, currency = 'NGN'): string {
    const value = Number(amount || 0) / 100;
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: currency || 'NGN', maximumFractionDigits: value % 1 ? 2 : 0 }).format(value);
  }

  date(value?: string): string {
    if (!value) return 'Not supplied';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(parsed);
  }

  exportCsv(): void {
    const columns = ['Order / Paystack reference', 'Package', 'Package slug', 'Guest name', 'Email', 'Phone', 'Travellers', 'Departure city', 'Travel date', 'Room preference', 'Special requests', 'Payment status', 'Unit price (NGN)', 'Order total (NGN)', 'Currency', 'Paid at', 'Fulfillment status', 'Created at', 'Updated at', 'Package inclusions', 'Package exclusions', 'Hotel options', 'Package terms'];
    const rows = this.filteredBookings.map((booking) => [
      booking.reference, booking.packageName, booking.packageSlug, booking.customer.fullName, booking.customer.email, booking.customer.phone,
      booking.travellers, booking.departureCity, booking.travelDate,
      booking.roomPreference, booking.notes, booking.paymentStatus, booking.unitPriceNaira,
      Number(booking.totalAmountKobo || 0) / 100, booking.currency || 'NGN',
      booking.paidAt, booking.fulfillmentStatus, booking.createdAt, booking.updatedAt,
      booking.packageSnapshot?.inclusions?.join('; '), booking.packageSnapshot?.exclusions?.join('; '),
      booking.packageSnapshot?.hotels?.join('; '), Array.isArray(booking.packageSnapshot?.terms) ? booking.packageSnapshot.terms.join('; ') : booking.packageSnapshot?.terms
    ]);
    const csv = [columns, ...rows].map((row) => row.map((value) => {
      const text = String(value ?? '');
      const safeText = /^[\s\uFEFF]*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
      return `"${safeText.replace(/"/g, '""')}"`;
    }).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `headies-package-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.feedback = `Exported ${rows.length} booking${rows.length === 1 ? '' : 's'} matching the current filters.`;
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...init,
      cache: 'no-store',
      headers: { 'content-type': 'application/json', 'x-super-admin-code': this.adminCode }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not load package bookings. Please try again.');
    return data as T;
  }
}
