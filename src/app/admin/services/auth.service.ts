// ============================================
// FILE: src/app/admin/services/auth.service.ts
// SECURE VERSION - Compatible with your API structure
// ============================================
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from './api.service';

interface User {
  username: string;
  token: string;
}

interface UserRole {
  role: string;
  role_id: string;
}

interface ProfileData {
  username: string;
  roles: UserRole[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;

  // Cache roles in memory (NOT localStorage)
  private userRolesCache: string[] = [];
  private profileDataCache: ProfileData | null = null;
  private rolesCacheExpiry: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(private api: ApiService, private router: Router) {
    const storedUser = localStorage.getItem('currentUser');
    this.currentUserSubject = new BehaviorSubject<User | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser = this.currentUserSubject.asObservable();
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  login(username: string, password: string): Observable<any> {
    return this.api.postMultipart('login', { username, password }).pipe(
      map((response) => {
        if (response.success && response.token) {
          const user: User = { username, token: response.token };

          // HANYA simpan username & token di localStorage
          // JANGAN simpan role/permissions
          localStorage.setItem('currentUser', JSON.stringify(user));
          localStorage.setItem('token', response.token);

          this.currentUserSubject.next(user);
        }
        return response;
      })
    );
  }

  logout(): void {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    localStorage.removeItem('role'); // Clean old role storage jika ada
    localStorage.removeItem('username'); // Clean old username storage jika ada

    // Clear memory cache
    this.userRolesCache = [];
    this.profileDataCache = null;
    this.rolesCacheExpiry = 0;

    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  /**
   * Get user profile dengan roles
   * Dengan caching di memory, expires setelah 5 menit
   */
  getUserProfile(): Observable<ProfileData | null> {
    const now = Date.now();

    // Jika cache masih valid, return dari cache
    if (this.profileDataCache && now < this.rolesCacheExpiry) {
      return of(this.profileDataCache);
    }

    // Fetch dari backend
    return this.api.get('profile').pipe(
      map((response) => {
        if (response.success && response.data) {
          const profileData: ProfileData = response.data;

          // Extract role IDs dan simpan ke cache
          const roleIds = profileData.roles.map((r) => r.role_id);

          // Simpan ke memory cache
          this.profileDataCache = profileData;
          this.userRolesCache = roleIds;
          this.rolesCacheExpiry = now + this.CACHE_DURATION;

          console.log('Profile fetched and cached:', {
            username: profileData.username,
            roles: roleIds,
            cacheExpiry: new Date(this.rolesCacheExpiry),
          });

          return profileData;
        }
        return null;
      }),
      catchError((error) => {
        console.error('Failed to fetch user profile:', error);

        // Jika 401, auto logout
        if (error.error?.status === 401 || error.status === 401) {
          this.logout();
        }

        // Clear cache
        this.userRolesCache = [];
        this.profileDataCache = null;
        this.rolesCacheExpiry = 0;

        return throwError(() => error);
      })
    );
  }

  /**
   * Get user role IDs only
   * Returns array of role_id strings: ['1', '3', etc]
   */
  getUserRoles(): Observable<string[]> {
    return this.getUserProfile().pipe(map((profile) => profile?.roles.map((r) => r.role_id) || []));
  }

  /**
   * Get cached roles synchronously (untuk component yang sudah load profile)
   * Returns empty array jika cache belum ada atau expired
   */
  getCachedRoles(): string[] {
    const now = Date.now();
    if (this.userRolesCache.length > 0 && now < this.rolesCacheExpiry) {
      return this.userRolesCache;
    }
    return [];
  }

  /**
   * Get cached profile synchronously
   */
  getCachedProfile(): ProfileData | null {
    const now = Date.now();
    if (this.profileDataCache && now < this.rolesCacheExpiry) {
      return this.profileDataCache;
    }
    return null;
  }

  /**
   * Check if user has specific role (Observable version)
   */
  hasRole(roleId: string): Observable<boolean> {
    return this.getUserRoles().pipe(map((roles) => roles.includes(roleId)));
  }

  /**
   * Check if user has specific role (Synchronous version for components)
   * Menggunakan cached data, return false jika cache belum ada
   */
  hasRoleSync(roleId: string): boolean {
    return this.getCachedRoles().includes(roleId);
  }

  /**
   * Check multiple roles (OR condition)
   */
  hasAnyRole(roleIds: string[]): Observable<boolean> {
    return this.getUserRoles().pipe(
      map((roles) => roleIds.some((roleId) => roles.includes(roleId)))
    );
  }

  /**
   * Check multiple roles (OR condition) - Synchronous
   */
  hasAnyRoleSync(roleIds: string[]): boolean {
    const cachedRoles = this.getCachedRoles();
    return roleIds.some((roleId) => cachedRoles.includes(roleId));
  }

  /**
   * Check multiple roles (AND condition)
   */
  hasAllRoles(roleIds: string[]): Observable<boolean> {
    return this.getUserRoles().pipe(
      map((roles) => roleIds.every((roleId) => roles.includes(roleId)))
    );
  }

  /**
   * Force refresh roles dari backend
   * Useful saat admin ubah role user
   */
  refreshUserProfile(): Observable<ProfileData | null> {
    this.userRolesCache = [];
    this.profileDataCache = null;
    this.rolesCacheExpiry = 0;
    return this.getUserProfile();
  }

  /**
   * Check if cache is valid
   */
  isCacheValid(): boolean {
    return Date.now() < this.rolesCacheExpiry && this.userRolesCache.length > 0;
  }
}
