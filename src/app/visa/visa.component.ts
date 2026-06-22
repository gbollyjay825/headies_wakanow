import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, EligibleApplicant, PassportParseResult, UploadGroup, UploadedFileRecord, VisaApplication } from '../api.service';

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
            <a class="btn btn-primary" href="#apply">Start application</a>
          </div>
        </div>
      </header>

      <main>
        <section class="page-hero">
          <div class="container page-hero__grid">
            <div>
              <p class="eyebrow">Canada visa | Toronto</p>
              <h1>Canada visa support for the <span>Headies weekend</span></h1>
              <p>Review the requirements, sign in as an eligible applicant, and upload documents through the secure portal. A flat fee applies per applicant.</p>
            </div>
            <div class="page-hero__media"><img src="assets/img/visa.jpg" alt="Passport and Canada visa travel support"></div>
          </div>
        </section>

        <section class="section" id="apply">
          <div class="container split-layout visa-apply-layout" [class.split-layout--full]="portalVisible">
            <div>
              <div class="process-grid">
                <div class="process-card"><b>1</b><h3>Request access</h3><p>Applicants sign up or use admin-issued credentials.</p></div>
                <div class="process-card"><b>2</b><h3>Upload documents</h3><p>Approved applicants submit required files.</p></div>
                <div class="process-card"><b>3</b><h3>Processing begins</h3><p>Details are prepared for Wakanow visa review.</p></div>
              </div>

              <article class="portal-card requirements-card">
                <div class="requirements-card__intro">
                  <p class="section-kicker">Canada Business Visa</p>
                  <h2 class="section-title" style="font-size:26px">Requirements and application guide</h2>
                  <p style="margin:8px 0 22px;color:var(--muted)">Visa fee <strong style="color:var(--text)">NGN 350,000</strong> per applicant. Prepare these documents before uploading.</p>
                  <div class="pss-note" style="margin-top:20px"><strong>Portal</strong><span>Applicants must be approved by an admin before upload access is enabled.</span></div>
                </div>
                <div class="requirement-grid">
                  <div class="requirement" *ngFor="let item of requirements">{{ item }}</div>
                </div>
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

        <section class="section portal-hidden" id="visa-upload" [hidden]="!portalVisible">
          <div class="container portal-shell">
            <div class="portal-top">
              <div>
                <p class="section-kicker" style="margin:0 0 5px">Canada Business Visa | The Headies</p>
                <h1 style="margin:0;font-size:30px">Your application</h1>
                <p style="margin:6px 0 0;color:var(--muted)">Upload documents, review details and submit for visa team review.</p>
              </div>
              <div class="status-pills">
                <span class="pill pill--warn" *ngIf="existingApplication">{{ existingApplication.status }}</span>
                <span class="pill" [class.pill--ok]="paymentPaid" [class.pill--warn]="paymentPending || paymentFailed">{{ paymentStatusLabel }}</span>
                <span class="pill pill--muted">{{ fileCount }} files</span>
              </div>
              <button class="btn btn-ghost btn-small" type="button" (click)="logout()">Sign out</button>
            </div>

            <div class="portal-stepper" aria-label="Visa application stages">
              <div class="portal-step is-active"><b>1</b><div><span>Passport</span><small>Extract details</small></div></div>
              <div class="portal-step"><b>2</b><div><span>Documents</span><small>Upload files</small></div></div>
              <div class="portal-step" [class.is-active]="paymentPaid"><b>3</b><div><span>Payment</span><small>{{ paymentPaid ? 'Paid' : 'Required before submit' }}</small></div></div>
              <div class="portal-step" [class.is-active]="reviewConfirmed"><b>4</b><div><span>Review</span><small>Confirm before submit</small></div></div>
            </div>

            <div class="portal-grid">
              <form id="visaApplicationForm" class="application-flow" #applicationForm="ngForm" (ngSubmit)="submitApplication(applicationForm.valid)">
                <section class="portal-card payment-card" [class.is-paid]="paymentPaid">
                  <div class="payment-card__copy">
                    <p class="section-kicker">Payment</p>
                    <h2>Visa service payment</h2>
                    <p>{{ paymentPaid ? 'Payment has been verified. Continue with the applicant documents and final review.' : 'Pay now to unlock a clean submission path, or upload documents first and pay before final submission.' }}</p>
                    <div class="payment-card__meta">
                      <span class="pill" [class.pill--ok]="paymentPaid" [class.pill--warn]="paymentPending || paymentFailed">{{ paymentStatusLabel }}</span>
                      <small *ngIf="application.paymentReference">Reference {{ application.paymentReference }}</small>
                      <small *ngIf="!application.paymentReference">Secured through Paystack card checkout</small>
                    </div>
                  </div>
                  <div class="payment-card__due">
                    <span>Total due</span>
                    <strong>{{ totalDueLabel }}</strong>
                    <small>{{ application.applicants || 1 }} applicant(s) · NGN 350,000 each</small>
                    <button class="btn btn-blue btn-block" type="button" [disabled]="paymentWorking || paymentPaid" (click)="startPaystackPayment()">
                      {{ paymentPaid ? 'Payment verified' : paymentWorking ? 'Opening Paystack...' : 'Pay with card' }}
                    </button>
                    <button class="payment-card__link" type="button" *ngIf="!paymentPaid && !uploadSectionVisible" (click)="openUploadsBeforePayment()">Upload documents first</button>
                    <p class="form-status" role="status">{{ paymentStatus }}</p>
                  </div>
                </section>

                <section class="portal-card upload-section" [hidden]="!uploadSectionVisible">
                  <div class="upload-section__header">
                    <div>
                      <h2>Upload documents</h2>
                      <p>Signed in as <strong>{{ currentApplicant?.name || currentApplicant?.email }}</strong></p>
                      <span>{{ currentApplicant?.email }} · {{ currentApplicant?.category }}</span>
                    </div>
                    <span class="badge">Portal save ready</span>
                  </div>

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
                  <p>{{ paymentPaid ? 'Payment is verified. Complete document review before final submission.' : 'Payment is required before the application can be submitted.' }}</p>
                </div>
                <div class="progress-meter">
                  <div class="progress-bar"><span [style.width.%]="uploadPercent"></span></div>
                  <small>{{ completeRequired }} of {{ requiredDocs.length }} required documents ready</small>
                </div>
                <div class="progress-list">
                  <div [class.is-complete]="passportDoc.files.length"><b></b><span>Passport data page</span></div>
                  <div [class.is-complete]="completeRequired === requiredDocs.length"><b></b><span>Required uploads</span></div>
                  <div [class.is-complete]="paymentPaid"><b></b><span>{{ paymentPaid ? 'Payment verified' : 'Payment pending' }}</span></div>
                  <div [class.is-complete]="reviewConfirmed"><b></b><span>Applicant review</span></div>
                </div>
                <button class="btn btn-blue btn-block" type="button" *ngIf="!paymentPaid" [disabled]="paymentWorking" (click)="startPaystackPayment()">
                  {{ paymentWorking ? 'Opening Paystack...' : 'Make payment · ' + totalDueLabel }}
                </button>
                <button class="btn btn-blue btn-block" type="submit" form="visaApplicationForm" *ngIf="paymentPaid" [disabled]="!reviewConfirmed">
                  Submit and review
                </button>
                <p class="form-status" role="status">{{ progressStatusText }}</p>
                <div class="pss-note"><strong>Safety</strong><span>No application is sent to admin until Paystack payment is verified and review is confirmed.</span></div>
              </aside>
            </div>
          </div>
        </section>
      </main>
    </div>
  `
})
export class VisaComponent implements OnInit {
  authMode: 'login' | 'signup' = 'login';
  portalVisible = false;
  loginStatus = '';
  signupStatus = '';
  applicationStatus = '';
  passportStatus = '';
  paymentStatus = '';
  paymentWorking = false;
  uploadUnlocked = false;
  reviewConfirmed = false;
  currentApplicant: EligibleApplicant | null = null;
  existingApplication: VisaApplication | null = null;

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
    void this.loadSession();
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

  get totalDue(): number {
    return this.applicantCount * 350000;
  }

  get totalDueLabel(): string {
    return `NGN ${this.totalDue.toLocaleString()}`;
  }

  get paymentPaid(): boolean {
    return this.application.paymentStatus === 'Paid';
  }

  get paymentPending(): boolean {
    return this.application.paymentStatus === 'Pending';
  }

  get paymentFailed(): boolean {
    return this.application.paymentStatus === 'Failed';
  }

  get paymentStatusLabel(): string {
    if (this.paymentPaid) return 'Paid';
    if (this.paymentPending) return 'Payment pending';
    if (this.paymentFailed) return 'Payment failed';
    return 'Unpaid';
  }

  get uploadSectionVisible(): boolean {
    return this.paymentPaid || this.uploadUnlocked;
  }

  get progressStatusText(): string {
    if (!this.paymentPaid) {
      return this.paymentStatus || 'Pay securely with Paystack before final submission.';
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
      passportExpiry: '',
      travelDate: '',
      travelHistory: '',
      role: '',
      salary: '',
      employmentLength: '',
      notes: '',
      fee: 'NGN350,000 per applicant',
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
      if (applicant.status === 'active') this.signupStatus = 'Your profile is already active. Use sign in with your access code.';
      else if (applicant.status === 'blocked') this.signupStatus = 'This profile cannot request access. Contact the visa admin team.';
      else this.signupStatus = 'Access request received. Use your chosen code after admin approval.';
      if (applicant.status === 'pending') this.signupModel = { name: '', email: '', phone: '', accessCode: '', confirmAccessCode: '', category: '', notes: '' };
    } catch (error) {
      this.signupStatus = 'Could not submit access request.';
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
      applicantCategory: applicant.category
    };
    try {
      const { application } = await this.api.getApplication(applicant.id);
      this.existingApplication = application;
      this.application = { ...this.application, ...application };
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
    this.paymentWorking = false;
    this.uploadUnlocked = false;
    this.reviewConfirmed = false;
  }

  openUploadsBeforePayment(): void {
    this.uploadUnlocked = true;
    this.paymentStatus = 'Documents can be uploaded now. Payment is still required before final submission.';
  }

  async startPaystackPayment(): Promise<void> {
    if (!this.currentApplicant) {
      this.paymentStatus = 'Sign in before payment.';
      return;
    }
    if (!this.application.email) {
      this.paymentStatus = 'Applicant email is required for payment.';
      return;
    }

    this.paymentWorking = true;
    this.paymentStatus = 'Preparing secure Paystack checkout...';
    try {
      const callbackUrl = `${location.origin}/visa`;
      const { application, payment } = await this.api.initializePaystackPayment({
        ...this.application,
        id: this.currentApplicant.id,
        applicantId: this.currentApplicant.id,
        applicants: String(this.applicantCount)
      }, callbackUrl);
      this.application = { ...this.application, ...application };
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
      this.application = { ...this.application, ...application };
      this.existingApplication = application;
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
    doc.files = Array.from((event.target as HTMLInputElement).files || []);
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
    const file = ((event.target as HTMLInputElement).files || [])[0];
    if (!file) return;

    this.passportStatus = 'Reading passport image...';
    const passportFile = await this.fileToData(file);
    this.passportDoc.files = [passportFile];

    try {
      this.passportStatus = 'Extracting passport details...';
      const details = await this.api.parsePassport(passportFile, this.application.travelDate);
      this.application.passportDetails = details;
      this.applyPassportDetails(details);
      this.passportStatus = 'Passport image saved and details extracted.';
    } catch (error) {
      this.application.passportDetails = null;
      this.passportStatus = error instanceof Error
        ? `Image saved, but extraction failed: ${error.message}`
        : 'Image saved, but extraction failed. Enter passport expiry manually.';
    }
  }

  applyPassportDetails(details: PassportParseResult): void {
    const expiry = this.toDateInput(details.parsed?.expirationDate);
    if (expiry) this.application.passportExpiry = expiry;
  }

  toDateInput(value?: string): string {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

    const separated = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (separated) {
      const [, day, month, year] = separated;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const mrzDate = text.match(/^(\d{2})(\d{2})(\d{2})$/);
    if (mrzDate) {
      const [, year, month, day] = mrzDate;
      const fullYear = Number(year) < 50 ? `20${year}` : `19${year}`;
      return `${fullYear}-${month}-${day}`;
    }
    return '';
  }

  async fileToData(file: UploadFile): Promise<UploadedFileRecord> {
    if ('dataUrl' in file) return file;
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
    if (!this.paymentPaid) {
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
    const uploads: UploadGroup[] = [];
    for (const doc of this.activeDocs) {
      uploads.push({
        field: doc.field,
        document: doc.document,
        required: doc.required,
        files: await Promise.all(doc.files.map((file) => this.fileToData(file)))
      });
    }
    try {
      const { application } = await this.api.saveApplication({
        ...this.application,
        uploads,
        status: 'Submitted',
        reviewConfirmed: true
      });
      this.existingApplication = application;
      this.application = { ...this.application, ...application };
      this.hydrateUploads(application.uploads || []);
      this.applicationStatus = 'Application submitted for admin review.';
    } catch (error) {
      this.applicationStatus = 'Could not save application.';
    }
  }
}
