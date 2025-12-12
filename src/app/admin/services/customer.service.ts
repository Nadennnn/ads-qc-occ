// src/app/admin/services/customer.service.ts

import { Injectable, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Customer {
  id: string;
  kodeCustomer: string;
  namaCustomer: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class CustomerService {
  private readonly STORAGE_KEY = 'ads_customers';
  private customersSubject = new BehaviorSubject<Customer[]>(this.loadFromStorage());

  customers$ = this.customersSubject.asObservable();

  private loadFromStorage(): Customer[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : this.getDefaultCustomers();
    } catch {
      return this.getDefaultCustomers();
    }
  }

  private getDefaultCustomers(): Customer[] {
    return [
      {
        id: this.generateId(),
        kodeCustomer: '001',
        namaCustomer: 'CV VINCET TECH LTO',
        createdAt: new Date().toISOString(),
      },
    ];
  }

  private saveToStorage(customers: Customer[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(customers));
    } catch (error) {
      console.error('Error saving to storage:', error);
    }
  }

  private generateId(): string {
    return `cust_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getAllCustomers(): Customer[] {
    return this.customersSubject.value;
  }

  getCustomerById(id: string): Customer | undefined {
    return this.customersSubject.value.find((c) => c.id === id);
  }

  searchCustomers(query: string): Customer[] {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) return this.getAllCustomers();

    return this.customersSubject.value.filter(
      (customer) =>
        customer.kodeCustomer.toLowerCase().includes(normalizedQuery) ||
        customer.namaCustomer.toLowerCase().includes(normalizedQuery)
    );
  }

  addCustomer(data: Omit<Customer, 'id' | 'createdAt'>): string {
    const customers = this.customersSubject.value;

    // Validasi kode customer duplikat
    const isDuplicate = customers.some(
      (c) => c.kodeCustomer.toLowerCase() === data.kodeCustomer.toLowerCase()
    );

    if (isDuplicate) {
      throw new Error('Kode customer sudah digunakan');
    }

    const newCustomer: Customer = {
      ...data,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
    };

    const updatedCustomers = [...customers, newCustomer];
    this.customersSubject.next(updatedCustomers);
    this.saveToStorage(updatedCustomers);

    return newCustomer.id;
  }

  updateCustomer(id: string, data: Partial<Omit<Customer, 'id' | 'createdAt'>>): boolean {
    const customers = this.customersSubject.value;
    const index = customers.findIndex((c) => c.id === id);

    if (index === -1) return false;

    // Validasi kode customer duplikat saat update
    if (data.kodeCustomer) {
      const isDuplicate = customers.some(
        (c) => c.id !== id && c.kodeCustomer.toLowerCase() === data.kodeCustomer!.toLowerCase()
      );

      if (isDuplicate) {
        throw new Error('Kode customer sudah digunakan');
      }
    }

    const updatedCustomer = { ...customers[index], ...data };
    const updatedCustomers = [...customers];
    updatedCustomers[index] = updatedCustomer;

    this.customersSubject.next(updatedCustomers);
    this.saveToStorage(updatedCustomers);

    return true;
  }

  deleteCustomer(id: string): boolean {
    const customers = this.customersSubject.value;
    const filteredCustomers = customers.filter((c) => c.id !== id);

    if (filteredCustomers.length === customers.length) return false;

    this.customersSubject.next(filteredCustomers);
    this.saveToStorage(filteredCustomers);

    return true;
  }

  isKodeCustomerExists(kode: string, excludeId?: string): boolean {
    return this.customersSubject.value.some(
      (c) => c.kodeCustomer.toLowerCase() === kode.toLowerCase() && c.id !== excludeId
    );
  }
}
