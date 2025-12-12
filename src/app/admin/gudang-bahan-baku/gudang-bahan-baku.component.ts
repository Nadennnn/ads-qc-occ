import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';

interface MoistureResults {
  totalMoisture: number;
  averageMoisture: number;
  claimPercentage: number;
  beratBahan: number;
  netto: number;
  pointsChecked: number;
}

export interface MenuItem {
  title: string;
  icon: string;
  route: string;
  description: string;
  badge?: {
    value: number;
    color: string;
  };
}

export const MENU_ITEMS: MenuItem[] = [
  {
    title: 'Timbangan Masuk',
    icon: '⚖️',
    route: '/admin/timbangan-masuk',
    description: 'Input data timbangan masuk dan tara',
  },
  {
    title: 'Uji Kelembapan',
    icon: '💧',
    route: '/admin/uji-kelembapan',
    description: 'Uji kelembapan bahan baku',
  },
  {
    title: 'Cek Laporan',
    icon: '📊',
    route: '/admin/cek-laporan',
    description: 'Laporan lengkap data timbangan',
  },
];

@Component({
  selector: 'app-gudang-bahan-baku',
  templateUrl: './gudang-bahan-baku.component.html',
  styleUrls: ['./gudang-bahan-baku.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
})
export class GudangBahanBakuComponent implements OnInit {
  constructor(private router: Router) {}

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

  ngOnInit(): void {
    console.log('Moisture Checker component initialized');
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

    // Calculate netto weight after moisture adjustment
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

    // Add print class to body
    document.body.classList.add('printing');

    setTimeout(() => {
      window.print();
      // Remove print class after printing
      setTimeout(() => {
        document.body.classList.remove('printing');
      }, 100);
    }, 100);
  }

  // Get filled moisture points for display
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

  navigateTo(data: any) {
    if (data == 'uji-kelembapan') {
      this.router.navigate(['dashboards/uji-kelembapan']);
    } else if (data == 'timbangan-masuk') {
      this.router.navigate(['dashboards/timbangan-masuk']);
    } else if (data == 'cek-laporan') {
      this.router.navigate(['dashboards/cek-laporan']);
    } else if (data == 'code-customer') {
      this.router.navigate(['dashboards/code-customer']);
    }
  }
}
