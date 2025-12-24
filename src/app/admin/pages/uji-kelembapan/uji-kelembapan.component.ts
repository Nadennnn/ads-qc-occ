// src/app/admin/pages/uji-kelembapan/uji-kelembapan.component.ts

import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, Subject, takeUntil } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { ModalService } from '../../services/modal.service';

// Interface untuk response API dari backend
interface BahanBakuApiResponse {
  id: number;
  nomor_bon: string;
  jenis_kendaraan: string;
  nomor_kendaraan: string;
  nomor_container: string | null;
  type_bahan: string;
  barang: string;
  keterangan_barang: string | null;
  customer: string | null;
  suplier: string | null;
  supir: string;
  berat_bruto: string;
  berat_netto: string | null;
  petugas: string;
  status: string;
  is_finished: string;
  created_at: string;
  updated_at: string;
  tara?: {
    id: number;
    berat_bruto: string;
    berat_tara: string;
    potongan_moisture: string;
    berat_netto: string;
    potongan_sampah: string;
  };
  uji_kelembapan?: {
    id: number;
    jumlah_ball: string;
    total_moisture: string;
    avg_moisture: string;
    nilai_claim: string;
    berat_bruto: string;
    berat_netto: string;
    potongan_sampah: string;
  };
  titik?: Array<{
    id: number;
    titik: string;
    nilai: string;
  }>;
}

interface MoistureResults {
  totalMoisture: number;
  averageMoisture: number;
  claimPercentage: number;
  beratBahan: number;
  netto: number;
  pointsChecked: number;
}

