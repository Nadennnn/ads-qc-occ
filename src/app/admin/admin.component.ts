// ============================================
// FILE: src/app/admin/admin.component.ts
// SECURE VERSION - Compatible dengan struktur API kamu
// ============================================
import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { ApiService } from './services/api.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class AdminComponent implements OnInit {
  currentUser: any;
  dataCurrentUser: any = {
    username: '',
    roles: [],
  };

  // Role IDs untuk quick checking - diambil dari memory cache
  userRoles: Set<string> = new Set();
  isLoadingRoles = true;

  showLogoutModal = false;
  currentYear = new Date().getFullYear();

  constructor(
    private router: Router,
    private authService: AuthService,
    private api: ApiService,
  ) {}

  async ngOnInit(): Promise<void> {
    console.log('Admin component initialized');

    // Get current user info
    this.currentUser = this.authService.currentUserValue;

    // Subscribe to user changes
    this.authService.currentUser.subscribe((user) => {
      this.currentUser = user;
    });

    // Load user profile & roles dari backend
    await this.loadUserProfile();
  }

  /**
   * Load user profile dari backend
   * Method ini HANYA dipanggil sekali saat component init
   * Data di-cache di AuthService untuk performa
   */
  private async loadUserProfile(): Promise<void> {
    this.isLoadingRoles = true;

    try {
      // Check cache dulu
      const cachedProfile = this.authService.getCachedProfile();

      if (cachedProfile) {
        // Gunakan cached data
        this.dataCurrentUser = cachedProfile;
        this.userRoles = new Set(cachedProfile.roles.map((r) => r.role_id));
        console.log('Using cached profile:', cachedProfile);
        this.isLoadingRoles = false;
        return;
      }

      // Fetch dari backend jika cache tidak ada atau expired
      this.authService.getUserProfile().subscribe({
        next: (profile) => {
          if (profile) {
            this.dataCurrentUser = profile;
            this.userRoles = new Set(profile.roles.map((r) => r.role_id));

            console.log('Profile loaded:', {
              username: profile.username,
              roles: Array.from(this.userRoles),
              roleDetails: profile.roles,
            });
          }
          this.isLoadingRoles = false;
        },
        error: (err) => {
          console.error('Failed to load user profile:', err);
          this.isLoadingRoles = false;

          // Jika gagal fetch profile (401/403), logout user
          if (err.error?.status === 401 || err.status === 401) {
            alert('Sesi Anda telah berakhir. Silakan login kembali.');
            this.authService.logout();
          } else {
            alert('Gagal memuat data profil. Silakan refresh halaman.');
          }
        },
      });
    } catch (err) {
      console.error('Error loading profile:', err);
      this.isLoadingRoles = false;
    }
  }

  /**
   * Check if user has specific role
   * Menggunakan data dari memory cache (sudah di-fetch saat init)
   */
  hasRole(roleId: string): boolean {
    return this.userRoles.has(roleId);
  }

  /**
   * Check if user has any of the specified roles (OR condition)
   */
  hasAnyRole(roleIds: string[]): boolean {
    return roleIds.some((roleId) => this.userRoles.has(roleId));
  }

  /**
   * Navigate dengan role checking
   * Role check di sini HANYA untuk UX (hide/show menu)
   * Backend MUST validate permissions on each endpoint!
   */
  navigateTo(route: string): void {
    // Role requirements untuk setiap route
    const routeRoleMap: { [key: string]: string[] } = {
      'timbangan-masuk': ['1', '3'], // Admin or Operator Timbangan
      'code-customer': ['1', '4'], // Admin or Customer Manager
      'code-supplier': ['1', '5'], // Admin or Supplier Manager
      'cek-laporan': ['1', '7'], // Admin or Supervisor
      'uji-kelembapan': ['1', '6'], // Admin or Lab Staff
      'users-control': ['1'], // Admin only
    };

    const requiredRoles = routeRoleMap[route];

    // Check role untuk UX purposes
    if (requiredRoles && !this.hasAnyRole(requiredRoles)) {
      alert('Anda tidak memiliki akses ke halaman ini');
      return;
    }

    // Navigate (Route Guard akan validate lagi di router level)
    const navigationMap: { [key: string]: string } = {
      'uji-kelembapan': 'dashboards/uji-kelembapan',
      'timbangan-masuk': 'dashboards/timbangan-masuk',
      'cek-laporan': 'dashboards/cek-laporan',
      'code-customer': 'dashboards/code-customer',
      'code-supplier': 'dashboards/code-supplier',
      'users-control': 'dashboards/users-control',
    };

    const path = navigationMap[route];
    if (path) {
      this.router.navigate([path]);
    }
  }

  /**
   * Show logout confirmation modal
   */
  logout(): void {
    this.showLogoutModal = true;
  }

  /**
   * Confirm logout - clear cache & navigate to login
   */
  confirmLogout(): void {
    this.showLogoutModal = false;
    this.authService.logout();
    // AuthService.logout() sudah handle navigation ke login
  }

  /**
   * Cancel logout modal
   */
  cancelLogout(): void {
    this.showLogoutModal = false;
  }

  /**
   * Refresh user roles (misalnya setelah admin ubah permissions)
   */
  async refreshProfile(): Promise<void> {
    this.isLoadingRoles = true;

    this.authService.refreshUserProfile().subscribe({
      next: (profile) => {
        if (profile) {
          this.dataCurrentUser = profile;
          this.userRoles = new Set(profile.roles.map((r) => r.role_id));
          console.log('Profile refreshed:', profile);
        }
        this.isLoadingRoles = false;
      },
      error: (err) => {
        console.error('Failed to refresh profile:', err);
        this.isLoadingRoles = false;
      },
    });
  }

  // REVIEW CHANGE Password

  // Change Password Modal
  showChangePasswordModal = false;
  isChangingPassword = false;

  changePasswordForm = {
    currentPassword: '',
    newUsername: '',
    newPassword: '',
    confirmPassword: '',
  };

  changePasswordErrors = {
    currentPassword: '',
    newUsername: '',
    newPassword: '',
    confirmPassword: '',
    general: '',
  };

  /**
   * Open change password modal
   */
  openChangePasswordModal(): void {
    this.showChangePasswordModal = true;
    this.resetChangePasswordForm();
  }

  /**
   * Close change password modal
   */
  closeChangePasswordModal(): void {
    this.showChangePasswordModal = false;
    this.resetChangePasswordForm();
  }

  /**
   * Reset form and errors
   */
  private resetChangePasswordForm(): void {
    this.changePasswordForm = {
      currentPassword: '',
      newUsername: '',
      newPassword: '',
      confirmPassword: '',
    };
    this.changePasswordErrors = {
      currentPassword: '',
      newUsername: '',
      newPassword: '',
      confirmPassword: '',
      general: '',
    };
  }

  /**
   * Validate change password form
   */
  private validateChangePasswordForm(): boolean {
    let isValid = true;
    this.changePasswordErrors = {
      currentPassword: '',
      newUsername: '',
      newPassword: '',
      confirmPassword: '',
      general: '',
    };

    // Validate current password
    if (!this.changePasswordForm.currentPassword) {
      this.changePasswordErrors.currentPassword = 'Password lama wajib diisi';
      isValid = false;
    }

    // Validate new password
    if (!this.changePasswordForm.newPassword) {
      this.changePasswordErrors.newPassword = 'Password baru wajib diisi';
      isValid = false;
    } else if (this.changePasswordForm.newPassword.length < 1) {
      this.changePasswordErrors.newPassword = 'Password minimal 3 karakter';
      isValid = false;
    }

    // Validate confirm password
    if (!this.changePasswordForm.confirmPassword) {
      this.changePasswordErrors.confirmPassword = 'Konfirmasi password wajib diisi';
      isValid = false;
    } else if (this.changePasswordForm.newPassword !== this.changePasswordForm.confirmPassword) {
      this.changePasswordErrors.confirmPassword = 'Password tidak cocok';
      isValid = false;
    }

    // Check if new password same as current
    if (
      this.changePasswordForm.currentPassword &&
      this.changePasswordForm.newPassword &&
      this.changePasswordForm.currentPassword === this.changePasswordForm.newPassword
    ) {
      this.changePasswordErrors.newPassword = 'Password baru tidak boleh sama dengan password lama';
      isValid = false;
    }

    return isValid;
  }

  /**
   * Submit change password
   */
  async submitChangePassword(): Promise<void> {
    // Reset general error
    this.changePasswordErrors.general = '';

    // Validate form
    if (!this.validateChangePasswordForm()) {
      return;
    }

    this.isChangingPassword = true;

    try {
      // Step 1: Verify current password by trying to login
      const loginResponse = await lastValueFrom(
        this.authService.login(
          this.dataCurrentUser.username,
          this.changePasswordForm.currentPassword,
        ),
      );

      if (!loginResponse.success) {
        this.changePasswordErrors.currentPassword = 'Password lama tidak sesuai';
        this.isChangingPassword = false;
        return;
      }

      // Step 2: Update password via API
      const updateData = {
        // username: this.dataCurrentUser.username,
        username:
          this.changePasswordForm.newUsername == ''
            ? this.dataCurrentUser.username
            : this.changePasswordForm.newUsername,
        password: this.changePasswordForm.newPassword,
      };

      const updateResponse = await lastValueFrom(
        this.api.postMultipart('update-profile', updateData),
      );

      if (updateResponse.success) {
        // Success
        // alert('Password berhasil diubah! Silakan login kembali dengan password baru.');

        // Close modal
        this.closeChangePasswordModal();

        // Logout user (force re-login with new password)
        this.authService.logout();
      } else {
        this.changePasswordErrors.general = updateResponse.message || 'Gagal mengubah password';
      }
    } catch (error: any) {
      console.error('Error changing password:', error);

      // Handle specific errors
      if (error.status === 401) {
        this.changePasswordErrors.currentPassword = 'Password lama tidak sesuai';
      } else if (error.error?.message) {
        this.changePasswordErrors.general = error.error.message;
      } else {
        this.changePasswordErrors.general = 'Terjadi kesalahan. Silakan coba lagi.';
      }
    } finally {
      this.isChangingPassword = false;
    }
  }

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(field: 'current' | 'new' | 'confirm'): void {
    const inputId =
      field === 'current' ? 'currentPassword' : field === 'new' ? 'newPassword' : 'confirmPassword';
    const input = document.getElementById(inputId) as HTMLInputElement;

    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  }
}
