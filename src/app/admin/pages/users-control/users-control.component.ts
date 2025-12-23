// src/app/admin/pages/cek-laporan/cek-laporan.component.ts

import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../services/api.service';

interface Role {
  role: string;
  role_id: string;
}

interface User {
  id: number;
  username: string;
  created_at: string;
  updated_at: string;
  roles: Role[];
}

interface RoleOption {
  id: number;
  nama: string;
  created_at: string;
  updated_at: string;
}

interface UserRole {
  id: number;
  user_id: string;
  role_id: string;
  created_at: string;
  updated_at: string;
}
@Component({
  selector: 'app-users-control',
  templateUrl: './users-control.component.html',
  styleUrls: ['./users-control.component.scss'],
  standalone: false,
})
export class UsersControlComponent implements OnInit {
  users: User[] = [];
  availableRoles: RoleOption[] = [];
  userRoles: UserRole[] = [];
  loading = false;
  showModal = false;
  modalMode: 'add' | 'edit' = 'add';

  // Form data
  formData = {
    username: '',
    password: '',
    selectedRoles: [] as string[],
  };

  selectedUser: User | null = null;
  errorMessage = '';
  successMessage = '';

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  /**
   * Load all initial data
   */
  loadInitialData(): void {
    this.loadRoles();
    this.loadUsers();
    this.loadUserRoles();
  }

