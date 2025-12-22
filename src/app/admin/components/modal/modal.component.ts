import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { ModalService, ModalConfig } from '../../services/modal.service';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss'],
  standalone: false,
})
export class ModalComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  isOpen = false;
  config: ModalConfig | null = null;
  private resolveFunction: ((value: boolean) => void) | null = null;

  constructor(private modalService: ModalService) {}

  ngOnInit(): void {
    this.modalService.modalStateObservable.pipe(takeUntil(this.destroy$)).subscribe((state) => {
      this.isOpen = state.isOpen;
      this.config = state.config;
      this.resolveFunction = state.resolve;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  confirm(): void {
    this.modalService.close(true, this.resolveFunction);
  }

  cancel(): void {
    this.modalService.close(false, this.resolveFunction);
  }

  getIconClass(): string {
    switch (this.config?.type) {
      case 'success':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'danger':
        return 'text-red-600';
      default:
        return 'text-blue-600';
    }
  }

  getConfirmButtonClass(): string {
    switch (this.config?.type) {
      case 'success':
        return 'bg-green-600 hover:bg-green-700';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700';
      case 'danger':
        return 'bg-red-600 hover:bg-red-700';
      default:
        return 'bg-blue-600 hover:bg-blue-700';
    }
  }
}
