import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, EligibleApplicant, VisaApplication } from '../api.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="admin-page">
      <header class="site-nav">
        <div class="container site-nav__inner">
          <a class="brand" routerLink="/" aria-label="The Headies x Wakanow home">
            <img src="assets/headies-logo.png" alt="The Headies">
            <span class="brand__divider" aria-hidden="true"></span>
            <img src="assets/wakanow-logo.png" alt="Wakanow">
          </a>
          <span class="badge">Travel Desk | Admin</span>
          <div class="nav-actions">
            <button class="btn btn-ghost btn-small" type="button" (click)="loadDashboard()">Refresh</button>
            <a class="btn btn-blue btn-small" routerLink="/">View site</a>
          </div>
        </div>
      </header>

      <main class="admin-main">
        <div class="container">
          <section class="admin-auth" [hidden]="isAdmin">
            <div class="portal-card" style="max-width:460px;margin:70px auto 0;padding:28px">
              <span class="badge">Admin access</span>
              <h1 style="margin:16px 0 8px;font-size:28px">Visa admin login</h1>
              <p style="margin:0 0 20px;color:var(--muted)">Sign in to add eligible applicants and review uploaded documents.</p>
              <form #loginForm="ngForm" (ngSubmit)="login(loginForm.valid)">
                <label class="field"><span class="form-label">Admin passcode</span><input name="passcode" type="password" [(ngModel)]="passcode" required></label>
                <button class="btn btn-blue btn-block" style="margin-top:18px" type="submit">Open admin dashboard</button>
                <p class="form-status" role="status">{{ loginStatus }}</p>
              </form>
            </div>
          </section>

          <section class="admin-panel" [hidden]="!isAdmin">
            <div class="admin-title">
              <div>
                <h1>Road to Toronto | Visa Admin</h1>
                <p>Preload approved applicant emails, manage login access and review submitted documents.</p>
              </div>
              <div class="admin-title__actions">
                <button class="btn btn-danger btn-small" type="button" (click)="logout()">Sign out</button>
              </div>
            </div>

            <div class="stat-grid stat-grid--admin">
              <div class="stat-card"><span>Preloaded emails</span><strong>{{ applicants.length }}</strong></div>
              <div class="stat-card"><span>Completed signups</span><strong>{{ completedSignupCount }}</strong></div>
              <div class="stat-card"><span>Applications</span><strong>{{ applications.length }}</strong></div>
              <div class="stat-card"><span>Uploaded documents</span><strong>{{ documentCount }}</strong></div>
            </div>

            <nav class="admin-tabs" aria-label="Admin sections">
              <button type="button" [class.is-active]="activeTab === 'applications'" (click)="activeTab = 'applications'">
                Applications <span>{{ applications.length }}</span>
              </button>
              <button type="button" [class.is-active]="activeTab === 'setup'" (click)="activeTab = 'setup'">
                Setup <span>Import</span>
              </button>
              <button type="button" [class.is-active]="activeTab === 'allowlist'" (click)="activeTab = 'allowlist'">
                Allowlist <span>{{ applicants.length }}</span>
              </button>
            </nav>

            <section class="admin-card admin-import-card" [hidden]="activeTab !== 'setup'">
              <div class="admin-import-card__copy">
                <span class="badge">Primary setup</span>
                <h2>Import allowlist</h2>
                <p>Upload a CSV of approved applicant emails first. Signup is denied until an email exists in this list. Access code is optional; applicants can create one during signup when admin leaves it blank.</p>
              </div>
              <form class="admin-import-card__form" (ngSubmit)="importApplicants(importCsvInput)">
                <label class="field">
                  <span class="form-label">CSV file</span>
                  <input #importCsvInput name="eligibleCsv" type="file" accept=".csv,text/csv" (change)="setImportFile($event)" required>
                </label>
                <button class="btn btn-blue btn-block" type="submit" [disabled]="importWorking">{{ importWorking ? 'Importing...' : 'Import approved emails' }}</button>
                <p class="form-status" role="status">{{ importStatus || selectedImportFileName }}</p>
              </form>
              <div class="admin-import-card__actions">
                <button class="btn btn-ghost btn-small" type="button" (click)="downloadTemplate()">Download CSV template</button>
                <button class="btn btn-secondary btn-small" type="button" (click)="exportEligibleCSV()">Export access list</button>
              </div>
            </section>

            <div class="admin-section-stack">
              <section class="admin-card" [hidden]="activeTab !== 'applications'">
                <div class="admin-card__head admin-card__head--row">
                    <div>
                      <h2>Visa applications and documents</h2>
                      <p style="margin:4px 0 0;color:var(--muted);font-size:13px">Review submitted applications and download uploaded documents.</p>
                    </div>
                  </div>
                  <div class="empty-state" *ngIf="!applications.length">No submitted visa applications yet.</div>
                  <div class="table-wrap" *ngIf="applications.length">
                    <table class="data-table data-table--applications">
                      <thead><tr><th>Applicant</th><th>Status</th><th>Payment</th><th>Category</th><th>Passport</th><th>Updated</th><th>Documents</th></tr></thead>
                      <tbody>
                        <tr *ngFor="let app of applications">
                          <td data-label="Applicant"><strong>{{ app.name || app.email }}</strong><div>{{ app.email }} · {{ app.phone }}</div></td>
                          <td data-label="Status">
                            <select [ngModel]="app.status" (ngModelChange)="updateApplicationStatus(app, $event)">
                              <option value="Draft">Draft</option>
                              <option value="Submitted">Submitted</option>
                              <option value="In review">In review</option>
                              <option value="Missing documents">Missing documents</option>
                              <option value="Approved">Approved</option>
                              <option value="Declined">Declined</option>
                            </select>
                          </td>
                          <td data-label="Payment">
                            <div class="payment-admin">
                              <span class="pill" [class.pill--ok]="app.paymentStatus === 'Paid'" [class.pill--warn]="app.paymentStatus === 'Pending' || app.paymentStatus === 'Failed'">
                                {{ app.paymentStatus || 'Unpaid' }}
                              </span>
                              <small *ngIf="app.paymentReference">{{ app.paymentReference }}</small>
                            </div>
                          </td>
                          <td data-label="Category">{{ app.applicantCategory || 'Unassigned' }}</td>
                          <td data-label="Passport">
                            <div class="passport-admin" *ngIf="app.passportDetails?.parsed; else noPassportDetails">
                              <strong>{{ app.passportDetails?.parsed?.passportNumber || 'Passport captured' }}</strong>
                              <span>{{ adminPassportName(app) }}</span>
                              <span>Expiry {{ app.passportExpiry || app.passportDetails?.parsed?.expirationDate || 'not found' }}</span>
                              <span class="pill" [class.pill--ok]="app.passportDetails?.validation?.valid" [class.pill--warn]="app.passportDetails?.validation && !app.passportDetails?.validation?.valid">
                                {{ app.passportDetails?.validation?.valid ? 'Valid' : 'Review' }}
                              </span>
                            </div>
                            <ng-template #noPassportDetails><span class="pill pill--muted">Not parsed</span></ng-template>
                          </td>
                          <td data-label="Updated">{{ formatDate(app.updatedAt || app.createdAt) }}</td>
                          <td data-label="Documents">
                            <ul class="document-list" *ngIf="countFiles(app); else noFiles">
                              <ng-container *ngFor="let upload of app.uploads">
                                <li *ngFor="let file of upload.files">
                                  <span>{{ upload.document }} · {{ file.name }} · {{ fileSize(file.size) }}</span>
                                  <a class="doc-link" [href]="file.dataUrl" [download]="file.name">Download</a>
                                </li>
                              </ng-container>
                            </ul>
                            <ng-template #noFiles><span class="pill pill--muted">No files</span></ng-template>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

              <div class="admin-grid admin-grid--allowlist" [class.admin-grid--wide-panel]="activeTab === 'allowlist'" [hidden]="activeTab === 'applications'">
                <aside class="admin-card admin-card--compact" [hidden]="activeTab !== 'setup'">
                  <div class="admin-card__head">
                    <h2>Preload one email</h2>
                    <p>Add an approved applicant manually when you do not need a CSV import.</p>
                  </div>
                  <form #addForm="ngForm" (ngSubmit)="addApplicant(addForm.valid)">
                    <div class="admin-form-grid">
                      <label class="field"><span class="form-label">Name</span><input name="name" type="text" [(ngModel)]="newApplicant.name" required></label>
                      <label class="field"><span class="form-label">Email</span><input name="email" type="email" [(ngModel)]="newApplicant.email" required></label>
                      <label class="field"><span class="form-label">Phone</span><input name="phone" type="tel" [(ngModel)]="newApplicant.phone"></label>
                      <label class="field"><span class="form-label">Access code</span><input name="accessCode" type="password" autocomplete="new-password" [(ngModel)]="newApplicant.accessCode" placeholder="Optional admin-issued code"></label>
                      <label class="field"><span class="form-label">Category</span>
                        <select name="category" [(ngModel)]="newApplicant.category">
                          <option value="">Unassigned</option>
                          <option value="employed">Employed</option>
                          <option value="business-owner">Business owner</option>
                          <option value="employed-business-owner">Employed and business owner</option>
                        </select>
                      </label>
                    </div>
                    <label class="field"><span class="form-label">Notes</span><textarea name="notes" [(ngModel)]="newApplicant.notes"></textarea></label>
                    <button class="btn btn-blue btn-block" type="submit">Preload email</button>
                    <p class="form-status" role="status">{{ addStatus }}</p>
                  </form>
                </aside>

                <section class="admin-card" [hidden]="activeTab !== 'allowlist'">
                  <div class="admin-card__head admin-card__head--row">
                    <div>
                      <h2>Visa email allowlist</h2>
                      <p style="margin:4px 0 0;color:var(--muted);font-size:13px">Signup is denied unless the applicant email is already preloaded here. Active applicants can sign in after setting or receiving an access code.</p>
                      <p class="form-status" role="status">{{ accessStatus }}</p>
                    </div>
                  </div>
                  <div class="empty-state" *ngIf="!applicants.length">No approved emails have been preloaded yet.</div>
                  <div class="table-wrap" *ngIf="applicants.length">
                    <table class="data-table data-table--allowlist">
                      <thead><tr><th>Applicant</th><th>Email</th><th>Access code</th><th>Category</th><th>Status</th><th>Signup</th><th>Actions</th></tr></thead>
                      <tbody>
                        <tr *ngFor="let applicant of applicants">
                          <td data-label="Applicant"><strong>{{ applicant.name || 'Unnamed' }}</strong><div>{{ applicant.phone }}</div></td>
                          <td data-label="Email">{{ applicant.email }}</td>
                          <td data-label="Access code">
                            <div class="access-code-cell">
                              <input class="input" [name]="'accessCode-' + applicant.id" type="password" autocomplete="new-password" [(ngModel)]="applicant.accessCode" minlength="6">
                              <button class="btn btn-secondary btn-small" type="button" (click)="updateApplicantCode(applicant)">Save code</button>
                            </div>
                          </td>
                          <td data-label="Category">{{ applicant.category || 'Unassigned' }}</td>
                          <td data-label="Status">
                            <select [ngModel]="applicant.status" (ngModelChange)="updateApplicantStatus(applicant, $event)">
                              <option value="pending">pending</option>
                              <option value="active">active</option>
                              <option value="blocked">blocked</option>
                            </select>
                          </td>
                          <td data-label="Signup">
                            <span class="pill" [class.pill--ok]="applicant.signupCompletedAt" [class.pill--warn]="!applicant.signupCompletedAt">
                              {{ applicant.signupCompletedAt ? 'Code set' : 'Awaiting signup' }}
                            </span>
                          </td>
                          <td data-label="Actions"><button class="btn btn-ghost btn-small" type="button" (click)="removeApplicant(applicant)">Remove</button></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  `
})
export class AdminComponent implements OnInit {
  passcode = '';
  loginStatus = '';
  addStatus = '';
  importStatus = '';
  accessStatus = '';
  importWorking = false;
  isAdmin = sessionStorage.getItem('headiesVisaAdminSession') === 'true';
  applicants: EligibleApplicant[] = [];
  applications: VisaApplication[] = [];
  importFile: File | null = null;
  selectedImportFileName = '';
  activeTab: 'applications' | 'setup' | 'allowlist' = 'applications';

  newApplicant: Partial<EligibleApplicant> = {
    name: '',
    email: '',
    phone: '',
    accessCode: '',
    category: '',
    notes: '',
    status: 'active'
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    if (this.isAdmin) void this.loadDashboard();
  }

  get documentCount(): number {
    return this.applications.reduce((total, app) => total + this.countFiles(app), 0);
  }

  get completedSignupCount(): number {
    return this.applicants.filter((applicant) => Boolean(applicant.signupCompletedAt)).length;
  }

  async login(valid: boolean | null): Promise<void> {
    if (!valid) return;
    if (this.passcode !== 'HEADIES2026') {
      this.loginStatus = 'Invalid admin passcode.';
      return;
    }
    sessionStorage.setItem('headiesVisaAdminSession', 'true');
    this.isAdmin = true;
    this.loginStatus = '';
    await this.loadDashboard();
  }

  logout(): void {
    sessionStorage.removeItem('headiesVisaAdminSession');
    this.isAdmin = false;
  }

  async loadDashboard(): Promise<void> {
    const [eligible, apps] = await Promise.all([
      this.api.listEligible(),
      this.api.listApplications()
    ]);
    this.applicants = eligible.applicants;
    this.applications = apps.applications.sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
  }

  async addApplicant(valid: boolean | null): Promise<void> {
    if (!valid) {
      this.addStatus = 'Complete the required fields.';
      return;
    }
    this.addStatus = 'Preloading approved email...';
    await this.api.addEligible({ ...this.newApplicant, status: 'active' });
    this.newApplicant = { name: '', email: '', phone: '', accessCode: '', category: '', notes: '', status: 'active' };
    this.addStatus = 'Approved email preloaded.';
    await this.loadDashboard();
  }

  async updateApplicantStatus(applicant: EligibleApplicant, status: 'pending' | 'active' | 'blocked'): Promise<void> {
    await this.api.updateEligible(applicant.id, { status });
    await this.loadDashboard();
  }

  async updateApplicantCode(applicant: EligibleApplicant): Promise<void> {
    const accessCode = String(applicant.accessCode || '').trim();
    if (accessCode.length < 6) {
      this.accessStatus = 'Access code must be at least 6 characters.';
      return;
    }
    this.accessStatus = 'Saving access code...';
    await this.api.updateEligible(applicant.id, { accessCode });
    this.accessStatus = 'Access code updated.';
    await this.loadDashboard();
  }

  async removeApplicant(applicant: EligibleApplicant): Promise<void> {
    await this.api.deleteEligible(applicant.id);
    await this.loadDashboard();
  }

  async updateApplicationStatus(app: VisaApplication, status: VisaApplication['status']): Promise<void> {
    await this.api.updateApplication(app.id, { status });
    await this.loadDashboard();
  }

  setImportFile(event: Event): void {
    this.importFile = ((event.target as HTMLInputElement).files || [])[0] || null;
    this.selectedImportFileName = this.importFile ? `Ready to import: ${this.importFile.name}` : '';
    this.importStatus = '';
  }

  async importApplicants(fileInput?: HTMLInputElement): Promise<void> {
    if (!this.importFile) {
      this.importStatus = 'Choose a CSV file.';
      return;
    }
    this.importWorking = true;
    this.importStatus = 'Reading CSV...';
    try {
      const rows = this.parseCSV(await this.importFile.text());
      if (!rows.length) {
        this.importStatus = 'No rows found in the CSV.';
        return;
      }
      const missingEmailIndex = rows.findIndex((row) => !(row['email'] || row['Email'] || '').trim());
      if (missingEmailIndex >= 0) {
        this.importStatus = `Row ${missingEmailIndex + 2} is missing an email address.`;
        return;
      }
      const records = rows.map((row) => ({
        name: row['name'] || row['Name'] || '',
        email: row['email'] || row['Email'] || '',
        phone: row['phone'] || row['Phone'] || '',
        accessCode: row['accessCode'] || row['AccessCode'] || row['code'] || row['Code'] || '',
        category: row['category'] || row['Category'] || '',
        status: (row['status'] || row['Status'] || 'active') as EligibleApplicant['status'],
        notes: row['notes'] || row['Notes'] || ''
      }));
      this.importStatus = 'Importing approved emails...';
      await this.api.importEligible(records);
      this.importStatus = `${records.length} approved email${records.length === 1 ? '' : 's'} imported.`;
      this.importFile = null;
      this.selectedImportFileName = '';
      if (fileInput) fileInput.value = '';
      await this.loadDashboard();
    } catch (error) {
      this.importStatus = error instanceof Error ? error.message : 'Could not import allowlist.';
    } finally {
      this.importWorking = false;
    }
  }

  parseCSV(text: string): Record<string, string>[] {
    const rows = this.parseCsvRows(text).filter((row) => row.some((cell) => cell.trim()));
    const [headers, ...records] = rows;
    if (!headers || !headers.length) return [];
    return records.map((cells) => headers.reduce<Record<string, string>>((row, header, index) => {
      row[header.trim()] = (cells[index] || '').trim();
      return row;
    }, {}));
  }

  parseCsvRows(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];
      if (char === '"' && quoted && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === ',' && !quoted) {
        row.push(cell);
        cell = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') index += 1;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }
    row.push(cell);
    rows.push(row);
    return rows;
  }

  downloadTemplate(): void {
    this.downloadText('visa-email-allowlist-template.csv', 'name,email,phone,accessCode,category,status,notes\nExample Applicant,applicant@example.com,+2340000000000,,employed,active,Preloaded by admin');
  }

  exportEligibleCSV(): void {
    const rows = [['name', 'email', 'phone', 'accessCode', 'category', 'status', 'signupCompletedAt', 'notes']];
    this.applicants.forEach((item) => rows.push([item.name, item.email, item.phone, item.accessCode || '', item.category, item.status, item.signupCompletedAt || '', item.notes]));
    this.downloadText('headies-visa-eligible-applicants.csv', rows.map((row) => row.map(this.csvEscape).join(',')).join('\n'));
  }

  csvEscape(value: string): string {
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }

  downloadText(filename: string, text: string): void {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      link.remove();
    });
  }

  countFiles(app: VisaApplication): number {
    return (app.uploads || []).reduce((total, upload) => total + (upload.files ? upload.files.length : 0), 0);
  }

  fileSize(bytes: number): string {
    if (!bytes) return '0 KB';
    if (bytes < 1048576) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0)} MB`;
  }

  adminPassportName(app: VisaApplication): string {
    const parsed = app.passportDetails?.parsed;
    const parts = [parsed?.firstName, parsed?.middleName, parsed?.surname].filter(Boolean);
    return parts.length ? parts.join(' ') : 'Name not found';
  }

  formatDate(value?: string): string {
    if (!value) return '';
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
}
