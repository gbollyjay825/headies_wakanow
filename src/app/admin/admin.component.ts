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
                <p>Manage visa access requests, eligible applicant login access and submitted documents.</p>
              </div>
              <div style="display:flex;gap:10px;flex-wrap:wrap">
                <button class="btn btn-ghost btn-small" type="button" (click)="downloadTemplate()">Download CSV template</button>
                <button class="btn btn-secondary btn-small" type="button" (click)="exportEligibleCSV()">Export access list</button>
                <button class="btn btn-danger btn-small" type="button" (click)="logout()">Sign out</button>
              </div>
            </div>

            <div class="stat-grid">
              <div class="stat-card"><span>Applicant profiles</span><strong>{{ applicants.length }}</strong></div>
              <div class="stat-card"><span>Applications</span><strong>{{ applications.length }}</strong></div>
              <div class="stat-card"><span>Uploaded documents</span><strong>{{ documentCount }}</strong></div>
            </div>

            <div class="admin-grid">
              <aside class="admin-card">
                <h2>Add eligible applicant</h2>
                <p style="margin:0 0 16px;color:var(--muted);font-size:13px">Admin-added applicants are active by default and can sign in with their access code.</p>
                <form #addForm="ngForm" (ngSubmit)="addApplicant(addForm.valid)">
                  <label class="field"><span class="form-label">Name</span><input name="name" type="text" [(ngModel)]="newApplicant.name" required></label>
                  <label class="field" style="margin-top:12px"><span class="form-label">Email</span><input name="email" type="email" [(ngModel)]="newApplicant.email" required></label>
                  <label class="field" style="margin-top:12px"><span class="form-label">Phone</span><input name="phone" type="tel" [(ngModel)]="newApplicant.phone"></label>
                  <label class="field" style="margin-top:12px"><span class="form-label">Access code</span><input name="accessCode" type="password" autocomplete="new-password" [(ngModel)]="newApplicant.accessCode" placeholder="Leave blank to auto-generate"></label>
                  <label class="field" style="margin-top:12px"><span class="form-label">Category</span>
                    <select name="category" [(ngModel)]="newApplicant.category">
                      <option value="">Unassigned</option>
                      <option value="employed">Employed</option>
                      <option value="business-owner">Business owner</option>
                      <option value="employed-business-owner">Employed and business owner</option>
                    </select>
                  </label>
                  <label class="field" style="margin-top:12px"><span class="form-label">Notes</span><textarea name="notes" [(ngModel)]="newApplicant.notes"></textarea></label>
                  <button class="btn btn-blue btn-block" style="margin-top:16px" type="submit">Add applicant</button>
                  <p class="form-status" role="status">{{ addStatus }}</p>
                </form>

                <hr style="border:0;border-top:1px solid var(--line);margin:24px 0">

                <h2>Import applicants</h2>
                <p style="margin:0 0 14px;color:var(--muted);font-size:13px">Upload a CSV with columns: name, email, phone, accessCode, category, status, notes.</p>
                <form (ngSubmit)="importApplicants()">
                  <label class="field"><span class="form-label">CSV file</span><input name="eligibleCsv" type="file" accept=".csv,text/csv" (change)="setImportFile($event)" required></label>
                  <button class="btn btn-secondary btn-block" style="margin-top:14px" type="submit">Import CSV</button>
                  <p class="form-status" role="status">{{ importStatus }}</p>
                </form>
              </aside>

              <div style="display:grid;gap:22px">
                <section class="admin-card">
                  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px">
                    <div>
                      <h2>Applicant access list</h2>
                      <p style="margin:4px 0 0;color:var(--muted);font-size:13px">Pending sign-ups must be activated before applicants can sign in.</p>
                      <p class="form-status" role="status">{{ accessStatus }}</p>
                    </div>
                  </div>
                  <div class="empty-state" *ngIf="!applicants.length">No applicant profiles yet.</div>
                  <div class="table-wrap" *ngIf="applicants.length">
                    <table class="data-table">
                      <thead><tr><th>Applicant</th><th>Email</th><th>Access code</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead>
                      <tbody>
                        <tr *ngFor="let applicant of applicants">
                          <td><strong>{{ applicant.name || 'Unnamed' }}</strong><div>{{ applicant.phone }}</div></td>
                          <td>{{ applicant.email }}</td>
                          <td>
                            <div class="access-code-cell">
                              <input class="input" [name]="'accessCode-' + applicant.id" type="password" autocomplete="new-password" [(ngModel)]="applicant.accessCode" minlength="6">
                              <button class="btn btn-secondary btn-small" type="button" (click)="updateApplicantCode(applicant)">Save code</button>
                            </div>
                          </td>
                          <td>{{ applicant.category || 'Unassigned' }}</td>
                          <td>
                            <select [ngModel]="applicant.status" (ngModelChange)="updateApplicantStatus(applicant, $event)">
                              <option value="pending">pending</option>
                              <option value="active">active</option>
                              <option value="blocked">blocked</option>
                            </select>
                          </td>
                          <td><button class="btn btn-ghost btn-small" type="button" (click)="removeApplicant(applicant)">Remove</button></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section class="admin-card">
                  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px">
                    <div>
                      <h2>Visa applications and documents</h2>
                      <p style="margin:4px 0 0;color:var(--muted);font-size:13px">Review submitted applications and download uploaded documents.</p>
                    </div>
                  </div>
                  <div class="empty-state" *ngIf="!applications.length">No submitted visa applications yet.</div>
                  <div class="table-wrap" *ngIf="applications.length">
                    <table class="data-table">
                      <thead><tr><th>Applicant</th><th>Status</th><th>Payment</th><th>Category</th><th>Passport</th><th>Updated</th><th>Documents</th></tr></thead>
                      <tbody>
                        <tr *ngFor="let app of applications">
                          <td><strong>{{ app.name || app.email }}</strong><div>{{ app.email }} · {{ app.phone }}</div></td>
                          <td>
                            <select [ngModel]="app.status" (ngModelChange)="updateApplicationStatus(app, $event)">
                              <option value="Draft">Draft</option>
                              <option value="Submitted">Submitted</option>
                              <option value="In review">In review</option>
                              <option value="Missing documents">Missing documents</option>
                              <option value="Approved">Approved</option>
                              <option value="Declined">Declined</option>
                            </select>
                          </td>
                          <td>
                            <div class="payment-admin">
                              <span class="pill" [class.pill--ok]="app.paymentStatus === 'Paid'" [class.pill--warn]="app.paymentStatus === 'Pending' || app.paymentStatus === 'Failed'">
                                {{ app.paymentStatus || 'Unpaid' }}
                              </span>
                              <small *ngIf="app.paymentReference">{{ app.paymentReference }}</small>
                            </div>
                          </td>
                          <td>{{ app.applicantCategory }}</td>
                          <td>
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
                          <td>{{ formatDate(app.updatedAt || app.createdAt) }}</td>
                          <td>
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
  isAdmin = sessionStorage.getItem('headiesVisaAdminSession') === 'true';
  applicants: EligibleApplicant[] = [];
  applications: VisaApplication[] = [];
  importFile: File | null = null;

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
    this.addStatus = 'Adding applicant...';
    await this.api.addEligible({ ...this.newApplicant, status: 'active' });
    this.newApplicant = { name: '', email: '', phone: '', accessCode: '', category: '', notes: '', status: 'active' };
    this.addStatus = 'Applicant added.';
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
  }

  async importApplicants(): Promise<void> {
    if (!this.importFile) {
      this.importStatus = 'Choose a CSV file.';
      return;
    }
    const rows = this.parseCSV(await this.importFile.text());
    for (const row of rows) {
      await this.api.addEligible({
        name: row['name'] || row['Name'] || '',
        email: row['email'] || row['Email'] || '',
        phone: row['phone'] || row['Phone'] || '',
        accessCode: row['accessCode'] || row['AccessCode'] || row['code'] || row['Code'] || '',
        category: row['category'] || row['Category'] || '',
        status: (row['status'] || row['Status'] || 'active') as EligibleApplicant['status'],
        notes: row['notes'] || row['Notes'] || ''
      });
    }
    this.importStatus = `${rows.length} applicants imported.`;
    await this.loadDashboard();
  }

  parseCSV(text: string): Record<string, string>[] {
    const [headerLine, ...lines] = text.split(/\r?\n/).filter((line) => line.trim());
    if (!headerLine) return [];
    const headers = headerLine.split(',').map((item) => item.trim());
    return lines.map((line) => {
      const cells = line.split(',');
      return headers.reduce<Record<string, string>>((row, header, index) => {
        row[header] = (cells[index] || '').trim();
        return row;
      }, {});
    });
  }

  downloadTemplate(): void {
    this.downloadText('visa-eligible-template.csv', 'name,email,phone,accessCode,category,status,notes\nExample Applicant,applicant@example.com,+2340000000000,HEADIES123,employed,active,');
  }

  exportEligibleCSV(): void {
    const rows = [['name', 'email', 'phone', 'accessCode', 'category', 'status', 'notes']];
    this.applicants.forEach((item) => rows.push([item.name, item.email, item.phone, item.accessCode || '', item.category, item.status, item.notes]));
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
