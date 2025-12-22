// src/app/admin/services/modal.service.ts

import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface ModalConfig {
  title: string;
  message: string;
  details?: { label: string; value: string }[];
  confirmText?: string;
  cancelText?: string;
  type?: 'info' | 'warning' | 'success' | 'danger';
  icon?: string;
}

interface ModalState {
  isOpen: boolean;
  config: ModalConfig | null;
  resolve: ((value: boolean) => void) | null;
}

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  private modalState$ = new Subject<ModalState>();

  get modalStateObservable(): Observable<ModalState> {
    return this.modalState$.asObservable();
  }

  confirm(config: ModalConfig): Promise<boolean> {
    return new Promise((resolve) => {
      this.modalState$.next({
        isOpen: true,
        config: {
          confirmText: 'Konfirmasi',
          cancelText: 'Batal',
          type: 'info',
          ...config,
        },
        resolve,
      });
    });
  }

  close(result: boolean, resolve: ((value: boolean) => void) | null): void {
    if (resolve) {
      resolve(result);
    }
    this.modalState$.next({
      isOpen: false,
      config: null,
      resolve: null,
    });
  }
}
