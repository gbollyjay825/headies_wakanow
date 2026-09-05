import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PackageService, TravelPackage } from '../packages/package.service';

@Component({
  selector: 'app-package-showcase',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="package-collection" id="packages" aria-labelledby="packages-heading">
      <div class="container">
        <div class="collection-heading">
          <div>
            <p class="section-kicker">The Headies 2026 · Toronto</p>
            <h2 id="packages-heading">One unforgettable trip.<br><span>Three ways to make it yours.</span></h2>
          </div>
          <p>Find your stay, explore what’s included and book as a guest. Your Toronto experience starts here.</p>
        </div>
        <ol class="collection-steps" aria-label="How package booking works">
          <li><span>01</span> Choose your package</li>
          <li><span>02</span> Add your travel details</li>
          <li><span>03</span> Pay securely with Paystack</li>
        </ol>

        <p *ngIf="loading" class="collection-message" role="status">Finding your Toronto experience…</p>
        <div *ngIf="error" class="collection-message" role="alert">
          <p>{{ error }}</p>
          <button type="button" class="btn btn-secondary" (click)="loadPackages()">Try again</button>
        </div>
        <div class="collection-grid" *ngIf="!loading && !error">
          <article class="collection-card" *ngFor="let package of packages" [class.collection-card--vip]="package.tier === 'vip'">
            <a class="collection-art" [routerLink]="['/packages', package.slug]" [attr.aria-label]="'Explore ' + package.name">
              <img [src]="package.image" [alt]="package.name + ' — The Headies 2026 in Toronto'" width="1003" height="1568" loading="lazy">
              <span class="collection-art-caption" aria-hidden="true"><small>THE HEADIES 2026</small><strong>Toronto.<br>Your way.</strong><span>{{ '★'.repeat(package.stars) }}</span></span>
            </a>
            <div class="collection-body">
              <div class="collection-tier"><span>{{ package.stars }}-star stay</span><span>No account needed</span></div>
              <h3><a [routerLink]="['/packages', package.slug]">{{ package.name }}</a></h3>
              <ul class="collection-inclusions" aria-label="Included in the package"><li *ngFor="let item of package.inclusions">{{ item }}</li></ul>
              <div class="collection-price"><span>{{ package.checkoutEnabled ? 'Price per person' : 'From · per person' }}</span><strong>{{ package.priceNaira | currency:'NGN':'symbol-narrow':'1.0-0' }}</strong></div>
              <a class="btn btn-primary collection-cta" [routerLink]="['/packages', package.slug]">{{ package.checkoutEnabled ? 'View details & book' : 'View package details' }} <span aria-hidden="true">↗</span></a>
              <p class="collection-availability" *ngIf="!package.checkoutEnabled">Booking temporarily unavailable</p>
            </div>
          </article>
        </div>
        <p *ngIf="!loading && !error && !packages.length" class="collection-message">New Toronto packages are on their way. Please check back shortly.</p>
        <div class="collection-footer"><span>Already have a travel plan in mind?</span><a href="#planner">Build a custom trip <span aria-hidden="true">→</span></a></div>
      </div>
    </section>
  `,
  styleUrl: './package-showcase.component.css'
})
export class PackageShowcaseComponent implements OnInit {
  packages: TravelPackage[] = [];
  loading = true;
  error = '';
  constructor(private packageService: PackageService) {}
  ngOnInit(): void { void this.loadPackages(); }
  async loadPackages(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const result = await this.packageService.listPackages();
      this.packages = result.packages;
    } catch {
      this.error = 'We couldn’t load the packages. Please try again.';
    } finally { this.loading = false; }
  }
}
