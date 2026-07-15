import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, EligibleApplicant, PassportParseResult, UploadGroup, UploadedFileRecord, VisaApplication, VisaPricing } from '../api.service';

type UploadFile = File | UploadedFileRecord;

interface UploadDoc {
  field: string;
  document: string;
  required: boolean;
  optional?: boolean;
  section?: 'employed' | 'business-owner';
  files: UploadFile[];
}

@Component({
  selector: 'app-visa',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-shell">
      <div class="topbar">
        <div class="container topbar__inner">
          <span>Canada Visa Support | The Headies x Wakanow</span>
          <span class="topbar__right">Processed by visa&#64;wakanow.com</span>
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
            <a routerLink="/" fragment="planner">Build trip</a>
            <a routerLink="/" fragment="packages">Packages</a>
            <a routerLink="/" fragment="luxury">Luxury service</a>
            <a class="is-active" routerLink="/visa">Visa</a>
          </nav>
          <div class="nav-actions">
            <a class="btn btn-primary" [attr.href]="portalVisible ? '#visa-upload' : '#apply'">{{ portalVisible ? 'Continue application' : 'Start application' }}</a>
          </div>
          <button class="mobile-menu" type="button" [class.is-open]="mobileMenuOpen" [attr.aria-expanded]="mobileMenuOpen" aria-controls="visa-mobile-menu" aria-label="Toggle menu" (click)="mobileMenuOpen = !mobileMenuOpen">
            <span class="mobile-menu__bars" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="sr-only">Menu</span>
          </button>
        </div>
        <nav class="mobile-drawer" id="visa-mobile-menu" [class.is-open]="mobileMenuOpen" [attr.aria-hidden]="!mobileMenuOpen" aria-label="Mobile navigation">
          <a routerLink="/" fragment="planner" (click)="mobileMenuOpen = false">Build trip</a>
          <a routerLink="/" fragment="packages" (click)="mobileMenuOpen = false">Packages</a>
          <a routerLink="/" fragment="luxury" (click)="mobileMenuOpen = false">Luxury service</a>
          <a class="is-active" routerLink="/visa" (click)="mobileMenuOpen = false">Visa</a>
          <a class="mobile-drawer__cta" [attr.href]="portalVisible ? '#visa-upload' : '#apply'" (click)="mobileMenuOpen = false">{{ portalVisible ? 'Continue application' : 'Start application' }}</a>
        </nav>
      </header>

      <main>
        <section class="page-hero" [hidden]="portalVisible">
          <div class="container page-hero__grid">
            <div>
              <p class="eyebrow">Canada visa | Toronto</p>
              <h1>Canada visa support for the <span>Headies weekend</span></h1>
              <p>Review the requirements, sign in as an eligible applicant, and upload documents through the secure portal. A flat fee applies per applicant.</p>
            </div>
            <div class="page-hero__media"><img src="assets/img/visa.jpg" alt="Passport and Canada visa travel support"></div>
          </div>
        </section>

        <section class="section visa-entry" id="apply" [hidden]="portalVisible">
          <div class="container split-layout visa-apply-layout">
            <div class="visa-entry__main">
              <ol class="visa-journey" aria-label="Visa application process">
                <li><b>1</b><div><h3>Confirm access</h3><p>Sign in with your approved email and access code.</p></div></li>
                <li><b>2</b><div><h3>Prepare documents</h3><p>Complete the forms and upload the required files.</p></div></li>
                <li><b>3</b><div><h3>Submit for review</h3><p>Pay, confirm your details and send the application.</p></div></li>
              </ol>

              <article class="requirements-card requirements-card--overview">
                <div class="requirements-card__intro">
                  <p class="section-kicker">Canada Business Visa</p>
                  <h2 class="section-title">Prepare once. Upload securely.</h2>
                  <p class="requirements-card__copy">The basic package is <strong>{{ basicPriceLabel }}</strong> per applicant. Premium or staff handling is applied automatically from the approved profile after sign in.</p>
                  <ul class="package-includes" aria-label="Visa package includes">
                    <li><span>Visa fee</span><strong>Included</strong></li>
                    <li><span>Admin processing fee</span><strong>Included</strong></li>
                    <li><span>Headies ticket fee</span><strong>Included</strong></li>
                  </ul>
                  <div class="portal-access-note"><strong>Approved applicants only</strong><span>Your email must be on the allowlist before you can create or access an application.</span></div>
                </div>
                <details class="requirements-disclosure">
                  <summary>
                    <span><strong>Required document checklist</strong><small>{{ requirements.length }} core documents</small></span>
                    <b>View checklist</b>
                  </summary>
                  <div class="requirement-grid">
                    <div class="requirement" *ngFor="let item of requirements">{{ item }}</div>
                  </div>
                </details>
              </article>
            </div>

            <aside class="sticky-panel" [hidden]="portalVisible">
              <div class="portal-card" style="padding:28px" id="visa-login">
                <span class="badge">Visa applicant access</span>
                <div class="auth-tabs" role="tablist" aria-label="Visa access options">
                  <button type="button" [class.is-active]="authMode === 'login'" (click)="authMode = 'login'">Sign in</button>
                  <button type="button" [class.is-active]="authMode === 'signup'" (click)="authMode = 'signup'">Sign up</button>
                </div>

                <div class="auth-panel" [hidden]="authMode !== 'login'">
                  <h2 style="margin:16px 0 6px;font-size:24px">Sign in to apply</h2>
                  <p style="margin:0 0 20px;color:var(--muted);font-size:14px">Use the email and access code supplied by the visa admin team.</p>
                  <form #loginForm="ngForm" (ngSubmit)="login(loginForm.valid)">
                    <label class="field"><span class="form-label">Email</span><input name="email" type="email" [(ngModel)]="loginModel.email" required></label>
                    <label class="field" style="margin-top:14px"><span class="form-label">Access code</span><input name="accessCode" type="password" autocomplete="current-password" [(ngModel)]="loginModel.accessCode" required></label>
                    <button class="btn btn-blue btn-block" style="margin-top:18px" type="submit">Sign in to continue</button>
                    <p class="form-status" role="status">{{ loginStatus }}</p>
                  </form>
                  <p style="margin:14px 0 0;color:var(--faint);font-size:12px;text-align:center">Need access? Sign up and wait for admin approval.</p>
                </div>

                <div class="auth-panel" [hidden]="authMode !== 'signup'">
                  <h2 style="margin:16px 0 6px;font-size:24px">Sign up for visa access</h2>
                  <p style="margin:0 0 20px;color:var(--muted);font-size:14px">Submit your details for Wakanow admin approval before uploading documents.</p>
                  <form #signupForm="ngForm" (ngSubmit)="signup(signupForm.valid)">
                    <label class="field"><span class="form-label">Full name</span><input name="name" type="text" [(ngModel)]="signupModel.name" required></label>
                    <label class="field" style="margin-top:14px"><span class="form-label">Email</span><input name="signupEmail" type="email" [(ngModel)]="signupModel.email" required></label>
                    <label class="field" style="margin-top:14px"><span class="form-label">Phone</span><input name="phone" type="tel" [(ngModel)]="signupModel.phone" required></label>
                    <label class="field" style="margin-top:14px"><span class="form-label">Create access code</span><input name="signupAccessCode" type="password" autocomplete="new-password" minlength="6" [(ngModel)]="signupModel.accessCode" placeholder="Minimum 6 characters" required></label>
                    <label class="field" style="margin-top:14px"><span class="form-label">Confirm access code</span><input name="confirmAccessCode" type="password" autocomplete="new-password" minlength="6" [(ngModel)]="signupModel.confirmAccessCode" required></label>
                    <label class="field" style="margin-top:14px"><span class="form-label">Applicant category</span>
                      <select name="category" [(ngModel)]="signupModel.category" required>
                        <option value="">Select category</option>
                        <option value="employed">Employed</option>
                        <option value="business-owner">Business owner</option>
                        <option value="employed-business-owner">Employed and business owner</option>
                      </select>
                    </label>
                    <label class="field" style="margin-top:14px"><span class="form-label">Note</span><textarea name="notes" [(ngModel)]="signupModel.notes"></textarea></label>
                    <button class="btn btn-blue btn-block" style="margin-top:18px" type="submit">Request access</button>
                    <p class="form-status" role="status">{{ signupStatus }}</p>
                  </form>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section class="section portal-hidden portal-workspace" id="visa-upload" [hidden]="!portalVisible">
          <div class="container portal-shell">
            <div class="portal-top">
              <div>
                <p class="section-kicker" style="margin:0 0 5px">Canada Business Visa | The Headies</p>
                <h1 style="margin:0;font-size:30px">Your application</h1>
                <p style="margin:6px 0 0;color:var(--muted)">Upload documents, review details and submit for visa team review.</p>
              </div>
              <div class="status-pills">
                <span class="pill pill--warn" *ngIf="existingApplication">{{ existingApplication.status }}</span>
                <span class="pill pill--muted">{{ applicantUserTypeLabel }}</span>
                <span class="pill" [class.pill--ok]="submissionPaymentSatisfied" [class.pill--warn]="!isStaffApplicant && (paymentPending || paymentFailed)">{{ paymentStatusLabel }}</span>
                <span class="pill pill--muted">{{ fileCount }} files</span>
              </div>
              <button class="btn btn-ghost btn-small" type="button" (click)="logout()">Sign out</button>
            </div>

            <div class="portal-stepper" aria-label="Visa application stages">
              <div class="portal-step is-active"><b>1</b><div><span>Passport</span><small>Extract details</small></div></div>
              <div class="portal-step"><b>2</b><div><span>Documents</span><small>Upload files</small></div></div>
              <div class="portal-step" [class.is-active]="submissionPaymentSatisfied"><b>3</b><div><span>Payment</span><small>{{ isStaffApplicant ? 'Not required' : paymentPaid ? 'Paid' : 'Required before submit' }}</small></div></div>
              <div class="portal-step" [class.is-active]="reviewConfirmed"><b>4</b><div><span>Review</span><small>Confirm before submit</small></div></div>
            </div>

            <div class="portal-grid">
              <form id="visaApplicationForm" class="application-flow" #applicationForm="ngForm" (ngSubmit)="submitApplication(applicationForm.valid)">
                <section class="portal-card payment-card" [class.is-paid]="submissionPaymentSatisfied">
                  <div class="payment-card__copy">
                    <p class="section-kicker">Payment step</p>
                    <h2>{{ isStaffApplicant ? 'Staff visa access' : paymentPaid ? 'Payment verified' : 'Pay before submission' }}</h2>
                    <p>{{ isStaffApplicant ? 'This staff profile does not require card payment. Complete the documents and review; a zero-value staff waiver is recorded automatically when you submit.' : paymentPaid ? 'Payment has been verified. Continue with the applicant documents and final review.' : 'Pay securely by card to unlock final submission. You can prepare and upload your documents first if they are not ready yet.' }}</p>
                    <div class="payment-card__meta">
                      <span class="pill" [class.pill--ok]="submissionPaymentSatisfied" [class.pill--warn]="!isStaffApplicant && (paymentPending || paymentFailed)">{{ paymentStatusLabel }}</span>
                      <small *ngIf="application.paymentReference">Reference {{ application.paymentReference }}</small>
                      <small *ngIf="!application.paymentReference">{{ isStaffApplicant ? 'Staff account, no card payment' : 'Secured through Paystack card checkout' }}</small>
                    </div>
                  </div>
                  <div class="payment-card__due">
                    <div class="payment-card__total">
                      <span>Total due</span>
                      <strong>{{ totalDueLabel }}</strong>
                      <small>{{ isStaffApplicant ? 'Staff applicant · no card payment' : (application.applicants || 1) + ' applicant(s) · ' + applicantUserTypeLabel + ' package' }}</small>
                    </div>
                    <ul class="fee-breakdown" aria-label="Payment breakdown">
                      <li><span>Visa fee</span><strong>Included</strong></li>
                      <li><span>Admin processing fee</span><strong>Included</strong></li>
                      <li><span>Headies ticket fee</span><strong>Included</strong></li>
                    </ul>
                    <div class="payment-card__actions">
                      <button class="btn btn-blue btn-block" type="button" *ngIf="!isStaffApplicant" [disabled]="paymentWorking || paymentPaid" (click)="startPaystackPayment()">
                        {{ paymentPaid ? 'Payment verified' : paymentWorking ? 'Opening Paystack...' : 'Pay now with card' }}
                      </button>
                      <button class="payment-card__link" type="button" *ngIf="!isStaffApplicant && !paymentPaid && !uploadSectionVisible" (click)="openUploadsBeforePayment()">Prepare documents before payment</button>
                      <div class="staff-payment-note" *ngIf="isStaffApplicant"><strong>Payment waived</strong><span>Continue to documents and submit after review.</span></div>
                    </div>
                    <p class="payment-card__hint" *ngIf="!isStaffApplicant && !paymentPaid && uploadSectionVisible">
                      Uploads are open. Complete payment before final submission.
                    </p>
                    <p class="form-status" role="status">{{ paymentStatus }}</p>
                  </div>
                </section>

                <section class="portal-card upload-section" [hidden]="!uploadSectionVisible">
                  <div class="upload-section__header">
                    <div>
                      <h2>Upload documents</h2>
                      <p>Signed in as <strong>{{ currentApplicant?.name || currentApplicant?.email }}</strong></p>
                      <span>{{ currentApplicant?.email }} · {{ currentApplicant?.category }} · {{ applicantUserTypeLabel }}</span>
                    </div>
                    <span class="badge">Portal save ready</span>
                  </div>

                  <details class="visa-templates" open>
                    <summary class="visa-templates__summary">
                      <span class="visa-template-filetype" aria-hidden="true">PDF</span>
                      <span class="visa-templates__copy"><strong>Required visa forms and checklist</strong><small>Download these official PDFs, complete the applicable forms, then upload the finished copies below.</small></span>
                      <span class="visa-templates__count">3 downloads</span>
                    </summary>
                    <div class="visa-template-list">
                      <a class="visa-template-link" href="/assets/visa-templates/canada-temporary-resident-visa-checklist.pdf" download="canada-temporary-resident-visa-checklist.pdf">
                        <span class="visa-template-filetype" aria-hidden="true">PDF</span>
                        <span class="visa-template-copy"><strong>Canada visa checklist</strong><small>Temporary resident visa · 2 pages</small></span>
                        <span class="visa-template-action">Download PDF</span>
                      </a>
                      <a class="visa-template-link" href="/assets/visa-templates/imm5257e-visitor-visa-application.pdf" download="imm5257e-visitor-visa-application.pdf">
                        <span class="visa-template-filetype" aria-hidden="true">PDF</span>
                        <span class="visa-template-copy"><strong>IMM 5257 application form</strong><small>Visitor visa application · 5 pages</small></span>
                        <span class="visa-template-action">Download PDF</span>
                      </a>
                      <a class="visa-template-link" href="/assets/visa-templates/imm5645e-family-information.pdf" download="imm5645e-family-information.pdf">
                        <span class="visa-template-filetype" aria-hidden="true">PDF</span>
                        <span class="visa-template-copy"><strong>IMM 5645 family information</strong><small>Family information form · 2 pages</small></span>
                        <span class="visa-template-action">Download PDF</span>
                      </a>
                    </div>
                  </details>

                  <section class="passport-intake" [class.is-complete]="passportDoc.files.length">
                  <div class="passport-intake__copy">
                    <span class="badge">{{ passportDoc.files.length ? 'Passport captured' : 'Start here' }}</span>
                    <h3>Upload passport data page</h3>
                    <p>Upload a clear image of the passport data page. We will extract the passport details and save the image as the required passport document.</p>
                  </div>
                  <div class="passport-intake__control">
                    <input name="passportDataPage" type="file" accept="image/jpeg,image/png,image/webp" (change)="parsePassportDataPage($event)">
                    <p class="form-status" role="status">{{ passportStatus }}</p>
                  </div>

                  <div class="passport-result" *ngIf="application.passportDetails?.parsed">
                    <div class="passport-result__banner" [class.is-valid]="application.passportDetails?.validation?.valid" [class.is-invalid]="application.passportDetails?.validation && !application.passportDetails?.validation?.valid">
                      <strong>{{ application.passportDetails?.validation?.valid ? 'Passport validity check passed' : 'Passport details extracted' }}</strong>
                      <span>{{ application.passportDetails?.validation?.reason || application.passportDetails?.warning || 'Review the extracted passport details before submitting.' }}</span>
                    </div>
                    <div class="passport-fields">
                      <div><span>Passport no.</span><strong>{{ application.passportDetails?.parsed?.passportNumber || 'Not found' }}</strong></div>
                      <div><span>Name</span><strong>{{ parsedPassportName }}</strong></div>
                      <div><span>Nationality</span><strong>{{ application.passportDetails?.parsed?.nationality || 'Not found' }}</strong></div>
                      <div><span>Expiry</span><strong>{{ application.passportExpiry || application.passportDetails?.parsed?.expirationDate || 'Not found' }}</strong></div>
                    </div>
                  </div>
                </section>

                  <div class="form-section-head">
                    <div><span>Applicant details</span><h3>Confirm your information</h3></div>
                    <p>Check the contact, category and travel details before continuing.</p>
                  </div>
                  <div class="field-grid">
                  <label class="field"><span class="form-label">Name</span><input name="name" [(ngModel)]="application.name" required class="readonly-field"></label>
                  <label class="field"><span class="form-label">Phone</span><input name="appPhone" [(ngModel)]="application.phone" required></label>
                  <label class="field"><span class="form-label">Email</span><input name="appEmail" type="email" [(ngModel)]="application.email" required class="readonly-field"></label>
                  <label class="field"><span class="form-label">Applicants</span><input name="applicants" type="number" min="1" [(ngModel)]="application.applicants" required></label>
                  <label class="field"><span class="form-label">Applicant category</span>
                    <select name="applicantCategory" [(ngModel)]="application.applicantCategory" required>
                      <option value="">Select category</option>
                      <option value="employed">Employed</option>
                      <option value="business-owner">Business owner</option>
                      <option value="employed-business-owner">Employed and business owner</option>
                    </select>
                  </label>
                  <label class="field"><span class="form-label">Passport expiry</span><input name="passportExpiry" type="date" [(ngModel)]="application.passportExpiry" required></label>
                  <label class="field"><span class="form-label">Travel date</span><input name="travelDate" type="date" [(ngModel)]="application.travelDate"></label>
                </div>
                  <label class="field" style="margin-top:14px"><span class="form-label">Travel history summary</span><textarea name="travelHistory" [(ngModel)]="application.travelHistory"></textarea></label>

                  <div class="form-section-head form-section-head--documents">
                    <div><span>Document checklist</span><h3>Upload required files</h3></div>
                    <p>Files save to your application as soon as each upload completes.</p>
                  </div>
                  <div class="upload-progress" aria-valuemin="0" aria-valuemax="100" [attr.aria-valuenow]="uploadPercent" style="margin:20px 0">
                  <div class="progress-bar"><span [style.width.%]="uploadPercent"></span></div>
                  <p style="margin:8px 0 0;color:var(--muted);font-size:13px">{{ completeRequired }} of {{ requiredDocs.length }} required uploads ready</p>
                </div>

                  <div class="upload-grid">
                  <div class="upload-row" *ngFor="let doc of visibleDocs" [class.is-complete]="doc.files.length">
                    <div class="upload-row__body">
                      <strong>{{ doc.document }}</strong>
                      <span>{{ doc.required ? 'Required document' : 'Optional supporting document' }}</span>
                      <em *ngIf="!doc.required">Optional</em>
                      <ul class="upload-list">
                        <li *ngFor="let file of doc.files"><span>{{ file.name }}</span><span>{{ fileSize(file.size) }}</span></li>
                      </ul>
                    </div>
                    <input type="file" [attr.multiple]="doc.field.includes('Statements') || doc.field.includes('Visas') ? true : null" [required]="doc.required" (change)="handleFiles(doc, $event)">
                  </div>
                </div>
                  <p class="form-status" role="status">{{ uploadStatus }}</p>

                  <section *ngIf="showsSection('employed')" style="margin-top:22px">
                  <h3 style="margin:0 0 12px;font-size:18px">Employment details</h3>
                  <div class="field-grid field-grid--3">
                    <label class="field"><span class="form-label">Role</span><input name="role" [(ngModel)]="application.role"></label>
                    <label class="field"><span class="form-label">Salary</span><input name="salary" [(ngModel)]="application.salary"></label>
                    <label class="field"><span class="form-label">Employment length</span><input name="employmentLength" [(ngModel)]="application.employmentLength"></label>
                  </div>
                </section>

                  <label class="field" style="margin-top:18px"><span class="form-label">Notes</span><textarea name="appNotes" [(ngModel)]="application.notes"></textarea></label>
                  <label class="review-check">
                  <input name="reviewConfirmed" type="checkbox" [(ngModel)]="reviewConfirmed">
                  <span>I have reviewed the applicant details, passport extraction, payment status and uploaded documents.</span>
                </label>
                </section>
              </form>

              <aside class="portal-card progress-panel">
                <div class="progress-panel__head">
                  <span class="badge">Progress</span>
                  <h3>Application status</h3>
                  <p>{{ isStaffApplicant ? 'No payment is required. Complete the documents and applicant review before submission.' : paymentPaid ? 'Payment is verified. Complete document review before final submission.' : 'Payment is required before the application can be submitted.' }}</p>
                </div>
                <div class="progress-meter">
                  <div class="progress-bar"><span [style.width.%]="uploadPercent"></span></div>
                  <small>{{ completeRequired }} of {{ requiredDocs.length }} required documents ready</small>
                </div>
                <div class="progress-list">
                  <div [class.is-complete]="passportDoc.files.length"><b></b><span>Passport data page</span></div>
                  <div [class.is-complete]="completeRequired === requiredDocs.length"><b></b><span>Required uploads</span></div>
                  <div [class.is-complete]="submissionPaymentSatisfied"><b></b><span>{{ isStaffApplicant ? 'No payment required' : paymentPaid ? 'Payment verified' : 'Payment pending' }}</span></div>
                  <div [class.is-complete]="reviewConfirmed"><b></b><span>Applicant review</span></div>
                </div>
                <button class="btn btn-blue btn-block" type="button" *ngIf="!submissionPaymentSatisfied" [disabled]="paymentWorking" (click)="startPaystackPayment()">
                  {{ paymentWorking ? 'Opening Paystack...' : 'Pay to submit · ' + totalDueLabel }}
                </button>
                <button class="btn btn-blue btn-block" type="submit" form="visaApplicationForm" *ngIf="submissionPaymentSatisfied" [disabled]="!reviewConfirmed">
                  Submit and review
                </button>
                <p class="form-status" role="status">{{ progressStatusText }}</p>
                <div class="pss-note"><strong>Safety</strong><span>{{ isStaffApplicant ? 'Staff applications are sent only after all required documents and applicant review are complete.' : 'No application is sent to admin until Paystack payment is verified and review is confirmed.' }}</span></div>
              </aside>
            </div>
          </div>
        </section>
      </main>
    </div>
  `
})
export class VisaComponent implements OnInit {
  static readonly MAX_FILE_BYTES = 20 * 1024 * 1024;

  authMode: 'login' | 'signup' = 'login';
  mobileMenuOpen = false;
  portalVisible = false;
  loginStatus = '';
  signupStatus = '';
  applicationStatus = '';
  passportStatus = '';
  paymentStatus = '';
  uploadStatus = '';
  uploadErrors = new Map<string, string>();
  uploadsInFlight = 0;
  paymentWorking = false;
  uploadUnlocked = false;
  reviewConfirmed = false;
  currentApplicant: EligibleApplicant | null = null;
  existingApplication: VisaApplication | null = null;
  pricing: VisaPricing = { basic: 745000, premium: 745000, staff: 0 };

  loginModel = { email: '', accessCode: '' };
  signupModel = { name: '', email: '', phone: '', accessCode: '', confirmAccessCode: '', category: '', notes: '' };

  requirements = [
    'Completed Canada visa application form',
    'Updated CV or resume',
    'Valid passport with minimum 6 months validity',
    'Previous and current visas showing travel history',
    'Personal and salary bank statements for 6 months',
    'Personal tax clearance certificate',
    'Family ties documents where applicable',
    'Asset or property ownership evidence'
  ];

  docs: UploadDoc[] = [
    { field: 'applicationForm', document: 'Completed Canada visa application form', required: true, files: [] },
    { field: 'resume', document: 'Updated CV / resume', required: true, files: [] },
    { field: 'passport', document: 'Valid passport', required: true, files: [] },
    { field: 'previousVisas', document: 'Previous and current visas', required: true, files: [] },
    { field: 'bankStatements', document: 'Bank statements', required: true, files: [] },
    { field: 'taxClearance', document: 'Personal tax clearance certificate', required: true, files: [] },
    { field: 'familyTies', document: 'Family ties documents', required: false, files: [] },
    { field: 'assets', document: 'Asset or property evidence', required: false, files: [] },
    { field: 'employmentLetter', document: 'Employment letter', required: true, section: 'employed', files: [] },
    { field: 'paySlips', document: '6 months pay slips', required: true, section: 'employed', files: [] },
    { field: 'staffId', document: 'Staff ID card', required: true, section: 'employed', files: [] },
    { field: 'introductionLetter', document: 'Introduction letter from employer', required: true, section: 'employed', files: [] },
    { field: 'cac', document: 'CAC registration documents', required: true, section: 'business-owner', files: [] },
    { field: 'companyIntro', document: 'Company introduction letter', required: true, section: 'business-owner', files: [] },
    { field: 'companyTax', document: 'Company tax clearance certificate', required: true, section: 'business-owner', files: [] },
    { field: 'businessBank', document: 'Business and personal bank statements', required: true, section: 'business-owner', files: [] }
  ];

  application: VisaApplication = this.blankApplication();

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    void this.loadPricing();
    void this.loadSession();
  }

  async loadPricing(): Promise<void> {
    try {
      const { pricing } = await this.api.getVisaPricing();
      this.pricing = pricing;
    } catch {
      this.pricing = { basic: 745000, premium: 745000, staff: 0 };
    }
  }

  get activeDocs(): UploadDoc[] {
    return this.docs.filter((doc) => !doc.section || this.showsSection(doc.section));
  }

  get visibleDocs(): UploadDoc[] {
    return this.activeDocs.filter((doc) => doc.field !== 'passport');
  }

  get passportDoc(): UploadDoc {
    return this.docs.find((doc) => doc.field === 'passport') as UploadDoc;
  }

  get requiredDocs(): UploadDoc[] {
    return this.activeDocs.filter((doc) => doc.required);
  }

  get completeRequired(): number {
    return this.requiredDocs.filter((doc) => doc.files.length > 0).length;
  }

  get uploadPercent(): number {
    return this.requiredDocs.length ? Math.round((this.completeRequired / this.requiredDocs.length) * 100) : 100;
  }

  get fileCount(): number {
    return this.docs.reduce((total, doc) => total + doc.files.length, 0);
  }

  get parsedPassportName(): string {
    const parsed = this.application.passportDetails?.parsed;
    const parts = [parsed?.firstName, parsed?.middleName, parsed?.surname].filter(Boolean);
    return parts.length ? parts.join(' ') : 'Not found';
  }

  get applicantCount(): number {
    const parsed = Number.parseInt(String(this.application.applicants || '1'), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  get applicantUserType(): 'basic' | 'premium' | 'staff' {
    const type = this.currentApplicant?.userType || this.application.userType || 'basic';
    return ['basic', 'premium', 'staff'].includes(type) ? type : 'basic';
  }

  get isStaffApplicant(): boolean {
    return this.applicantUserType === 'staff';
  }

  get applicantUserTypeLabel(): string {
    if (this.applicantUserType === 'premium') return 'Premium';
    if (this.applicantUserType === 'staff') return 'Staff';
    return 'Basic';
  }

  get totalDue(): number {
    if (this.isStaffApplicant) return 0;
    const perApplicant = this.applicantUserType === 'premium' ? this.pricing.premium : this.pricing.basic;
    return this.applicantCount * Number(perApplicant || 0);
  }

  get totalDueLabel(): string {
    if (this.isStaffApplicant) return 'No payment required';
    return `NGN ${this.totalDue.toLocaleString()}`;
  }

  get basicPriceLabel(): string {
    return `NGN ${Number(this.pricing.basic || 0).toLocaleString()}`;
  }

  get paymentPaid(): boolean {
    return this.application.paymentStatus === 'Paid';
  }

  get submissionPaymentSatisfied(): boolean {
    return this.isStaffApplicant || this.paymentPaid;
  }

  get paymentPending(): boolean {
    return this.application.paymentStatus === 'Pending';
  }

  get paymentFailed(): boolean {
    return this.application.paymentStatus === 'Failed';
  }

  get paymentStatusLabel(): string {
    if (this.isStaffApplicant) return 'No payment required';
    if (this.paymentPaid) return 'Paid';
    if (this.paymentPending) return 'Payment pending';
    if (this.paymentFailed) return 'Payment failed';
    return 'Unpaid';
  }

  get uploadSectionVisible(): boolean {
    return this.isStaffApplicant || this.paymentPaid || this.uploadUnlocked;
  }

  get progressStatusText(): string {
    if (this.isStaffApplicant) {
      return this.applicationStatus || 'Complete the required documents and confirm the applicant review to submit.';
    }
    if (!this.paymentPaid) {
      return this.paymentStatus || (this.uploadSectionVisible
        ? 'Documents can be uploaded now. Pay with card before final submission.'
        : 'Choose pay now or continue to uploads. Submission stays locked until payment is verified.');
    }
    return this.applicationStatus || 'Confirm the review checklist when all required uploads are ready.';
  }

  blankApplication(): VisaApplication {
    return {
      id: '',
      applicantId: '',
      name: '',
      email: '',
      phone: '',
      applicants: '1',
      applicantCategory: '',
      userType: 'basic',
      passportExpiry: '',
      travelDate: '',
      travelHistory: '',
      role: '',
      salary: '',
      employmentLength: '',
      notes: '',
      fee: 'Basic visa package: visa fee included, admin processing fee included, Headies ticket fee included',
      status: 'Draft',
      paymentStatus: 'Unpaid',
      paymentReference: '',
      paymentAmount: 0,
      paymentCurrency: 'NGN',
      paymentPaidAt: '',
      reviewedAt: '',
      passportDetails: null,
      reviewConfirmed: false,
      uploads: []
    };
  }

  async signup(valid: boolean | null): Promise<void> {
    if (!valid) {
      this.signupStatus = 'Complete the required fields.';
      return;
    }
    if (this.signupModel.accessCode.trim().length < 6) {
      this.signupStatus = 'Access code must be at least 6 characters.';
      return;
    }
    if (this.signupModel.accessCode.trim() !== this.signupModel.confirmAccessCode.trim()) {
      this.signupStatus = 'Access code and confirmation must match.';
      return;
    }
    this.signupStatus = 'Submitting access request...';
    try {
      const { applicant } = await this.api.signupApplicant({
        name: this.signupModel.name,
        email: this.signupModel.email,
        phone: this.signupModel.phone,
        accessCode: this.signupModel.accessCode.trim(),
        category: this.signupModel.category,
        notes: this.signupModel.notes
      });
      if (applicant.status === 'active') {
        this.saveSession(applicant);
        await this.openPortal(applicant);
        this.signupStatus = 'Access confirmed. Continue your visa application.';
      } else if (applicant.status === 'blocked') this.signupStatus = 'This profile cannot request access. Contact the visa admin team.';
      else this.signupStatus = 'Access request received. Use your chosen code after admin approval.';
      if (applicant.status === 'pending') this.signupModel = { name: '', email: '', phone: '', accessCode: '', confirmAccessCode: '', category: '', notes: '' };
    } catch (error) {
      this.signupStatus = error instanceof Error ? error.message : 'Could not submit access request.';
    }
  }

  async login(valid: boolean | null): Promise<void> {
    if (!valid) {
      this.loginStatus = 'Enter your email and access code.';
      return;
    }
    this.loginStatus = 'Checking eligibility...';
    try {
      const { applicant } = await this.api.loginApplicant(this.loginModel.email, this.loginModel.accessCode);
      this.saveSession(applicant);
      await this.openPortal(applicant);
      this.loginStatus = '';
    } catch (error) {
      this.loginStatus = 'No active applicant matched those details.';
    }
  }

  async loadSession(): Promise<void> {
    const raw = sessionStorage.getItem('headiesVisaApplicantSession') || localStorage.getItem('headiesVisaApplicantSession');
    if (!raw) return;
    const session = JSON.parse(raw) as { id: string };
    const { applicants } = await this.api.listEligible();
    const applicant = applicants.find((item) => item.id === session.id && item.status === 'active');
    if (applicant) await this.openPortal(applicant);
  }

  saveSession(applicant: EligibleApplicant): void {
    const session = JSON.stringify({ id: applicant.id, email: applicant.email });
    sessionStorage.setItem('headiesVisaApplicantSession', session);
    localStorage.setItem('headiesVisaApplicantSession', session);
  }

  async openPortal(applicant: EligibleApplicant): Promise<void> {
    this.currentApplicant = applicant;
    this.portalVisible = true;
    this.uploadUnlocked = false;
    this.reviewConfirmed = false;
    this.application = {
      ...this.blankApplication(),
      id: applicant.id,
      applicantId: applicant.id,
      name: applicant.name,
      email: applicant.email,
      phone: applicant.phone,
      applicantCategory: applicant.category,
      userType: applicant.userType || 'basic'
    };
    try {
      const { application } = await this.api.getApplication(applicant.id);
      this.existingApplication = application;
      this.mergeApplication(application);
      // A bare draft row (created by an early document upload) must never blank
      // out the profile fields prefilled from the signed-in applicant.
      this.application.name = this.application.name || applicant.name;
      this.application.email = this.application.email || applicant.email;
      this.application.phone = this.application.phone || applicant.phone;
      this.application.applicantCategory = this.application.applicantCategory || applicant.category;
      this.application.userType = applicant.userType || application.userType || 'basic';
      this.hydrateUploads(application.uploads || []);
      this.uploadUnlocked = this.paymentPaid || Boolean((application.uploads || []).some((upload) => (upload.files || []).length));
      if (application.passportDetails?.parsed) {
        this.passportStatus = 'Passport details loaded from saved application.';
      }
      await this.verifyPaymentCallbackIfNeeded();
    } catch {
      this.existingApplication = null;
      this.hydrateUploads([]);
      this.uploadUnlocked = false;
      this.passportStatus = '';
      await this.verifyPaymentCallbackIfNeeded();
    }
    setTimeout(() => location.hash = 'visa-upload');
  }

  logout(): void {
    sessionStorage.removeItem('headiesVisaApplicantSession');
    localStorage.removeItem('headiesVisaApplicantSession');
    this.portalVisible = false;
    this.currentApplicant = null;
    this.existingApplication = null;
    this.application = this.blankApplication();
    this.docs.forEach((doc) => doc.files = []);
    this.passportStatus = '';
    this.paymentStatus = '';
    this.uploadStatus = '';
    this.uploadErrors.clear();
    this.uploadsInFlight = 0;
    this.paymentWorking = false;
    this.uploadUnlocked = false;
    this.reviewConfirmed = false;
  }

  /** Merge server fields into local state without letting server upload
   *  metadata leak into the payloads we later POST back. */
  mergeApplication(application: VisaApplication): void {
    const { uploads, ...fields } = application;
    this.application = { ...this.application, ...fields };
  }

  openUploadsBeforePayment(): void {
    this.uploadUnlocked = true;
    this.paymentStatus = this.isStaffApplicant
      ? 'Uploads are open. Staff access does not require card payment.'
      : 'Uploads are open. Payment is still required before final submission.';
  }

  async startPaystackPayment(): Promise<void> {
    if (!this.currentApplicant) {
      this.paymentStatus = 'Sign in before payment.';
      return;
    }
    if (this.isStaffApplicant) {
      this.paymentStatus = 'No payment is required for staff applications.';
      return;
    }
    if (!this.application.email) {
      this.paymentStatus = 'Applicant email is required for payment.';
      return;
    }

    this.paymentWorking = true;
    this.paymentStatus = 'Preparing secure Paystack checkout...';
    try {
      this.normalizeApplicationDates();
      const callbackUrl = `${location.origin}/visa`;
      const { application, payment } = await this.api.initializePaystackPayment({
        ...this.application,
        id: this.currentApplicant.id,
        applicantId: this.currentApplicant.id,
        applicants: String(this.applicantCount),
        uploads: undefined
      }, callbackUrl);
      this.mergeApplication(application);
      this.existingApplication = application;
      this.paymentStatus = 'Redirecting to Paystack...';
      location.href = payment.authorizationUrl;
    } catch (error) {
      this.paymentStatus = error instanceof Error ? error.message : 'Could not start Paystack payment.';
      this.paymentWorking = false;
    }
  }

  async verifyPaymentCallbackIfNeeded(): Promise<void> {
    const query = new URLSearchParams(location.search);
    const reference = query.get('reference') || query.get('trxref');
    if (!reference || !this.currentApplicant) return;

    this.paymentWorking = true;
    this.paymentStatus = 'Verifying Paystack payment...';
    try {
      const { application, payment } = await this.api.verifyPaystackPayment(reference);
      this.mergeApplication(application);
      this.existingApplication = application;
      this.hydrateUploads(application.uploads || []);
      this.paymentStatus = payment.verified ? 'Payment verified. Continue upload and review.' : 'Payment could not be verified.';
      if (payment.verified) this.uploadUnlocked = true;
    } catch (error) {
      this.paymentStatus = error instanceof Error ? error.message : 'Could not verify payment.';
    } finally {
      this.paymentWorking = false;
      history.replaceState(null, '', `${location.pathname}#visa-upload`);
    }
  }

  showsSection(section: 'employed' | 'business-owner'): boolean {
    const type = this.application.applicantCategory;
    if (section === 'employed') return type === 'employed' || type === 'employed-business-owner';
    return type === 'business-owner' || type === 'employed-business-owner';
  }

  handleFiles(doc: UploadDoc, event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    void this.uploadDocumentFiles(doc, files, input);
  }

  /** Uploads each selected file to the server immediately so documents are
   *  persisted before payment and survive the Paystack redirect. */
  async uploadDocumentFiles(doc: UploadDoc, files: File[], input?: HTMLInputElement): Promise<void> {
    if (!this.currentApplicant) {
      this.uploadStatus = 'Sign in again before uploading documents.';
      return;
    }
    const oversized = files.find((file) => file.size > VisaComponent.MAX_FILE_BYTES);
    if (oversized) {
      this.uploadErrors.set(doc.field, `${oversized.name} is larger than 20MB. Compress it and select it again.`);
      if (input) input.value = '';
      this.refreshUploadStatus();
      return;
    }
    doc.files = files;
    this.uploadsInFlight += 1;
    this.refreshUploadStatus();
    try {
      let replaceField = true;
      let application: VisaApplication | null = null;
      for (const file of files) {
        const record = await this.fileToData(file);
        const result = await this.api.uploadApplicationDocument(this.currentApplicant.id, {
          field: doc.field,
          document: doc.document,
          required: doc.required,
          replaceField,
          file: record
        });
        application = result.application;
        replaceField = false;
      }
      if (application) {
        const group = (application.uploads || []).find((upload) => upload.field === doc.field);
        doc.files = group ? group.files : [];
      }
      this.uploadErrors.delete(doc.field);
    } catch (error) {
      doc.files = [];
      if (input) input.value = '';
      this.uploadErrors.set(doc.field, error instanceof Error && error.message && error.message !== 'Request failed'
        ? `Could not save ${doc.document}: ${error.message}`
        : `Could not save ${doc.document}. Check your connection and select the file again.`);
    } finally {
      this.uploadsInFlight -= 1;
      this.refreshUploadStatus();
    }
  }

  /** Composes one status line from in-flight uploads and per-document errors so
   *  a later success can never hide an earlier failure. */
  refreshUploadStatus(): void {
    const errors = Array.from(this.uploadErrors.values());
    if (errors.length) {
      this.uploadStatus = errors.join(' ');
      return;
    }
    if (this.uploadsInFlight > 0) {
      this.uploadStatus = 'Saving documents...';
      return;
    }
    this.uploadStatus = this.fileCount ? 'All selected documents are saved to your application.' : '';
  }

  fileSize(bytes: number): string {
    if (!bytes) return '0 KB';
    if (bytes < 1048576) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0)} MB`;
  }

  hydrateUploads(uploads: UploadGroup[]): void {
    this.docs.forEach((doc) => doc.files = []);
    uploads.forEach((upload) => {
      const doc = this.docs.find((item) => item.field === upload.field);
      if (doc) doc.files = upload.files || [];
    });
  }

  async parsePassportDataPage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = (input.files || [])[0];
    if (!file) return;
    if (file.size > VisaComponent.MAX_FILE_BYTES) {
      this.passportStatus = `${file.name} is larger than 20MB. Compress it and select it again.`;
      input.value = '';
      return;
    }

    this.passportStatus = 'Reading passport image...';
    const passportFile = await this.fileToData(file);
    this.passportDoc.files = [passportFile];

    // Persist the passport image immediately so it survives the Paystack redirect.
    if (this.currentApplicant) {
      this.passportStatus = 'Saving passport image...';
      try {
        const { application } = await this.api.uploadApplicationDocument(this.currentApplicant.id, {
          field: this.passportDoc.field,
          document: this.passportDoc.document,
          required: this.passportDoc.required,
          replaceField: true,
          file: passportFile
        });
        const group = (application.uploads || []).find((upload) => upload.field === this.passportDoc.field);
        if (group) this.passportDoc.files = group.files;
      } catch (error) {
        // Keep the UI honest: the passport is NOT attached, and reset the input
        // so re-selecting the same file fires a change event again.
        this.passportDoc.files = [];
        input.value = '';
        this.passportStatus = error instanceof Error && error.message && error.message !== 'Request failed'
          ? `Could not save the passport image: ${error.message} Select it again to retry.`
          : 'Could not save the passport image. Check your connection and select it again.';
        return;
      }
    }

    try {
      this.passportStatus = 'Extracting passport details...';
      const details = await this.api.parsePassport(passportFile, this.application.travelDate);
      this.application.passportDetails = details;
      this.applyPassportDetails(details);
      this.passportStatus = 'Passport image saved and details extracted.';
    } catch (error) {
      this.application.passportDetails = null;
      this.passportStatus = error instanceof Error && error.message && error.message !== 'Request failed'
        ? `Image saved, but extraction failed: ${error.message}`
        : 'Image saved, but extraction failed. Enter passport expiry manually.';
    }
  }

  applyPassportDetails(details: PassportParseResult): void {
    const expiry = this.toDateInput(details.parsed?.expirationDate);
    this.application.passportExpiry = expiry || '';
  }

  toDateInput(value?: string): string {
    const text = String(value || '').trim();
    if (!text) return '';
    const validIso = (yearValue: string | number, monthValue: string | number, dayValue: string | number): string => {
      const rawYear = Number.parseInt(String(yearValue), 10);
      const year = rawYear < 100 ? (rawYear < 50 ? 2000 + rawYear : 1900 + rawYear) : rawYear;
      const month = Number.parseInt(String(monthValue), 10);
      const day = Number.parseInt(String(dayValue), 10);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (
        !Number.isFinite(year) ||
        !Number.isFinite(month) ||
        !Number.isFinite(day) ||
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
      ) return '';
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };
    const months: Record<string, number> = {
      jan: 1, january: 1,
      feb: 2, february: 2,
      mar: 3, march: 3,
      apr: 4, april: 4,
      may: 5,
      jun: 6, june: 6,
      jul: 7, july: 7,
      aug: 8, august: 8,
      sep: 9, sept: 9, september: 9,
      oct: 10, october: 10,
      nov: 11, november: 11,
      dec: 12, december: 12
    };

    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
    if (iso) return validIso(iso[1], iso[2], iso[3]);

    const separated = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (separated) {
      const [, day, month, year] = separated;
      return validIso(year, month, day);
    }

    const yearFirst = text.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);
    if (yearFirst) {
      const [, year, month, day] = yearFirst;
      return validIso(year, month, day);
    }

    const mrzDate = text.match(/^(\d{2})(\d{2})(\d{2})$/);
    if (mrzDate) {
      const [, year, month, day] = mrzDate;
      return validIso(year, month, day);
    }

    const textMonth = text.match(/^(?:(?:mon|tue|wed|thu|fri|sat|sun)\w*\s+)?([a-z]+)\s+(\d{1,2})(?:,?\s+(\d{2,4}))$/i);
    if (textMonth) {
      const month = months[textMonth[1].toLowerCase()];
      return month ? validIso(textMonth[3], month, textMonth[2]) : '';
    }

    const dayTextMonth = text.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{2,4})$/i);
    if (dayTextMonth) {
      const month = months[dayTextMonth[2].toLowerCase()];
      return month ? validIso(dayTextMonth[3], month, dayTextMonth[1]) : '';
    }

    if (/\d{4}/.test(text)) {
      const parsed = new Date(text);
      if (!Number.isNaN(parsed.getTime())) {
        return validIso(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
      }
    }

    return '';
  }

  normalizeApplicationDates(): void {
    this.application.passportExpiry = this.toDateInput(this.application.passportExpiry);
    this.application.travelDate = this.toDateInput(this.application.travelDate);
  }

  async fileToData(file: UploadFile): Promise<UploadedFileRecord> {
    if (!(file instanceof File)) return file;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    return { name: file.name, size: file.size, type: file.type || 'application/octet-stream', dataUrl };
  }

  async submitApplication(valid: boolean | null): Promise<void> {
    if (!valid || !this.currentApplicant) {
      this.applicationStatus = 'Complete the required fields.';
      return;
    }
    if (!this.submissionPaymentSatisfied) {
      this.applicationStatus = 'Verified Paystack payment is required before submission. You can keep uploading documents.';
      return;
    }
    if (!this.reviewConfirmed) {
      this.applicationStatus = 'Review and confirm the application before submission.';
      return;
    }
    if (this.completeRequired < this.requiredDocs.length) {
      this.applicationStatus = 'Upload all required documents before submitting.';
      return;
    }
    this.applicationStatus = 'Saving application...';
    try {
      this.normalizeApplicationDates();
      // Documents are already persisted server-side as they were selected.
      // Omitting `uploads` keeps the submit payload tiny and tells the server
      // to leave the stored documents untouched.
      const payload: VisaApplication = {
        ...this.application,
        status: 'Submitted',
        reviewConfirmed: true
      };
      delete payload.uploads;
      const { application } = await this.api.saveApplication(payload);
      this.existingApplication = application;
      this.mergeApplication(application);
      this.hydrateUploads(application.uploads || []);
      this.applicationStatus = 'Application submitted for admin review.';
    } catch (error) {
      this.applicationStatus = error instanceof Error && error.message && error.message !== 'Request failed'
        ? error.message
        : 'Could not save application. Check your connection and try again.';
    }
  }
}
