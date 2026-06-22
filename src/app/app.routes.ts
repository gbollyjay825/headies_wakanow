import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { VisaComponent } from './visa/visa.component';
import { AdminComponent } from './admin/admin.component';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Road to Toronto | The Headies x Wakanow' },
  { path: 'index.html', redirectTo: '', pathMatch: 'full' },
  { path: 'visa', component: VisaComponent, title: 'Visa Support | The Headies x Wakanow' },
  { path: 'visa.html', component: VisaComponent, title: 'Visa Support | The Headies x Wakanow' },
  { path: 'admin', component: AdminComponent, title: 'Visa Admin | The Headies x Wakanow' },
  { path: '**', redirectTo: '' }
];
