// src/app/admin/pages/code-supplier/code-supplier.component.ts

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { lastValueFrom, Subject } from 'rxjs';
import { ApiService } from '../../services/api.service';

interface Supplier {
  id: number;
  nama: string;
  created_at: string;
  updated_at: string;
}

interface ModalConfig {
  type: 'success' | 'error' | 'confirm';
  title: string;
  message: string;
  showCancel?: boolean;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

@Component({
  selector: 'app-code-supplier',
  templateUrl: './code-supplier.component.html',
  styleUrls: ['./code-supplier.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CodeSupplierComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  supplierForm!: FormGroup;
  supplierList = signal<Supplier[]>([]);
  filteredSupplierList = signal<Supplier[]>([]);
  searchQuery = signal('');
  showFormModal = signal(false);
  editingSupplier = signal<Supplier | null>(null);
  isSubmitting = signal(false);
  isLoading = signal(false);

  // Modal state
  showModal = signal(false);
  modalConfig = signal<ModalConfig | null>(null);

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.initForm();
    this.loadSuppliers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.supplierForm = this.fb.nonNullable.group({
      nama: ['', [Validators.required, Validators.minLength(3)]],
    });
  }

  async loadSuppliers(): Promise<void> {
    this.isLoading.set(true);
    try {
      const res = await lastValueFrom(this.api.get<Supplier[]>('suplier'));
      if (res.success && res.data) {
        this.supplierList.set(res.data);
        this.filterList();
      }
    } catch (error: any) {
      this.showNotification({
        type: 'error',
        title: 'Failed to Load Data',
        message: error.message || 'Unable to load supplier data',
        confirmText: 'OK',
      });
    } finally {
      this.isLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query.toLowerCase());
    this.filterList();
  }

  private filterList(): void {
    const query = this.searchQuery();
    const list = this.supplierList();

    if (!query.trim()) {
      this.filteredSupplierList.set(list);
      return;
    }

    const filtered = list.filter((supplier) => supplier.nama.toLowerCase().includes(query));

    this.filteredSupplierList.set(filtered);
  }

  openAddModal(): void {
    this.editingSupplier.set(null);
    this.supplierForm.reset();
    this.showFormModal.set(true);
  }

  openEditModal(supplier: Supplier): void {
    this.editingSupplier.set(supplier);
    this.supplierForm.patchValue({
      nama: supplier.nama,
    });
    this.showFormModal.set(true);
  }

  closeFormModal(): void {
    this.showFormModal.set(false);
    this.editingSupplier.set(null);
    this.supplierForm.reset();
  }

  async submitForm(): Promise<void> {
    if (!this.supplierForm.valid || this.isSubmitting()) return;

    this.isSubmitting.set(true);

    try {
      const formData = this.supplierForm.getRawValue();
      const editing = this.editingSupplier();

      if (editing) {
        // Update existing supplier - gunakan postMultipart dengan endpoint suplier/{id}
        const res = await lastValueFrom(this.api.postMultipart(`suplier/${editing.id}`, formData));

        if (res.success) {
          this.showNotification({
            type: 'success',
            title: 'Supplier Updated Successfully',
            message: `Supplier ${formData.nama} has been updated`,
            confirmText: 'OK',
          });
          await this.loadSuppliers();
          this.closeFormModal();
        }
      } else {
        // Add new supplier - gunakan postMultipart dengan endpoint suplier (tanpa ID)
        const res = await lastValueFrom(this.api.postMultipart('suplier', formData));

        if (res.success) {
          this.showNotification({
            type: 'success',
            title: 'Supplier Added Successfully',
            message: `Supplier ${formData.nama} has been added`,
            confirmText: 'OK',
          });
          await this.loadSuppliers();
          this.closeFormModal();
        }
      }
    } catch (error: any) {
      this.showNotification({
        type: 'error',
        title: 'An Error Occurred',
        message: error.message || 'Failed to save supplier data',
        confirmText: 'Close',
      });
    } finally {
      this.isSubmitting.set(false);
      this.cdr.markForCheck();
    }
  }

  deleteSupplier(supplier: Supplier): void {
    this.showNotification({
      type: 'confirm',
      title: 'Confirm Delete',
      message: `Are you sure you want to delete supplier ${supplier.nama}?`,
      showCancel: true,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const res = await lastValueFrom(this.api.delete(`suplier/${supplier.id}`));

          if (res.success) {
            this.showNotification({
              type: 'success',
              title: 'Supplier Deleted Successfully',
              message: 'Supplier data has been deleted from the system',
              confirmText: 'OK',
            });
            await this.loadSuppliers();
          }
        } catch (error: any) {
          this.showNotification({
            type: 'error',
            title: 'Failed to Delete',
            message: error.message || 'Unable to delete supplier',
            confirmText: 'OK',
          });
        } finally {
          this.cdr.markForCheck();
        }
      },
    });
  }

  getThisMonthCount(): number {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return this.supplierList().filter((supplier) => {
      const createdDate = new Date(supplier.created_at);
      return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
    }).length;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getError(controlName: string): string {
    const control = this.supplierForm.get(controlName);
    if (!control?.errors || !control.touched) return '';

    const errors = control.errors;
    if (errors['required']) return 'This field is required';
    if (errors['minlength']) return `Minimum ${errors['minlength'].requiredLength} characters`;

    return 'Invalid input';
  }

  private showNotification(config: ModalConfig): void {
    this.modalConfig.set(config);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    setTimeout(() => this.modalConfig.set(null), 300);
  }

  handleModalConfirm(): void {
    const config = this.modalConfig();
    if (config?.onConfirm) {
      config.onConfirm();
    }
    this.closeModal();
  }

  handleModalCancel(): void {
    const config = this.modalConfig();
    if (config?.onCancel) {
      config.onCancel();
    }
    this.closeModal();
  }
}
