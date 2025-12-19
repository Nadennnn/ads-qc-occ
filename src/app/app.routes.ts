// src/app/app.routes.ts
import { Route } from '@angular/router';
import { LoginComponent } from './admin/pages/login/login.component';
import { AuthGuard } from './admin/services/auth.guard';

export const routes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login-bridge',
  },
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'login-bridge',
    loadChildren: () =>
      import('./admin/login-bridge/login-bridge.module').then((m) => m.LoginBridgeModule),
    // canActivate: [AuthGuard],
  },
  {
    path: 'dashboards', // ✅ This is the correct path
    loadChildren: () => import('./admin/admin.module').then((m) => m.AdminModule),
    canActivate: [AuthGuard],
  },
  {
    path: '**',
    redirectTo: 'login-bridge',
  },
];