@Component({
  selector: 'app-uji-kelembapan',
  templateUrl: './uji-kelembapan.component.html',
  styleUrls: ['./uji-kelembapan.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class UjiKelembapanComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Tab Management
  activeTab: 'new' | 'edit' = 'new';

  // List data dari API
  bahanBakuList: BahanBakuApiResponse[] = [];
  bahanBakuEditList: BahanBakuApiResponse[] = [];
  selectedData: BahanBakuApiResponse | null = null;
  showForm = false;
  isEditMode = false;
  editingUjiId: number | null = null;

  // Loading & Error states
  isLoading = false;
  isLoadingList = false;
  isLoadingEditList = false;
  isSaving = false;
  errorMessage = '';
  errorMessageEdit = '';

  // Form Data
  formData = {
    noKendaraan: '',
    noSlipTimbang: '',
    tanggal: new Date().toISOString().split('T')[0],
    supplier: '',
    jenisBarang: '',
    jumlahBall: '',
    beratBahan: '',
    potonganSampah: '0',
  };

  // Moisture Points (80 points)
  moisturePoints: string[] = Array(80).fill('');

  // Results
  results: MoistureResults | null = null;

  // Constants
  readonly STANDARD_MOISTURE = 15;

  // Helper array for grid display
  get pointsArray(): number[] {
    return Array(80)
      .fill(0)
      .map((_, i) => i);
  }

  constructor(
    private router: Router,
    private apiService: ApiService,
    private modalService: ModalService,
  ) {}

  ngOnInit(): void {
    this.loadBahanBakuList();
    this.loadBahanBakuEditList();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Switch between tabs
   */
  switchTab(tab: 'new' | 'edit'): void {
    this.activeTab = tab;
    if (this.showForm) {
      this.backToList();
    }
  }

  /**
   * Load daftar bahan baku untuk input baru
   */
  private loadBahanBakuList(): void {
    this.isLoadingList = true;
    this.errorMessage = '';

    this.apiService
      .get<BahanBakuApiResponse[]>('daftar-bahan-baku')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isLoadingList = false)),
      )
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.bahanBakuList = response.data.filter(
              (item) => item.status === 'Belum Diuji' && item.type_bahan === 'Bahan Baku',
            );
          } else {
            this.errorMessage = 'Gagal memuat data';
          }
        },
        error: (error) => {
          console.error('Error loading bahan baku:', error);
          this.errorMessage = error.message || 'Gagal memuat data bahan baku';
        },
      });
  }

  /**
   * Load daftar bahan baku untuk edit (sudah diuji)
   */
  private loadBahanBakuEditList(): void {
    this.isLoadingEditList = true;
    this.errorMessageEdit = '';

    this.apiService
      .get<BahanBakuApiResponse[]>('daftar-tara-selesai')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isLoadingEditList = false)),
      )
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.bahanBakuEditList = response.data.filter(
              (item) => item.type_bahan === 'Bahan Baku' && item.uji_kelembapan,
            );
            console.log('Loaded edit list:', this.bahanBakuEditList);
          } else {
            this.errorMessageEdit = 'Gagal memuat data';
          }
        },
        error: (error) => {
          console.error('Error loading edit list:', error);
          this.errorMessageEdit = error.message || 'Gagal memuat data untuk edit';
        },
      });
  }

  /**
   * Refresh list data
   */
  refreshList(): void {
    if (this.activeTab === 'new') {
      this.loadBahanBakuList();
    } else {
      this.loadBahanBakuEditList();
    }
  }

  /**
   * Select data untuk uji kelembapan baru
   */
  selectData(data: BahanBakuApiResponse): void {
    this.selectedData = data;
    this.showForm = true;
    this.isEditMode = false;
    this.editingUjiId = null;

    this.formData = {
      noKendaraan: data.nomor_kendaraan || '',
      noSlipTimbang: data.nomor_bon || '',
      tanggal: new Date(data.created_at).toISOString().split('T')[0],
      supplier: data.suplier || '',
      jenisBarang: data.barang || '',
      jumlahBall: '',
      beratBahan: data.berat_bruto || '0',
      potonganSampah: '0',
    };

    this.moisturePoints = Array(80).fill('');
    this.results = null;

    setTimeout(() => {
      document.getElementById('form-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  /**
   * Select data untuk edit uji kelembapan
   */
  selectDataForEdit(data: BahanBakuApiResponse): void {
    if (!data.uji_kelembapan) {
      this.modalService.confirm({
        title: 'Data Tidak Lengkap',
        message: 'Data uji kelembapan tidak ditemukan',
        icon: 'warning',
        type: 'warning',
        confirmText: 'OK',
        cancelText: 'Tutup',
      });
      return;
    }

    this.selectedData = data;
    this.showForm = true;
    this.isEditMode = true;
    this.editingUjiId = data.uji_kelembapan.id;

    // Populate form dengan data existing
    this.formData = {
      noKendaraan: data.nomor_kendaraan || '',
      noSlipTimbang: data.nomor_bon || '',
      tanggal: new Date(data.created_at).toISOString().split('T')[0],
      supplier: data.suplier || '',
      jenisBarang: data.barang || '',
      jumlahBall: data.uji_kelembapan.jumlah_ball || '0',
      beratBahan: data.uji_kelembapan.berat_bruto || '0',
      potonganSampah: data.uji_kelembapan.potongan_sampah || '0',
    };

    // Populate moisture points dari data existing
    this.moisturePoints = Array(80).fill('');
    if (data.titik && data.titik.length > 0) {
      data.titik.forEach((point) => {
        const index = parseInt(point.titik) - 1;
        if (index >= 0 && index < 80) {
          this.moisturePoints[index] = point.nilai;
        }
      });
    }

    // Parse dan set results dari data existing
    const avgMoisture = parseFloat(data.uji_kelembapan.avg_moisture.replace('%', ''));
    const claimValue = parseFloat(data.uji_kelembapan.nilai_claim.replace('%', ''));
    const totalMoisture = parseFloat(data.uji_kelembapan.total_moisture.replace('%', ''));

    this.results = {
      totalMoisture: totalMoisture,
      averageMoisture: avgMoisture,
      claimPercentage: claimValue,
      beratBahan: parseFloat(data.uji_kelembapan.berat_bruto),
      netto: parseFloat(data.uji_kelembapan.berat_netto),
      pointsChecked: data.titik?.length || 0,
    };

    setTimeout(() => {
      document.getElementById('form-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  backToList(): void {
    this.showForm = false;
    this.selectedData = null;
    this.isEditMode = false;
    this.editingUjiId = null;
    this.resetForm();
  }

  async calculateResults(): Promise<boolean> {
    if (!this.formData.supplier || !this.formData.jenisBarang) {
      await this.modalService.confirm({
        title: 'Data Tidak Lengkap',
        message: 'Harap lengkapi data supplier dan jenis barang',
        icon: 'warning',
        type: 'warning',
        confirmText: 'OK',
        cancelText: 'Tutup',
      });
      return false;
    }

    if (!this.formData.beratBahan || parseFloat(this.formData.beratBahan) <= 0) {
      await this.modalService.confirm({
        title: 'Berat Bahan Kosong',
        message: 'Harap isi Berat Bahan terlebih dahulu',
        icon: 'warning',
        type: 'warning',
        confirmText: 'OK',
        cancelText: 'Tutup',
      });
      return false;
    }

    const filledPoints = this.moisturePoints
      .filter((point) => point !== '' && !isNaN(parseFloat(point)))
      .map((point) => parseFloat(point));

    if (filledPoints.length === 0) {
      await this.modalService.confirm({
        title: 'Tidak Ada Data Moisture',
        message: 'Harap isi minimal satu titik pengukuran moisture',
        icon: 'warning',
        type: 'warning',
        confirmText: 'OK',
        cancelText: 'Tutup',
      });
      return false;
    }

    if (filledPoints.length < 10) {
      const proceed = await this.modalService.confirm({
        title: 'Titik Pengukuran Kurang',
        message: `Hanya ${filledPoints.length} titik yang terisi. Minimal 10 titik direkomendasikan.`,
        icon: 'warning',
        type: 'warning',
        confirmText: 'Lanjutkan',
        cancelText: 'Batal',
      });

      if (!proceed) return false;
    }

    if (!this.formData.jumlahBall || parseInt(this.formData.jumlahBall) < 0) {
      const proceed = await this.modalService.confirm({
        title: 'Jumlah Ball Kosong',
        message: 'Jumlah Ball belum diisi. Lanjutkan dengan 0?',
        icon: 'warning',
        type: 'warning',
        confirmText: 'Ya, Lanjutkan',
        cancelText: 'Batal',
      });

      if (!proceed) return false;
      this.formData.jumlahBall = '0';
    }

    const invalidPoints = filledPoints.filter((p) => p < 5 || p > 30);
    if (invalidPoints.length > 0) {
      const proceed = await this.modalService.confirm({
        title: 'Nilai Tidak Wajar Terdeteksi',
        message: `Ada ${invalidPoints.length} titik dengan nilai tidak wajar: ${invalidPoints.join(', ')}%`,
        icon: 'warning',
        type: 'warning',
        confirmText: 'Lanjutkan',
        cancelText: 'Batal',
      });

      if (!proceed) return false;
    }

    const totalMoisture = filledPoints.reduce((sum, val) => sum + val, 0);
    const averageMoisture = totalMoisture / filledPoints.length;
    const claimPercentage = averageMoisture - this.STANDARD_MOISTURE;
    const beratBahan = parseFloat(this.formData.beratBahan);

    let netto: number;
    if (claimPercentage <= 0) {
      netto = beratBahan;
    } else {
      netto = beratBahan - beratBahan * (claimPercentage / 100);
    }

    this.results = {
      totalMoisture: parseFloat(totalMoisture.toFixed(2)),
      averageMoisture: parseFloat(averageMoisture.toFixed(2)),
      claimPercentage: parseFloat(claimPercentage.toFixed(2)),
      beratBahan: parseFloat(beratBahan.toFixed(2)),
      netto: parseFloat(netto.toFixed(2)),
      pointsChecked: filledPoints.length,
    };

    return true;
  }

  /**
   * Save atau Update hasil uji kelembapan
   */
  async saveResults(): Promise<void> {
    // Recalculate dulu supaya hasil selalu up-to-date
    const ok = await this.calculateResults();
    if (!ok) {
      // Validasi gagal / user batal → jangan lanjut simpan
      return;
    }

    if (!this.results || !this.selectedData) {
      await this.modalService.confirm({
        title: 'Hasil Belum Dihitung',
        message: 'Harap hitung hasil terlebih dahulu',
        icon: 'warning',
        type: 'warning',
        confirmText: 'OK',
        cancelText: 'Tutup',
      });
      return;
    }

    const actionText = this.isEditMode ? 'mengupdate' : 'menyimpan';
    const confirmed = await this.modalService.confirm({
      title: `Konfirmasi ${this.isEditMode ? 'Update' : 'Simpan'} Data`,
      message: `Apakah Anda yakin ingin ${actionText} hasil uji kelembapan ini?`,
      details: [
        { label: 'Kelembapan Rata-rata', value: `${this.results.averageMoisture}%` },
        { label: 'Standar', value: `${this.STANDARD_MOISTURE}%` },
        {
          label: 'Selisih',
          value: `${this.results.claimPercentage > 0 ? '+' : ''}${this.results.claimPercentage}%`,
        },
        { label: 'Berat Netto', value: `${this.results.netto} kg` },
      ],
      icon: 'save',
      type: 'info',
      confirmText: `Ya, ${this.isEditMode ? 'Update' : 'Simpan'}`,
      cancelText: 'Batal',
    });

    if (!confirmed) return;

    this.isSaving = true;

    const titikArray = this.moisturePoints
      .map((value, index) => ({
        titik: index + 1,
        value: value !== '' && !isNaN(parseFloat(value)) ? parseFloat(value) : null,
      }))
      .filter((item) => item.value !== null);

    const payload = {
      jumlah_ball: parseInt(this.formData.jumlahBall) || 0,
      total_moisture: `${this.results.totalMoisture}%`,
      avg_moisture: `${this.results.averageMoisture}%`,
      nilai_claim: `${this.results.claimPercentage > 0 ? '+' : ''}${this.results.claimPercentage}%`,
      berat_bruto: parseFloat(this.formData.beratBahan),
      berat_netto: this.results.netto,
      potongan_sampah: parseFloat(this.formData.potonganSampah) || 0,
      titik: titikArray,
    };

    // Jika edit mode, tambahkan timbangan_masuk_id untuk endpoint insert
    // atau gunakan endpoint update dengan ID
    const endpoint = this.isEditMode
      ? `update-uji-kelembapan/${this.editingUjiId}`
      : 'insert-uji-kelembapan';

    const apiMethod = this.isEditMode ? 'put' : 'post';

    // Untuk insert, perlu timbangan_masuk_id
    if (!this.isEditMode) {
      (payload as any).timbangan_masuk_id = this.selectedData.id;
    }

    console.log('Payload yang dikirim:', payload);

    this.apiService[apiMethod](endpoint, payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isSaving = false)),
      )
      .subscribe({
        next: async (response) => {
          if (response.success) {
            await this.modalService.confirm({
              title: `Berhasil ${this.isEditMode ? 'Diupdate' : 'Disimpan'}!`,
              message: `Hasil uji kelembapan berhasil ${this.isEditMode ? 'diupdate' : 'disimpan'} ke database`,
              details: [
                { label: 'Kelembapan Rata-rata', value: `${this.results!.averageMoisture}%` },
                { label: 'Standar', value: `${this.STANDARD_MOISTURE}%` },
                {
                  label: 'Selisih',
                  value: `${this.results!.claimPercentage > 0 ? '+' : ''}${this.results!.claimPercentage}%`,
                },
                { label: 'Berat Netto', value: `${this.results!.netto} kg` },
              ],
              icon: 'success',
              type: 'success',
              confirmText: 'OK',
              cancelText: 'Tutup',
            });
            this.backToList();
            this.refreshList();
            if (this.isEditMode) {
              this.loadBahanBakuEditList();
            }
          } else {
            await this.modalService.confirm({
              title: 'Gagal Menyimpan',
              message: response.message || 'Terjadi kesalahan saat menyimpan data',
              icon: 'danger',
              type: 'danger',
              confirmText: 'OK',
              cancelText: 'Tutup',
            });
          }
        },
        error: async (error) => {
          console.error('Error saving hasil uji:', error);
          await this.modalService.confirm({
            title: 'Error',
            message: error.message || 'Terjadi kesalahan saat menyimpan hasil',
            icon: 'danger',
            type: 'danger',
            confirmText: 'OK',
            cancelText: 'Tutup',
          });
        },
      });
  }

  resetForm(): void {
    this.formData = {
      noKendaraan: '',
      noSlipTimbang: '',
      tanggal: new Date().toISOString().split('T')[0],
      supplier: '',
      jenisBarang: '',
      jumlahBall: '',
      beratBahan: '',
      potonganSampah: '0',
    };
    this.moisturePoints = Array(80).fill('');
    this.results = null;
  }

  exportToJson(): void {
    if (!this.results) {
      alert('Harap hitung hasil terlebih dahulu');
      return;
    }

    const exportData = {
      bahanBakuId: this.selectedData?.id,
      formData: this.formData,
      moisturePoints: this.moisturePoints
        .map((point, index) => ({
          titik: index + 1,
          nilai: point !== '' ? parseFloat(point) : null,
        }))
        .filter((p) => p.nilai !== null),
      results: this.results,
      timestamp: new Date().toISOString(),
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `moisture_check_${new Date().getTime()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  printReport(): void {
    if (!this.results) {
      alert('Harap hitung hasil terlebih dahulu');
      return;
    }

    document.body.classList.add('printing');

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('printing');
      }, 100);
    }, 100);
  }

  getFilledPoints(): Array<{ index: number; value: string }> {
    return this.moisturePoints
      .map((value, index) => ({ index: index + 1, value }))
      .filter((point) => point.value !== '');
  }

  getClaimClass(): string {
    if (!this.results) return '';
    return this.results.claimPercentage > 0
      ? 'bg-red-50 border-red-200'
      : 'bg-green-50 border-green-200';
  }

  getPengurangan(): string {
    if (!this.results) return '0.00';
    return (this.results.beratBahan - this.results.netto).toFixed(2);
  }

  getStatusBadgeClass(status: string): string {
    if (status === 'Sudah Diuji') return 'bg-green-100 text-green-800';
    return 'bg-yellow-100 text-yellow-800';
  }

  getStatusText(status: string): string {
    return status || 'Belum Diuji';
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

  navigateTo(path: string): void {
    if (path === 'menu-utama') {
      this.router.navigate(['dashboards']);
    }
  }

  validateMoistureInput(event: any, index: number): void {
    const value = parseFloat(event.target.value);
    if (!isNaN(value) && (value < 0 || value > 100)) {
      this.moisturePoints[index] = '';
      alert('Nilai moisture harus antara 0-100%');
    }
  }

  isInvalidMoisture(index: number): boolean {
    const value = parseFloat(this.moisturePoints[index]);
    return !isNaN(value) && (value < 0 || value > 100);
  }

  async fillSampleData(): Promise<void> {
    const confirmed = await this.modalService.confirm({
      title: 'Isi Data Sample',
      message: 'Isi dengan data sample untuk testing?',
      icon: 'info',
      type: 'info',
      confirmText: 'Ya, Isi',
      cancelText: 'Batal',
    });

    if (confirmed) {
      for (let i = 0; i < 20; i++) {
        this.moisturePoints[i] = (14 + Math.random() * 4).toFixed(1);
      }
    }
  }
}
