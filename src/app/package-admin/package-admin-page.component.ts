import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../api.service';
import { PackageAdminComponent } from './package-admin.component';

@Component({
  selector: 'app-package-admin-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PackageAdminComponent],
  templateUrl: './package-admin-page.component.html',
  styleUrl: './package-admin-page.component.css'
})
export class PackageAdminPageComponent implements OnInit, OnDestroy {
  @ViewChild(PackageAdminComponent) bookings?: PackageAdminComponent;

  adminCode = '';
  adminRole: '' | 'admin' | 'super' = '';
  passcode = '';
  loginError = '';
  checkingSession = true;
  working = false;
  private authVersion = 0;

  constructor(private api: ApiService) {}

  get isAdmin(): boolean {
    return Boolean(this.adminCode && this.adminRole);
  }

  ngOnInit(): void {
    void this.restoreSession();
  }

  ngOnDestroy(): void {
    this.authVersion++;
  }

  async login(valid: boolean | null): Promise<void> {
    if (!valid || this.working || this.checkingSession || !this.passcode.trim()) return;
    const version = ++this.authVersion;
    const code = this.passcode.trim();
    this.working = true;
    this.loginError = '';
    try {
      const { role } = await this.api.authorizeAdmin(code);
      if (version !== this.authVersion) return;
      this.acceptSession(code, role);
      this.passcode = '';
    } catch (error) {
      if (version === this.authVersion) this.loginError = error instanceof Error ? error.message : 'Could not sign in. Please try again.';
    } finally {
      if (version === this.authVersion) this.working = false;
    }
  }

  logout(): void {
    this.authVersion++;
    this.adminCode = '';
    this.adminRole = '';
    this.passcode = '';
    this.loginError = '';
    this.working = false;
    this.checkingSession = false;
    this.clearStoredSession();
  }

  async refresh(): Promise<void> {
    if (this.isAdmin) await this.bookings?.loadBookings();
  }

  private async restoreSession(): Promise<void> {
    const version = ++this.authVersion;
    let code = '';
    try { code = sessionStorage.getItem('headiesVisaAdminCode') || ''; }
    catch { /* Sign-in remains available when browser storage is disabled. */ }
    if (!code) {
      this.checkingSession = false;
      return;
    }
    try {
      // A stored role alone never grants access to customer information.
      const { role } = await this.api.authorizeAdmin(code);
      if (version !== this.authVersion) return;
      this.acceptSession(code, role);
    } catch {
      if (version !== this.authVersion) return;
      this.clearStoredSession();
      this.loginError = 'Please sign in again to open the package dashboard.';
    } finally {
      if (version === this.authVersion) this.checkingSession = false;
    }
  }

  private acceptSession(code: string, role: 'admin' | 'super'): void {
    if (role !== 'admin' && role !== 'super') throw new Error('Admin access is required.');
    this.adminCode = code;
    this.adminRole = role;
    try {
      sessionStorage.setItem('headiesVisaAdminSession', 'true');
      sessionStorage.setItem('headiesVisaAdminRole', role);
      sessionStorage.setItem('headiesVisaAdminCode', code);
    } catch { /* Keep the verified session in memory for this page. */ }
  }

  private clearStoredSession(): void {
    try {
      sessionStorage.removeItem('headiesVisaAdminSession');
      sessionStorage.removeItem('headiesVisaAdminRole');
      sessionStorage.removeItem('headiesVisaAdminCode');
    } catch { /* Local page state is cleared regardless of storage availability. */ }
  }
}
