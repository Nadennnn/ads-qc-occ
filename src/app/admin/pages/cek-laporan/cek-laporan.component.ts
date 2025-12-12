// src/app/admin/pages/cek-laporan/cek-laporan.component.ts

import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { TimbanganData, TimbanganService } from '../../services/timbangan.service';

type FilterPeriod = 'harian' | 'mingguan' | 'bulanan' | 'custom';
type FilterStatus = 'semua' | 'masuk' | 'selesai';
type FilterTipe = 'semua' | 'bahan-baku' | 'lainnya';

interface LaporanStats {
  totalTransaksi: number;
  totalBruto: number;
  totalTara: number;
  totalNetto: number;
  totalPotongan: number;
  bahanBaku: number;
  lainnya: number;
  menungguTara: number;
  selesai: number;
  sudahDiuji: number;
  belumDiuji: number;
}

@Component({
  selector: 'app-cek-laporan',
  templateUrl: './cek-laporan.component.html',
  styleUrls: ['./cek-laporan.component.scss'],
  standalone: false,
})
export class CekLaporanComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  filterForm!: FormGroup;
  allData: TimbanganData[] = [];
  filteredData: TimbanganData[] = [];
  stats: LaporanStats = this.getEmptyStats();

  readonly periodOptions = [
    { value: 'harian', label: 'Hari Ini' },
    { value: 'mingguan', label: 'Minggu Ini' },
    { value: 'bulanan', label: 'Bulan Ini' },
    { value: 'custom', label: 'Custom Range' },
  ];

  readonly statusOptions = [
    { value: 'semua', label: 'Semua Status' },
    { value: 'masuk', label: 'Menunggu Tara' },
    { value: 'selesai', label: 'Selesai' },
  ];

  readonly tipeOptions = [
    { value: 'semua', label: 'Semua Tipe' },
    { value: 'bahan-baku', label: 'Bahan Baku' },
    { value: 'lainnya', label: 'Lainnya' },
  ];

  // Current date for display
  currentDate = new Date().toISOString();

  constructor(private fb: FormBuilder, private timbanganService: TimbanganService) {}

  ngOnInit(): void {
    this.initForm();
    this.loadData();
    this.setupFilterListener();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    const today = new Date().toISOString().split('T')[0];

    this.filterForm = this.fb.group({
      period: ['harian'],
      startDate: [today],
      endDate: [today],
      status: ['semua'],
      tipe: ['semua'],
    });
  }

  private loadData(): void {
    this.timbanganService.timbanganData$.pipe(takeUntil(this.destroy$)).subscribe((data) => {
      this.allData = data;
      this.applyFilters();
    });
  }

  private setupFilterListener(): void {
    this.filterForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.applyFilters();
    });
  }

  private applyFilters(): void {
    const { period, startDate, endDate, status, tipe } = this.filterForm.value;

    let filtered = [...this.allData];

    // Filter by period
    const dateRange = this.getDateRange(period, startDate, endDate);
    filtered = filtered.filter((item) => {
      const itemDate = new Date(item.timestamp);
      return itemDate >= dateRange.start && itemDate <= dateRange.end;
    });

    // Filter by status
    if (status !== 'semua') {
      filtered = filtered.filter((item) => item.statusTimbangan === status);
    }

    // Filter by tipe
    if (tipe !== 'semua') {
      filtered = filtered.filter((item) => item.tipeBahan === tipe);
    }

    this.filteredData = filtered;
    this.calculateStats();
  }

  private getDateRange(
    period: FilterPeriod,
    startDate: string,
    endDate: string
  ): { start: Date; end: Date } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (period) {
      case 'harian':
        return {
          start: today,
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
        };

      case 'mingguan': {
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return { start: monday, end: sunday };
      }

      case 'bulanan': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
        return { start: firstDay, end: lastDay };
      }

      case 'custom': {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      }

      default:
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1) };
    }
  }

  private calculateStats(): void {
    const stats = this.getEmptyStats();

    this.filteredData.forEach((item) => {
      stats.totalTransaksi++;
      stats.totalBruto += item.timbanganPertama;

      if (item.timbanganKedua) {
        stats.totalTara += item.timbanganKedua;
      }

      if (item.beratNetto) {
        stats.totalNetto += item.beratNetto;

        // Calculate potongan (kelembapan)
        const nettoKotor = item.timbanganPertama - (item.timbanganKedua || 0);
        const potongan = nettoKotor - item.beratNetto;
        stats.totalPotongan += potongan;
      }

      // Count by tipe
      if (item.tipeBahan === 'bahan-baku') {
        stats.bahanBaku++;

        // Count uji kelembapan status
        if (item.statusUjiKelembapan === 'completed') {
          stats.sudahDiuji++;
        } else if (item.statusUjiKelembapan === 'pending') {
          stats.belumDiuji++;
        }
      } else {
        stats.lainnya++;
      }

      // Count by status
      if (item.statusTimbangan === 'masuk') {
        stats.menungguTara++;
      } else {
        stats.selesai++;
      }
    });

    this.stats = stats;
  }

  private getEmptyStats(): LaporanStats {
    return {
      totalTransaksi: 0,
      totalBruto: 0,
      totalTara: 0,
      totalNetto: 0,
      totalPotongan: 0,
      bahanBaku: 0,
      lainnya: 0,
      menungguTara: 0,
      selesai: 0,
      sudahDiuji: 0,
      belumDiuji: 0,
    };
  }

  exportToExcel(): void {
    const data = this.filteredData.map((item) => ({
      'No. Tiket': item.noTiket,
      Tanggal: this.formatDate(item.timestamp),
      'No. Kendaraan': item.noKendaraan,
      Supplier: item.namaRelasi,
      'Nama Barang': item.namaBarang,
      Supir: item.namaSupir,
      Tipe: item.tipeBahan === 'bahan-baku' ? 'Bahan Baku' : 'Lainnya',
      'Bruto (kg)': item.timbanganPertama,
      'Tara (kg)': item.timbanganKedua || '-',
      'Netto (kg)': item.beratNetto || '-',
      'Kelembapan (%)': item.kelembapan || '-',
      Status: item.statusTimbangan === 'masuk' ? 'Menunggu Tara' : 'Selesai',
      Penimbang: item.namaPenimbang,
    }));

    const csv = this.convertToCSV(data);
    this.downloadCSV(csv, `laporan_timbangan_${Date.now()}.csv`);
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    data.forEach((row) => {
      const values = headers.map((header) => {
        const value = row[header];
        return typeof value === 'string' ? `"${value}"` : value;
      });
      csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
  }

  private downloadCSV(csv: string, filename: string): void {
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  printLaporan(): void {
    window.print();
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

  formatNumber(num: number | null | undefined): string {
    if (num === null || num === undefined || isNaN(Number(num))) {
      return '0.00';
    }

    return Number(num)
      .toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  getStatusBadge(status: 'masuk' | 'selesai'): string {
    return status === 'selesai' ? 'Selesai' : 'Menunggu Tara';
  }

  getStatusClass(status: 'masuk' | 'selesai'): string {
    return status === 'selesai' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
  }

  getTipeBadge(tipe: 'bahan-baku' | 'lainnya'): string {
    return tipe === 'bahan-baku' ? 'Bahan Baku' : 'Lainnya';
  }

  getTipeClass(tipe: 'bahan-baku' | 'lainnya'): string {
    return tipe === 'bahan-baku' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
  }

  get isCustomPeriod(): boolean {
    return this.filterForm.get('period')?.value === 'custom';
  }

  get periodLabel(): string {
    const period = this.filterForm.get('period')?.value;
    const option = this.periodOptions.find((opt) => opt.value === period);
    return option?.label || '';
  }

  isRincianVisible: boolean = false;

  toggleShowRincian(): void {
    this.isRincianVisible = !this.isRincianVisible;
  }
}
