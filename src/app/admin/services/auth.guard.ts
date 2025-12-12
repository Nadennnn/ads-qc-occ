// ============================================
// FILE: src/app/admin/services/auth.guard.ts
// Functional Guard - Compatible dengan Angular standalone
// ============================================
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Basic Auth Guard - Check if user is logged in
 */
export const AuthGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('token');

  if (token) {
    return true;
  }

  router.navigate(['/login'], {
    queryParams: { returnUrl: state.url },
  });
  return false;
};

/**
 * Role Guard - Check if user has required roles
 * Usage di route:
 * {
 *   path: 'users-control',
 *   component: UsersControlComponent,
 *   canActivate: [AuthGuard, RoleGuard],
 *   data: { roles: ['1'] } // Required role IDs
 * }
 */
export const RoleGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  // Get required roles dari route data
  const requiredRoles = route.data['roles'] as string[] | undefined;

  // Jika tidak ada required roles, allow access
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  console.log('RoleGuard checking roles:', {
    required: requiredRoles,
    url: state.url,
  });

  // Check roles dari backend/cache
  return authService.getUserRoles().pipe(
    map((userRoles) => {
      console.log('User has roles:', userRoles);

      // Check if user has any of the required roles (OR condition)
      const hasRequiredRole = requiredRoles.some((role) => userRoles.includes(role));

      if (!hasRequiredRole) {
        console.warn('Access denied:', {
          required: requiredRoles,
          userHas: userRoles,
          url: state.url,
        });

        // Redirect ke unauthorized atau back to dashboard
        alert('Anda tidak memiliki akses ke halaman ini');
        router.navigate(['/dashboards']);
        return false;
      }

      console.log('Access granted to:', state.url);
      return true;
    }),
    catchError((error) => {
      console.error('Error checking roles:', error);

      // Jika error (misalnya 401), redirect ke login
      router.navigate(['/login'], {
        queryParams: { returnUrl: state.url },
      });

      return of(false);
    })
  );
};

/**
 * Combined Auth + Role Guard
 * Usage: canActivate: [AuthRoleGuard]
 *
 * Lebih efisien dari pakai 2 guard terpisah
 */
export const AuthRoleGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  // Check authentication first
  const token = localStorage.getItem('token');
  if (!token) {
    router.navigate(['/login'], {
      queryParams: { returnUrl: state.url },
    });
    return false;
  }

  // Get required roles
  const requiredRoles = route.data['roles'] as string[] | undefined;

  // No role requirement, just need auth
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  // Check roles
  return authService.getUserRoles().pipe(
    map((userRoles) => {
      const hasAccess = requiredRoles.some((role) => userRoles.includes(role));

      if (!hasAccess) {
        alert('Anda tidak memiliki akses ke halaman ini');
        router.navigate(['/dashboards']);
        return false;
      }

      return true;
    }),
    catchError((error) => {
      console.error('Auth error:', error);
      router.navigate(['/login']);
      return of(false);
    })
  );
};
