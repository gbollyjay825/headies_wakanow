import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, TravelRequest } from '../api.service';

interface SummaryRow {
  k: string;
  v: string;
  sub: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-shell">
      <div class="topbar">
        <div class="container topbar__inner">
          <span>Official Travel Partner of The Headies | Awards Weekend 2026</span>
          <span class="topbar__right"><span>24/7 support: 0700 925 2669</span><span>Secure booking</span></span>
        </div>
      </div>

      <header class="site-nav">
        <div class="container site-nav__inner">
          <a class="brand" routerLink="/" aria-label="The Headies x Wakanow home">
            <img src="assets/headies-logo.png" alt="The Headies">
            <span class="brand__divider" aria-hidden="true"></span>
            <img src="assets/wakanow-logo.png" alt="Wakanow">
          </a>
          <nav class="nav-links" aria-label="Primary navigation">
            <a href="#planner">Build trip</a>
            <a href="#packages">Packages</a>
            <a href="#luxury">Luxury service</a>
            <a routerLink="/visa">Visa</a>
          </nav>
          <div class="nav-actions">
            <span class="currency">NG | EN | NGN</span>
            <a class="btn btn-primary" href="#planner">Build my trip</a>
          </div>
          <button class="mobile-menu" type="button" [class.is-open]="mobileMenuOpen" [attr.aria-expanded]="mobileMenuOpen" aria-controls="home-mobile-menu" aria-label="Toggle menu" (click)="mobileMenuOpen = !mobileMenuOpen">
            <span class="mobile-menu__bars" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="sr-only">Menu</span>
          </button>
        </div>
        <nav class="mobile-drawer" id="home-mobile-menu" [class.is-open]="mobileMenuOpen" [attr.aria-hidden]="!mobileMenuOpen" aria-label="Mobile navigation">
          <a href="#planner" (click)="mobileMenuOpen = false">Build trip</a>
          <a href="#packages" (click)="mobileMenuOpen = false">Packages</a>
          <a href="#luxury" (click)="mobileMenuOpen = false">Luxury service</a>
          <a routerLink="/visa" (click)="mobileMenuOpen = false">Visa</a>
          <a class="mobile-drawer__cta" href="#planner" (click)="mobileMenuOpen = false">Build my trip</a>
        </nav>
      </header>

      <main id="top">
        <section class="hero">
          <div class="container hero__inner">
            <div class="hero__copy">
              <p class="eyebrow">Powered by Wakanow</p>
              <h1>Road to<br><span>Toronto</span></h1>
              <p>Plan your Headies Canada trip end to end. Choose flight class, hotel category, airport transfer and optional car rental in one clean dark-mode travel flow.</p>
              <div class="hero-pills" aria-label="Travel services">
                <span>Flights</span><span>Hotels and villas</span><span>Airport transfer</span><span>Visa guidance</span><span>Concierge</span>
              </div>
              <div class="hero-actions">
                <a class="btn btn-primary" href="#planner">Build my travel plan</a>
                <a class="btn btn-secondary" href="#luxury">Talk to concierge</a>
              </div>
            </div>
            <div class="hero-media">
              <div class="hero-media__frame">
                <img src="assets/img/hero.jpg" alt="Toronto night skyline for The Headies travel">
                <div class="hero-stat">
                  <div><span>Destination</span><strong>Toronto, Canada</strong></div>
                  <div><span>Travel window</span><strong>Awards weekend</strong></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="section" id="planner">
          <div class="container">
            <div class="section-head center">
              <p class="section-kicker">Build your trip</p>
              <h2>Plan it in five quick steps</h2>
              <p>Tell Wakanow what you need for the weekend. Segment dates are optional where you are flexible.</p>
            </div>

