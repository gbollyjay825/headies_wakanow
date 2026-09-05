import { CommonModule } from '@angular/common';
import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { PackageBooking, PackageBookingResult, PackageCheckoutRequest, PackagePayment, PackageRequestError, PackageService, TravelPackage } from './package.service';

interface CheckoutSession {
  bookingToken?: string;
  reference?: string;
  idempotencyKey: string;
}

interface PaystackCallbacks {
  onSuccess: (transaction: { reference: string }) => void;
  onCancel: () => void;
  onError: (error: { message?: string }) => void;
}

type PaystackConstructor = new () => {
  resumeTransaction: (accessCode: string, callbacks: PaystackCallbacks) => unknown;
};

let paystackScript: Promise<PaystackConstructor> | undefined;

function loadPaystack(): Promise<PaystackConstructor> {
  const paystackWindow = window as Window & { PaystackPop?: PaystackConstructor };
  if (paystackWindow.PaystackPop) return Promise.resolve(paystackWindow.PaystackPop);
  if (paystackScript) return paystackScript;
  paystackScript = new Promise<PaystackConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v2/inline.js';
    script.async = true;
    const timeout = window.setTimeout(() => fail(), 20000);
    const fail = () => {
      window.clearTimeout(timeout);
      script.remove();
      paystackScript = undefined;
      reject(new Error('Secure checkout could not load. Check your connection and try again.'));
    };
    script.onload = () => {
      window.clearTimeout(timeout);
      if (paystackWindow.PaystackPop) resolve(paystackWindow.PaystackPop);
      else fail();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return paystackScript;
}

@Component({
  selector: 'app-package-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './package-details.component.html',
  styleUrl: './package-details.component.css'
})
export class PackageDetailsComponent implements OnInit, OnDestroy {
  travelPackage: TravelPackage | null = null;
  booking: PackageBooking | null = null;
  payment: PackagePayment | null = null;
  loading = true;
  busy = false;
  loadError = '';
  paymentError = '';
  paymentMessage = '';
  formSubmitted = false;
  recoveryRequired = false;
  readonly travellerOptions = [1, 2, 3, 4, 5, 6];
  readonly today = new Date().toLocaleDateString('en-CA');
  readonly roomOptions = ['No preference', 'Single room', 'Double room', 'Twin room'];
  form = this.emptyForm();
  private session: CheckoutSession = { idempotencyKey: '' };
  private routeSubscription?: Subscription;
  private requestVersion = 0;
  private destroyed = false;
  private sessionSaved = false;

  constructor(private route: ActivatedRoute, private packages: PackageService, private zone: NgZone) {}

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe(params => void this.load(params.get('slug') || ''));
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.requestVersion += 1;
    this.routeSubscription?.unsubscribe();
  }

  get paid(): boolean { return this.booking?.paymentStatus === 'Paid'; }
  get failed(): boolean { return this.booking?.paymentStatus === 'Failed'; }
  get cancelled(): boolean { return this.booking?.fulfillmentStatus === 'Cancelled'; }
  get displayPackage(): TravelPackage | null { return this.booking?.packageSnapshot || this.travelPackage; }
  get payable(): boolean { return !!this.travelPackage?.checkoutEnabled && !this.paid && !this.cancelled && !this.recoveryRequired; }
  get total(): number {
    return this.booking ? this.booking.totalAmountKobo / 100 : (this.travelPackage?.priceNaira || 0) * this.form.travellers;
  }
  get paymentLabel(): string {
    if (this.busy) return 'Please wait…';
    if (!this.travelPackage?.checkoutEnabled) return 'Booking temporarily unavailable';
    return this.booking ? 'Continue with Paystack' : `Pay ${this.money(this.total)}`;
  }

  money(value: number): string {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);
  }

  retryLoad(): void { void this.load(this.route.snapshot.paramMap.get('slug') || ''); }

  async checkout(checkoutForm: NgForm): Promise<void> {
    if (this.busy || !this.payable || !this.travelPackage) return;
    this.formSubmitted = true;
    if (checkoutForm.invalid || !this.form.fullName.trim() || this.form.departureCity.trim().length < 2 || !this.form.termsAccepted) {
      this.paymentError = 'Please complete the required details and accept the booking terms.';
      checkoutForm.control.markAllAsTouched();
      document.querySelector<HTMLElement>('.guest-checkout .ng-invalid:not(form)')?.focus();
      return;
    }
    this.busy = true;
    const version = this.requestVersion;
    this.persistSession(this.travelPackage.slug);
    this.paymentError = '';
    this.paymentMessage = 'Preparing your secure checkout…';
    try {
      const Paystack = await loadPaystack();
      if (this.destroyed || version !== this.requestVersion) return;
      const payload: PackageCheckoutRequest = {
        packageSlug: this.travelPackage.slug,
        travellers: Number(this.form.travellers),
        customer: { fullName: this.form.fullName.trim(), email: this.form.email.trim().toLowerCase(), phone: this.form.phone.trim() },
        departureCity: this.form.departureCity.trim(),
        travelDate: this.form.travelDate,
        roomPreference: this.form.roomPreference,
        notes: this.form.notes.trim(),
        termsAccepted: this.form.termsAccepted,
        idempotencyKey: this.session.idempotencyKey,
        ...(this.session.bookingToken ? { bookingToken: this.session.bookingToken } : {})
      };
      const result = await this.packages.initialize(payload);
      if (this.destroyed || version !== this.requestVersion) return;
      this.applyBooking(result);
      if (this.paid) {
        this.busy = false;
        this.paymentMessage = '';
        return;
      }
      this.openPayment(Paystack);
    } catch (error) {
      if (this.destroyed || version !== this.requestVersion) return;
      if (error instanceof PackageRequestError && error.result) this.applyBooking(error.result);
      if (!(error instanceof PackageRequestError) || error.statusCode >= 500) this.recoveryRequired = !this.booking;
      this.busy = false;
      this.paymentMessage = '';
      this.paymentError = this.errorMessage(error, 'We could not open checkout. Please try again.');
    }
  }

  async recoverBooking(): Promise<void> {
    if (this.busy || !this.session.bookingToken) return;
    this.busy = true;
    const version = this.requestVersion;
    this.paymentError = '';
    this.paymentMessage = 'Checking your saved booking…';
    try {
      const result = await this.packages.status(this.session.reference, this.session.bookingToken, this.session.idempotencyKey);
      if (this.destroyed || version !== this.requestVersion) return;
      this.applyBooking(result);
      this.recoveryRequired = false;
      this.paymentMessage = this.paid ? '' : 'Your booking has been recovered. You can continue below.';
    } catch (error) {
      if (this.destroyed || version !== this.requestVersion) return;
      if (error instanceof PackageRequestError && error.statusCode === 404) {
        this.recoveryRequired = false;
        this.paymentMessage = 'No booking was created. You can safely try checkout again.';
      } else {
        this.paymentMessage = '';
        this.paymentError = this.errorMessage(error, 'We could not retrieve your booking. Please check again before starting another payment.');
      }
    } finally { if (version === this.requestVersion) this.busy = false; }
  }

  startNewPayment(): void {
    if (this.busy || this.cancelled || this.booking?.paymentStatus !== 'Failed' || !this.travelPackage) return;
    const previous = this.booking;
    try { sessionStorage.setItem(`headies.package.receipt.${previous.reference}`, JSON.stringify(this.session)); }
    catch { /* The current page continues to function when storage is unavailable. */ }
    this.form = {
      fullName: previous.customer.fullName,
      email: previous.customer.email,
      phone: previous.customer.phone,
      travellers: previous.travellers,
      departureCity: this.travelPackage.departureCity || previous.departureCity || '',
      travelDate: previous.travelDate || '',
      roomPreference: previous.roomPreference || 'No preference',
      notes: previous.notes || '',
      termsAccepted: false
    };
    this.booking = null;
    this.payment = null;
    this.session = this.newSession();
    this.formSubmitted = false;
    this.paymentError = '';
    this.paymentMessage = 'Your previous payment was unsuccessful. Review your details to start a new payment.';
    this.persistSession(this.travelPackage.slug);
  }

  async resumePayment(): Promise<void> {
    if (this.busy || !this.payable || !this.booking || !this.session.bookingToken || this.failed) return;
    this.busy = true;
    const version = this.requestVersion;
    this.paymentError = '';
    this.paymentMessage = 'Opening secure checkout…';
    try {
      const latest = await this.packages.status(this.session.reference, this.session.bookingToken, this.session.idempotencyKey);
      if (this.destroyed || version !== this.requestVersion) return;
      this.applyBooking(latest);
      if (this.paid || this.cancelled || this.failed) {
        this.busy = false;
        this.paymentMessage = this.failed ? 'Your previous payment was unsuccessful. Review your details below to try again.' : '';
        return;
      }
      const Paystack = await loadPaystack();
      if (this.destroyed || version !== this.requestVersion) return;
      if (!this.payment?.accessCode) {
        const result = await this.packages.initialize({
          packageSlug: this.booking.packageSlug,
          travellers: this.booking.travellers,
          customer: this.booking.customer,
          departureCity: this.booking.departureCity || this.form.departureCity,
          travelDate: this.booking.travelDate || '',
          roomPreference: this.booking.roomPreference || 'No preference',
          notes: this.booking.notes || '',
          termsAccepted: true,
          idempotencyKey: this.session.idempotencyKey,
          bookingToken: this.session.bookingToken
        });
        if (this.destroyed || version !== this.requestVersion) return;
        this.applyBooking(result);
      }
      if (this.paid || this.cancelled || this.failed) {
        this.busy = false;
        this.paymentMessage = '';
        return;
      }
      this.openPayment(Paystack);
    } catch (error) {
      if (this.destroyed || version !== this.requestVersion) return;
      if (error instanceof PackageRequestError && error.result) this.applyBooking(error.result);
      this.busy = false;
      this.paymentMessage = '';
      this.paymentError = this.errorMessage(error, 'We could not resume checkout. Please try again.');
    }
  }

  async verifyPayment(): Promise<void> {
    if (!this.session.reference || !this.session.bookingToken || this.busy) return;
    this.busy = true;
    const version = this.requestVersion;
    this.paymentError = '';
    this.paymentMessage = 'Checking your payment securely…';
    try {
      const result = await this.packages.verify(this.session.reference, this.session.bookingToken);
      if (this.destroyed || version !== this.requestVersion) return;
      this.applyBooking(result);
      this.recoveryRequired = false;
      this.paymentMessage = this.paid ? '' : this.booking?.paymentStatus === 'Failed'
        ? 'Your payment was not completed. You can return to checkout to try again.'
        : 'Payment has not been confirmed yet. If you have paid, check again in a moment before making another payment.';
    } catch (error) {
      if (this.destroyed || version !== this.requestVersion) return;
      this.paymentMessage = '';
      this.paymentError = this.errorMessage(error, 'We could not confirm your payment yet. Please check again before paying again.');
    } finally {
      if (version === this.requestVersion) this.busy = false;
    }
  }

  private async load(slug: string): Promise<void> {
    const version = ++this.requestVersion;
    this.loading = true;
    this.loadError = '';
    this.travelPackage = null;
    this.booking = null;
    this.payment = null;
    this.paymentError = '';
    this.paymentMessage = '';
    this.formSubmitted = false;
    this.recoveryRequired = false;
    this.busy = false;
    this.form = this.emptyForm();
    this.session = this.readSession(slug);
    try {
      const response = await this.packages.get(slug);
      if (version !== this.requestVersion) return;
      this.travelPackage = response.package;
      this.form.departureCity = response.package.departureCity || '';
      const callbackReference = this.route.snapshot.queryParamMap.get('reference') || this.route.snapshot.queryParamMap.get('trxref');
      if (callbackReference && callbackReference !== this.session.reference) {
        this.recoveryRequired = true;
        this.paymentError = 'This browser session cannot access that payment. Please contact Wakanow with the reference from your Paystack receipt.';
      } else if (this.sessionSaved && this.session.bookingToken) {
        try {
          const result = await this.packages.status(this.session.reference, this.session.bookingToken, this.session.idempotencyKey);
          if (version !== this.requestVersion) return;
          this.applyBooking(result);
          if (callbackReference && !this.paid) await this.verifyPayment();
        } catch (error) {
          if (version !== this.requestVersion) return;
          if (!(error instanceof PackageRequestError) || error.statusCode !== 404) {
            this.recoveryRequired = true;
            this.paymentError = this.errorMessage(error, 'We could not retrieve your booking. Please check your payment before starting again.');
          }
        }
      }
    } catch (error) {
      if (version === this.requestVersion) this.loadError = this.errorMessage(error, 'This package could not be loaded. Please try again.');
    } finally {
      if (version === this.requestVersion) this.loading = false;
    }
  }

  private openPayment(Paystack: PaystackConstructor): void {
    if (!this.payment?.accessCode || !this.session.bookingToken) throw new Error('Checkout is not ready. Please try again.');
    this.paymentMessage = 'Complete your payment in the secure Paystack window.';
    const version = this.requestVersion;
    let settled = false;
    new Paystack().resumeTransaction(this.payment.accessCode, {
      onSuccess: () => this.zone.run(() => {
        if (this.destroyed || version !== this.requestVersion || settled) return;
        settled = true;
        this.busy = false;
        // A checkout callback is only a prompt to verify the stored reference with our server.
        void this.verifyPayment();
      }),
      onCancel: () => this.zone.run(() => {
        if (this.destroyed || version !== this.requestVersion || settled) return;
        settled = true;
        this.busy = false;
        this.paymentMessage = 'Checkout was closed. Your booking is saved; continue when you are ready, or check the payment status if you already paid.';
      }),
      onError: error => this.zone.run(() => {
        if (this.destroyed || version !== this.requestVersion || settled) return;
        settled = true;
        this.busy = false;
        this.paymentMessage = '';
        this.paymentError = error.message || 'Paystack could not load. Please try again.';
      })
    });
  }

  private applyBooking(result: PackageBookingResult): void {
    if (result.booking.packageSlug !== this.travelPackage?.slug) throw new Error('This payment belongs to a different package. Please open the original package to view your booking.');
    this.booking = result.booking;
    if (result.payment) this.payment = result.payment;
    this.session.reference = result.booking.reference;
    if (result.bookingToken) this.session.bookingToken = result.bookingToken;
    this.persistSession(result.booking.packageSlug);
  }

  private emptyForm() {
    return { fullName: '', email: '', phone: '', travellers: 1, departureCity: '', travelDate: '', roomPreference: 'No preference', notes: '', termsAccepted: false };
  }

  private readSession(slug: string): CheckoutSession {
    this.sessionSaved = false;
    try {
      const callbackReference = this.route.snapshot.queryParamMap.get('reference') || this.route.snapshot.queryParamMap.get('trxref');
      const archived = callbackReference ? sessionStorage.getItem(`headies.package.receipt.${callbackReference}`) : null;
      const stored: unknown = JSON.parse(archived || sessionStorage.getItem(`headies.package.${slug}`) || 'null');
      if (stored && typeof stored === 'object' && 'idempotencyKey' in stored && typeof stored.idempotencyKey === 'string') {
        const value = stored as Record<string, unknown>;
        this.sessionSaved = true;
        return {
          idempotencyKey: stored.idempotencyKey,
          ...(typeof value['reference'] === 'string' ? { reference: value['reference'] } : {}),
          ...(typeof value['bookingToken'] === 'string' ? { bookingToken: value['bookingToken'] } : {})
        };
      }
    } catch { /* Browsers may disable session storage; checkout can still run in this tab. */ }
    return this.newSession();
  }

  private newSession(): CheckoutSession {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const bookingToken = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return { idempotencyKey: crypto.randomUUID(), bookingToken };
  }

  private persistSession(slug: string): void {
    this.sessionSaved = true;
    try { sessionStorage.setItem(`headies.package.${slug}`, JSON.stringify(this.session)); }
    catch { /* Do not persist customer details as a fallback. */ }
  }

  private errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}
