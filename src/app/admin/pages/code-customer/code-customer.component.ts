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

interface Customer {
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
  selector: 'app-code-customer',
  templateUrl: './code-customer.component.html',
  styleUrls: ['./code-customer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class CodeCustomerComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  customerForm!: FormGroup;
  customerList = signal<Customer[]>([]);
  filteredCustomerList = signal<Customer[]>([]);
  searchQuery = signal('');
  showFormModal = signal(false);
  editingCustomer = signal<Customer | null>(null);
  isSubmitting = signal(false);
  isLoading = signal(false);

  // Modal state
  showModal = signal(false);
  modalConfig = signal<ModalConfig | null>(null);

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.initForm();
    this.loadCustomers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.customerForm = this.fb.nonNullable.group({
      nama: ['', [Validators.required, Validators.minLength(3)]],
    });
  }

  async loadCustomers(): Promise<void> {
    this.isLoading.set(true);
    try {
      const res = await lastValueFrom(this.api.get<Customer[]>('customer'));
      if (res.success && res.data) {
        this.customerList.set(res.data);
        this.filterList();
      }
    } catch (error: any) {
      this.showNotification({
        type: 'error',
        title: 'Failed to Load Data',
        message: error.message || 'Unable to load customer data',
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
    const list = this.customerList();

    if (!query.trim()) {
      this.filteredCustomerList.set(list);
      return;
    }

    const filtered = list.filter((customer) => customer.nama.toLowerCase().includes(query));

    this.filteredCustomerList.set(filtered);
  }

  openAddModal(): void {
    this.editingCustomer.set(null);
    this.customerForm.reset();
    this.showFormModal.set(true);
  }

  openEditModal(customer: Customer): void {
    this.editingCustomer.set(customer);
    this.customerForm.patchValue({
      nama: customer.nama,
    });
    this.showFormModal.set(true);
  }

  closeFormModal(): void {
    this.showFormModal.set(false);
    this.editingCustomer.set(null);
    this.customerForm.reset();
  }

  async submitForm(): Promise<void> {
    if (!this.customerForm.valid || this.isSubmitting()) return;

    this.isSubmitting.set(true);

    try {
      const formData = this.customerForm.getRawValue();
      const editing = this.editingCustomer();

      if (editing) {
        // Update existing customer - GUNAKAN postMultipart untuk FormData
        const res = await lastValueFrom(this.api.postMultipart(`customer/${editing.id}`, formData));

        if (res.success) {
          this.showNotification({
            type: 'success',
            title: 'Customer Updated Successfully',
            message: `Customer ${formData.nama} has been updated`,
            confirmText: 'OK',
          });
          await this.loadCustomers();
          this.closeFormModal();
        }
      } else {
        // Add new customer - GUNAKAN postMultipart untuk FormData
        const res = await lastValueFrom(this.api.postMultipart('customer', formData));

        if (res.success) {
          this.showNotification({
            type: 'success',
            title: 'Customer Added Successfully',
            message: `Customer ${formData.nama} has been added`,
            confirmText: 'OK',
          });
          await this.loadCustomers();
          this.closeFormModal();
        }
      }
    } catch (error: any) {
      this.showNotification({
        type: 'error',
        title: 'An Error Occurred',
        message: error.message || 'Failed to save customer data',
        confirmText: 'Close',
      });
    } finally {
      this.isSubmitting.set(false);
      this.cdr.markForCheck();
    }
  }

  deleteCustomer(customer: Customer): void {
    this.showNotification({
      type: 'confirm',
      title: 'Confirm Delete',
      message: `Are you sure you want to delete customer ${customer.nama}?`,
      showCancel: true,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const res = await lastValueFrom(this.api.delete(`customer/${customer.id}`));

          if (res.success) {
            this.showNotification({
              type: 'success',
              title: 'Customer Deleted Successfully',
              message: 'Customer data has been deleted from the system',
              confirmText: 'OK',
            });
            await this.loadCustomers();
          }
        } catch (error: any) {
          this.showNotification({
            type: 'error',
            title: 'Failed to Delete',
            message: error.message || 'Unable to delete customer',
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

    return this.customerList().filter((customer) => {
      const createdDate = new Date(customer.created_at);
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
    const control = this.customerForm.get(controlName);
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