            <div class="wizard-layout">
              <form class="wizard-card" #tripForm="ngForm" (ngSubmit)="submitTrip(tripForm.valid)">
                <div class="wizard-progress"><span [style.width.%]="((step - 1) / 4) * 100"></span></div>
                <div class="stepper" aria-label="Trip planner steps">
                  <button *ngFor="let item of steps" type="button" [class.is-active]="step === item.n" [class.is-done]="step > item.n" (click)="step = item.n">
                    <span class="step-dot">{{ item.n }}</span><span>{{ item.label }}</span>
                  </button>
                </div>

                <section class="wizard-step" [hidden]="step !== 1">
                  <h3>Flights</h3>
                  <p>How will you fly into Toronto?</p>
                  <span class="form-label">Flight type</span>
                  <div class="option-grid">
                    <label class="option-card" *ngFor="let option of flightTypes">
                      <input type="radio" name="flightType" [value]="option.value" [(ngModel)]="trip.flightType" required>
                      <strong>{{ option.title }}</strong><span>{{ option.sub }}</span>
                    </label>
                  </div>
                  <div [hidden]="trip.flightType === 'No Flight Needed'">
                    <span class="form-label" style="margin-top:22px">Class of travel</span>
                    <div class="option-grid">
                      <label class="option-card" *ngFor="let option of flightClasses">
                        <input type="radio" name="flightClass" [value]="option.value" [(ngModel)]="trip.flightClass" required>
                        <strong>{{ option.title }}</strong><span>{{ option.sub }}</span>
                      </label>
                    </div>
                  </div>
                  <div class="field-grid">
                    <label class="field"><span class="form-label">Departure date</span><input name="flightDepartureDate" type="date" [(ngModel)]="trip.flightDepartureDate"></label>
                    <label class="field"><span class="form-label">Return date</span><input name="flightReturnDate" type="date" [(ngModel)]="trip.flightReturnDate"></label>
                  </div>
                </section>

                <section class="wizard-step" [hidden]="step !== 2">
                  <h3>Where you will stay</h3>
                  <p>Choose accommodation type and hotel class.</p>
                  <span class="form-label">Accommodation</span>
                  <div class="option-grid">
                    <label class="option-card" *ngFor="let option of accommodations">
                      <input type="radio" name="accommodation" [value]="option.value" [(ngModel)]="trip.accommodation" required>
                      <strong>{{ option.title }}</strong><span>{{ option.sub }}</span>
                    </label>
                  </div>
                  <span class="form-label" style="margin-top:22px">Hotel class</span>
                  <div class="option-grid">
                    <label class="option-card" *ngFor="let option of hotelClasses">
                      <input type="radio" name="hotelClass" [value]="option.value" [(ngModel)]="trip.hotelClass">
                      <strong>{{ option.title }}</strong><span>{{ option.sub }}</span>
                    </label>
                  </div>
                  <div class="field-grid">
                    <label class="field"><span class="form-label">Check-in</span><input name="hotelCheckIn" type="date" [(ngModel)]="trip.hotelCheckIn"></label>
                    <label class="field"><span class="form-label">Check-out</span><input name="hotelCheckOut" type="date" [(ngModel)]="trip.hotelCheckOut"></label>
                  </div>
                </section>

                <section class="wizard-step" [hidden]="step !== 3">
                  <h3>Airport transfer</h3>
                  <p>Choose your arrival movement level.</p>
                  <span class="form-label">Transfer level</span>
                  <div class="option-grid">
                    <label class="option-card" *ngFor="let option of transfers">
                      <input type="radio" name="airportTransfer" [value]="option.value" [(ngModel)]="trip.airportTransfer" required>
                      <strong>{{ option.title }}</strong><span>{{ option.sub }}</span>
                    </label>
                  </div>
                  <div class="field-grid field-grid--3">
                    <label class="field"><span class="form-label">Passengers</span><input name="transferPassengers" type="number" min="1" [(ngModel)]="trip.transferPassengers"></label>
                    <label class="field"><span class="form-label">Arrival date</span><input name="arrivalTransferDate" type="date" [(ngModel)]="trip.arrivalTransferDate"></label>
                    <label class="field"><span class="form-label">Departure date</span><input name="departureTransferDate" type="date" [(ngModel)]="trip.departureTransferDate"></label>
                  </div>
                </section>

