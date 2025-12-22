// src/app/admin/pages/cek-laporan/components/kelembapan/kelembapan.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ApiService } from '../../../../services/api.service';
import { TimbanganData, TimbanganService } from '../../../../services/timbangan.service';

// Types
type FilterPeriod = 'harian' | 'mingguan' | 'bulanan' | 'custom';
type FilterStatus = 'semua' | 'menunggu' | 'selesai';
type FilterTipe = 'semua' | 'bahan-baku' | 'lainnya';

interface LaporanStats {
  totalTransaksi: number;
  totalSelesai: number;
  totalMenunggu: number;
  totalNetto: number;
  totalBruto: number;
  totalTara: number;
  totalPotongan: number;
  bahanBaku: number;
  lainnya: number;
  sudahDiuji: number;
  belumDiuji: number;
}

interface BarangOption {
  value: string;
  label: string;
}

interface FilterOption<T = string> {
  value: T;
  label: string;
  apiValue?: string | number | null;
}

interface HasilUjiKelembapan {
  id: string;
  totalMoisture: number;
  averageMoisture: number;
  claimPercentage: number;
  beratBahan: number;
  netto: number;
  potonganSampah: number;
  pointsChecked: number;
  moisturePoints: string[];
  tanggalUji: string;
}

@Component({
  selector: 'app-kelembapan',
  templateUrl: './kelembapan.component.html',
  styleUrls: ['./kelembapan.component.scss'],
  standalone: false,
})
export class KelembapanComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Form & Data
  filterForm!: FormGroup;
  displayedData: TimbanganData[] = [];
  stats: LaporanStats = this.initEmptyStats();

  // UI State
  isLoading = false;
  isRincianVisible = false;
  currentDate = new Date().toISOString();

  // Modal State
  isModalOpen = false;
  selectedItem: any = null;

  readonly bahanBakuOptions: BarangOption[] = [
    { value: 'semua', label: 'Semua Barang' },
    { value: 'LOCC/OCC', label: 'LOCC/OCC' },
    { value: 'DLK', label: 'DLK' },
    { value: 'DUPLEK', label: 'DUPLEK' },
    { value: 'MIX WASTE', label: 'MIX WASTE' },
    { value: 'SARANG TELOR', label: 'SARANG TELOR' },
    { value: 'TUNGKUL', label: 'TUNGKUL' },
  ];

  private allData: TimbanganData[] = [];

  // Filter Options
  readonly periodOptions: FilterOption<FilterPeriod>[] = [
    { value: 'harian', label: 'Hari Ini', apiValue: 'Hari Ini' },
    { value: 'mingguan', label: 'Minggu Ini', apiValue: 'Minggu Ini' },
    { value: 'bulanan', label: 'Bulan Ini', apiValue: 'Bulan Ini' },
    { value: 'custom', label: 'Custom Range', apiValue: 'Custom Range' },
  ];

  readonly statusOptions: FilterOption<FilterStatus>[] = [
    { value: 'semua', label: 'Semua Status', apiValue: null },
    { value: 'menunggu', label: 'Menunggu Tara', apiValue: 0 },
    { value: 'selesai', label: 'Selesai', apiValue: 1 },
  ];

  readonly tipeOptions: FilterOption<FilterTipe>[] = [
    { value: 'semua', label: 'Semua Tipe', apiValue: null },
    { value: 'bahan-baku', label: 'Bahan Baku', apiValue: 'Bahan Baku' },
    { value: 'lainnya', label: 'Lainnya', apiValue: 'Lainnya' },
  ];

  constructor(
    private fb: FormBuilder,
    private timbanganService: TimbanganService,
    private api: ApiService,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadKelembapanData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Initialization
  private initForm(): void {
    const today = this.getTodayDateString();

    this.filterForm = this.fb.group({
      period: ['harian'],
      startDate: [today],
      endDate: [today],
      status: ['semua'],
      tipe: ['semua'],
      namaBarang: ['semua'], // Tambahkan field baru
    });

    // Subscribe ke perubahan form untuk auto-filter
    this.filterForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.applyFilters();
    });
  }

  private initEmptyStats(): LaporanStats {
    return {
      totalTransaksi: 0,
      totalSelesai: 0,
      totalMenunggu: 0,
      totalNetto: 0,
      totalBruto: 0,
      totalTara: 0,
      totalPotongan: 0,
      bahanBaku: 0,
      lainnya: 0,
      sudahDiuji: 0,
      belumDiuji: 0,
    };
  }

  // Data Loading
  loadKelembapanData(): void {
    this.isLoading = true;

    this.timbanganService
      .loadDaftarTaraSelesai()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: TimbanganData[]) => {
          // Simpan data asli (sudah difilter bahan-baku)
          this.allData = data.filter((item) => item.tipeBahan === 'bahan-baku');

          // Apply filters
          this.applyFilters();

          this.isLoading = false;
          console.log('✅ Total data loaded:', this.allData.length);
          console.log('✅ Data setelah filter:', this.displayedData.length);
        },
        error: (error) => {
          console.error('❌ Gagal memuat data tara selesai:', error);
          this.isLoading = false;
        },
      });
  }

  // Main filter function - dipanggil setiap kali form berubah
  applyFilters(): void {
    let filtered = [...this.allData];

    // 1. Filter by Date/Period
    filtered = this.filterByPeriod(filtered);

    // 2. Filter by Status
    filtered = this.filterByStatus(filtered);

    // 3. Filter by Tipe Bahan
    filtered = this.filterByTipe(filtered);

    // 4. Filter by Nama Barang - BARU
    filtered = this.filterByNamaBarang(filtered);

    // Update displayed data
    this.displayedData = filtered;

    // Recalculate stats
    this.calculateStats();

    console.log('🔍 Filter applied - Results:', this.displayedData.length, 'items');
  }

  // Filter berdasarkan Periode Waktu
  private filterByPeriod(data: TimbanganData[]): TimbanganData[] {
    const period = this.filterForm.get('period')?.value;
    const now = new Date();

    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case 'harian':
        // Hari ini: 00:00:00 sampai 23:59:59
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;

      case 'mingguan':
        // Minggu ini (Senin - Minggu)
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Senin sebagai hari pertama

        startDate = new Date(now);
        startDate.setDate(now.getDate() - diff);
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'bulanan':
        // Bulan ini: tanggal 1 sampai akhir bulan
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;

      case 'custom':
        // Custom date range
        const startDateStr = this.filterForm.get('startDate')?.value;
        const endDateStr = this.filterForm.get('endDate')?.value;

        if (!startDateStr || !endDateStr) {
          return data; // Jika tanggal tidak lengkap, return semua data
        }

        startDate = new Date(startDateStr);
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);
        break;

      default:
        return data;
    }

    return data.filter((item) => {
      const itemDate = new Date(item.timestamp);
      return itemDate >= startDate && itemDate <= endDate;
    });
  }

  // Filter berdasarkan Status Timbangan
  private filterByStatus(data: TimbanganData[]): TimbanganData[] {
    const status = this.filterForm.get('status')?.value;

    if (status === 'semua') {
      return data;
    }

    const statusMap: { [key: string]: string } = {
      menunggu: 'masuk',
      selesai: 'selesai',
    };

    const targetStatus = statusMap[status];
    return data.filter((item) => item.statusTimbangan === targetStatus);
  }

  // Filter berdasarkan Tipe Bahan
  private filterByTipe(data: TimbanganData[]): TimbanganData[] {
    const tipe = this.filterForm.get('tipe')?.value;

    if (tipe === 'semua') {
      return data;
    }

    const tipeMap: { [key: string]: string } = {
      'bahan-baku': 'bahan-baku',
      lainnya: 'lainnya',
    };

    const targetTipe = tipeMap[tipe];
    return data.filter((item) => item.tipeBahan === targetTipe);
  }

  // Filter berdasarkan Nama Barang - BARU
  private filterByNamaBarang(data: TimbanganData[]): TimbanganData[] {
    const namaBarang = this.filterForm.get('namaBarang')?.value;

    if (namaBarang === 'semua') {
      return data;
    }

    return data.filter((item) => item.namaBarang === namaBarang);
  }

  // Reset semua filter ke nilai default
  resetFilters(): void {
    const today = this.getTodayDateString();

    this.filterForm.patchValue(
      {
        period: 'harian',
        startDate: today,
        endDate: today,
        status: 'semua',
        tipe: 'semua',
        namaBarang: 'semua',
      },
      { emitEvent: true },
    ); // emitEvent: true akan trigger valueChanges

    console.log('🔄 Filter telah direset');
  }

  private filterBahanBaku(data: TimbanganData[]): TimbanganData[] {
    return data.filter((item) => item.tipeBahan === 'bahan-baku');
  }

  private calculateStats(): void {
    const data = this.displayedData;

    this.stats = {
      totalTransaksi: data.length,
      totalSelesai: data.filter((d) => d.statusTimbangan === 'selesai').length,
      totalMenunggu: data.filter((d) => d.statusTimbangan === 'masuk').length,
      totalNetto: data.reduce((sum, d) => sum + (Number(d.beratNetto) || 0), 0),
      totalBruto: data.reduce((sum, d) => sum + (Number(d.timbanganPertama) || 0), 0),
      totalTara: data.reduce((sum, d) => sum + (Number(d.timbanganKedua) || 0), 0),
      totalPotongan: data.reduce(
        (sum, d) =>
          sum + (d.hasilTara?.potonganMoisture ? Number(d.hasilTara.potonganMoisture) : 0),
        0,
      ),
      bahanBaku: data.filter((d) => d.tipeBahan === 'bahan-baku').length,
      lainnya: data.filter((d) => d.tipeBahan === 'lainnya').length,
      sudahDiuji: data.filter((d) => d.statusUjiKelembapan === 'completed').length,
      belumDiuji: data.filter((d) => !d.statusUjiKelembapan || d.statusUjiKelembapan === 'pending')
        .length,
    };

    console.log('📊 Stats updated:', this.stats);
  }

  // Getter untuk menampilkan jumlah filter aktif
  get activeFilterCount(): number {
    let count = 0;
    if (this.filterForm.get('period')?.value !== 'harian') count++;
    if (this.filterForm.get('status')?.value !== 'semua') count++;
    if (this.filterForm.get('tipe')?.value !== 'semua') count++;
    if (this.filterForm.get('namaBarang')?.value !== 'semua') count++;
    return count;
  }

  // Getter untuk cek apakah ada filter aktif
  get hasActiveFilters(): boolean {
    return this.activeFilterCount > 0;
  }

  // Export & Print
  exportToExcel(): void {
    if (this.displayedData.length === 0) return;

    const exportData = this.prepareExportData();
    const csv = this.convertToCSV(exportData);
    this.downloadCSV(csv, `laporan_kelembapan_${Date.now()}.csv`);
  }

  private prepareExportData(): any[] {
    return this.displayedData.map((item) => ({
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
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          return typeof value === 'string' ? `"${value}"` : value;
        })
        .join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }

  private downloadCSV(csv: string, filename: string): void {
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  printLaporan(): void {
    window.print();
  }

  // UI Helpers
  toggleRincian(): void {
    this.isRincianVisible = !this.isRincianVisible;
  }

  viewDetail(item: any): void {
    console.log('📋 Item yang dipilih:', item);
    console.log('🔍 Hasil Uji Kelembapan:', item.hasilUjiKelembapan);
    console.log('📊 Moisture Points:', item.hasilUjiKelembapan?.moisturePoints);

    this.selectedItem = item;
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.selectedItem = null;
  }

  getTipeClass(tipe: 'bahan-baku' | 'lainnya'): string {
    return tipe === 'bahan-baku' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
  }

  getSupplierDisplay(supplier: string | null): string {
    return supplier && supplier !== '---' ? supplier : '-';
  }

  // Formatting
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

  formatNumber(value: number | string | null | undefined): string {
    const num = Number(value);
    return isNaN(num) ? '0' : new Intl.NumberFormat('id-ID').format(num);
  }

  private getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  // Getters
  get isCustomPeriod(): boolean {
    return this.filterForm.get('period')?.value === 'custom';
  }

  get periodLabel(): string {
    const period = this.filterForm.get('period')?.value;
    return this.periodOptions.find((opt) => opt.value === period)?.label || '';
  }
}
