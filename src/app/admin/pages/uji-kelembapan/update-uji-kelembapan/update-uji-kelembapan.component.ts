// src/app/admin/pages/uji-kelembapan/update-uji-kelembapan/update-uji-kelembapan.component.ts

import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { finalize, Subject, takeUntil } from 'rxjs';
import { ApiService } from '../../../services/api.service';

// Interface untuk response API detail
interface TaraSelesaiResponse {
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
  uji_kelembapan: {
    id: number;
    timbangan_masuk_id: string;
    jumlah_ball: string;
    total_moisture: string;
    avg_moisture: string;
    nilai_claim: string;
    berat_bruto: string;
    berat_netto: string;
    potongan_sampah: string;
    created_at: string;
    updated_at: string;
  };
  titik: Array<{
    id: number;
    uji_kelembapan_id: string;
    titik: string;
    nilai: string;
    created_at: string;
    updated_at: string;
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
  selector: 'app-update-uji-kelembapan',
  templateUrl: './update-uji-kelembapan.component.html',
  styleUrls: ['./update-uji-kelembapan.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class UpdateUjiKelembapanComponent implements OnInit, OnDestroy {
  @Output() onBack = new EventEmitter<void>();
  @Output() onUpdateSuccess = new EventEmitter<void>();

  private destroy$ = new Subject<void>();

  // List data dari API
  bahanBakuList: TaraSelesaiResponse[] = [];
  selectedData: TaraSelesaiResponse | null = null;
  showForm = false;

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

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadTaraSelesaiList();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load daftar bahan baku yang sudah selesai dari API /daftar-tara-selesai
   */
  private loadTaraSelesaiList(): void {
    this.isLoadingList = true;
    this.errorMessage = '';

    this.apiService
      .get<TaraSelesaiResponse[]>('daftar-tara-selesai')
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isLoadingList = false)),
      )
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Filter hanya yang sudah diuji dan punya data uji_kelembapan
            this.bahanBakuList = response.data.filter(
              (item) =>
                item.status === 'Sudah Diuji' &&
                item.type_bahan === 'Bahan Baku' &&
                item.uji_kelembapan != null,
            );
            console.log('Loaded tara selesai list:', this.bahanBakuList);
          } else {
            this.errorMessage = 'Gagal memuat data';
          }
        },
        error: (error) => {
          console.error('Error loading tara selesai:', error);
          this.errorMessage = error.message || 'Gagal memuat data';
        },
      });
  }

  /**
   * Refresh list data
   */
  refreshList(): void {
    this.loadTaraSelesaiList();
  }

  /**
   * Select data untuk edit uji kelembapan
   */
  selectData(data: TaraSelesaiResponse): void {
    this.selectedData = data;
    this.showForm = true;

    // Populate form dengan data dari API
    this.formData = {
      noKendaraan: data.nomor_kendaraan || '',
      noSlipTimbang: data.nomor_bon || '',
      tanggal: new Date(data.created_at).toISOString().split('T')[0],
      supplier: data.suplier || '',
      jenisBarang: data.barang || '',
      jumlahBall: data.uji_kelembapan?.jumlah_ball || '0',
      beratBahan: data.uji_kelembapan?.berat_bruto || '0',
      potonganSampah: data.uji_kelembapan?.potongan_sampah || '0',
    };

    // Reset moisture points terlebih dahulu
    this.moisturePoints = Array(80).fill('');

    // Populate moisture points dari data titik yang ada
    if (data.titik && data.titik.length > 0) {
      data.titik.forEach((titikData) => {
        const index = parseInt(titikData.titik) - 1; // titik 1 = index 0
        if (index >= 0 && index < 80) {
          this.moisturePoints[index] = titikData.nilai;
        }
      });
    }

    // Auto calculate results dari data yang sudah ada
    this.autoCalculateFromExistingData(data);

    // Scroll to form
    setTimeout(() => {
      document.getElementById('update-form-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  /**
   * Auto calculate results dari data existing
   */
  private autoCalculateFromExistingData(data: TaraSelesaiResponse): void {
    if (!data.uji_kelembapan) return;

    const ujiData = data.uji_kelembapan;

    // Parse nilai dari string (contoh: "162%" -> 162)
    const totalMoisture = parseFloat(ujiData.total_moisture.replace('%', ''));
    const avgMoisture = parseFloat(ujiData.avg_moisture.replace('%', ''));
    const claimPercentage = parseFloat(ujiData.nilai_claim.replace('%', '').replace('+', ''));

    this.results = {
      totalMoisture: totalMoisture,
      averageMoisture: avgMoisture,
      claimPercentage: claimPercentage,
      beratBahan: parseFloat(ujiData.berat_bruto),
      netto: parseFloat(ujiData.berat_netto),
      pointsChecked: data.titik?.length || 0,
    };
  }

  backToList(): void {
    this.showForm = false;
    this.selectedData = null;
    this.resetForm();
    this.onBack.emit();
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

    // Validate jumlah ball
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
   * UPDATE hasil uji kelembapan ke backend
   */
  saveResults(): void {
    if (!this.results || !this.selectedData || !this.selectedData.uji_kelembapan) {
      alert('Harap hitung hasil terlebih dahulu');
      return;
    }

    // Confirm before save
    if (
      !confirm(
        `Update hasil uji kelembapan?\n\n` +
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

    // Build payload sesuai format backend untuk UPDATE
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

    const ujiKelembapanId = this.selectedData.uji_kelembapan.id;
    console.log('Update payload:', payload);
    console.log('Uji Kelembapan ID:', ujiKelembapanId);

    // Gunakan endpoint PUT/PATCH untuk update
    this.apiService
      .put(`update-uji-kelembapan/${ujiKelembapanId}`, payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.isSaving = false)),
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            alert(
              `✓ Hasil uji kelembapan berhasil diupdate!\n\n` +
                `Kelembapan Rata-rata: ${this.results!.averageMoisture}%\n` +
                `Standar: ${this.STANDARD_MOISTURE}%\n` +
                `Selisih: ${this.results!.claimPercentage}%\n` +
                `Berat Netto: ${this.results!.netto} kg`,
            );
            this.onUpdateSuccess.emit();
            this.backToList();
            this.refreshList();
          } else {
            alert(`Gagal mengupdate: ${response.message}`);
          }
        },
        error: (error) => {
          console.error('Error updating hasil uji:', error);
          alert(`Gagal mengupdate hasil: ${error.message || 'Terjadi kesalahan'}`);
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
      ujiKelembapanId: this.selectedData?.uji_kelembapan?.id,
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
    const exportFileDefaultName = `moisture_check_update_${new Date().getTime()}.json`;

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
}