                <section class="wizard-step" [hidden]="step !== 4">
                  <h3>Car rental</h3>
                  <p>Add a vehicle only if you need one on the ground.</p>
                  <label class="inline-check">
                    <input type="checkbox" name="carRentalNeeded" [(ngModel)]="trip.carRentalNeeded">
                    <span><strong>Add car rental to my plan</strong><br><small>Optional vehicle type and rental days.</small></span>
                  </label>
                  <div class="hidden-region" [hidden]="!trip.carRentalNeeded">
                    <span class="form-label" style="margin-top:22px">Vehicle type</span>
                    <div class="option-grid">
                      <label class="option-card" *ngFor="let option of carTypes">
                        <input type="radio" name="carType" [value]="option.value" [(ngModel)]="trip.carType" [required]="trip.carRentalNeeded">
                        <strong>{{ option.title }}</strong><span>{{ option.sub }}</span>
                      </label>
                    </div>
                    <div class="field-grid field-grid--3">
                      <label class="field"><span class="form-label">Rental days</span><input name="carRentalDays" type="number" min="1" [(ngModel)]="trip.carRentalDays" [required]="trip.carRentalNeeded"></label>
                      <label class="field"><span class="form-label">Pickup date</span><input name="carPickupDate" type="date" [(ngModel)]="trip.carPickupDate"></label>
                      <label class="field"><span class="form-label">Return date</span><input name="carReturnDate" type="date" [(ngModel)]="trip.carReturnDate"></label>
                    </div>
                  </div>
                </section>

                <section class="wizard-step" [hidden]="step !== 5">
                  <h3>Your details</h3>
                  <p>Where Wakanow should send your travel options.</p>
                  <div class="field-grid">
                    <label class="field"><span class="form-label">Full name</span><input name="name" type="text" [(ngModel)]="trip.name" required></label>
                    <label class="field"><span class="form-label">Phone</span><input name="phone" type="tel" [(ngModel)]="trip.phone" required></label>
                  </div>
                  <label class="field" style="margin-top:14px"><span class="form-label">Email</span><input name="email" type="email" [(ngModel)]="trip.email" required></label>
                  <label class="field" style="margin-top:14px"><span class="form-label">Trip notes</span><textarea name="notes" [(ngModel)]="trip.notes"></textarea></label>
                  <label class="inline-check" style="margin-top:14px">
                    <input type="checkbox" name="needsVisa" [(ngModel)]="trip.needsVisa">
                    <span><strong>I need visa support for this trip</strong><br><small>Visa applicants must sign in before uploading documents.</small></span>
                  </label>
                </section>

                <div class="form-actions">
                  <button class="btn btn-ghost" type="button" [hidden]="step === 1" (click)="step = step - 1">Back</button>
                  <span class="spacer"></span>
                  <button class="btn btn-primary" type="button" [hidden]="step === 5" (click)="step = step + 1">Continue</button>
                  <button class="btn btn-blue" type="submit" [hidden]="step !== 5">Submit travel request</button>
                </div>
                <p class="form-status" role="status" aria-live="polite">{{ tripStatus }}</p>
              </form>

              <aside class="summary-card">
                <div class="summary-card__head">
                  <h3>Your trip summary</h3>
                  <span class="badge">{{ segmentCount }} segments</span>
                </div>
                <p>Updates live as you build. Wakanow confirms the final quote.</p>
                <div class="summary-list">
                  <div class="summary-row" *ngFor="let row of summaryRows">
                    <span class="summary-dot" aria-hidden="true"></span>
                    <div><span class="summary-row__label">{{ row.k }}</span><strong>{{ row.v }}</strong><small>{{ row.sub }}</small></div>
                  </div>
                </div>
                <div class="pss-note"><strong>PSS</strong><span>Pay Small Small may be available on eligible packages.</span></div>
              </aside>
            </div>
          </div>
        </section>

