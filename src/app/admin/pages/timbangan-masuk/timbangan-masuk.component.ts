// src/app/admin/pages/timbangan-masuk/timbangan-masuk.component.ts

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { debounceTime, lastValueFrom, Subject, takeUntil } from 'rxjs';
import { CustomerSelectionEvent } from '../../components/customer-dropdown/customer-dropdown.component';
import { AuthService } from '../../services/auth.service';
import { ScaleReaderService } from '../../services/scale-reader.service';
import { TimbanganData, TimbanganService } from '../../services/timbangan.service';

interface BarangOption {
  value: string;
  label: string;
}

type ViewMode = 'form' | 'list';

interface ModalConfig {
  type: 'success' | 'warning' | 'error' | 'info' | 'confirm';
  title: string;
  message: string;
  details?: Array<{ label: string; value: string | number }>;
  steps?: string[];
  showCancel?: boolean;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

@Component({
  selector: 'app-timbangan-masuk',
  templateUrl: './timbangan-masuk.component.html',
  styleUrls: ['./timbangan-masuk.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TimbanganMasukComponent implements OnInit, OnDestroy {
  @ViewChild('noTiketInput') noTiketInput!: ElementRef;

  private readonly fb = inject(FormBuilder);
  private readonly timbanganService = inject(TimbanganService);
  private readonly scaleReader = inject(ScaleReaderService);
  private readonly authService = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  taraForm!: FormGroup;
  showKelembapan = signal(false);
  isSubmitting = signal(false);
  currentView = signal<ViewMode>('form');
  timbanganMasukList = signal<TimbanganData[]>([]);
  selectedForTara = signal<TimbanganData | null>(null);
  showTaraModal = signal(false);

  // Scale reader signals
  scaleConnected = this.scaleReader.isConnected;
  currentWeight = this.scaleReader.currentWeight;
  weightStable = this.scaleReader.isStable;
  scaleError = this.scaleReader.connectionError;

  // Modal state
  showModal = signal(false);
  modalConfig = signal<ModalConfig | null>(null);

  // Search
  searchQuery = signal('');
  filteredTimbanganList = signal<TimbanganData[]>([]);

  private destroy$ = new Subject<void>();

  // Signal untuk nama penimbang
  namaPenimbang = signal<string>('');
  isLoadingProfile = signal<boolean>(true);

  readonly bahanBakuOptions: BarangOption[] = [
    { value: 'LOCC/OCC', label: 'LOCC/OCC' },
    { value: 'DLK', label: 'DLK' },
    { value: 'DUPLEK', label: 'DUPLEK' },
    { value: 'MIX WASTE', label: 'MIX WASTE' },
    { value: 'SARANG TELOR', label: 'SARANG TELOR' },
    { value: 'TUNGKUL', label: 'TUNGKUL' },
  ];

  readonly bahanLainnyaOptions: BarangOption[] = [
    { value: 'CHEMICAL', label: 'CHEMICAL' },
    { value: 'TEPUNG TAPIOKA', label: 'TEPUNG TAPIOKA' },
    { value: 'ROL KERTAS', label: 'ROL KERTAS' },
    { value: 'DAN LAIN-LAIN', label: 'DAN LAIN-LAIN' },
  ];

  readonly tipeBahanOptions: BarangOption[] = [
    { value: 'bahan-baku', label: 'Bahan Baku' },
    { value: 'lainnya', label: 'Lainnya' },
  ];

  currentBarangOptions = signal<BarangOption[]>([]);

  ngOnInit(): void {
    this.loadUserProfile();
    this.initForm();
    this.initTaraForm();
    this.setupFormListeners();
    this.loadTimbanganMasukList();
    this.setupScaleListener();

    if (!('serial' in navigator)) {
      alert('Browser Anda tidak mendukung Web Serial API. Gunakan Chrome/Edge versi terbaru.');
      return;
    }
    this.cekTara();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.scaleReader.disconnect();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.noTiketInput?.nativeElement?.focus(), 100);
  }

  private loadUserProfile(): void {
    if (!this.authService.isLoggedIn()) {
      this.showNotification({
        type: 'error',
        title: 'Sesi Berakhir',
        message: 'Silakan login kembali untuk melanjutkan',
        confirmText: 'Login',
        onConfirm: () => {
          this.authService.logout();
        },
      });
      return;
    }

    const cachedProfile = this.authService.getCachedProfile();
    if (cachedProfile) {
      this.namaPenimbang.set(cachedProfile.username);
      this.isLoadingProfile.set(false);
      console.log('✅ Using cached profile:', cachedProfile.username);
      return;
    }

    this.authService
      .getUserProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (profile) => {
          if (profile) {
            this.namaPenimbang.set(profile.username);
            this.isLoadingProfile.set(false);

            if (this.form) {
              this.form.patchValue({ namaPenimbang: profile.username });
            }

            console.log('✅ Profile loaded from API:', profile.username);
          }
        },
        error: (error) => {
          console.error('❌ Failed to load profile:', error);
          this.isLoadingProfile.set(false);

          const currentUser = this.authService.currentUserValue;
          if (currentUser?.username) {
            this.namaPenimbang.set(currentUser.username);
            console.warn('⚠️ Using fallback username from localStorage');
          } else {
            this.showNotification({
              type: 'error',
              title: 'Gagal Memuat Profile',
              message: 'Tidak dapat memuat data pengguna. Silakan refresh halaman.',
              confirmText: 'Refresh',
              onConfirm: () => window.location.reload(),
            });
          }
        },
      });
  }

