// src/app/admin/components/customer-dropdown/customer-dropdown.component.ts

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  inject,
  OnDestroy,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { forkJoin, lastValueFrom, Subject } from 'rxjs';
import { ApiService } from '../../services/api.service';

interface Customer {
  id: number;
  nama: string;
  created_at: string;
  updated_at: string;
  type?: 'customer' | 'supplier'; // Distinguished by source endpoint
}

// ✅ Interface untuk event yang di-emit
export interface CustomerSelectionEvent {
  nama: string;
  type: 'customer' | 'supplier';
}

@Component({
  selector: 'app-customer-dropdown',
  templateUrl: './customer-dropdown.component.html',
  styleUrls: ['./customer-dropdown.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomerDropdownComponent),
      multi: true,
    },
  ],
})
export class CustomerDropdownComponent implements ControlValueAccessor, OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  customers = signal<Customer[]>([]);
  filteredCustomers = signal<Customer[]>([]);
  searchQuery = signal('');
  isOpen = signal(false);
  selectedCustomer = signal<Customer | null>(null);
  isLoading = signal(false);
  loadError = signal<string | null>(null);

  // ✅ Event emitter untuk memberitahu parent tentang jenis relasi
  @Output() customerSelected = new EventEmitter<CustomerSelectionEvent>();

  private destroy$ = new Subject<void>();

  // ControlValueAccessor implementation
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  disabled = false;

  ngOnInit(): void {
    this.loadCustomers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load customers and suppliers from API and merge them
   */
  async loadCustomers(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(null);

    try {
      // Fetch both endpoints simultaneously
      const response = await lastValueFrom(
        forkJoin({
          customers: this.api.get<Customer[]>('customer'),
          suppliers: this.api.get<Customer[]>('suplier'),
        })
      );

      const allCustomers: Customer[] = [];

      // Add customers with type marker
      if (response.customers.success && response.customers.data) {
        const customersWithType = response.customers.data.map((c: Customer) => ({
          ...c,
          type: 'customer' as const,
        }));
        allCustomers.push(...customersWithType);
      }

      // Add suppliers with type marker
      if (response.suppliers.success && response.suppliers.data) {
        const suppliersWithType = response.suppliers.data.map((s: Customer) => ({
          ...s,
          type: 'supplier' as const,
        }));
        allCustomers.push(...suppliersWithType);
      }

      if (allCustomers.length === 0) {
        this.loadError.set('Gagal memuat data customer dan supplier');
      } else {
        // Sort by name for better UX
        allCustomers.sort((a, b) => a.nama.localeCompare(b.nama));

        this.customers.set(allCustomers);
        this.filteredCustomers.set(allCustomers);
      }
    } catch (error: any) {
      console.error('Error loading customers and suppliers:', error);
      this.loadError.set(error.message || 'Gagal memuat data customer dan supplier');
    } finally {
      this.isLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  /**
   * Filter customers based on search query
   */
  onSearchChange(query: string): void {
    this.searchQuery.set(query.toLowerCase());

    if (!query.trim()) {
      this.filteredCustomers.set(this.customers());
      return;
    }

    const filtered = this.customers().filter((customer) =>
      customer.nama.toLowerCase().includes(query.toLowerCase())
    );

    this.filteredCustomers.set(filtered);
  }

  /**
   * Toggle dropdown open/close
   */
  toggleDropdown(): void {
    if (this.disabled) return;
    this.isOpen.set(!this.isOpen());
    if (this.isOpen()) {
      this.onTouched();
    }
  }

  /**
   * Select a customer
   * ✅ UPDATED: Emit event dengan informasi type
   */
  selectCustomer(customer: Customer): void {
    this.selectedCustomer.set(customer);
    this.onChange(customer.nama);
    this.isOpen.set(false);
    this.searchQuery.set('');
    this.filteredCustomers.set(this.customers());

    // ✅ Emit event ke parent component
    if (customer.type) {
      this.customerSelected.emit({
        nama: customer.nama,
        type: customer.type,
      });
      console.log('✅ Customer selected:', customer.nama, 'Type:', customer.type);
    }
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.selectedCustomer.set(null);
    this.onChange('');
    this.searchQuery.set('');
    this.filteredCustomers.set(this.customers());
  }

  /**
   * Close dropdown when clicking outside
   */
  onClickOutside(): void {
    this.isOpen.set(false);
    this.searchQuery.set('');
    this.filteredCustomers.set(this.customers());
  }

  // ControlValueAccessor methods
  writeValue(value: string): void {
    if (value) {
      // Find customer by name
      const customer = this.customers().find((c) => c.nama === value);
      this.selectedCustomer.set(customer || null);
    } else {
      this.selectedCustomer.set(null);
    }
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  /**
   * ✅ Helper method untuk get badge class berdasarkan type
   */
  getBadgeClass(type: 'customer' | 'supplier'): string {
    return type === 'customer' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  }

  /**
   * ✅ Helper method untuk get badge label
   */
  getBadgeLabel(type: 'customer' | 'supplier'): string {
    return type === 'customer' ? 'Customer' : 'Supplier';
  }
}