        <section class="section section--panel" id="packages">
          <div class="container">
            <div class="section-head">
              <p class="section-kicker">Travel options</p>
              <h2>Choose your arrival style</h2>
              <p>Begin from a common Headies Canada path, then fine-tune in the planner.</p>
            </div>
            <div class="package-grid">
              <article class="package-card" *ngFor="let card of packageCards">
                <div class="package-card__media"><img [src]="card.image" [alt]="card.title"><span class="package-tag">{{ card.tag }}</span></div>
                <div class="package-card__body">
                  <p class="section-kicker">{{ card.kicker }}</p>
                  <h3>{{ card.title }}</h3>
                  <p>{{ card.copy }}</p>
                  <ul class="check-list"><li *ngFor="let item of card.items">{{ item }}</li></ul>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section class="section luxury" id="luxury">
          <div class="container luxury-grid">
            <div>
              <p class="section-kicker">Luxury service</p>
              <h2 class="section-title">Concierge planning for VIP guests</h2>
              <div class="numbered">
                <div class="numbered__item"><b>1</b><div><strong>Tell us what you need</strong><span>Movement, hosting, stay, crew or private jet support.</span></div></div>
                <div class="numbered__item"><b>2</b><div><strong>We design the plan</strong><span>Wakanow specialists curate options around your schedule.</span></div></div>
              </div>
              <figure class="luxury-plane">
                <img src="assets/img/headies-plane.png" alt="The Headies x Wakanow branded private jet">
              </figure>
            </div>
            <form class="portal-card" style="padding:26px" #luxForm="ngForm" (ngSubmit)="submitLuxury(luxForm.valid)">
              <h3 style="margin-top:0">Request concierge help</h3>
              <div class="chip-row">
                <label class="service-chip" *ngFor="let service of services">
                  <input type="checkbox" [checked]="luxury.services.includes(service)" (change)="toggleService(service, $event)">
                  <span>{{ service }}</span>
                </label>
              </div>
              <div class="field-grid">
                <label class="field"><span class="form-label">Name</span><input name="luxName" [(ngModel)]="luxury.name" required></label>
                <label class="field"><span class="form-label">Phone</span><input name="luxPhone" [(ngModel)]="luxury.phone" required></label>
              </div>
              <label class="field" style="margin-top:14px"><span class="form-label">Email</span><input type="email" name="luxEmail" [(ngModel)]="luxury.email" required></label>
              <button class="btn btn-primary btn-block" style="margin-top:16px" type="submit">Send concierge request</button>
              <p class="form-status" role="status">{{ luxuryStatus }}</p>
            </form>
          </div>
        </section>
      </main>

