// src/app/admin/pages/uji-kelembapan/uji-kelembapan.component.ts

import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { finalize, Subject, takeUntil } from 'rxjs';
import { ApiService } from '../../services/api.service';

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
  status: string; // "Belum Diuji" | "Sudah Diuji"
  is_finished: string; // "0" | "1"
  created_at: string;
  updated_at: string;
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

  // List data dari API
  bahanBakuList: BahanBakuApiResponse[] = [];
  selectedData: BahanBakuApiResponse | null = null;
  showForm = false;
  isEdit: boolean = false;

  // Loading & Error states
  isLoading = false;
  isLoadingList = false;
  isSaving = false;
  errorMessage = '';

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
  ) {}

  ngOnInit(): void {
    this.loadBahanBakuList();

    this.showForm = false;
    this.isEdit = false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load daftar bahan baku dari API
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
            // Filter hanya yang belum diuji (status "Belum Diuji")
            this.bahanBakuList = response.data.filter(
              (item) => item.status === 'Belum Diuji' && item.type_bahan === 'Bahan Baku',
            );
            console.log('Loaded bahan baku list:', this.bahanBakuList);
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
   * Refresh list data
   */
  refreshList(): void {
    this.loadBahanBakuList();
  }

  /**
   * Select data untuk uji kelembapan
   */
  selectData(data: BahanBakuApiResponse): void {
    this.selectedData = data;
    this.showForm = true;

    // Populate form dengan data dari API
    this.formData = {
      noKendaraan: data.nomor_kendaraan || '',
      noSlipTimbang: data.nomor_bon || '',
      tanggal: new Date(data.created_at).toISOString().split('T')[0],
      supplier: data.suplier || '',
      jenisBarang: data.barang || '',
      jumlahBall: '',
      beratBahan: data.berat_bruto || '0',
      potonganSampah: '0', // ← TAMBAHKAN INI
    };

    // Reset moisture points
    this.moisturePoints = Array(80).fill('');
    this.results = null;

    // Scroll to form
    setTimeout(() => {
      document.getElementById('form-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  // editData(data: BahanBakuApiResponse) {
  //   this.isEdit = true;
  //   this.showForm = true;
  // }

  backToList(): void {
    this.showForm = false;
    this.selectedData = null;
    this.resetForm();
  }

  calculateResults(): void {
    // Validate form completeness
    if (!this.formData.supplier || !this.formData.jenisBarang) {
      alert('Harap lengkapi data supplier dan jenis barang');
      return;
    }

    // Validate berat bahan
    if (!this.formData.beratBahan || parseFloat(this.formData.beratBahan) <= 0) {
      alert('Harap isi Berat Bahan terlebih dahulu');
      return;
    }

    // Filter only filled moisture points
    const filledPoints = this.moisturePoints
      .filter((point) => point !== '' && !isNaN(parseFloat(point)))
      .map((point) => parseFloat(point));

    // Validate minimum points
    if (filledPoints.length === 0) {
      alert('Harap isi minimal satu titik pengukuran moisture');
      return;
    }

    // Validate minimum 10 points
    if (filledPoints.length < 10) {
      if (
        !confirm(
          `Hanya ${filledPoints.length} titik yang terisi. Minimal 10 titik direkomendasikan.\n\nLanjutkan perhitungan?`,
        )
      ) {
        return;
      }
    }

    // NEW: Validate jumlah ball
    if (!this.formData.jumlahBall || parseInt(this.formData.jumlahBall) < 0) {
      if (!confirm('Jumlah Ball belum diisi. Lanjutkan dengan 0?')) {
        return;
      }
      this.formData.jumlahBall = '0';
    }

    // Validate moisture range (5-30%)
    const invalidPoints = filledPoints.filter((p) => p < 5 || p > 30);
    if (invalidPoints.length > 0) {
      if (
        !confirm(
          `Ada ${invalidPoints.length} titik dengan nilai tidak wajar.\n` +
            `Nilai: ${invalidPoints.join(', ')}%\n\n` +
            `Lanjutkan perhitungan?`,
        )
      ) {
        return;
      }
    }

    const totalMoisture = filledPoints.reduce((sum, val) => sum + val, 0);
    const averageMoisture = totalMoisture / filledPoints.length;

    // Calculate claim percentage (difference from standard)
    const claimPercentage = averageMoisture - this.STANDARD_MOISTURE;

    // Calculate netto based on Bruto
    const beratBahan = parseFloat(this.formData.beratBahan);

    // ✅ BAGIAN BARU - LOGIKA YANG BENAR
    let netto: number;
    if (claimPercentage <= 0) {
      // Kelembapan di bawah atau sama dengan standar -> tidak ada penyesuaian
      netto = beratBahan;
    } else {
      // Kelembapan di atas standar -> ada pengurangan
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
  }

  /**
   * ANCHOR Save hasil uji kelembapan ke backend
   */
  saveResults(): void {
    if (!this.results || !this.selectedData) {
      alert('Harap hitung hasil terlebih dahulu');
      return;
    }

    // Confirm before save
    if (
      !confirm(
        `Simpan hasil uji kelembapan?\n\n` +
          `Kelembapan Rata-rata: ${this.results.averageMoisture}%\n` +
          `Standar: ${this.STANDARD_MOISTURE}%\n` +
          `Selisih: ${this.results.claimPercentage}%\n` +
          `Berat Netto: ${this.results.netto} kg`,
      )
    ) {
      return;
    }

    this.isSaving = true;

    // Build titik array - HANYA yang terisi
    const titikArray = this.moisturePoints
      .map((value, index) => ({
        titik: index + 1,
        value: value !== '' && !isNaN(parseFloat(value)) ? parseFloat(value) : null,
      }))
      .filter((item) => item.value !== null); // Filter hanya yang ada valuenya

    // Build payload sesuai format backend
    const payload = {
      timbangan_masuk_id: this.selectedData.id,
      jumlah_ball: parseInt(this.formData.jumlahBall) || 0,
      total_moisture: `${this.results.totalMoisture}%`,
      avg_moisture: `${this.results.averageMoisture}%`,
      nilai_claim: `${this.results.claimPercentage > 0 ? '+' : ''}${this.results.claimPercentage}%`,
      berat_bruto: parseFloat(this.formData.beratBahan),
      berat_netto: this.results.netto,
      potongan_sampah: parseFloat(this.formData.potonganSampah) || 0,
      titik: titikArray,
    };

    console.log('Payload yang dikirim:', payload);

    this.apiService
      .post('insert-uji-kelembapan', payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isSaving = false)),
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            alert(
              `✓ Hasil uji kelembapan berhasil disimpan!\n\n` +
                `Kelembapan Rata-rata: ${this.results!.averageMoisture}%\n` +
                `Standar: ${this.STANDARD_MOISTURE}%\n` +
                `Selisih: ${this.results!.claimPercentage}%\n` +
                `Berat Netto: ${this.results!.netto} kg`,
            );
            this.backToList();
            this.refreshList(); // Refresh list setelah save
          } else {
            alert(`Gagal menyimpan: ${response.message}`);
          }
        },
        error: (error) => {
          console.error('Error saving hasil uji:', error);
          alert(`Gagal menyimpan hasil: ${error.message || 'Terjadi kesalahan'}`);
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

  /**
   * Validate moisture input (0-100%)
   */
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

  /**
   * Fill sample data for testing (optional)
   */
  fillSampleData(): void {
    if (confirm('Isi dengan data sample untuk testing?')) {
      for (let i = 0; i < 20; i++) {
        this.moisturePoints[i] = (14 + Math.random() * 4).toFixed(1); // 14-18%
      }
    }
  }

  // ANCHOR UPDATE DATA UJI KELEMBAPAN
  // Method untuk handle event dari child component
  onUpdateBack(): void {
    this.showForm = false;
    this.isEdit = false;
    this.refreshList();
  }

  onUpdateSuccess(): void {
    this.showForm = false;
    this.isEdit = false;
    this.refreshList();
    // Optional: tambahkan notifikasi success
  }

  // Update method editData
  editData(): void {
    this.isEdit = true;
    this.showForm = true;
    // this.selectedData = data;
  }
}
