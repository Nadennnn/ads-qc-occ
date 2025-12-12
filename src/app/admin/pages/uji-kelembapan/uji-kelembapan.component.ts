// src/app/admin/pages/uji-kelembapan/uji-kelembapan.component.ts

import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TimbanganData, TimbanganService } from '../../services/timbangan.service';

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

  // List data timbangan untuk bahan baku
  bahanBakuList: TimbanganData[] = [];
  selectedData: TimbanganData | null = null;
  showForm = false;

  // Form Data
  formData = {
    noKendaraan: '',
    noSlipTimbang: '',
    tanggal: new Date().toISOString().split('T')[0],
    supplier: '',
    jenisBarang: '',
    jumlahBall: '',
    beratBahan: '',
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

  constructor(private router: Router, private timbanganService: TimbanganService) {}

  ngOnInit(): void {
    this.loadBahanBakuList();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadBahanBakuList(): void {
    this.timbanganService.timbanganData$.pipe(takeUntil(this.destroy$)).subscribe((data) => {
      // FIXED: Filter hanya bahan baku yang statusUjiKelembapan = 'pending'
      // Tidak perlu menunggu tara selesai
      this.bahanBakuList = data.filter(
        (item) => item.tipeBahan === 'bahan-baku' && item.statusUjiKelembapan === 'pending'
      );
    });
  }

  selectData(data: TimbanganData): void {
    this.selectedData = data;
    this.showForm = true;

    // FIXED: Gunakan timbanganPertama (Bruto) untuk uji kelembapan
    // Karena uji kelembapan dilakukan sebelum tara
    this.formData = {
      noKendaraan: data.noKendaraan,
      noSlipTimbang: data.noTiket,
      tanggal: new Date(data.timestamp).toISOString().split('T')[0],
      supplier: data.namaRelasi,
      jenisBarang: data.namaBarang,
      jumlahBall: '',
      beratBahan: data.timbanganPertama.toString(), // Gunakan Bruto
    };

    // Load previous results if available
    if (data.hasilUjiKelembapan) {
      this.moisturePoints = data.hasilUjiKelembapan.moisturePoints;
      this.results = {
        totalMoisture: data.hasilUjiKelembapan.totalMoisture,
        averageMoisture: data.hasilUjiKelembapan.averageMoisture,
        claimPercentage: data.hasilUjiKelembapan.claimPercentage,
        beratBahan: data.hasilUjiKelembapan.beratBahan,
        netto: data.hasilUjiKelembapan.netto,
        pointsChecked: data.hasilUjiKelembapan.pointsChecked,
      };
    } else {
      this.moisturePoints = Array(80).fill('');
      this.results = null;
    }

    // Scroll to form
    setTimeout(() => {
      document.getElementById('form-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  backToList(): void {
    this.showForm = false;
    this.selectedData = null;
    this.resetForm();
  }

  calculateResults(): void {
    // Validate berat bahan
    if (!this.formData.beratBahan || parseFloat(this.formData.beratBahan) <= 0) {
      alert('Harap isi Berat Bahan terlebih dahulu');
      return;
    }

    // Filter only filled moisture points
    const filledPoints = this.moisturePoints
      .filter((point) => point !== '' && !isNaN(parseFloat(point)))
      .map((point) => parseFloat(point));

    if (filledPoints.length === 0) {
      alert('Harap isi minimal satu titik pengukuran moisture');
      return;
    }

    // Calculate average moisture
    const totalMoisture = filledPoints.reduce((sum, val) => sum + val, 0);
    const averageMoisture = totalMoisture / filledPoints.length;

    // Calculate claim percentage (difference from standard)
    const claimPercentage = averageMoisture - this.STANDARD_MOISTURE;

    // FIXED: Calculate netto based on Bruto (timbanganPertama)
    // Netto disini adalah berat setelah dikurangi kelembapan
    const beratBahan = parseFloat(this.formData.beratBahan);
    const netto = beratBahan - beratBahan * (claimPercentage / 100);

    this.results = {
      totalMoisture: parseFloat(totalMoisture.toFixed(2)),
      averageMoisture: parseFloat(averageMoisture.toFixed(2)),
      claimPercentage: parseFloat(claimPercentage.toFixed(2)),
      beratBahan: parseFloat(beratBahan.toFixed(2)),
      netto: parseFloat(netto.toFixed(2)),
      pointsChecked: filledPoints.length,
    };
  }

  saveResults(): void {
    if (!this.results || !this.selectedData) {
      alert('Harap hitung hasil terlebih dahulu');
      return;
    }

    const success = this.timbanganService.updateHasilUjiKelembapan(this.selectedData.id, {
      totalMoisture: this.results.totalMoisture,
      averageMoisture: this.results.averageMoisture,
      claimPercentage: this.results.claimPercentage,
      beratBahan: this.results.beratBahan,
      netto: this.results.netto,
      pointsChecked: this.results.pointsChecked,
      moisturePoints: this.moisturePoints,
      tanggalUji: new Date().toISOString(),
    });

    if (success) {
      alert(
        `✓ Hasil uji kelembapan berhasil disimpan!\n\n` +
          `Kelembapan Rata-rata: ${this.results.averageMoisture}%\n` +
          `Standar: ${this.STANDARD_MOISTURE}%\n` +
          `Selisih: ${this.results.claimPercentage}%\n\n` +
          `Berat akan dikurangi ${this.results.claimPercentage}% saat perhitungan netto akhir.`
      );
      this.backToList();
    } else {
      alert('Gagal menyimpan hasil');
    }
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
      dataTimbanganId: this.selectedData?.id,
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

  getStatusBadgeClass(status?: 'pending' | 'completed'): string {
    if (status === 'completed') return 'bg-green-100 text-green-800';
    return 'bg-yellow-100 text-yellow-800';
  }

  getStatusText(status?: 'pending' | 'completed'): string {
    if (status === 'completed') return 'Selesai';
    return 'Belum Diuji';
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

  navigateTo(data: any): void {
    if (data === 'menu-utama') {
      this.router.navigate(['dashboards']);
    }
  }
}
