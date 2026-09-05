import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, EligibleApplicant, TravelRequest, UploadedFileRecord, UploadGroup, VisaApplication, VisaPricing } from '../api.service';
import { PackageAdminComponent } from '../package-admin/package-admin.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PackageAdminComponent],
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
            <a class="btn btn-ghost btn-small" routerLink="/package_admin" *ngIf="isAdmin">Package dashboard</a>
            <button class="btn btn-ghost btn-small" type="button" (click)="refreshActiveSection()">Refresh</button>
            <a class="btn btn-blue btn-small" routerLink="/">View site</a>
          </div>
        </div>
      </header>

      <main class="admin-main">
        <div class="container">
          <section class="admin-auth" [hidden]="isAdmin">
            <div class="portal-card" style="max-width:460px;margin:70px auto 0;padding:28px">
              <span class="badge">Admin access</span>
                <h1 style="margin:16px 0 8px;font-size:28px">Travel admin login</h1>
                <p style="margin:0 0 20px;color:var(--muted)">Sign in to manage travel enquiries, visa applicants and uploaded documents.</p>
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
                <h1>Road to Toronto | Travel Admin</h1>
                <p>Manage package bookings, travel enquiries, visa access and submitted applications in one workspace.</p>
              </div>
              <div class="admin-title__actions">
                <span class="badge">{{ isSuperAdmin ? 'Super admin' : 'Admin' }}</span>
                <button class="btn btn-danger btn-small" type="button" (click)="logout()">Sign out</button>
              </div>
            </div>

            <p class="form-status" role="status">{{ dashboardStatus }}</p>

            <div class="stat-grid stat-grid--admin stat-grid--admin-five">
              <div class="stat-card"><span>Travel requests</span><strong>{{ travelRequests.length }}</strong></div>
              <div class="stat-card"><span>Preloaded emails</span><strong>{{ applicants.length }}</strong></div>
              <div class="stat-card"><span>Completed signups</span><strong>{{ completedSignupCount }}</strong></div>
              <div class="stat-card" *ngIf="isSuperAdmin"><span>Submitted applications</span><strong>{{ submittedApplications.length }}</strong></div>
              <div class="stat-card" *ngIf="isSuperAdmin"><span>Uploaded documents</span><strong>{{ documentCount }}</strong></div>
            </div>

            <nav class="admin-tabs" aria-label="Admin sections">
              <button type="button" [class.is-active]="activeTab === 'requests'" (click)="activeTab = 'requests'">
                Travel requests <span>{{ travelRequests.length }}</span>
              </button>
              <button type="button" [class.is-active]="activeTab === 'packages'" (click)="activeTab = 'packages'">
                Package bookings
              </button>
              <button type="button" *ngIf="isSuperAdmin" [class.is-active]="activeTab === 'applications'" (click)="activeTab = 'applications'">
                Visa applications <span>{{ applications.length }}</span>
              </button>
              <button type="button" [class.is-active]="activeTab === 'setup'" (click)="activeTab = 'setup'">
                Setup <span>Import</span>
              </button>
              <button type="button" [class.is-active]="activeTab === 'allowlist'" (click)="activeTab = 'allowlist'">
                Allowlist <span>{{ applicants.length }}</span>
              </button>
            </nav>

            <app-package-admin *ngIf="isAdmin && activeTab === 'packages'" [adminCode]="superAdminCode"></app-package-admin>

            <section class="admin-card admin-import-card" [hidden]="activeTab !== 'setup'">
              <div class="admin-import-card__copy">
                <span class="badge">Primary setup</span>
                <h2>Import allowlist</h2>
                <p>Upload a CSV of approved applicant emails first. Columns can include name, email, phone, accessCode, category, userType, status and notes. Use basic, premium, staff or nominee; a blank user type becomes Basic.</p>
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

            <section class="admin-card" [hidden]="activeTab !== 'setup'">
              <div class="admin-card__head admin-card__head--row">
                <div>
                  <h2>Visa pricing</h2>
                  <p style="margin:4px 0 0;color:var(--muted);font-size:13px">Basic and Premium use package pricing. Nominees pay for visa only. Staff users pay nothing.</p>
                </div>
                <span class="badge">{{ isSuperAdmin ? 'Super admin controls' : 'View only' }}</span>
              </div>
              <form class="admin-form-grid" (ngSubmit)="updatePricing()">
                <label class="field"><span class="form-label">Basic price</span><input name="basicPrice" type="number" min="0" step="1000" [(ngModel)]="pricingModel.basic" [disabled]="!isSuperAdmin"></label>
                <label class="field"><span class="form-label">Premium price</span><input name="premiumPrice" type="number" min="0" step="1000" [(ngModel)]="pricingModel.premium" [disabled]="!isSuperAdmin"></label>
                <label class="field"><span class="form-label">Nominees price · visa only</span><input name="nomineePrice" type="number" min="0" step="1000" [(ngModel)]="pricingModel.nominee" [disabled]="!isSuperAdmin"></label>
                <label class="field"><span class="form-label">Staff price</span><input name="staffPrice" type="text" [value]="money(pricing.staff)" disabled></label>
                <button class="btn btn-blue btn-block" type="submit" [disabled]="!isSuperAdmin || pricingWorking">{{ pricingWorking ? 'Saving...' : 'Save pricing' }}</button>
              </form>
              <p class="form-status" role="status">{{ pricingStatus || (!isSuperAdmin ? 'Login with the super admin passcode to update pricing.' : '') }}</p>
            </section>

            <div class="admin-section-stack">
              <section class="admin-card admin-applications-card" [hidden]="activeTab !== 'applications'">
                <div class="admin-card__head admin-card__head--row">
                  <div>
                    <h2>Visa applications and documents</h2>
                    <p style="margin:4px 0 0;color:var(--muted);font-size:13px">Superadmin workspace for reviewing status, exporting submitted applications and downloading uploaded documents.</p>
                  </div>
                  <button class="btn btn-blue btn-small" type="button" (click)="downloadSubmittedApplications()" [disabled]="!submittedApplications.length">Download submitted CSV</button>
                </div>

                <div class="empty-state" *ngIf="!applications.length">No submitted visa applications yet.</div>

                <div class="application-toolbar" *ngIf="applications.length">
                  <label class="field">
                    <span class="form-label">Search applications</span>
                    <input name="applicationSearch" type="search" [(ngModel)]="applicationSearch" placeholder="Name, email, phone, reference or category">
                  </label>
                  <label class="field">
                    <span class="form-label">Application status</span>
                    <select name="applicationStatusFilter" [(ngModel)]="applicationStatusFilter">
                      <option value="submitted">Submitted and under review</option>
                      <option value="all">All including drafts</option>
                      <option value="Submitted">Submitted</option>
                      <option value="In review">In review</option>
                      <option value="Missing documents">Missing documents</option>
                      <option value="Approved">Approved</option>
                      <option value="Declined">Declined</option>
                      <option value="Draft">Draft</option>
                    </select>
                  </label>
                  <label class="field">
                    <span class="form-label">Payment</span>
                    <select name="applicationPaymentFilter" [(ngModel)]="applicationPaymentFilter">
                      <option value="all">All payments</option>
                      <option value="Paid">Paid</option>
                      <option value="Pending">Pending</option>
                      <option value="Unpaid">Unpaid</option>
                      <option value="Failed">Failed</option>
                    </select>
                  </label>
                </div>

                <div class="empty-state" *ngIf="applications.length && !filteredApplications.length">No applications match the current filters.</div>

                <div class="applications-workbench" *ngIf="filteredApplications.length">
                  <aside class="application-list-panel" aria-label="Visa applications">
                    <button
                      class="application-list-item"
                      type="button"
                      *ngFor="let app of filteredApplications"
                      [class.is-active]="selectedApplication?.id === app.id"
                      (click)="selectApplication(app)"
                    >
                      <span class="application-list-item__top">
                        <span class="application-list-item__main">
                          <strong>{{ app.name || app.email }}</strong>
                          <small>{{ app.email }}</small>
                          <small *ngIf="app.phone">{{ app.phone }}</small>
                        </span>
                        <span class="application-list-item__meta">
                          <span class="pill" [class.pill--ok]="app.paymentStatus === 'Paid'" [class.pill--warn]="app.paymentStatus === 'Pending' || app.paymentStatus === 'Failed' || !app.paymentStatus">
                            {{ app.paymentStatus || 'Unpaid' }}
                          </span>
                          <span class="application-doc-count">{{ countFiles(app) }} file{{ countFiles(app) === 1 ? '' : 's' }}</span>
                        </span>
                      </span>
                      <span class="application-list-item__foot">
                        <span>{{ userTypeLabel(app.userType) }} · {{ app.applicantCategory || 'Unassigned' }} · {{ app.status }}</span>
                        <span>{{ formatDate(app.updatedAt || app.createdAt) }}</span>
                      </span>
                    </button>
                  </aside>

                  <ng-container *ngIf="selectedApplication as selectedApp">
                    <section class="application-detail-panel">
                      <div class="application-detail-head">
                        <div>
                          <span class="detail-kicker">Selected application</span>
                          <h3>{{ selectedApp.name || selectedApp.email }}</h3>
                          <p>{{ selectedApp.email }}<span *ngIf="selectedApp.phone"> · {{ selectedApp.phone }}</span></p>
                        </div>
                        <div class="application-detail-actions">
                          <button class="btn btn-secondary btn-small" type="button" (click)="downloadApplication(selectedApp)">Download application CSV</button>
                          <label class="field application-status-field">
                            <span class="form-label">Review status</span>
                            <select [ngModel]="selectedApp.status" (ngModelChange)="updateApplicationStatus(selectedApp, $event)">
                              <option value="Draft">Draft</option>
                              <option value="Submitted">Submitted</option>
                              <option value="In review">In review</option>
                              <option value="Missing documents">Missing documents</option>
                              <option value="Approved">Approved</option>
                              <option value="Declined">Declined</option>
                            </select>
                          </label>
                        </div>
                      </div>

                      <div class="application-badges">
                        <span class="pill" [class.pill--ok]="selectedApp.paymentStatus === 'Paid'" [class.pill--warn]="selectedApp.paymentStatus === 'Pending' || selectedApp.paymentStatus === 'Failed' || !selectedApp.paymentStatus">
                          {{ selectedApp.paymentStatus || 'Unpaid' }}
                        </span>
                        <span class="pill">{{ userTypeLabel(selectedApp.userType) }}</span>
                        <span class="pill">{{ selectedApp.applicantCategory || 'Unassigned category' }}</span>
                        <span class="pill">{{ selectedDocumentCount }} uploaded file{{ selectedDocumentCount === 1 ? '' : 's' }}</span>
                      </div>

                      <dl class="application-info-grid">
                        <div>
                          <dt>Payment reference</dt>
                          <dd>{{ selectedApp.paymentReference || 'Not available' }}</dd>
                        </div>
                        <div>
                          <dt>Amount</dt>
                          <dd>{{ selectedApp.paymentAmount ? moneyMinorUnits(selectedApp.paymentAmount) : (selectedApp.userType === 'staff' ? 'Staff comp' : 'Pending') }}</dd>
                        </div>
                        <div>
                          <dt>Travel date</dt>
                          <dd>{{ selectedApp.travelDate || 'Not supplied' }}</dd>
                        </div>
                        <div>
                          <dt>Updated</dt>
                          <dd>{{ formatDate(selectedApp.updatedAt || selectedApp.createdAt) }}</dd>
                        </div>
                      </dl>

                      <div class="application-passport-panel" [class.is-parsed]="selectedApp.passportDetails?.parsed">
                        <span class="form-label">Passport</span>
                        <div *ngIf="selectedApp.passportDetails?.parsed; else passportMissing">
                          <strong>{{ selectedApp.passportDetails?.parsed?.passportNumber || 'Passport captured' }}</strong>
                          <span>{{ adminPassportName(selectedApp) }}</span>
                          <span>Expiry {{ selectedApp.passportExpiry || selectedApp.passportDetails?.parsed?.expirationDate || 'not found' }}</span>
                          <span class="pill" [class.pill--ok]="selectedApp.passportDetails?.validation?.valid" [class.pill--warn]="selectedApp.passportDetails?.validation && !selectedApp.passportDetails?.validation?.valid">
                            {{ selectedApp.passportDetails?.validation?.valid ? 'Valid passport' : 'Needs review' }}
                          </span>
                        </div>
                        <ng-template #passportMissing>
                          <span class="pill pill--muted">Not parsed</span>
                        </ng-template>
                      </div>

                      <div class="application-documents-panel">
                        <div class="application-documents-panel__head">
                          <div>
                            <h4>Uploaded documents</h4>
                            <p>Grouped by requirement so downloads stay readable as files grow.</p>
                          </div>
                          <span>{{ selectedDocumentCount }} file{{ selectedDocumentCount === 1 ? '' : 's' }}</span>
                        </div>

                        <div class="empty-state" *ngIf="!selectedDocumentCount">No files have been uploaded for this application.</div>

                        <div class="application-upload-group" *ngFor="let upload of selectedUploads">
                          <div class="application-upload-group__head">
                            <strong>{{ upload.document }}</strong>
                            <span>{{ upload.files.length }} file{{ upload.files.length === 1 ? '' : 's' }}</span>
                          </div>
                          <div class="application-file-list">
                            <div class="application-file-row" *ngFor="let file of upload.files">
                              <div>
                                <strong>{{ file.name }}</strong>
                                <span>{{ file.type || 'Document' }} · {{ fileSize(file.size) }}</span>
                              </div>
                              <button class="btn btn-secondary btn-small" type="button" *ngIf="file.id" (click)="downloadDocument(selectedApp, file)" [disabled]="documentDownloadWorkingId === file.id">
                                {{ documentDownloadWorkingId === file.id ? 'Downloading...' : 'Download document' }}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </section>
                  </ng-container>
                </div>
              </section>

              <section class="admin-card admin-applications-card admin-requests-card" [hidden]="activeTab !== 'requests'">
                <div class="admin-card__head admin-card__head--row">
                  <div>
                    <span class="detail-kicker">Booking desk</span>
                    <h2>Travel and concierge requests</h2>
                    <p style="margin:4px 0 0;color:var(--muted);font-size:13px">Every Build my trip and concierge enquiry appears here, with the full itinerary and email-delivery state.</p>
                  </div>
                </div>

                <div class="empty-state" *ngIf="!travelRequests.length">No travel requests have been submitted yet.</div>

                <div class="application-toolbar request-toolbar" *ngIf="travelRequests.length">
                  <label class="field">
                    <span class="form-label">Search requests</span>
                    <input name="requestSearch" type="search" [(ngModel)]="requestSearch" placeholder="Name, email, phone, service or reference">
                  </label>
                  <label class="field">
                    <span class="form-label">Request type</span>
                    <select name="requestTypeFilter" [(ngModel)]="requestTypeFilter">
                      <option value="all">All requests</option>
                      <option value="Travel">Build my trip</option>
                      <option value="Luxury">Concierge</option>
                    </select>
                  </label>
                  <label class="field">
                    <span class="form-label">Status</span>
                    <select name="requestStatusFilter" [(ngModel)]="requestStatusFilter">
                      <option value="all">All statuses</option>
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Quoted">Quoted</option>
                      <option value="Booked">Booked</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </label>
                </div>

                <div class="empty-state" *ngIf="travelRequests.length && !filteredTravelRequests.length">No travel requests match the current filters.</div>

                <div class="applications-workbench requests-workbench" *ngIf="filteredTravelRequests.length">
                  <aside class="application-list-panel" aria-label="Travel requests">
                    <button
                      class="application-list-item"
                      type="button"
                      *ngFor="let request of filteredTravelRequests"
                      [class.is-active]="selectedTravelRequest?.id === request.id"
                      (click)="selectTravelRequest(request)"
                    >
                      <span class="application-list-item__top">
                        <span class="application-list-item__main">
                          <strong>{{ request.name || request.email }}</strong>
                          <small>{{ request.email }}</small>
                          <small *ngIf="request.phone">{{ request.phone }}</small>
                        </span>
                        <span class="application-list-item__meta">
                          <span class="pill" [class.pill--ok]="request.status === 'Booked'" [class.pill--warn]="request.status === 'New'">{{ request.status || 'New' }}</span>
                          <span class="request-type-label">{{ request.type === 'Luxury' ? 'Concierge' : 'Build trip' }}</span>
                        </span>
                      </span>
                      <span class="request-list-summary">{{ request.summary || 'No summary supplied' }}</span>
                      <span class="application-list-item__foot">
                        <span [class.request-email-ok]="requestEmailStatus(request) === 'sent'">{{ requestEmailLabel(request) }}</span>
                        <span>{{ formatDate(request.createdAt) }}</span>
                      </span>
                    </button>
                  </aside>

                  <ng-container *ngIf="selectedTravelRequest as selectedRequest">
                    <section class="application-detail-panel request-detail-panel">
                      <div class="application-detail-head">
                        <div>
                          <span class="detail-kicker">{{ selectedRequest.type === 'Luxury' ? 'Concierge request' : 'Build my trip request' }}</span>
                          <h3>{{ selectedRequest.name || selectedRequest.email }}</h3>
                          <p>{{ selectedRequest.email }}<span *ngIf="selectedRequest.phone"> · {{ selectedRequest.phone }}</span></p>
                        </div>
                        <label class="field application-status-field">
                          <span class="form-label">Request status</span>
                          <select [ngModel]="selectedRequest.status || 'New'" (ngModelChange)="updateTravelRequestStatus(selectedRequest, $event)">
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Quoted">Quoted</option>
                            <option value="Booked">Booked</option>
                            <option value="Closed">Closed</option>
                          </select>
                        </label>
                      </div>

                      <div class="application-badges">
                        <span class="pill">{{ selectedRequest.type === 'Luxury' ? 'Concierge' : 'Travel plan' }}</span>
                        <span class="pill" [class.pill--ok]="requestEmailStatus(selectedRequest) === 'sent'" [class.pill--warn]="requestEmailStatus(selectedRequest) !== 'sent'">{{ requestEmailLabel(selectedRequest) }}</span>
                      </div>

                      <dl class="application-info-grid request-contact-grid">
                        <div><dt>Phone</dt><dd>{{ selectedRequest.phone || 'Not supplied' }}</dd></div>
                        <div><dt>Email</dt><dd>{{ selectedRequest.email || 'Not supplied' }}</dd></div>
                        <div><dt>Reference</dt><dd>{{ selectedRequest.id }}</dd></div>
                        <div><dt>Submitted</dt><dd>{{ formatDate(selectedRequest.createdAt) }}</dd></div>
                      </dl>

                      <section class="request-summary-panel">
                        <span class="form-label">Request summary</span>
                        <strong>{{ selectedRequest.summary || 'No summary supplied' }}</strong>
                      </section>

                      <section class="request-itinerary-panel">
                        <div class="application-documents-panel__head">
                          <div><h4>Full request details</h4><p>Selections captured from the customer journey.</p></div>
                        </div>
                        <dl class="request-detail-list">
                          <div *ngFor="let detail of selectedRequest.details">
                            <dt>{{ detail[0] }}</dt>
                            <dd>{{ detail[1] }}</dd>
                          </div>
                        </dl>
                      </section>

                      <section class="request-email-panel" [class.is-sent]="requestEmailStatus(selectedRequest) === 'sent'">
                        <div>
                          <span class="form-label">Team email</span>
                          <h4>{{ requestEmailLabel(selectedRequest) }}</h4>
                          <p>{{ requestEmailRecipients(selectedRequest) }}</p>
                          <p class="request-email-error" *ngIf="selectedRequest.metadata?.notification?.error">{{ selectedRequest.metadata?.notification?.error }}</p>
                          <small *ngIf="selectedRequest.metadata?.notification?.attemptedAt">Last attempt {{ formatDate(selectedRequest.metadata?.notification?.attemptedAt) }}</small>
                        </div>
                        <div class="request-email-actions">
                          <a class="btn btn-secondary btn-small" [href]="'mailto:' + selectedRequest.email">Email customer</a>
                          <button class="btn btn-blue btn-small" type="button" (click)="retryTravelRequestEmail(selectedRequest)" [disabled]="requestNotifyWorkingId === selectedRequest.id">
                            {{ requestNotifyWorkingId === selectedRequest.id ? 'Sending...' : (requestEmailStatus(selectedRequest) === 'sent' ? 'Resend team email' : 'Send team email') }}
                          </button>
                        </div>
                      </section>
                    </section>
                  </ng-container>
                </div>
              </section>

              <div class="admin-grid admin-grid--allowlist" [class.admin-grid--wide-panel]="activeTab === 'allowlist'" [hidden]="activeTab === 'applications' || activeTab === 'requests' || activeTab === 'packages'">
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
                      <label class="field"><span class="form-label">User type</span>
                        <select name="userType" [(ngModel)]="newApplicant.userType" [disabled]="!isSuperAdmin">
                          <option value="basic">Basic</option>
                          <option value="premium">Premium</option>
                          <option value="staff">Staff</option>
                          <option value="nominee">Nominees</option>
                        </select>
                      </label>
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
                    <p class="form-status" *ngIf="!isSuperAdmin">Regular admin can preload Basic users. Premium, Staff and Nominees require super admin.</p>
                    <button class="btn btn-blue btn-block" type="submit">Preload email</button>
                    <p class="form-status" role="status">{{ addStatus }}</p>
                  </form>
                </aside>

                <section class="admin-card" [hidden]="activeTab !== 'allowlist'">
                  <div class="admin-card__head admin-card__head--row">
                    <div>
                      <h2>Visa email allowlist</h2>
                      <p style="margin:4px 0 0;color:var(--muted);font-size:13px">Signup is denied unless the applicant email is already preloaded here. Active applicants can sign in after setting or receiving an access code.</p>
                      <p style="margin:4px 0 0;color:var(--muted);font-size:13px" *ngIf="!isSuperAdmin">Existing allowlist changes are locked to super admin.</p>
                      <p class="form-status" role="status">{{ accessStatus }}</p>
                    </div>
                  </div>
                  <div class="empty-state" *ngIf="!applicants.length">No approved emails have been preloaded yet.</div>
                  <div class="allowlist-toolbar" *ngIf="applicants.length">
                    <div class="allowlist-search">
                      <label class="field">
                        <span class="form-label">Search allowlist</span>
                        <input
                          name="allowlistSearch"
                          type="search"
                          [(ngModel)]="allowlistSearch"
                          placeholder="Name, email, phone, type, category or status"
                          aria-describedby="allowlistSearchSummary"
                        >
                      </label>
                      <button class="btn btn-ghost btn-small" type="button" *ngIf="allowlistSearch" (click)="allowlistSearch = ''">Clear</button>
                    </div>
                    <p class="allowlist-results" id="allowlistSearchSummary" aria-live="polite">
                      Showing {{ filteredApplicants.length }} of {{ applicants.length }}
                    </p>
                  </div>
                  <div class="empty-state" *ngIf="applicants.length && !filteredApplicants.length">No allowlist users match your search.</div>
                  <div class="table-wrap" *ngIf="filteredApplicants.length">
                    <table class="data-table data-table--allowlist">
                      <thead><tr><th>Applicant</th><th>Email</th><th>Access code</th><th>Type</th><th>Category</th><th>Status</th><th>Signup</th><th>Actions</th></tr></thead>
                      <tbody>
                        <tr *ngFor="let applicant of filteredApplicants">
                          <td data-label="Applicant"><strong>{{ applicant.name || 'Unnamed' }}</strong><div>{{ applicant.phone }}</div></td>
                          <td data-label="Email">{{ applicant.email }}</td>
                          <td data-label="Access code">
                            <div class="access-code-cell">
                              <input class="input" [name]="'accessCode-' + applicant.id" type="password" autocomplete="new-password" [(ngModel)]="applicant.accessCode" minlength="6" [disabled]="!isSuperAdmin">
                              <button class="btn btn-secondary btn-small" type="button" [disabled]="!isSuperAdmin" (click)="updateApplicantCode(applicant)">Save code</button>
                            </div>
                          </td>
                          <td data-label="Type">
                            <select [ngModel]="applicant.userType || 'basic'" [disabled]="!isSuperAdmin" (ngModelChange)="updateApplicantUserType(applicant, $event)">
                              <option value="basic">Basic</option>
                              <option value="premium">Premium</option>
                              <option value="staff">Staff</option>
                              <option value="nominee">Nominees</option>
                            </select>
                          </td>
                          <td data-label="Category">{{ applicant.category || 'Unassigned' }}</td>
                          <td data-label="Status">
                            <select [ngModel]="applicant.status" [disabled]="!isSuperAdmin" (ngModelChange)="updateApplicantStatus(applicant, $event)">
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
                          <td data-label="Actions"><button class="btn btn-ghost btn-small" type="button" [disabled]="!isSuperAdmin" (click)="removeApplicant(applicant)">Remove</button></td>
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
  dashboardStatus = '';
  pricingStatus = '';
  importWorking = false;
  pricingWorking = false;
  adminRole = (sessionStorage.getItem('headiesVisaAdminRole') || '') as '' | 'admin' | 'super';
  isAdmin = Boolean(this.adminRole);
  travelRequests: TravelRequest[] = [];
  applicants: EligibleApplicant[] = [];
  applications: VisaApplication[] = [];
  pricing: VisaPricing = { basic: 745000, premium: 745000, nominee: 350000, staff: 0 };
  pricingModel = { basic: 745000, premium: 745000, nominee: 350000 };
  importFile: File | null = null;
  selectedImportFileName = '';
  activeTab: 'requests' | 'applications' | 'packages' | 'setup' | 'allowlist' = 'requests';
  @ViewChild(PackageAdminComponent) packageAdmin?: PackageAdminComponent;
  requestSearch = '';
  requestTypeFilter: 'all' | 'Travel' | 'Luxury' = 'all';
  requestStatusFilter = 'all';
  selectedTravelRequestId = '';
  requestNotifyWorkingId = '';
  applicationSearch = '';
  allowlistSearch = '';
  applicationStatusFilter = 'submitted';
  applicationPaymentFilter: 'all' | NonNullable<VisaApplication['paymentStatus']> = 'all';
  selectedApplicationId = '';
  documentDownloadWorkingId = '';

  newApplicant: Partial<EligibleApplicant> = {
    name: '',
    email: '',
    phone: '',
    accessCode: '',
    category: '',
    userType: 'basic',
    notes: '',
    status: 'active'
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    if (this.isSuperAdmin) this.activeTab = 'applications';
    if (this.isAdmin) void this.loadDashboard();
  }

  get documentCount(): number {
    return this.applications.reduce((total, app) => total + this.countFiles(app), 0);
  }

  get completedSignupCount(): number {
    return this.applicants.filter((applicant) => Boolean(applicant.signupCompletedAt)).length;
  }

  get submittedApplications(): VisaApplication[] {
    return this.applications.filter((application) => application.status !== 'Draft');
  }

  get isSuperAdmin(): boolean {
    return this.adminRole === 'super';
  }

  get superAdminCode(): string {
    return sessionStorage.getItem('headiesVisaAdminCode') || '';
  }

  get filteredApplications(): VisaApplication[] {
    const query = this.applicationSearch.trim().toLowerCase();
    return this.applications.filter((app) => {
      const paymentStatus = app.paymentStatus || 'Unpaid';
      if (this.applicationStatusFilter === 'submitted' && app.status === 'Draft') return false;
      if (this.applicationStatusFilter !== 'submitted' && this.applicationStatusFilter !== 'all' && app.status !== this.applicationStatusFilter) return false;
      if (this.applicationPaymentFilter !== 'all' && paymentStatus !== this.applicationPaymentFilter) return false;
      if (!query) return true;
      return [
        app.name,
        app.email,
        app.phone,
        app.paymentReference,
        app.userType,
        app.applicantCategory,
        app.status,
        app.travelDate
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }

  get filteredTravelRequests(): TravelRequest[] {
    const query = this.requestSearch.trim().toLowerCase();
    return this.travelRequests.filter((request) => {
      if (this.requestTypeFilter !== 'all' && request.type !== this.requestTypeFilter) return false;
      if (this.requestStatusFilter !== 'all' && (request.status || 'New') !== this.requestStatusFilter) return false;
      if (!query) return true;
      const details = (request.details || []).flatMap((detail) => detail || []);
      return [
        request.id,
        request.name,
        request.email,
        request.phone,
        request.type,
        request.summary,
        request.status,
        ...details
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }

  get selectedTravelRequest(): TravelRequest | null {
    return this.filteredTravelRequests.find((request) => request.id === this.selectedTravelRequestId) || this.filteredTravelRequests[0] || null;
  }

  get filteredApplicants(): EligibleApplicant[] {
    const query = this.allowlistSearch.trim().toLowerCase();
    if (!query) return this.applicants;
    return this.applicants.filter((applicant) => [
      applicant.name,
      applicant.email,
      applicant.phone,
      applicant.userType || 'basic',
      applicant.category,
      applicant.status,
      applicant.signupCompletedAt ? 'code set signed up' : 'awaiting signup'
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }

  get selectedApplication(): VisaApplication | null {
    return this.filteredApplications.find((app) => app.id === this.selectedApplicationId) || this.filteredApplications[0] || null;
  }

  get selectedUploads(): UploadGroup[] {
    return (this.selectedApplication?.uploads || []).filter((upload) => Boolean(upload.files?.length));
  }

  get selectedDocumentCount(): number {
    const application = this.selectedApplication;
    return application ? this.countFiles(application) : 0;
  }

  async login(valid: boolean | null): Promise<void> {
    if (!valid) return;
    try {
      const { role } = await this.api.authorizeAdmin(this.passcode);
      sessionStorage.setItem('headiesVisaAdminSession', 'true');
      sessionStorage.setItem('headiesVisaAdminRole', role);
      sessionStorage.setItem('headiesVisaAdminCode', this.passcode);
      this.adminRole = role;
      this.isAdmin = true;
      this.activeTab = role === 'super' ? 'applications' : 'requests';
      this.loginStatus = '';
      this.passcode = '';
      await this.loadDashboard();
    } catch {
      this.loginStatus = 'Invalid admin passcode.';
    }
  }

  logout(): void {
    sessionStorage.removeItem('headiesVisaAdminSession');
    sessionStorage.removeItem('headiesVisaAdminRole');
    sessionStorage.removeItem('headiesVisaAdminCode');
    this.adminRole = '';
    this.isAdmin = false;
    this.activeTab = 'requests';
  }

  async loadDashboard(): Promise<void> {
    this.dashboardStatus = 'Loading dashboard...';
    try {
      const applicationsRequest = this.isSuperAdmin
        ? this.api.listApplications(this.superAdminCode)
        : Promise.resolve({ applications: [] as VisaApplication[] });
      const [requests, eligible, apps, pricing] = await Promise.all([
        this.api.listTravelRequests(this.superAdminCode),
        this.api.listEligible(),
        applicationsRequest,
        this.api.getVisaPricing()
      ]);
      const previousRequestSelection = this.selectedTravelRequestId;
      const previousSelection = this.selectedApplicationId;
      this.travelRequests = requests.requests.sort((a, b) => String(b.createdAt || b.updatedAt).localeCompare(String(a.createdAt || a.updatedAt)));
      this.selectedTravelRequestId = this.travelRequests.some((request) => request.id === previousRequestSelection)
        ? previousRequestSelection
        : (this.travelRequests[0]?.id || '');
      this.applicants = eligible.applicants;
      this.applications = apps.applications.sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
      this.selectedApplicationId = this.applications.some((app) => app.id === previousSelection) ? previousSelection : (this.applications[0]?.id || '');
      this.pricing = {
        basic: Number(pricing.pricing.basic ?? 745000),
        premium: Number(pricing.pricing.premium ?? 745000),
        nominee: Number(pricing.pricing.nominee ?? 350000),
        staff: Number(pricing.pricing.staff ?? 0)
      };
      this.pricingModel = { basic: this.pricing.basic, premium: this.pricing.premium, nominee: this.pricing.nominee };
      this.dashboardStatus = '';
    } catch (error) {
      this.dashboardStatus = error instanceof Error && error.message && error.message !== 'Request failed'
        ? `Could not load the dashboard: ${error.message}`
        : 'Could not load the dashboard. Use Refresh to try again.';
    }
  }

  async refreshActiveSection(): Promise<void> {
    if (this.activeTab === 'packages' && this.packageAdmin) {
      await this.packageAdmin.loadBookings();
      return;
    }
    await this.loadDashboard();
  }

  async downloadDocument(app: VisaApplication, file: UploadedFileRecord): Promise<void> {
    if (!this.isSuperAdmin || !file.id || this.documentDownloadWorkingId) return;
    this.documentDownloadWorkingId = file.id;
    this.dashboardStatus = `Downloading ${file.name}...`;
    try {
      const blob = await this.api.downloadApplicationDocument(app.id, file.id, this.superAdminCode);
      this.downloadBlob(file.name, blob);
      this.dashboardStatus = `${file.name} downloaded.`;
    } catch (error) {
      this.dashboardStatus = error instanceof Error ? error.message : 'Could not download the document.';
    } finally {
      this.documentDownloadWorkingId = '';
    }
  }

  selectApplication(app: VisaApplication): void {
    this.selectedApplicationId = app.id;
  }

  selectTravelRequest(request: TravelRequest): void {
    this.selectedTravelRequestId = request.id || '';
  }

  requestEmailStatus(request: TravelRequest): string {
    return request.metadata?.notification?.status || 'not_sent';
  }

  requestEmailLabel(request: TravelRequest): string {
    return {
      sent: 'Team email sent',
      pending: 'Team email pending',
      failed: 'Team email failed',
      not_configured: 'Email setup required',
      not_sent: 'No email record'
    }[this.requestEmailStatus(request)] || 'Email status unknown';
  }

  requestEmailRecipients(request: TravelRequest): string {
    const recipients = request.metadata?.notification?.recipients || [];
    return recipients.length
      ? `Recipients: ${recipients.join(' and ')}`
      : 'Recipients: ifeyinwao@wakanow.com and holidays@wakanow.com';
  }

  async updateTravelRequestStatus(request: TravelRequest, status: string): Promise<void> {
    if (!request.id) return;
    const previous = request.status;
    request.status = status;
    try {
      const result = await this.api.updateTravelRequest(request.id, status, this.superAdminCode);
      this.travelRequests = this.travelRequests.map((item) => item.id === request.id ? result.request : item);
      this.dashboardStatus = 'Travel request status updated.';
    } catch (error) {
      request.status = previous;
      this.dashboardStatus = error instanceof Error ? error.message : 'Could not update the travel request.';
    }
  }

  async retryTravelRequestEmail(request: TravelRequest): Promise<void> {
    if (!request.id || this.requestNotifyWorkingId) return;
    this.requestNotifyWorkingId = request.id;
    this.dashboardStatus = 'Sending the request to the travel team...';
    try {
      const result = await this.api.notifyTravelRequest(request.id, this.superAdminCode);
      this.travelRequests = this.travelRequests.map((item) => item.id === request.id ? result.request : item);
      this.dashboardStatus = result.notification.status === 'sent'
        ? 'Travel request emailed to both team addresses.'
        : (result.notification.error || 'The request is saved, but the team email could not be sent.');
    } catch (error) {
      this.dashboardStatus = error instanceof Error ? error.message : 'Could not send the team email.';
    } finally {
      this.requestNotifyWorkingId = '';
    }
  }

  userTypeLabel(userType: EligibleApplicant['userType'] | VisaApplication['userType']): string {
    const type: NonNullable<EligibleApplicant['userType']> = userType || 'basic';
    return {
      basic: 'Basic',
      premium: 'Premium',
      staff: 'Staff',
      nominee: 'Nominees'
    }[type];
  }

  async addApplicant(valid: boolean | null): Promise<void> {
    if (!valid) {
      this.addStatus = 'Complete the required fields.';
      return;
    }
    this.addStatus = 'Preloading approved email...';
    await this.api.addEligible({ ...this.newApplicant, status: 'active' }, this.isSuperAdmin ? this.superAdminCode : undefined);
    this.newApplicant = { name: '', email: '', phone: '', accessCode: '', category: '', userType: 'basic', notes: '', status: 'active' };
    this.addStatus = 'Approved email preloaded.';
    await this.loadDashboard();
  }

  async updateApplicantStatus(applicant: EligibleApplicant, status: 'pending' | 'active' | 'blocked'): Promise<void> {
    if (!this.isSuperAdmin) {
      this.accessStatus = 'Super admin access is required to edit existing allowlist users.';
      return;
    }
    await this.api.updateEligible(applicant.id, { status }, this.superAdminCode);
    await this.loadDashboard();
  }

  async updateApplicantCode(applicant: EligibleApplicant): Promise<void> {
    if (!this.isSuperAdmin) {
      this.accessStatus = 'Super admin access is required to edit existing allowlist users.';
      return;
    }
    const accessCode = String(applicant.accessCode || '').trim();
    if (accessCode.length < 6) {
      this.accessStatus = 'Access code must be at least 6 characters.';
      return;
    }
    this.accessStatus = 'Saving access code...';
    await this.api.updateEligible(applicant.id, { accessCode }, this.superAdminCode);
    this.accessStatus = 'Access code updated.';
    await this.loadDashboard();
  }

  async updateApplicantUserType(applicant: EligibleApplicant, userType: EligibleApplicant['userType']): Promise<void> {
    if (!this.isSuperAdmin) {
      this.accessStatus = 'Super admin access is required to edit existing allowlist users.';
      return;
    }
    await this.api.updateEligible(applicant.id, { userType }, this.superAdminCode);
    await this.loadDashboard();
  }

  async removeApplicant(applicant: EligibleApplicant): Promise<void> {
    if (!this.isSuperAdmin) {
      this.accessStatus = 'Super admin access is required to remove allowlist users.';
      return;
    }
    await this.api.deleteEligible(applicant.id, this.superAdminCode);
    await this.loadDashboard();
  }

  async updateApplicationStatus(app: VisaApplication, status: VisaApplication['status']): Promise<void> {
    if (!this.isSuperAdmin) {
      this.dashboardStatus = 'Superadmin access is required to update visa application status.';
      return;
    }
    const previous = app.status;
    app.status = status;
    try {
      await this.api.updateApplication(app.id, { status }, this.superAdminCode);
      await this.loadDashboard();
    } catch (error) {
      app.status = previous;
      this.dashboardStatus = error instanceof Error && error.message && error.message !== 'Request failed'
        ? `Could not update the status: ${error.message}`
        : 'Could not update the application status. Try again.';
    }
  }

  async updatePricing(): Promise<void> {
    if (!this.isSuperAdmin) {
      this.pricingStatus = 'Super admin access is required to update visa pricing.';
      return;
    }
    this.pricingWorking = true;
    this.pricingStatus = 'Saving visa pricing...';
    try {
      const { pricing } = await this.api.updateVisaPricing(this.pricingModel, this.superAdminCode);
      this.pricing = pricing;
      this.pricingModel = { basic: pricing.basic, premium: pricing.premium, nominee: pricing.nominee };
      this.pricingStatus = 'Visa pricing updated.';
    } catch (error) {
      this.pricingStatus = error instanceof Error && error.message && error.message !== 'Request failed'
        ? error.message
        : 'Could not update visa pricing.';
    } finally {
      this.pricingWorking = false;
    }
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
        userType: (row['userType'] || row['UserType'] || row['type'] || row['Type'] || '') as EligibleApplicant['userType'],
        status: (row['status'] || row['Status'] || 'active') as EligibleApplicant['status'],
        notes: row['notes'] || row['Notes'] || ''
      }));
      this.importStatus = 'Importing approved emails...';
      await this.api.importEligible(records, this.isSuperAdmin ? this.superAdminCode : undefined);
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
    this.downloadText('visa-email-allowlist-template.csv', 'name,email,phone,accessCode,category,userType,status,notes\nExample Applicant,applicant@example.com,+2340000000000,,employed,basic,active,Preloaded by admin');
  }

  exportEligibleCSV(): void {
    const rows = [['name', 'email', 'phone', 'accessCode', 'category', 'userType', 'status', 'signupCompletedAt', 'notes']];
    this.applicants.forEach((item) => rows.push([item.name, item.email, item.phone, item.accessCode || '', item.category, item.userType || 'basic', item.status, item.signupCompletedAt || '', item.notes]));
    this.downloadText('headies-visa-eligible-applicants.csv', rows.map((row) => row.map(this.csvEscape).join(',')).join('\n'));
  }

  downloadSubmittedApplications(): void {
    if (!this.isSuperAdmin || !this.submittedApplications.length) {
      this.dashboardStatus = 'There are no submitted visa applications to download.';
      return;
    }
    this.downloadApplicationsCsv('headies-visa-submitted-applications.csv', this.submittedApplications);
    this.dashboardStatus = `${this.submittedApplications.length} submitted application${this.submittedApplications.length === 1 ? '' : 's'} downloaded.`;
  }

  downloadApplication(application: VisaApplication): void {
    if (!this.isSuperAdmin) return;
    const name = String(application.name || application.id || 'visa-application')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'visa-application';
    this.downloadApplicationsCsv(`${name}-visa-application.csv`, [application]);
    this.dashboardStatus = `${application.name || application.email || 'Visa application'} downloaded.`;
  }

  downloadApplicationsCsv(filename: string, applications: VisaApplication[]): void {
    const headers = [
      'applicationId', 'applicantId', 'name', 'email', 'phone', 'applicants', 'applicantCategory', 'userType',
      'applicationStatus', 'paymentStatus', 'paymentReference', 'paymentAmountMinorUnits', 'paymentCurrency',
      'passportNumber', 'passportName', 'passportNationality', 'passportDateOfBirth', 'passportSex', 'passportIssuingCountry',
      'passportExpiry', 'passportValidation', 'travelDate', 'travelHistory', 'role', 'salary', 'employmentLength', 'notes', 'fee',
      'uploadedDocumentCount', 'uploadedDocuments', 'uploadedFileNames', 'createdAt', 'updatedAt', 'reviewedAt'
    ];
    const rows = applications.map((application) => {
      const uploads = (application.uploads || []).filter((upload) => Boolean(upload.files?.length));
      const uploadedDocuments = uploads.map((upload) => upload.document).join(' | ');
      const uploadedFileNames = uploads.flatMap((upload) => upload.files.map((file) => `${upload.document}: ${file.name}`)).join(' | ');
      return [
        application.id,
        application.applicantId,
        application.name,
        application.email,
        application.phone,
        application.applicants,
        application.applicantCategory,
        application.userType || 'basic',
        application.status,
        application.paymentStatus || 'Unpaid',
        application.paymentReference || '',
        application.paymentAmount || 0,
        application.paymentCurrency || 'NGN',
        application.passportDetails?.parsed?.passportNumber || '',
        this.adminPassportName(application),
        application.passportDetails?.parsed?.nationality || '',
        application.passportDetails?.parsed?.dateOfBirth || '',
        application.passportDetails?.parsed?.sex || '',
        application.passportDetails?.parsed?.issuingCountry || '',
        application.passportExpiry,
        application.passportDetails?.validation?.reason || '',
        application.travelDate,
        application.travelHistory,
        application.role,
        application.salary,
        application.employmentLength,
        application.notes,
        application.fee,
        this.countFiles(application),
        uploadedDocuments,
        uploadedFileNames,
        application.createdAt || '',
        application.updatedAt || '',
        application.reviewedAt || ''
      ];
    });
    this.downloadText(filename, [headers, ...rows].map((row) => row.map(this.csvEscape).join(',')).join('\n'), 'text/csv;charset=utf-8');
  }

  csvEscape(value: unknown): string {
    let text = String(value ?? '');
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  downloadText(filename: string, text: string, type = 'text/plain;charset=utf-8'): void {
    this.downloadBlob(filename, new Blob([text], { type }));
  }

  downloadBlob(filename: string, blob: Blob): void {
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

  money(value: number): string {
    return `NGN ${Number(value || 0).toLocaleString()}`;
  }

  moneyMinorUnits(value: number): string {
    return this.money(Number(value || 0) / 100);
  }

  formatDate(value?: string): string {
    if (!value) return '';
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
}