  private initForm(): void {
    const initialNamaPenimbang = this.namaPenimbang() || '';

    this.form = this.fb.nonNullable.group({
      noTiket: ['', Validators.required],
      jenisKendaraan: ['', Validators.required],
      noKendaraan: ['', Validators.required],
      noContainer: [''],
      tipeBahan: ['', Validators.required],
      namaBarang: ['', Validators.required],
      namaRelasi: ['', [Validators.required, Validators.minLength(3)]],
      jenisRelasi: ['supplier'],
      namaSupir: [''],
      timbanganPertama: [
        { value: null as number | null, disabled: true },
        [Validators.required, Validators.min(1)],
      ],
      namaPenimbang: [{ value: initialNamaPenimbang, disabled: true }, Validators.required],
    });
  }

  private initTaraForm(): void {
    this.taraForm = this.fb.group({
      timbanganKedua: [
        { value: null as number | null, disabled: true },
        [Validators.required, Validators.min(1)],
      ],
    });
  }

  private setupFormListeners(): void {
    // Listener untuk noKendaraan
    this.form
      .get('noKendaraan')
      ?.valueChanges.pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe((value) => {
        if (value) {
          const formatted = this.formatNoKendaraan(value);
          if (formatted !== value) {
            this.form.patchValue({ noKendaraan: formatted }, { emitEvent: false });
          }
        }
      });

    // Listener untuk jenisKendaraan
    this.form
      .get('jenisKendaraan')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        const noContainerControl = this.form.get('noContainer');

        if (value === 'container') {
          noContainerControl?.setValidators([Validators.required, Validators.minLength(3)]);
        } else {
          noContainerControl?.clearValidators();
          noContainerControl?.setValue('');
        }

        noContainerControl?.updateValueAndValidity();
      });

    // ✅ PERBAIKAN: Listener untuk tipeBahan dengan reset yang lebih agresif
    this.form
      .get('tipeBahan')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        console.log('🔄 Tipe Bahan berubah menjadi:', value);

        // ✅ Reset namaBarang dengan force
        const namaBarangControl = this.form.get('namaBarang');
        namaBarangControl?.setValue('', { emitEvent: false });
        namaBarangControl?.markAsUntouched();
        namaBarangControl?.markAsPristine();

        // Set options sesuai tipe
        if (value === 'bahan-baku') {
          this.currentBarangOptions.set(this.bahanBakuOptions);
          console.log('📦 Options set ke Bahan Baku:', this.bahanBakuOptions);
        } else if (value === 'lainnya') {
          this.currentBarangOptions.set(this.bahanLainnyaOptions);
          console.log('📦 Options set ke Lainnya:', this.bahanLainnyaOptions);
        } else {
          this.currentBarangOptions.set([]);
          console.log('📦 Options dikosongkan');
        }

        // ✅ Force change detection
        this.cdr.detectChanges();
      });
  }

  private setupScaleListener(): void {
    this.scaleReader.weight$.pipe(takeUntil(this.destroy$)).subscribe((reading) => {
      if (reading && reading.stable) {
        console.log('📊 Received stable weight:', reading.weight);
      }
    });
  }

  // === SCALE METHODS ===

  async connectScale(): Promise<void> {
    const success = await this.scaleReader.connect();

    if (success) {
      this.showNotification({
        type: 'success',
        title: 'Timbangan Terhubung',
        message: 'Timbangan berhasil terhubung. Silakan mulai penimbangan.',
        confirmText: 'OK',
      });
    } else {
      this.showNotification({
        type: 'error',
        title: 'Koneksi Gagal',
        message:
          this.scaleError() ||
          'Gagal terhubung ke timbangan. Pastikan timbangan sudah terhubung ke komputer.',
        confirmText: 'Tutup',
      });
    }
  }

  async disconnectScale(): Promise<void> {
    await this.scaleReader.disconnect();
    this.showNotification({
      type: 'info',
      title: 'Timbangan Terputus',
      message: 'Koneksi ke timbangan telah diputus.',
      confirmText: 'OK',
    });
  }

  captureWeightForBruto(): void {
    const weight = this.scaleReader.getStableWeight();

    if (weight === null) {
      this.showNotification({
        type: 'warning',
        title: 'Berat Tidak Stabil',
        message: 'Tunggu hingga berat stabil sebelum mengambil data.',
        confirmText: 'OK',
      });
      return;
    }

    this.form.patchValue({ timbanganPertama: weight });

    this.showNotification({
      type: 'success',
      title: 'Berat Bruto Diambil',
      message: `Berat bruto ${weight} kg telah diinput.`,
      confirmText: 'OK',
    });
  }

  captureWeightForTara(): void {
    const weight = this.scaleReader.getStableWeight();

    if (weight === null) {
      this.showNotification({
        type: 'warning',
        title: 'Berat Tidak Stabil',
        message: 'Tunggu hingga berat stabil sebelum mengambil data.',
        confirmText: 'OK',
      });
      return;
    }

    this.taraForm.patchValue({ timbanganKedua: weight });

    this.showNotification({
      type: 'success',
      title: 'Berat Tara Diambil',
      message: `Berat tara ${weight} kg telah diinput.`,
      confirmText: 'OK',
    });
  }

  // === SEARCH METHODS ===

  onSearchChange(query: string): void {
    this.searchQuery.set(query.toLowerCase());
    this.filterList();
  }

  private filterList(): void {
    const query = this.searchQuery();
    const list = this.timbanganMasukList();

    if (!query.trim()) {
      this.filteredTimbanganList.set(list);
      return;
    }

    const filtered = list.filter(
      (item) =>
        item.noTiket.toLowerCase().includes(query) ||
        item.noKendaraan.toLowerCase().includes(query),
    );

    this.filteredTimbanganList.set(filtered);
  }

  private loadTimbanganMasukList(): void {
    // Subscribe ke menungguTara$ untuk daftar yang menunggu input Tara
    this.timbanganService.menungguTara$.pipe(takeUntil(this.destroy$)).subscribe((data) => {
      this.timbanganMasukList.set(data);
      this.filterList();
      console.log('📋 Loaded menunggu tara:', data.length, 'items');
    });

    // Load data menunggu tara
    this.timbanganService.refreshMenungguTara();
  }

  private formatNoKendaraan(value: string): string {
    const cleaned = value.replace(/\s+/g, '').toUpperCase();
    const match = cleaned.match(/^([A-Z]{1,2})(\d{1,4})([A-Z]{1,3})$/);
    return match ? `${match[1]} ${match[2]} ${match[3]}` : value.toUpperCase();
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

  // REVIEW onSubmit
  async onSubmit(): Promise<void> {
    if (!this.form.valid || this.isSubmitting()) return;

    this.isSubmitting.set(true);

    try {
      const rawFormData = this.form.getRawValue();

      console.log('📝 Form Value saat Submit:', {
        noTiket: rawFormData.noTiket,
        tipeBahan: rawFormData.tipeBahan,
        namaBarang: rawFormData.namaBarang,
        jenisKendaraan: rawFormData.jenisKendaraan,
        jenisRelasi: rawFormData.jenisRelasi,
      });

      if (!rawFormData.tipeBahan || !rawFormData.namaBarang) {
        throw new Error('Tipe Bahan dan Nama Barang wajib diisi!');
      }

      const response = await lastValueFrom(
        this.timbanganService.addTimbanganData({
          noTiket: rawFormData.noTiket,
          jenisKendaraan: rawFormData.jenisKendaraan,
          noKendaraan: rawFormData.noKendaraan,
          noContainer: rawFormData.noContainer || undefined,
          tipeBahan: rawFormData.tipeBahan,
          namaBarang: rawFormData.namaBarang,
          namaRelasi: rawFormData.namaRelasi,
          jenisRelasi: rawFormData.jenisRelasi,
          namaSupir: rawFormData.namaSupir,
          timbanganPertama: rawFormData.timbanganPertama,
          namaPenimbang: rawFormData.namaPenimbang,
          timestamp: new Date().toISOString(),
        }),
      );

      if (!response.success) {
        throw new Error(response.message || 'Gagal menyimpan data');
      }

      console.log('✅ Data saved successfully:', response.message);

      await this.delay(300);

      const tipeBahan = rawFormData.tipeBahan === 'bahan-baku' ? 'Bahan Baku' : 'Lainnya';

      // Tampilkan notifikasi sukses
      if (rawFormData.tipeBahan === 'bahan-baku') {
        this.showNotification({
          type: 'success',
          title: 'Data Berhasil Disimpan',
          message: response.message || 'Data timbangan masuk telah tersimpan dengan baik',
          details: [
            { label: 'Tipe Bahan', value: tipeBahan },
            { label: 'Bruto', value: `${rawFormData.timbanganPertama} kg` },
          ],
          steps: [
            'Lakukan Uji Kelembapan terlebih dahulu',
            'Setelah selesai uji, input Tara saat truk keluar',
            'Netto akan otomatis dihitung dengan pengurangan kelembapan',
          ],
          confirmText: 'Mengerti',
        });
      } else {
        this.showNotification({
          type: 'success',
          title: 'Data Berhasil Disimpan',
          message: response.message || 'Data timbangan masuk telah tersimpan dengan baik',
          details: [
            { label: 'Tipe Bahan', value: tipeBahan },
            { label: 'Bruto', value: `${rawFormData.timbanganPertama} kg` },
          ],
          confirmText: 'Mengerti',
        });
      }

      this.onReset();
      this.switchView('list');
    } catch (error: any) {
      console.error('❌ Error:', error);

      const errorMessage = error?.message || 'Gagal menyimpan data. Silakan coba lagi.';

      this.showNotification({
        type: 'error',
        title: 'Terjadi Kesalahan',
        message: errorMessage,
        confirmText: 'Tutup',
      });
    } finally {
      this.isSubmitting.set(false);
    }
  }

  openTaraModal(data: TimbanganData): void {
    if (data.tipeBahan === 'bahan-baku' && data.statusUjiKelembapan === 'pending') {
      this.showNotification({
        type: 'warning',
        title: 'Data Belum Diuji Kelembapan',
        message:
          'Untuk bahan baku, wajib melakukan uji kelembapan terlebih dahulu sebelum input Tara.',
        steps: [
          'Silakan ke menu Uji Kelembapan',
          'Lakukan pengujian pada data ini',
          'Kembali ke sini untuk input Tara',
        ],
        confirmText: 'Mengerti',
      });
      return;
    }

    this.selectedForTara.set(data);
    this.showTaraModal.set(true);
    this.taraForm.reset();
  }

  closeTaraModal(): void {
    this.showTaraModal.set(false);
    this.selectedForTara.set(null);
    this.taraForm.reset();
  }

  // REVIEW submitTara
  async submitTara(): Promise<void> {
    const selected = this.selectedForTara();
    if (!this.taraForm.valid || !selected || this.isSubmitting()) return;

    this.isSubmitting.set(true);

    try {
      const tara = this.taraForm.getRawValue().timbanganKedua;

      // ✅ Validasi: Tara tidak boleh >= Bruto
      if (tara >= selected.timbanganPertama) {
        this.showNotification({
          type: 'error',
          title: 'Input Tidak Valid',
          message: 'Tara tidak boleh lebih besar atau sama dengan Bruto',
          details: [
            { label: 'Bruto', value: `${selected.timbanganPertama} kg` },
            { label: 'Tara yang diinput', value: `${tara} kg` },
          ],
          confirmText: 'Tutup',
        });
        this.isSubmitting.set(false);
        return;
      }

      console.log('📤 Submitting Tara:', {
        id: selected.id,
        tara: tara,
        bruto: selected.timbanganPertama,
      });

      // ✅ Kirim ke endpoint insert-tara
      const response = await lastValueFrom(this.timbanganService.updateTaraData(selected.id, tara));

      if (!response.success) {
        throw new Error(response.message || 'Gagal menyimpan data Tara');
      }

      console.log('✅ Tara saved successfully:', response.message);

      await this.delay(500);

      // Hitung netto
      const nettoSebelumPengurangan = selected.timbanganPertama - tara;

      let details: Array<{ label: string; value: string | number }> = [];

      // ✅ Jika bahan baku dengan kelembapan
      if (selected.tipeBahan === 'bahan-baku' && selected.hasilUjiKelembapan) {
        const kelembapan = selected.hasilUjiKelembapan.claimPercentage;
        const pengurangan = nettoSebelumPengurangan * (kelembapan / 100);
        const nettoAkhir = nettoSebelumPengurangan - pengurangan;

        details = [
          { label: 'Bruto', value: `${selected.timbanganPertama} kg` },
          { label: 'Tara', value: `${tara} kg` },
          { label: 'Netto Kotor', value: `${nettoSebelumPengurangan.toFixed(2)} kg` },
          { label: 'Kelembapan', value: `${kelembapan.toFixed(2)}%` },
          { label: 'Pengurangan', value: `${pengurangan.toFixed(2)} kg` },
          { label: 'Netto Final', value: `${nettoAkhir.toFixed(2)} kg` },
        ];
      } else {
        // ✅ Bahan lainnya atau bahan baku belum diuji
        details = [
          { label: 'Bruto', value: `${selected.timbanganPertama} kg` },
          { label: 'Tara', value: `${tara} kg` },
          { label: 'Netto', value: `${nettoSebelumPengurangan.toFixed(2)} kg` },
        ];
      }

      // ✅ Close modal
      this.closeTaraModal();

      // ✅ Tampilkan konfirmasi cetak slip
      this.showNotification({
        type: 'confirm',
        title: 'Data Tara Berhasil Disimpan',
        message: 'Apakah Anda ingin mencetak slip timbangan?',
        details: details,
        showCancel: true,
        confirmText: 'Cetak Slip',
        cancelText: 'Tidak',
        onConfirm: () => this.printSlip(selected.id),
        onCancel: () => {
          console.log('User memilih tidak cetak slip');
        },
      });
    } catch (error: any) {
      console.error('❌ Error saat submit tara:', error);

      const errorMessage = error?.message || 'Gagal menyimpan data Tara. Silakan coba lagi.';

      this.showNotification({
        type: 'error',
        title: 'Terjadi Kesalahan',
        message: errorMessage,
        confirmText: 'Tutup',
      });
    } finally {
      this.isSubmitting.set(false);
    }
  }

  // printSlip(id: string): void {
  //   const url = `/admin/print-slip/${id}`;
  //   window.open(url, '_blank', 'width=400,height=600');
  // }

  deleteData(data: TimbanganData): void {
    this.showNotification({
      type: 'confirm',
      title: 'Konfirmasi Hapus',
      message: `Apakah Anda yakin ingin menghapus data dengan nomor tiket ${data.noTiket}?`,
      showCancel: true,
      confirmText: 'Hapus',
      cancelText: 'Batal',
      onConfirm: async () => {
        try {
          const response = await lastValueFrom(this.timbanganService.deleteTimbanganData(data.id));

          if (response.success) {
            this.showNotification({
              type: 'success',
              title: 'Berhasil Dihapus',
              message: response.message || 'Data berhasil dihapus dari sistem',
              confirmText: 'Tutup',
            });
          } else {
            throw new Error(response.message || 'Gagal menghapus data');
          }
        } catch (error: any) {
          this.showNotification({
            type: 'error',
            title: 'Gagal Menghapus',
            message: error?.message || 'Gagal menghapus data. Silakan coba lagi.',
            confirmText: 'Tutup',
          });
        }
      },
    });
  }

  switchView(view: ViewMode): void {
    this.currentView.set(view);
  }

  onReset(): void {
    // ✅ Reset dengan nilai default yang jelas
    this.form.reset({
      noTiket: '',
      jenisKendaraan: '',
      noKendaraan: '',
      noContainer: '',
      tipeBahan: '',
      namaBarang: '',
      namaRelasi: '',
      jenisRelasi: 'supplier',
      namaSupir: '',
      timbanganPertama: null,
      namaPenimbang: this.namaPenimbang(),
    });

    // ✅ Clear options
    this.currentBarangOptions.set([]);

    // ✅ Mark all as untouched
    Object.keys(this.form.controls).forEach((key) => {
      const control = this.form.get(key);
      control?.markAsUntouched();
      control?.markAsPristine();
    });

    this.showKelembapan.set(false);

    // ✅ Force change detection
    this.cdr.detectChanges();

    setTimeout(() => this.noTiketInput?.nativeElement?.focus(), 100);
  }

  getError(controlName: string, form: FormGroup = this.form): string {
    const control = form.get(controlName);
    if (!control?.errors || !control.touched) return '';

    const errors = control.errors;
    if (errors['required']) return 'Wajib diisi';
    if (errors['minlength']) return `Min ${errors['minlength'].requiredLength} karakter`;
    if (errors['min']) return `Min ${errors['min'].min}`;
    if (errors['max']) return `Max ${errors['max'].max}`;

    return 'Input tidak valid';
  }

  canInputTara(data: TimbanganData): boolean {
    if (data.tipeBahan !== 'bahan-baku') return true;
    return data.statusUjiKelembapan === 'completed';
  }

  getStatusBadge(data: TimbanganData): string {
    if (data.tipeBahan !== 'bahan-baku') {
      return 'Siap Input Tara';
    }

    if (data.statusUjiKelembapan === 'pending') {
      return 'Perlu Uji Kelembapan';
    }

    return 'Siap Input Tara';
  }

  getStatusBadgeClass(data: TimbanganData): string {
    if (data.tipeBahan !== 'bahan-baku') {
      return 'bg-blue-100 text-blue-800';
    }

    if (data.statusUjiKelembapan === 'pending') {
      return 'bg-yellow-100 text-yellow-800';
    }

    return 'bg-green-100 text-green-800';
  }

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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  onCustomerSelected(event: CustomerSelectionEvent): void {
    console.log('🎯 Customer/Supplier selected:', event.nama, 'Type:', event.type);

    this.form.patchValue(
      {
        jenisRelasi: event.type,
      },
      { emitEvent: false },
    );
  }

  refreshList(): void {
    this.timbanganService.refreshMenungguTara();
  }

  // ANCHOR Tara selesai
  // ✅ History Modal State
  showHistoryModal = signal(false);
  taraSelesaiList = signal<TimbanganData[]>([]);
  filteredHistoryList = signal<TimbanganData[]>([]);
  historySearchQuery = signal('');
  isLoadingHistory = signal(false);

  cekTara() {
    this.timbanganService.taraSelesai$.pipe(takeUntil(this.destroy$)).subscribe((data) => {
      this.taraSelesaiList.set(data);
      this.filterHistoryList();
      console.log('📋 Loaded tara selesai:', data.length, 'items');
    });
  }

  // ✅ Open History Modal
  openHistoryModal(): void {
    this.isLoadingHistory.set(true);
    this.showHistoryModal.set(true);
    this.historySearchQuery.set('');

    // Load data dari API
    this.timbanganService
      .loadDaftarTaraSelesai()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isLoadingHistory.set(false);
        },
        error: (error) => {
          console.error('❌ Failed to load history:', error);
          this.isLoadingHistory.set(false);
          this.showNotification({
            type: 'error',
            title: 'Gagal Memuat Data',
            message: 'Tidak dapat memuat data history. Silakan coba lagi.',
            confirmText: 'Tutup',
          });
        },
      });
  }

  // ✅ Close History Modal
  closeHistoryModal(): void {
    this.showHistoryModal.set(false);
    this.historySearchQuery.set('');
  }

  // ✅ Search History
  onHistorySearchChange(query: string): void {
    this.historySearchQuery.set(query.toLowerCase());
    this.filterHistoryList();
  }

  // ✅ Filter History List
  private filterHistoryList(): void {
    const query = this.historySearchQuery();
    const list = this.taraSelesaiList();

    if (!query.trim()) {
      this.filteredHistoryList.set(list);
      return;
    }

    const filtered = list.filter(
      (item) =>
        item.noTiket.toLowerCase().includes(query) ||
        item.noKendaraan.toLowerCase().includes(query) ||
        item.namaBarang.toLowerCase().includes(query) ||
        item.namaRelasi.toLowerCase().includes(query),
    );

    this.filteredHistoryList.set(filtered);
  }

  // ✅ Print Slip dari History
  printSlipFromHistory(data: TimbanganData): void {
    console.log('cek data ini :', data);
    this.printSlip(data.id);
  }

  printSlip(id: string): void {
    // Ambil data lengkap berdasarkan ID
    const data = this.taraSelesaiList().find((item) => item.id === id);

    if (!data) {
      this.showNotification({
        type: 'error',
        title: 'Data Tidak Ditemukan',
        message: 'Data slip tidak dapat ditemukan.',
        confirmText: 'Tutup',
      });
      return;
    }

    // Generate print window
    this.generatePrintSlip(data);
  }

  private generatePrintSlip(data: TimbanganData): void {
    // Format tanggal dan waktu
    const dateMasuk = new Date(data.timestamp);
    const tanggalMasuk = dateMasuk.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const jamMasuk = dateMasuk.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Tanggal keluar
    const dateKeluar = new Date();
    const tanggalKeluar = dateKeluar.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const jamKeluar = dateKeluar.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Data berat
    const bruto = data.timbanganPertama || 0;
    const tara = data.timbanganKedua || 0;
    const nettoKotor = bruto - tara;

    // Hitung potongan dari kelembapan jika ada
    let potongan = 0;
    if (data.tipeBahan === 'bahan-baku' && data.hasilUjiKelembapan) {
      const kelembapan = data.hasilUjiKelembapan.claimPercentage || 0;
      potongan = Math.round(nettoKotor * (kelembapan / 100));
    }

    const nettoAkhir = nettoKotor - potongan;

    // Nama barang display
    let namaBarangDisplay = data.namaBarang || '-';
    if (data.namaBarang === 'DAN LAIN-LAIN' && data.keteranganBarang) {
      namaBarangDisplay = data.keteranganBarang;
    }

    // Data lainnya
    const supplierCustomer = data.namaRelasi || '-';
    const namaSupir = data.namaSupir || '-';
    const noContainer = data.noContainer || '-';

    // HTML untuk printer dot matrix - kertas 10.5cm x 16.5cm
    const printContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Slip Timbangan - ${data.noTiket}</title>
  <style>
    @page {
      size: 105mm 165mm;
      margin: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 20px;
      line-height: 1.3;
      width: 100mm;
      height: 150mm;
      background: white;
      color: #000;
    }

    .header {
      text-align: center;
      margin-bottom: 3mm;
      padding-bottom: 2mm;
    }

    .title {
      font-weight: bold;
      font-size: 12px;
      letter-spacing: 1px;
      margin-bottom: 1mm;
    }

    .subtitle {
      font-size: 9px;
      letter-spacing: 0.5px;
    }

    .divider {
      border-top: 1px solid #000;
      margin: 2.5mm 0;
    }

    .double-divider {
      border-top: 2px solid #000;
      margin: 3mm 0;
    }

    .row {
      display: flex;
      margin-bottom: 1.5mm;
      font-size: 9px;
      line-height: 1.4;
    }

    .row-label {
      width: 35%;
    }

    .row-separator {
      width: 5%;
    }

    .row-value {
      width: 60%;
      word-wrap: break-word;
    }

    .weight-section {
      border: 2px solid #000;
      padding: 3mm 2mm;
      margin: 4mm 0;
    }

    .weight-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2mm;
      font-size: 10px;
    }

    .weight-label {
      font-weight: 700;
      font-size: 9px;
    }

    .weight-value {
      font-weight: 700;
      text-align: right;
      font-size: 10px;
    }

    .weight-result {
      border-top: 2px solid #000;
      padding-top: 2.5mm;
      margin-top: 2.5mm;
    }

    .weight-result .weight-label {
      font-size: 10px;
    }

    .weight-result .weight-value {
      font-size: 11px;
    }

    .signature-section {
      margin-top: 5mm;
      display: flex;
      justify-content: space-between;
      padding: 0 2mm;
    }

    .signature-box {
      width: 47%;
      text-align: center;
      font-size: 8px;
    }

    .signature-label {
      margin-bottom: 2mm;
      font-weight: 600;
    }

    .signature-line {
      height: 15mm;
      border-bottom: 1px solid #000;
      margin: 2mm 3mm;
    }

    .signature-name {
      font-size: 7px;
      margin-top: 1.5mm;
    }

    .footer {
      text-align: center;
      margin-top: 4mm;
      font-size: 9px;
      font-weight: bold;
      letter-spacing: 3px;
    }

    .barcode-section {
      text-align: center;
      margin-top: 3mm;
      padding-top: 2mm;
      border-top: 1px dashed #000;
    }

    .barcode-number {
      font-size: 9px;
      letter-spacing: 3px;
      font-weight: bold;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      @page {
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="title">BUKTI KRT. TIMBANGAN</div>
    <div class="subtitle">PT AGRO DELI SERDANG</div>
  </div>

  <!-- Info Section 1 -->
  <div>
    <div class="row">
      <span class="row-label">No. Tiket</span>
      <span class="row-separator">:</span>
      <span class="row-value">${data.noTiket}</span>
    </div>
    <div class="row">
      <span class="row-label">Tgl/ Jam Masuk</span>
      <span class="row-separator">:</span>
      <span class="row-value">${tanggalMasuk} ${jamMasuk}</span>
    </div>
    <div class="row">
      <span class="row-label">Tgl/ Jam Keluar</span>
      <span class="row-separator">:</span>
      <span class="row-value">${tanggalKeluar} ${jamKeluar}</span>
    </div>
  </div>

  <div class="divider"></div>

  <!-- Info Section 2 -->
  <div>
    <div class="row">
      <span class="row-label">No. Kendaraan</span>
      <span class="row-separator">:</span>
      <span class="row-value">${data.noKendaraan}</span>
    </div>
    <div class="row">
      <span class="row-label">No. Container</span>
      <span class="row-separator">:</span>
      <span class="row-value">${noContainer}</span>
    </div>
    <div class="row">
      <span class="row-label">Nama Barang</span>
      <span class="row-separator">:</span>
      <span class="row-value">${namaBarangDisplay}</span>
    </div>
    <div class="row">
      <span class="row-label">No. Referensi</span>
      <span class="row-separator">:</span>
      <span class="row-value">${noContainer !== '-' ? noContainer : 'P1100398'}</span>
    </div>
    <div class="row">
      <span class="row-label">Rel. / Supplier</span>
      <span class="row-separator">:</span>
      <span class="row-value">${supplierCustomer}</span>
    </div>
    <div class="row">
      <span class="row-label">Nama Supir</span>
      <span class="row-separator">:</span>
      <span class="row-value">${namaSupir}</span>
    </div>
  </div>


  <!-- Weight Section -->
  <div class="weight-section">
    <div class="weight-row">
      <span class="weight-label">Timbangan Pertama</span>
      <span class="weight-value">: ${bruto}</span>
    </div>
    <div class="weight-row">
      <span class="weight-label">Timbangan Kedua</span>
      <span class="weight-value">: ${tara}</span>
    </div>
    <div class="weight-row">
      <span class="weight-label">Hasil Akhir</span>
      <span class="weight-value">: ${nettoKotor}</span>
    </div>
    <div class="weight-row weight-result">
      <span class="weight-label">Hasil Akhir Setelah Potongan</span>
      <span class="weight-value">: ${nettoAkhir}Kg</span>
    </div>
  </div>


  <!-- Signature Section -->
  <div class="signature-section">
    <div class="signature-box">
      <div class="signature-label">Ditimbang</div>
      <div class="signature-line"></div>
      <div class="signature-name">Diketahui</div>
    </div>
    <div class="signature-box">
      <div class="signature-label">&nbsp;</div>
      <div class="signature-line"></div>
      <div class="signature-name">Nama & Tanda Tangan</div>
    </div>
  </div>





  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.onafterprint = function() {
          window.close();
        };
      }, 500);
    };
  </script>
</body>
</html>
`;

    // Open print window
    const printWindow = window.open('', '_blank', 'width=420,height=660');

    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    } else {
      this.showNotification({
        type: 'error',
        title: 'Gagal Membuka Print',
        message: 'Browser memblokir popup. Izinkan popup untuk mencetak slip.',
        confirmText: 'Tutup',
      });
    }
  }

  // ✅ Refresh History List
  refreshHistoryList(): void {
    this.isLoadingHistory.set(true);
    this.timbanganService
      .loadDaftarTaraSelesai()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isLoadingHistory.set(false);
          this.showNotification({
            type: 'success',
            title: 'Data Diperbarui',
            message: 'History data berhasil diperbarui.',
            confirmText: 'OK',
          });
        },
        error: () => {
          this.isLoadingHistory.set(false);
        },
      });
  }
}
