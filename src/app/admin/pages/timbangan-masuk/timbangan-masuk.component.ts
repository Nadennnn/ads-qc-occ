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
  type: 'success' | 'warning' | 'error' | 'info' | 'confirm' | 'preview';
  title: string;
  message: string;
  details?: Array<{ label: string; value: string | number }>;
  steps?: string[];
  showCancel?: boolean;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  payload?: any;
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
      tipeTransaksi: ['pembelian', Validators.required],
      tipeBahan: ['', Validators.required],
      namaBarang: ['', Validators.required],
      keteranganBarang: [''],
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
      timbanganKedua: [{ value: null as number | null }, [Validators.required, Validators.min(1)]],
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

    this.form
      .get('namaBarang')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        const keteranganControl = this.form.get('keteranganBarang');
        const tipeBahan = this.form.get('tipeBahan')?.value;

        console.log('🔄 Nama Barang berubah:', value, 'Tipe Bahan:', tipeBahan);

        // Jika Lainnya + DAN LAIN-LAIN, wajibkan keterangan
        if (tipeBahan === 'lainnya' && value === 'DAN LAIN-LAIN') {
          keteranganControl?.setValidators([Validators.required, Validators.minLength(3)]);
          console.log('✅ Keterangan Barang WAJIB diisi');
        } else {
          keteranganControl?.clearValidators();
          keteranganControl?.setValue('');
          console.log('❌ Keterangan Barang tidak wajib');
        }

        keteranganControl?.updateValueAndValidity();
      });

    this.form
      .get('tipeTransaksi')
      ?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        if (value === 'penjualan') {
          this.form.patchValue({ jenisRelasi: 'customer' }, { emitEvent: false });
          console.log('🔄 Tipe Transaksi: PENJUALAN → jenisRelasi: customer');
        } else {
          this.form.patchValue({ jenisRelasi: 'supplier' }, { emitEvent: false });
          console.log('🔄 Tipe Transaksi: PEMBELIAN → jenisRelasi: supplier');
        }
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
    // Validasi awal - jangan submit jika form invalid atau sedang submitting
    if (!this.form.valid || this.isSubmitting()) return;

    // Ambil semua data dari form
    const rawFormData = this.form.getRawValue();

    console.log('📝 Form Value saat Submit:', {
      noTiket: rawFormData.noTiket,
      tipeBahan: rawFormData.tipeBahan,
      namaBarang: rawFormData.namaBarang,
      jenisKendaraan: rawFormData.jenisKendaraan,
      jenisRelasi: rawFormData.jenisRelasi,
    });

    // ============================================
    // VALIDASI DATA
    // ============================================

    // Validasi 1: Tipe Bahan dan Nama Barang wajib diisi
    if (!rawFormData.tipeBahan || !rawFormData.namaBarang) {
      this.showNotification({
        type: 'error',
        title: 'Data Tidak Lengkap',
        message: 'Tipe Bahan dan Nama Barang wajib diisi!',
        confirmText: 'Tutup',
      });
      return;
    }

    // Validasi 2: Jika pilih "DAN LAIN-LAIN", keterangan wajib diisi
    if (
      rawFormData.tipeBahan === 'lainnya' &&
      rawFormData.namaBarang === 'DAN LAIN-LAIN' &&
      !rawFormData.keteranganBarang
    ) {
      this.showNotification({
        type: 'error',
        title: 'Data Tidak Lengkap',
        message: 'Keterangan Barang wajib diisi untuk barang DAN LAIN-LAIN!',
        confirmText: 'Tutup',
      });
      return;
    }

    // ============================================
    // PREPARE PAYLOAD UNTUK PREVIEW
    // ============================================

    const payload = {
      nomor_bon: rawFormData.noTiket,
      jenis_kendaraan: rawFormData.jenisKendaraan === 'truck' ? 'Truck' : 'Container',
      nomor_kendaraan: rawFormData.noKendaraan,
      nomor_container: rawFormData.noContainer || '-',
      type_bahan: rawFormData.tipeBahan === 'bahan-baku' ? 'Bahan Baku' : 'Lainnya',
      barang: rawFormData.namaBarang,
      keterangan_barang: rawFormData.keteranganBarang || '-',
      [rawFormData.jenisRelasi === 'customer' ? 'customer' : 'suplier']: rawFormData.namaRelasi,
      supir: rawFormData.namaSupir || '-',
      berat_bruto: String(rawFormData.timbanganPertama),
      petugas: rawFormData.namaPenimbang,
      tipe_transaksi: rawFormData.tipeTransaksi === 'pembelian' ? 'PEMBELIAN' : 'PENJUALAN',
    };

    // ============================================
    // BUILD DETAILS ARRAY UNTUK MODAL PREVIEW
    // ============================================

    const previewDetails: Array<{ label: string; value: string | number }> = [
      { label: 'Nomor Bon', value: payload.nomor_bon },
      { label: 'Tipe Transaksi', value: payload.tipe_transaksi },
      { label: 'Jenis Kendaraan', value: payload.jenis_kendaraan },
      { label: 'No. Kendaraan', value: payload.nomor_kendaraan },
    ];

    // Tambahkan No. Container jika ada
    if (payload.nomor_container !== '-') {
      previewDetails.push({ label: 'No. Container', value: payload.nomor_container });
    }

    // Tambahkan data barang
    previewDetails.push(
      { label: 'Tipe Bahan', value: payload.type_bahan },
      { label: 'Nama Barang', value: payload.barang },
    );

    // Tambahkan keterangan jika ada
    if (payload.keterangan_barang !== '-') {
      previewDetails.push({ label: 'Keterangan', value: payload.keterangan_barang });
    }

    // Tambahkan customer/supplier
    previewDetails.push({
      label: rawFormData.jenisRelasi === 'customer' ? 'Customer' : 'Supplier',
      value: rawFormData.namaRelasi,
    });

    // Tambahkan nama supir jika ada
    if (payload.supir !== '-') {
      previewDetails.push({ label: 'Nama Supir', value: payload.supir });
    }

    // Tambahkan berat dan petugas
    previewDetails.push(
      { label: 'Berat Bruto', value: `${payload.berat_bruto} kg` },
      { label: 'Petugas', value: payload.petugas },
    );

    // ============================================
    // TAMPILKAN MODAL KONFIRMASI
    // ============================================

    this.showNotification({
      type: 'preview',
      title: 'Konfirmasi Data Timbangan Pertama',
      message: 'Pastikan semua data sudah benar sebelum menyimpan',
      details: previewDetails,
      showCancel: true,
      confirmText: '✓ Ya, Simpan Data',
      cancelText: '✕ Batal',
      payload: payload, // Untuk debugging (optional)
      onConfirm: () => this.executeSaveData(rawFormData), // Panggil method save
      onCancel: () => {
        console.log('❌ User membatalkan penyimpanan data');
      },
    });
  }

  // ANCHOR EXECUTE SUBMIT
  private async executeSaveData(rawFormData: any): Promise<void> {
    this.isSubmitting.set(true);

    try {
      const response = await lastValueFrom(
        this.timbanganService.addTimbanganData({
          noTiket: rawFormData.noTiket,
          jenisKendaraan: rawFormData.jenisKendaraan,
          noKendaraan: rawFormData.noKendaraan,
          noContainer: rawFormData.noContainer || undefined,
          tipeBahan: rawFormData.tipeBahan,
          namaBarang: rawFormData.namaBarang,
          keteranganBarang: rawFormData.keteranganBarang || undefined,
          namaRelasi: rawFormData.namaRelasi,
          jenisRelasi: rawFormData.jenisRelasi,
          namaSupir: rawFormData.namaSupir,
          tipeTransaksi: rawFormData.tipeTransaksi,
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
      this.showNotification({
        type: 'error',
        title: 'Terjadi Kesalahan',
        message: error?.message || 'Gagal menyimpan data. Silakan coba lagi.',
        confirmText: 'Tutup',
      });
    } finally {
      this.isSubmitting.set(false);
    }
  }
  // ANCHOR END EXECUTE SUBMIT

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
    const tara = this.taraForm.getRawValue().timbanganKedua;
    const selected = this.selectedForTara();

    if (!selected || this.isSubmitting()) return;

    // ✅ Validasi berdasarkan tipe transaksi
    if (selected.tipeTransaksi === 'pembelian' && tara >= selected.timbanganPertama) {
      this.showNotification({
        type: 'error',
        title: 'Input Tidak Valid',
        message: 'Untuk PEMBELIAN, Tara tidak boleh lebih besar atau sama dengan Bruto',
        details: [
          { label: 'Tipe', value: 'PEMBELIAN' },
          { label: 'Bruto (Truk + Barang)', value: `${selected.timbanganPertama} kg` },
          { label: 'Tara (Truk Kosong)', value: `${tara} kg` },
        ],
        confirmText: 'Tutup',
      });
      return;
    }

    if (selected.tipeTransaksi === 'penjualan' && tara <= selected.timbanganPertama) {
      this.showNotification({
        type: 'error',
        title: 'Input Tidak Valid',
        message: 'Untuk PENJUALAN, Tara tidak boleh lebih kecil atau sama dengan Bruto',
        details: [
          { label: 'Tipe', value: 'PENJUALAN' },
          { label: 'Bruto (Truk Kosong)', value: `${selected.timbanganPertama} kg` },
          { label: 'Tara (Truk + Barang)', value: `${tara} kg` },
        ],
        confirmText: 'Tutup',
      });
      return;
    }

    // ✅ Hitung Netto untuk preview
    let nettoSebelumPengurangan = 0;
    if (selected.tipeTransaksi === 'pembelian') {
      nettoSebelumPengurangan = selected.timbanganPertama - tara;
    } else {
      nettoSebelumPengurangan = tara - selected.timbanganPertama;
    }

    // ✅ Prepare details untuk preview
    let previewDetails: Array<{ label: string; value: string | number }> = [
      { label: 'Nomor Bon', value: selected.noTiket },
      {
        label: 'Tipe Transaksi',
        value: selected.tipeTransaksi === 'pembelian' ? 'PEMBELIAN' : 'PENJUALAN',
      },
      { label: 'No. Kendaraan', value: selected.noKendaraan },
      { label: 'Nama Barang', value: selected.namaBarang },
    ];

    if (selected.tipeTransaksi === 'pembelian') {
      previewDetails.push(
        { label: 'Bruto (Truk + Barang)', value: `${selected.timbanganPertama} kg` },
        { label: 'Tara (Truk Kosong)', value: `${tara} kg` },
        { label: 'Netto Kotor', value: `${nettoSebelumPengurangan.toFixed(2)} kg` },
      );

      if (selected.tipeBahan === 'bahan-baku' && selected.hasilUjiKelembapan) {
        const kelembapan = selected.hasilUjiKelembapan.claimPercentage;
        const pengurangan = nettoSebelumPengurangan * (kelembapan / 100);
        const nettoAkhir = nettoSebelumPengurangan - pengurangan;

        previewDetails.push(
          { label: 'Kelembapan', value: `${kelembapan.toFixed(2)}%` },
          { label: 'Pengurangan', value: `${pengurangan.toFixed(2)} kg` },
          { label: 'Netto Final', value: `${nettoAkhir.toFixed(2)} kg` },
        );
      }
    } else {
      previewDetails.push(
        { label: 'Bruto (Truk Kosong)', value: `${selected.timbanganPertama} kg` },
        { label: 'Tara (Truk + Barang)', value: `${tara} kg` },
        { label: 'Netto', value: `${nettoSebelumPengurangan.toFixed(2)} kg` },
      );
    }

    // ✅ TAMPILKAN MODAL KONFIRMASI
    this.showNotification({
      type: 'preview',
      title: 'Konfirmasi Data Timbangan Kedua',
      message: 'Pastikan berat tara sudah sesuai sebelum menyimpan',
      details: previewDetails,
      showCancel: true,
      confirmText: '✓ Ya, Simpan Tara',
      cancelText: '✕ Batal',
      payload: {
        timbangan_masuk_id: selected.id,
        berat_tara: String(tara),
      },
      onConfirm: () => this.executeSubmitTara(selected, tara),
      onCancel: () => {
        console.log('❌ User membatalkan input tara');
      },
    });
  }

  // ANCHOR END REVIEW TARA

  // ANCHOR EXCECUTE SUBMIT TARA
  private async executeSubmitTara(selected: TimbanganData, tara: number): Promise<void> {
    this.isSubmitting.set(true);

    try {
      const response = await lastValueFrom(this.timbanganService.updateTaraData(selected.id, tara));

      if (!response.success) {
        throw new Error(response.message || 'Gagal menyimpan data Tara');
      }

      console.log('✅ Tara saved successfully:', response.message);
      await this.delay(500);

      // Hitung netto
      let nettoSebelumPengurangan = 0;
      if (selected.tipeTransaksi === 'pembelian') {
        nettoSebelumPengurangan = selected.timbanganPertama - tara;
      } else {
        nettoSebelumPengurangan = tara - selected.timbanganPertama;
      }

      // Build details untuk notifikasi sukses
      let details: Array<{ label: string; value: string | number }> = [];
      if (selected.tipeTransaksi === 'pembelian') {
        if (selected.tipeBahan === 'bahan-baku' && selected.hasilUjiKelembapan) {
          const kelembapan = selected.hasilUjiKelembapan.claimPercentage;
          const pengurangan = nettoSebelumPengurangan * (kelembapan / 100);
          const nettoAkhir = nettoSebelumPengurangan - pengurangan;

          details = [
            { label: 'Tipe', value: 'PEMBELIAN' },
            { label: 'Bruto (Truk + Barang)', value: `${selected.timbanganPertama} kg` },
            { label: 'Tara (Truk Kosong)', value: `${tara} kg` },
            { label: 'Netto Kotor', value: `${nettoSebelumPengurangan.toFixed(2)} kg` },
            { label: 'Kelembapan', value: `${kelembapan.toFixed(2)}%` },
            { label: 'Pengurangan', value: `${pengurangan.toFixed(2)} kg` },
            { label: 'Netto Final', value: `${nettoAkhir.toFixed(2)} kg` },
          ];
        } else {
          details = [
            { label: 'Tipe', value: 'PEMBELIAN' },
            { label: 'Bruto (Truk + Barang)', value: `${selected.timbanganPertama} kg` },
            { label: 'Tara (Truk Kosong)', value: `${tara} kg` },
            { label: 'Netto', value: `${nettoSebelumPengurangan.toFixed(2)} kg` },
          ];
        }
      } else {
        details = [
          { label: 'Tipe', value: 'PENJUALAN' },
          { label: 'Bruto (Truk Kosong)', value: `${selected.timbanganPertama} kg` },
          { label: 'Tara (Truk + Barang)', value: `${tara} kg` },
          { label: 'Netto', value: `${nettoSebelumPengurangan.toFixed(2)} kg` },
        ];
      }

      this.closeTaraModal();

      // Tampilkan konfirmasi cetak slip
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
      this.showNotification({
        type: 'error',
        title: 'Terjadi Kesalahan',
        message: error?.message || 'Gagal menyimpan data Tara. Silakan coba lagi.',
        confirmText: 'Tutup',
      });
    } finally {
      this.isSubmitting.set(false);
    }
  }
  // ANCHOR END EXCECUTE SUBMIT TARA

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
      keteranganBarang: '',
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

  /**
   * ✅ METHOD GENERATE PRINT SLIP - FULL UPDATED VERSION
   * Copy-paste method ini ke timbangan-masuk.component.ts
   * Ganti method generatePrintSlip yang lama dengan yang ini
   */

  private generatePrintSlip(data: TimbanganData): void {
    console.log('📄 Generating print slip with data:', data);

    // ========================================
    // ✅ STEP 1: AMBIL DATA DARI hasilTara
    // ========================================
    const beratBrutoAPI = parseFloat(data.hasilTara?.beratBruto || '0');
    const beratTaraAPI = parseFloat(data.hasilTara?.beratTara || '0');

    // ========================================
    // ✅ STEP 2: SWAP LOGIC - Bruto HARUS lebih besar dari Tara
    // ========================================
    const bruto = Math.max(beratBrutoAPI, beratTaraAPI);
    const tara = Math.min(beratBrutoAPI, beratTaraAPI);

    console.log('🔄 Weight Assignment:', {
      fromAPI: { beratBruto: beratBrutoAPI, beratTara: beratTaraAPI },
      assigned: { bruto, tara },
      swapped: beratBrutoAPI < beratTaraAPI,
    });

    // ========================================
    // ✅ STEP 3: HITUNG NETTO KOTOR
    // ========================================
    const beratNetto = bruto - tara;

    // ========================================
    // ✅ STEP 4: AMBIL DATA POTONGAN
    // ========================================
    const claimPercentage = data.hasilUjiKelembapan?.claimPercentage || 0;
    const potonganSampahKg = parseInt(data.hasilUjiKelembapan?.potonganSampah || '0');

    // ========================================
    // ✅ STEP 5: HITUNG POTONGAN BASAH (dalam KG)
    // ========================================
    const potonganBasahKg = beratNetto * (claimPercentage / 100);

    // ========================================
    // ✅ STEP 6: HITUNG NETTO SETELAH POTONG BASAH
    // ========================================
    const nettoSetelahPotongBasah = beratNetto - potonganBasahKg;

    // ========================================
    // ✅ STEP 7: HITUNG NETTO AKHIR (setelah potong sampah)
    // ========================================
    const nettoAkhir = nettoSetelahPotongBasah - potonganSampahKg;

    console.log('📊 Calculation Summary:', {
      bruto: bruto + ' kg',
      tara: tara + ' kg',
      beratNetto: beratNetto.toFixed(2) + ' kg',
      claimPercentage: claimPercentage + '%',
      potonganBasahKg: potonganBasahKg.toFixed(2) + ' kg',
      nettoSetelahPotongBasah: nettoSetelahPotongBasah.toFixed(2) + ' kg',
      potonganSampahKg: potonganSampahKg + ' kg',
      nettoAkhir: nettoAkhir.toFixed(2) + ' kg',
    });

    // ========================================
    // FORMAT TANGGAL DAN WAKTU
    // ========================================
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

    const dateKeluar = data.updatedAt ? new Date(data.updatedAt) : new Date();
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

    // ========================================
    // DETEKSI TIPE TRANSAKSI
    // ========================================
    let isPenjualan = false;
    if (data.tipeTransaksi) {
      isPenjualan = data.tipeTransaksi === 'penjualan';
    } else {
      isPenjualan = !!(
        data.namaRelasi &&
        data.namaRelasi !== '---' &&
        data.namaRelasi.trim() !== ''
      );
    }

    // ========================================
    // DATA LAINNYA
    // ========================================
    const namaBarangDisplay = data.namaBarang || '-';
    const supplierCustomer = data.namaRelasi || '-';
    const noContainer = data.noContainer || '-';
    const showKeteranganBarang =
      data.tipeBahan === 'lainnya' && data.namaBarang === 'DAN LAIN-LAIN' && data.keteranganBarang;

    // ========================================
    // ✅ WEIGHT SECTION - DYNAMIC HTML
    // ========================================
    let weightSectionHTML = '';

    // Cek apakah ada potongan
    const adaPotongan = potonganBasahKg > 0 || potonganSampahKg > 0;

    if (adaPotongan) {
      // ========================================
      // DENGAN POTONGAN (Basah dan/atau Sampah)
      // ========================================
      weightSectionHTML = `
<!-- Weight Section - DENGAN POTONGAN -->
<table class="weight-table">
  <tr>
    <td class="weight-label">Berat Bruto</td>
    <td class="weight-separator">:</td>
    <td class="weight-value">${bruto.toFixed(0)} kg</td>
  </tr>
  <tr>
    <td class="weight-label">Berat Tarra</td>
    <td class="weight-separator">:</td>
    <td class="weight-value">${tara.toFixed(0)} kg</td>
  </tr>
  <tr>
    <td class="weight-label">Berat Netto</td>
    <td class="weight-separator">:</td>
    <td class="weight-value">${beratNetto.toFixed(0)} kg</td>
  </tr>
  ${
    potonganBasahKg > 0
      ? `
  <tr>
    <td class="weight-label">Potong Basah</td>
    <td class="weight-separator">:</td>
    <td class="weight-value">${potonganBasahKg.toFixed(2)} kg (${claimPercentage.toFixed(2)}%)</td>
  </tr>`
      : ''
  }
  ${
    potonganSampahKg > 0
      ? `
  <tr>
    <td class="weight-label">Potong Sampah</td>
    <td class="weight-separator">:</td>
    <td class="weight-value">${potonganSampahKg.toFixed(0)} kg</td>
  </tr>`
      : ''
  }
  <tr class="weight-result-row">
    <td class="weight-label-result">Berat Netto Akhir</td>
    <td class="weight-separator">:</td>
    <td class="weight-value-result">${nettoAkhir.toFixed(0)} kg</td>
  </tr>
</table>`;
    } else {
      // ========================================
      // TANPA POTONGAN
      // ========================================
      weightSectionHTML = `
<!-- Weight Section - TANPA POTONGAN -->
<table class="weight-table">
  <tr>
    <td class="weight-label">Berat Bruto</td>
    <td class="weight-separator">:</td>
    <td class="weight-value">${bruto.toFixed(0)} kg</td>
  </tr>
  <tr>
    <td class="weight-label">Berat Tarra</td>
    <td class="weight-separator">:</td>
    <td class="weight-value">${tara.toFixed(0)} kg</td>
  </tr>
  <tr class="weight-result-row">
    <td class="weight-label-result">Berat Netto</td>
    <td class="weight-separator">:</td>
    <td class="weight-value-result">${beratNetto.toFixed(0)} kg</td>
  </tr>
</table>`;
    }

    // ========================================
    // HTML TEMPLATE UNTUK PRINT
    // ========================================
    const printContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Slip Timbangan - ${data.noTiket}</title>
  <style>
    @page {
      size: 105mm 195mm;
      margin: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      margin: 0;
      padding: 0;
    }

    body {
      font-family: Arial, sans-serif;
      line-height: 1;
      width: 105mm;
      min-height: 195mm;
      background: white;
      color: #000;
      padding: 2mm 3mm 3mm 3mm;
      margin: 0;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-content: flex-start;
    }

    .header {
      text-align: center;
      margin-bottom: 2mm;
      padding-bottom: 1mm;
      margin-top: 0;
      padding-top: 0;
    }

    .title {
      font-weight: bold;
      font-size: 18px;
      letter-spacing: 1px;
      margin-bottom: 0.5mm;
    }

    .subtitle {
      font-size: 14px;
      letter-spacing: 0.5px;
      margin-bottom: 5mm;
    }

    .divider {
      border-top: 1px solid #000;
      margin: 2mm 0;
    }

    .double-divider {
      border-top: 2px solid #000;
      margin: 2.5mm 0;
    }

    .row {
      display: flex;
      margin-bottom: 1.5mm;
      font-size: 16px;
      line-height: 1.4;
    }

    .row-label {
      width: 35%;
      font-size: 14px;
    }

    .row-separator {
      width: 5%;
      font-size: 16px;
    }

    .row-value {
      width: 60%;
      word-wrap: break-word;
      font-size: 14px;
    }

    .weight-table {
      width: 100%;
      border-collapse: collapse;
      margin: 3mm 0;
      padding: 0;
    }

    .weight-table tr {
      margin-bottom: 2mm;
    }

    .weight-label {
      width: 45%;
      text-align: left;
      font-weight: 700;
      font-size: 14px;
      padding: 1mm 0;
      vertical-align: top;
    }

    .weight-separator {
      width: 5%;
      text-align: center;
      font-size: 14px;
      padding: 1mm 0;
      vertical-align: top;
    }

    .weight-value {
      width: 50%;
      text-align: left;
      font-weight: 600;
      font-size: 14px;
      padding: 1mm 0;
      vertical-align: top;
    }

    .weight-result-row {
      border-top: 2px solid #000;
    }

    .weight-label-result {
      width: 45%;
      text-align: left;
      font-weight: 800;
      font-size: 15px;
      padding: 2mm 0 1mm 0;
      vertical-align: top;
    }

    .weight-value-result {
      width: 50%;
      text-align: left;
      font-weight: 800;
      font-size: 15px;
      padding: 2mm 0 1mm 0;
      vertical-align: top;
    }

    .signature-section {
      margin-top: 4mm;
      display: flex;
      justify-content: space-between;
      padding: 0 2mm;
    }

    .signature-box {
      width: 47%;
      text-align: center;
      font-size: 14px;
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
      font-size: 12px;
      margin-top: 1.5mm;
    }

    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      body {
        padding: 2mm 3mm 3mm 3mm !important;
      }

      @page {
        margin: 0 !important;
      }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="title">PT AGRO DELI SERDANG</div>
    <div class="subtitle">DUSUN VII, DALU Sepuluh-A</div>
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

    ${
      showKeteranganBarang
        ? `
    <div class="row">
      <span class="row-label">Keterangan</span>
      <span class="row-separator">:</span>
      <span class="row-value">${data.keteranganBarang}</span>
    </div>
    `
        : ''
    }

    <div class="row">
      <span class="row-label">${isPenjualan ? 'Customer' : 'Supplier'}</span>
      <span class="row-separator">:</span>
      <span class="row-value">${supplierCustomer}</span>
    </div>
  </div>

  <!-- Weight Section - DYNAMIC TABLE -->
  ${weightSectionHTML}

  <!-- Signature Section -->
  <div class="signature-section">
    <div class="signature-box">
      <div class="signature-label">Ditimbang</div>
      <div class="signature-line"></div>
      <div class="signature-name">(&nbsp;${data.namaPenimbang}&nbsp;)</div>
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

    // ========================================
    // OPEN PRINT WINDOW
    // ========================================
    const printWindow = window.open('', '_blank', 'width=420,height=660');

    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      console.log('✅ Print window opened successfully');
    } else {
      console.error('❌ Failed to open print window - popup blocked');
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