  /**
   * Load available roles from API
   */
  loadRoles(): void {
    this.apiService.get<RoleOption[]>('role').subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.availableRoles = response.data;
          console.log('Available Roles:', this.availableRoles);
        }
      },
      error: (error) => {
        this.showError('Gagal memuat data roles: ' + error.message);
      },
    });
  }

  /**
   * Load all users
   */
  loadUsers(): void {
    this.loading = true;
    this.apiService.get<User[]>('users').subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.users = response.data;
          console.log('Users:', this.users);
        }
        this.loading = false;
      },
      error: (error) => {
        this.showError('Gagal memuat data users: ' + error.message);
        this.loading = false;
      },
    });
  }

  /**
   * Load user-role mappings
   */
  loadUserRoles(): void {
    this.apiService.get<UserRole[]>('user-role').subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.userRoles = response.data;
          console.log('User Roles:', this.userRoles);
        }
      },
      error: (error) => {
        console.error('Gagal memuat user-role:', error.message);
      },
    });
  }

  /**
   * Open modal for adding new user
   */
  openAddModal(): void {
    this.modalMode = 'add';
    this.resetForm();
    this.showModal = true;
  }

  /**
   * Open modal for editing user
   */
  openEditModal(user: User): void {
    this.modalMode = 'edit';
    this.selectedUser = user;
    this.formData.username = user.username;
    this.formData.password = '';
    this.formData.selectedRoles = user.roles.map((r) => r.role_id);
    this.showModal = true;
  }

  /**
   * Close modal
   */
  closeModal(): void {
    this.showModal = false;
    this.resetForm();
    this.selectedUser = null;
  }

  /**
   * Reset form
   */
  resetForm(): void {
    this.formData = {
      username: '',
      password: '',
      selectedRoles: [],
    };
    this.errorMessage = '';
  }

  /**
   * Toggle role selection
   */
  toggleRole(roleId: string): void {
    const index = this.formData.selectedRoles.indexOf(roleId);
    if (index > -1) {
      this.formData.selectedRoles.splice(index, 1);
    } else {
      this.formData.selectedRoles.push(roleId);
    }
  }

  /**
   * Check if role is selected
   */
  isRoleSelected(roleId: string): boolean {
    return this.formData.selectedRoles.includes(roleId);
  }

  /**
   * Submit form (Add or Edit)
   */
  submitForm(): void {
    // Validation
    if (!this.formData.username.trim()) {
      this.showError('Username harus diisi');
      return;
    }

    if (this.modalMode === 'add' && !this.formData.password.trim()) {
      this.showError('Password harus diisi');
      return;
    }

    if (this.formData.selectedRoles.length === 0) {
      this.showError('Pilih minimal satu role');
      return;
    }

    if (this.modalMode === 'add') {
      this.addUser();
    } else {
      this.updateUser();
    }
  }

  /**
   * Add new user
   */
  addUser(): void {
    this.loading = true;

    // Prepare FormData
    const formData = new FormData();
    formData.append('username', this.formData.username);
    formData.append('password', this.formData.password);

    // Add roles with proper formatting: role[0], role[1], etc.
    this.formData.selectedRoles.forEach((roleId, index) => {
      // Format role_id dengan leading zero jika perlu (01, 02, 03, 04)
      const formattedRoleId = roleId.padStart(2, '0');
      formData.append(`role[${index}]`, formattedRoleId);
    });

    this.apiService.postFormData('register', formData).subscribe({
      next: (response) => {
        if (response.success) {
          this.showSuccess('User berhasil ditambahkan');
          this.closeModal();
          this.loadUsers();
          this.loadUserRoles();
        }
        this.loading = false;
      },
      error: (error) => {
        this.showError('Gagal menambahkan user: ' + error.message);
        this.loading = false;
      },
    });
  }

  /**
   * Update existing user with granular role management
   * Strategy:
   * 1. Get current user-role records for this user
   * 2. Compare with new selected roles
   * 3. Delete removed roles
   * 4. Add new roles
   * 5. Keep existing roles unchanged
   */
  updateUser(): void {
    if (!this.selectedUser) return;

    this.loading = true;

    // Get current user-role records for this user
    const currentUserRoles = this.userRoles.filter(
      (ur) => ur.user_id === this.selectedUser!.id.toString(),
    );

    const currentRoleIds = currentUserRoles.map((ur) => ur.role_id);
    const newRoleIds = this.formData.selectedRoles;

    // Find roles to delete (in current but not in new)
    const rolesToDelete = currentUserRoles.filter((ur) => !newRoleIds.includes(ur.role_id));

    // Find roles to add (in new but not in current)
    const rolesToAdd = newRoleIds.filter((roleId) => !currentRoleIds.includes(roleId));

    // Find roles to update (roles that exist in both but might need update)
    const rolesToKeep = currentUserRoles.filter((ur) => newRoleIds.includes(ur.role_id));

    console.log('Update Strategy:', {
      currentRoleIds,
      newRoleIds,
      rolesToDelete: rolesToDelete.map((r) => ({ id: r.id, role_id: r.role_id })),
      rolesToAdd,
      rolesToKeep: rolesToKeep.map((r) => ({ id: r.id, role_id: r.role_id })),
    });

    // Prepare API calls
    const apiCalls: any[] = [];

    // 1. Delete removed roles
    rolesToDelete.forEach((userRole) => {
      apiCalls.push(this.apiService.delete(`user-role/${userRole.id}`));
    });

    // 2. Add new roles (using POST api/user-role)
    rolesToAdd.forEach((roleId) => {
      const formData = new FormData();
      formData.append('user_id', this.selectedUser!.id.toString());
      formData.append('role_id', roleId);

      apiCalls.push(this.apiService.postFormData('user-role', formData));
    });

    // 3. Update existing roles if needed (using POST api/user-role/{id})
    // This ensures the role relationship is refreshed
    rolesToKeep.forEach((userRole) => {
      const formData = new FormData();
      formData.append('user_id', this.selectedUser!.id.toString());
      formData.append('role_id', userRole.role_id);

      apiCalls.push(this.apiService.postFormData(`user-role/${userRole.id}`, formData));
    });

    // Execute all API calls
    if (apiCalls.length > 0) {
      forkJoin(apiCalls).subscribe({
        next: (responses) => {
          console.log('Update responses:', responses);
          this.showSuccess('User roles berhasil diupdate');
          this.closeModal();
          this.loadUsers();
          this.loadUserRoles();
          this.loading = false;
        },
        error: (error) => {
          this.showError('Gagal mengupdate user roles: ' + error.message);
          this.loading = false;
        },
      });
    } else {
      // No changes needed
      this.showSuccess('Tidak ada perubahan role');
      this.closeModal();
      this.loading = false;
    }
  }

  /**
   * Quick add role to user (without opening modal)
   */
  quickAddRole(user: User, roleId: number): void {
    // Check if user already has this role
    const hasRole = user.roles.some((r) => r.role_id === roleId.toString());
    if (hasRole) {
      this.showError('User sudah memiliki role ini');
      return;
    }

    const formData = new FormData();
    formData.append('user_id', user.id.toString());
    formData.append('role_id', roleId.toString());

    this.apiService.postFormData('user-role', formData).subscribe({
      next: (response) => {
        if (response.success) {
          this.showSuccess('Role berhasil ditambahkan');
          this.loadUsers();
          this.loadUserRoles();
        }
      },
      error: (error) => {
        this.showError('Gagal menambahkan role: ' + error.message);
      },
    });
  }

  /**
   * Quick remove role from user (without opening modal)
   */
  quickRemoveRole(user: User, roleId: string): void {
    // Find the user-role record
    const userRoleRecord = this.userRoles.find(
      (ur) => ur.user_id === user.id.toString() && ur.role_id === roleId,
    );

    if (!userRoleRecord) {
      this.showError('User-role record tidak ditemukan');
      return;
    }

    if (!confirm('Hapus role ini dari user?')) {
      return;
    }

    this.apiService.delete(`user-role/${userRoleRecord.id}`).subscribe({
      next: (response) => {
        if (response.success) {
          this.showSuccess('Role berhasil dihapus');
          this.loadUsers();
          this.loadUserRoles();
        }
      },
      error: (error) => {
        this.showError('Gagal menghapus role: ' + error.message);
      },
    });
  }

  /**
   * Get role names from user
   */
  getRoleNames(user: User): string {
    return user.roles.map((r) => r.role).join(', ');
  }

  /**
   * Get role color class
   */
  getRoleColorClass(roleName: string): string {
    const roleColors: { [key: string]: string } = {
      superadmin: 'bg-purple-100 text-purple-800',
      'input-timbangan': 'bg-blue-100 text-blue-800',
      'code-customer': 'bg-green-100 text-green-800',
      'code-supplier': 'bg-orange-100 text-orange-800',
      'uji-kelembapan': 'bg-teal-100 text-teal-800',
    };

    return roleColors[roleName] || 'bg-gray-100 text-gray-800';
  }

  /**
   * Show error message
   */
  showError(message: string): void {
    this.errorMessage = message;
    setTimeout(() => {
      this.errorMessage = '';
    }, 5000);
  }

  /**
   * Show success message
   */
  showSuccess(message: string): void {
    this.successMessage = message;
    setTimeout(() => {
      this.successMessage = '';
    }, 3000);
  }

  /**
   * Format date
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Format role name for display
   */
  formatRoleName(roleName: string): string {
    return roleName
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  //TODO DELETE USER
  showDeleteUserModal: boolean = false;
  deleteConfirmed: boolean = false;
  namaToDelete: string = '';
  idToDelete: any;
  deleteUserModal(userId: any) {
    this.showDeleteUserModal = true;
    console.log('cek data user yang mau di delete', userId);
    this.namaToDelete = userId.username;
    this.idToDelete = userId.id;
  }

  confirmDelete() {
    this.deleteConfirmed = true;
    if (this.deleteConfirmed) {
      this.deleteUser(this.idToDelete);
    }
  }
  cancelDelete() {
    this.showDeleteUserModal = false;
  }

  deleteUser(user: User): void {
    this.loading = true;
    this.apiService.delete(`users/delete/${user}`).subscribe({
      next: (response) => {
        if (response.success) {
          this.showSuccess('User berhasil dihapus');
          this.loadUsers();
          this.loadUserRoles();
        }
        this.loading = false;
        this.showDeleteUserModal = false;
      },
      error: (error) => {
        this.showError('Gagal menghapus user: ' + error.message);
        this.loading = false;
      },
    });
  }
}
