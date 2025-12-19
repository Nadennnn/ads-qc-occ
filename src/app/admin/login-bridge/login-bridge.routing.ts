// ============================================
// FILE: src/app/admin/admin.routing.ts
// Protected routes dengan RoleGuard
// ============================================
import { Route } from '@angular/router';
import { LoginBridgeComponent } from './login-bridge.component';

export const LoginBridgeRoutes: Route[] = [
  {
    path: '',
    component: LoginBridgeComponent,
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
