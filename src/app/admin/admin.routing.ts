// ============================================
// FILE: src/app/admin/admin.routing.ts
// Protected routes dengan RoleGuard
// ============================================
import { Route } from '@angular/router';
import { AdminComponent } from './admin.component';
import { PrintSlipComponent } from './components/print-slip/print-slip.component';
import { GudangBahanBakuComponent } from './gudang-bahan-baku/gudang-bahan-baku.component';
import { CekLaporanComponent } from './pages/cek-laporan/cek-laporan.component';
import { CodeCustomerComponent } from './pages/code-customer/code-customer.component';
import { CodeSupplierComponent } from './pages/code-supplier/code-supplier.component';
import { ScaleDisplayComponent } from './pages/scale-display/scale-display.component';
import { TimbanganMasukComponent } from './pages/timbangan-masuk/timbangan-masuk.component';
import { UjiKelembapanComponent } from './pages/uji-kelembapan/uji-kelembapan.component';
import { UsersControlComponent } from './pages/users-control/users-control.component';
import { RoleGuard } from './services/auth.guard';
import { AbhiLatihanComponent } from './unused/abhi-latihan.component';

export const AdminRoutes: Route[] = [
  {
    path: '',
    children: [
      {
        path: '',
        component: AdminComponent,
      },
      {
        path: 'gudang-bahan-baku',
        component: GudangBahanBakuComponent,
      },
    ],
  },
  {
    path: 'timbangan-masuk',
    component: TimbanganMasukComponent,
    canActivate: [RoleGuard],
    data: {
      roles: ['1', '3'], // Admin or Operator Timbangan
      title: 'Input Timbangan',
    },
  },
  {
    path: 'uji-kelembapan',
    component: UjiKelembapanComponent,
    canActivate: [RoleGuard],
    data: {
      roles: ['1', '6'], // Admin or Lab Staff
      title: 'Uji Kelembapan',
    },
  },
  {
    path: 'cek-laporan',
    component: CekLaporanComponent,
    canActivate: [RoleGuard],
    data: {
      roles: ['1', '7'], // Admin or Supervisor
      title: 'Cek Laporan',
    },
  },
  {
    path: 'code-customer',
    component: CodeCustomerComponent,
    canActivate: [RoleGuard],
    data: {
      roles: ['1', '4'], // Admin or Customer Manager
      title: 'Code Customer',
    },
  },
  {
    path: 'code-supplier',
    component: CodeSupplierComponent,
    canActivate: [RoleGuard],
    data: {
      roles: ['1', '5'], // Admin or Supplier Manager
      title: 'Code Supplier',
    },
  },
  {
    path: 'print-slip/:id',
    component: PrintSlipComponent,
    // Print slip bisa diakses semua role yang sudah login
  },
  {
    path: 'testlek',
    component: ScaleDisplayComponent,
    // Print slip bisa diakses semua role yang sudah login
  },
  {
    path: 'latihanlek',
    component: AbhiLatihanComponent,
    // Print slip bisa diakses semua role yang sudah login
  },
  {
    path: 'users-control',
    component: UsersControlComponent,
    canActivate: [RoleGuard],
    data: {
      roles: ['1'], // Only Admin/Superadmin
      title: 'Users Control',
    },
  },
];

// ============================================
// Role ID Reference:
// '1' = Superadmin/Admin - Full access
// '3' = Operator Timbangan - Input weighing data
// '4' = Customer Manager - Manage customers
// '5' = Supplier Manager - Manage suppliers
// '6' = Lab Staff - Testing & quality control
// '7' = Supervisor - View reports
// ============================================