      <footer class="footer">
        <div class="container">
          <div class="footer-grid">
            <div><a class="brand" routerLink="/"><img src="assets/headies-logo.png" alt="The Headies"><span class="brand__divider"></span><img src="assets/wakanow-logo.png" alt="Wakanow"></a><p style="margin-top:14px">Travel support for The Headies Canada weekend.</p></div>
            <div><h4>Explore</h4><a href="#planner">Build trip</a><a href="#luxury">Luxury service</a></div>
            <div><h4>Visa</h4><a routerLink="/visa">Start application</a></div>
            <div><h4>Support</h4><p>visa&#64;wakanow.com</p><p>0700 925 2669</p></div>
          </div>
        </div>
      </footer>
    </div>
  `
})
export class HomeComponent {
  step = 1;
  tripStatus = '';
  luxuryStatus = '';
  mobileMenuOpen = false;

  steps = [
    { n: 1, label: 'Flight' },
    { n: 2, label: 'Stay' },
    { n: 3, label: 'Transfer' },
    { n: 4, label: 'Car' },
    { n: 5, label: 'Details' }
  ];

  flightTypes = [
    { value: 'Commercial Flight', title: 'Commercial flight', sub: 'Scheduled airline booking' },
    { value: 'Private Jet', title: 'Private jet', sub: 'Charter enquiry path' },
    { value: 'No Flight Needed', title: 'No flight needed', sub: 'I will arrange mine' }
  ];
  flightClasses = [
    { value: 'Economy', title: 'Economy', sub: 'Efficient and flexible' },
    { value: 'Business Class', title: 'Business class', sub: 'Premium cabin' },
    { value: 'Private Jet', title: 'Private jet', sub: 'Charter request' }
  ];
  accommodations = [
    { value: 'Hotel', title: 'Hotel', sub: '3 to 5 star properties' },
    { value: 'Villa', title: 'Villa', sub: 'Private full home' },
    { value: 'No Accommodation Needed', title: 'No stay needed', sub: 'I will arrange mine' }
  ];
  hotelClasses = [
    { value: '3-star', title: '3-star', sub: 'Smart value' },
    { value: '4-star', title: '4-star', sub: 'Premium comfort' },
    { value: '5-star', title: '5-star', sub: 'Luxury stay' }
  ];
  transfers = [
    { value: 'Basic Transfer', title: 'Basic transfer', sub: 'Standard pickup' },
    { value: 'Executive Transfer', title: 'Executive', sub: 'Premium chauffeur' },
    { value: 'No Airport Transfer Needed', title: 'No transfer', sub: 'Not needed' }
  ];
  carTypes = [
    { value: 'Sedan', title: 'Sedan', sub: 'Compact city movement' },
    { value: 'SUV', title: 'SUV', sub: 'Premium comfort' },
    { value: 'Luxury Van', title: 'Van / group', sub: 'Team movement' }
  ];
  services = ['VIP movement', 'Private jet', 'Executive hotel', 'Artist logistics', 'Airport protocol', 'Security support'];

  packageCards = [
    { image: 'assets/img/headies-plane.png', tag: 'Flight + Stay', kicker: 'Weekend access', title: 'Fly in for awards night', copy: 'A straightforward path for guests who need flights, a stay and airport movement around the main event.', items: ['Return flights and 4 nights', 'Airport transfer option', 'Visa support path'] },
    { image: 'assets/img/event.jpg', tag: 'Hotel + Event', kicker: 'Premium guest flow', title: 'Add event access and arrival planning', copy: 'For guests who want travel to connect cleanly with the show, red carpet and partner moments.', items: ['Return flights and 4 nights', 'Premium event ticket information', 'Pay Small Small when available'] },
    { image: 'assets/img/vip.jpg', tag: 'VIP', kicker: 'High-touch access', title: 'Build a premium weekend plan', copy: 'For executives, partners, artists and teams who need elevated stays, movement and support.', items: ['Business-class enquiry path', '5-star hotels or villa options', 'Executive transfer support'] }
  ];

  trip = {
    flightType: 'Commercial Flight',
    flightClass: 'Business Class',
    flightDepartureDate: '',
    flightReturnDate: '',
    accommodation: 'Hotel',
    hotelClass: '5-star',
    hotelCheckIn: '',
    hotelCheckOut: '',
    airportTransfer: 'Executive Transfer',
    transferPassengers: 2,
    arrivalTransferDate: '',
    departureTransferDate: '',
    carRentalNeeded: false,
    carType: 'SUV',
    carRentalDays: 3,
    carPickupDate: '',
    carReturnDate: '',
    name: '',
    email: '',
    phone: '',
    notes: '',
    needsVisa: false
  };

  luxury = {
    name: '',
    email: '',
    phone: '',
    services: [] as string[]
  };

  constructor(private api: ApiService) {}

  get summaryRows(): SummaryRow[] {
    const rows: SummaryRow[] = [];
    if (this.trip.flightType === 'No Flight Needed') rows.push({ k: 'Flight', v: 'Not needed', sub: '' });
    else rows.push({ k: 'Flight', v: `${this.trip.flightClass || 'Class pending'} / ${this.trip.flightType}`, sub: this.dateRange(this.trip.flightDepartureDate, this.trip.flightReturnDate) });

    if (this.trip.accommodation === 'No Accommodation Needed') rows.push({ k: 'Stay', v: 'Not needed', sub: '' });
    else rows.push({ k: 'Stay', v: this.trip.accommodation === 'Villa' ? 'Private villa' : `${this.trip.hotelClass} hotel`, sub: this.dateRange(this.trip.hotelCheckIn, this.trip.hotelCheckOut) });

    if (this.trip.airportTransfer === 'No Airport Transfer Needed') rows.push({ k: 'Airport transfer', v: 'Not needed', sub: '' });
    else rows.push({ k: 'Airport transfer', v: this.trip.airportTransfer, sub: `${this.trip.transferPassengers || 1} passenger(s)` });

    if (this.trip.carRentalNeeded) rows.push({ k: 'Car rental', v: this.trip.carType, sub: `${this.trip.carRentalDays || 1} day(s)` });
    else rows.push({ k: 'Car rental', v: 'Not added', sub: '' });

    if (this.trip.needsVisa) rows.push({ k: 'Visa support', v: 'Requested', sub: 'Applicant portal required' });
    return rows;
  }

  get segmentCount(): number {
    return this.summaryRows.filter((row) => row.v !== 'Not needed' && row.v !== 'Not added').length;
  }

  dateRange(start: string, end: string): string {
    if (start && end) return `${start} -> ${end}`;
    if (start) return `From ${start}`;
    return 'Dates to confirm';
  }

  async submitTrip(valid: boolean | null): Promise<void> {
    if (!valid) {
      this.tripStatus = 'Complete the required fields to submit.';
      return;
    }
    this.tripStatus = 'Submitting travel request...';
    const rows = this.summaryRows;
    const request: TravelRequest = {
      type: 'Travel',
      name: this.trip.name.trim(),
      email: this.trip.email.trim(),
      phone: this.trip.phone.trim(),
      summary: rows.slice(0, 2).map((row) => row.v).join(' / '),
      details: [
        ['Flight', rows[0]?.v || '-'],
        ['Travel dates', rows[0]?.sub || 'Flexible'],
        ['Stay', rows[1]?.v || '-'],
        ['Stay dates', rows[1]?.sub || 'Flexible'],
        ['Airport transfer', `${rows[2]?.v || '-'} ${rows[2]?.sub || ''}`],
        ['Car rental', `${rows[3]?.v || '-'} ${rows[3]?.sub || ''}`],
        ['Visa support', this.trip.needsVisa ? 'Requested' : 'No'],
        ['Notes', this.trip.notes.trim() || '-']
      ]
    };
    try {
      await this.api.saveTravelRequest(request);
      this.tripStatus = 'Travel request received. Wakanow will follow up with options.';
      this.step = 1;
    } catch (error) {
      this.tripStatus = 'Could not submit request. Please try again.';
    }
  }

  toggleService(service: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.luxury.services = checked
      ? [...this.luxury.services, service]
      : this.luxury.services.filter((item) => item !== service);
  }

  async submitLuxury(valid: boolean | null): Promise<void> {
    if (!valid || !this.luxury.services.length) {
      this.luxuryStatus = 'Select at least one concierge service and complete your contact details.';
      return;
    }
    this.luxuryStatus = 'Submitting concierge request...';
    try {
      await this.api.saveTravelRequest({
        type: 'Luxury',
        name: this.luxury.name.trim(),
        email: this.luxury.email.trim(),
        phone: this.luxury.phone.trim(),
        summary: this.luxury.services.join(', '),
        details: [['Services', this.luxury.services.join(', ')]]
      });
      this.luxuryStatus = 'Concierge request received. A dedicated travel specialist will follow up.';
    } catch (error) {
      this.luxuryStatus = 'Could not submit concierge request.';
    }
  }
}
