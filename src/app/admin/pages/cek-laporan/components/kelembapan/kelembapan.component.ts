// src/app/admin/pages/cek-laporan/components/kelembapan/kelembapan.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import * as XLSX from 'xlsx';
import { WorkSheet } from 'xlsx';
import { ApiService } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';
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
    private authService: AuthService,
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
    if (this.displayedData.length === 0) {
      alert('Tidak ada data untuk di-export');
      return;
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet: WorkSheet = {};

    let currentRow = 1;

    // ====================================
    // 1. HEADER SECTION (Baris 1-4)
    // ====================================
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // Title row (7 kolom total)
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }, // Subtitle row
    ];

    XLSX.utils.sheet_add_aoa(
      worksheet,
      [['PT AGRO DELI SERDANG'], ['LAPORAN DATA UJI KELEMBAPAN']],
      { origin: 'A1' },
    );

    currentRow = 3;

    // Meta info (Periode, Tanggal Cetak, Jumlah Data)
    const metaInfo = [
      `Periode: ${this.periodLabel}`,
      `Tanggal Cetak: ${this.formatDate(this.currentDate)}`,
      `Jumlah Data: ${this.displayedData.length} transaksi`,
    ];

    XLSX.utils.sheet_add_aoa(worksheet, [[metaInfo.join('     |     ')]], {
      origin: `A${currentRow}`,
    });

    worksheet['!merges'].push({ s: { r: currentRow - 1, c: 0 }, e: { r: currentRow - 1, c: 6 } });

    currentRow += 2; // Baris kosong

    // ====================================
    // 2. TABLE HEADER (7 Kolom)
    // ====================================
    const headers = [
      'No.',
      'Tanggal',
      'No. Kendaraan',
      'Supplier',
      'Nama Barang',
      'Hasil Uji Rata-Rata (%)',
      'Nilai Claim (%)',
    ];

    XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: `A${currentRow}` });
    currentRow++;

    // ====================================
    // 3. TABLE DATA
    // ====================================
    const tableData = this.displayedData.map((item, index) => [
      index + 1,
      this.formatDate(item.timestamp),
      item.noKendaraan,
      item.laporanSupplier || '-',
      item.namaBarang,
      item.hasilUjiKelembapan?.averageMoisture || '-',
      item.hasilUjiKelembapan?.claimPercentage
        ? (item.hasilUjiKelembapan.claimPercentage > 0 ? '+' : '') +
          item.hasilUjiKelembapan.claimPercentage
        : '-',
    ]);

    XLSX.utils.sheet_add_aoa(worksheet, tableData, { origin: `A${currentRow}` });
    currentRow += tableData.length + 1;

    // ====================================
    // 4. SUMMARY SECTION
    // ====================================
    // Hitung statistik kelembapan
    const kelembapanStats = this.calculateKelembapanStats();

    const summaryData = [
      [
        'Total Transaksi',
        this.displayedData.length,
        'Rata-rata Moisture',
        `${kelembapanStats.avgMoisture.toFixed(2)}%`,
      ],
      [
        'Total Moisture',
        `${kelembapanStats.totalMoisture.toFixed(2)}%`,
        'Total Claim',
        `${kelembapanStats.totalClaim.toFixed(2)}%`,
      ],
      [
        'Berat Total Bruto',
        `${this.formatNumber(kelembapanStats.totalBruto)} kg`,
        'Berat Total Netto',
        `${this.formatNumber(kelembapanStats.totalNetto)} kg`,
      ],
    ];

    XLSX.utils.sheet_add_aoa(worksheet, summaryData, { origin: `A${currentRow}` });

    // ====================================
    // 5. STYLING & FORMATTING
    // ====================================
    worksheet['!cols'] = [
      { wch: 5 }, // No.
      { wch: 18 }, // Tanggal
      { wch: 15 }, // No. Kendaraan
      { wch: 20 }, // Supplier
      { wch: 20 }, // Nama Barang
      { wch: 18 }, // Hasil Uji
      { wch: 15 }, // Nilai Claim
    ];

    // Apply styles (reuse dari timbangan)
    this.applyExcelStyles(worksheet, headers.length, tableData.length, currentRow);

    // ====================================
    // 6. SAVE FILE
    // ====================================
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Kelembapan');

    const filename = `Laporan_Kelembapan_${this.getFilenameDate()}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }

  // 2. Helper: Calculate Kelembapan Statistics
  private calculateKelembapanStats() {
    const data = this.displayedData;

    let totalMoisture = 0;
    let totalClaim = 0;
    let totalBruto = 0;
    let totalNetto = 0;
    let countMoisture = 0;

    data.forEach((item) => {
      if (item.hasilUjiKelembapan) {
        totalMoisture += Number(item.hasilUjiKelembapan.averageMoisture) || 0;
        totalClaim += Number(item.hasilUjiKelembapan.claimPercentage) || 0;
        countMoisture++;
      }

      if (item.hasilUjiKelembapan?.beratBahan) {
        totalBruto += Number(item.hasilUjiKelembapan.beratBahan) || 0;
      }

      if (item.hasilUjiKelembapan?.netto) {
        totalNetto += Number(item.hasilUjiKelembapan.netto) || 0;
      }
    });

    return {
      totalMoisture,
      avgMoisture: countMoisture > 0 ? totalMoisture / countMoisture : 0,
      totalClaim,
      totalBruto,
      totalNetto,
    };
  }

  // 3. Helper: Apply Excel Styles (sama seperti timbangan, sesuaikan kolom count)
  private applyExcelStyles(
    worksheet: WorkSheet,
    colCount: number,
    dataRowCount: number,
    summaryStartRow: number,
  ): void {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!worksheet[cellAddress]) continue;

        const cell = worksheet[cellAddress];
        if (!cell.s) cell.s = {};

        // Header Company (Row 1-2)
        if (R === 0 || R === 1) {
          cell.s = {
            font: { bold: true, sz: R === 0 ? 16 : 14 },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: 'E8E8E8' } },
          };
        }

        // Meta Info (Row 3)
        if (R === 2) {
          cell.s = {
            font: { sz: 10 },
            alignment: { horizontal: 'center' },
            border: {
              bottom: { style: 'thin', color: { rgb: '000000' } },
            },
          };
        }

        // Table Headers (Row 5)
        if (R === 4) {
          cell.s = {
            font: { bold: true, sz: 11 },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: 'D3D3D3' } },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } },
            },
          };
        }

        // Table Data
        if (R >= 5 && R < 5 + dataRowCount) {
          cell.s = {
            border: {
              top: { style: 'thin', color: { rgb: 'CCCCCC' } },
              bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
              left: { style: 'thin', color: { rgb: 'CCCCCC' } },
              right: { style: 'thin', color: { rgb: 'CCCCCC' } },
            },
            alignment: {
              horizontal: C === 0 ? 'center' : 'left',
              vertical: 'center',
            },
          };
        }

        // Summary Section
        if (R >= summaryStartRow - 1) {
          cell.s = {
            font: { bold: C === 0 || C === 2 ? true : false, sz: 10 },
            alignment: {
              horizontal: C === 1 || C === 3 ? 'right' : 'left',
            },
            border: {
              bottom: { style: 'thin', color: { rgb: '000000' } },
            },
          };
        }
      }
    }
  }

  // 4. Helper: Format Date for Excel
  private formatDateForExcel(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // 5. Helper: Generate Filename with Date
  private getFilenameDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');

    return `${year}${month}${day}_${hour}${minute}`;
  }

  // 6. UPDATE: Getter periodLabel untuk mendukung custom range
  get periodLabel(): string {
    const period = this.filterForm.get('period')?.value;
    const startDate = this.filterForm.get('startDate')?.value;
    const endDate = this.filterForm.get('endDate')?.value;

    if (period === 'custom' && startDate && endDate) {
      const start = new Date(startDate).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const end = new Date(endDate).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      return `${start} - ${end}`;
    }

    const option = this.periodOptions.find((opt) => opt.value === period);
    return option?.label || '';
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
    // Pastikan mode print hanya untuk laporan tabel (bukan modal)
    document.body.classList.remove('printing-modal');
    window.print();
  }

  // UI Helpers
  toggleRincian(): void {
    this.isRincianVisible = !this.isRincianVisible;
  }

  nettoSetelahPotongan: any;

  viewDetail(item: any): void {
    console.log('📋 Item yang dipilih:', item);
    console.log('🔍 Hasil Uji Kelembapan:', item.hasilUjiKelembapan);
    console.log('📊 Moisture Points:', item.hasilUjiKelembapan?.moisturePoints);

    let beratNetto = item.hasilTara.beratNetto;

    // Mulai dari berat netto
    let netWeight = beratNetto;

    // Kurangi potongan basah jika averageMoisture > 15
    if (item.hasilUjiKelembapan && item.hasilUjiKelembapan.averageMoisture > 15) {
      const claimPercentage = item.hasilUjiKelembapan.claimPercentage;
      const potonganBasah = beratNetto * (claimPercentage / 100);
      netWeight = netWeight - potonganBasah;
    }

    // Kurangi potongan sampah jika ada
    if (item.hasilUjiKelembapan && item.hasilUjiKelembapan.potonganSampah) {
      netWeight = netWeight - item.hasilUjiKelembapan.potonganSampah;
    }

    this.nettoSetelahPotongan = netWeight;
    this.selectedItem = item;
    this.isModalOpen = true;
  }

  printModal(): void {
    if (!this.selectedItem) {
      return;
    }

    // Aktifkan mode print khusus modal
    document.body.classList.add('printing-modal');
    window.print();

    // Hapus flag setelah print selesai (print dialog akan mem-block JS)
    setTimeout(() => {
      document.body.classList.remove('printing-modal');
    }, 0);
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

  // get periodLabel(): string {
  //   const period = this.filterForm.get('period')?.value;
  //   return this.periodOptions.find((opt) => opt.value === period)?.label || '';
  // }

  // REVIEW UPDATE METODE GET averageMoisture
  // ====================================
  // HELPER METHODS untuk Summary di Print/HTML
  // Tambahkan ke kelembapan.component.ts
  // ====================================

  // 1. Calculate Total Moisture
  calculateTotalMoisture(): string {
    let total = 0;

    this.displayedData.forEach((item) => {
      if (item.hasilUjiKelembapan?.averageMoisture) {
        total += Number(item.hasilUjiKelembapan.averageMoisture) || 0;
      }
    });

    return total.toFixed(2);
  }

  // 2. Calculate Average Moisture
  calculateAvgMoisture(): string {
    const total = parseFloat(this.calculateTotalMoisture());
    const count = this.displayedData.filter(
      (item) => item.hasilUjiKelembapan?.averageMoisture,
    ).length;

    if (count === 0) return '0.00';

    return (total / count).toFixed(2);
  }

  // 3. Calculate Total Claim
  calculateTotalClaim(): string {
    let total = 0;
    const THRESHOLD = 20; // Threshold 20%

    this.displayedData.forEach((item) => {
      if (item.hasilUjiKelembapan?.claimPercentage) {
        const claimValue = Number(item.hasilUjiKelembapan.claimPercentage) || 0;
        // Hanya hitung jika claim >= 20%
        if (claimValue >= THRESHOLD) {
          total += claimValue;
        }
      }
    });

    return total.toFixed(2);
  }

  // 4. Calculate Total Bruto (dari uji kelembapan)
  calculateTotalBruto(): number {
    let total = 0;

    this.displayedData.forEach((item) => {
      if (item.hasilUjiKelembapan?.beratBahan) {
        total += Number(item.hasilUjiKelembapan.beratBahan) || 0;
      }
    });

    return total;
  }

  // 5. Calculate Total Netto (dari uji kelembapan)
  calculateTotalNetto(): number {
    let total = 0;

    this.displayedData.forEach((item) => {
      if (item.hasilUjiKelembapan?.netto) {
        total += Number(item.hasilUjiKelembapan.netto) || 0;
      }
    });

    return total;
  }

  // 6. Calculate Total Potongan Sampah
  calculateTotalPotonganSampah(): number {
    let total = 0;

    this.displayedData.forEach((item) => {
      if (item.hasilUjiKelembapan?.potonganSampah) {
        total += Number(item.hasilUjiKelembapan.potonganSampah) || 0;
      }
    });

    return total;
  }

  // 7. Calculate Average Potongan Sampah
  calculateAvgPotonganSampah(): string {
    const total = this.calculateTotalPotonganSampah();
    const count = this.displayedData.filter(
      (item) => item.hasilUjiKelembapan?.potonganSampah,
    ).length;

    if (count === 0) return '0';

    return this.formatNumber(total / count);
  }

  // 8. Calculate Average Claim
  calculateAvgClaim(): string {
    const THRESHOLD = 20; // Threshold 20%
    let total = 0;
    let count = 0;

    this.displayedData.forEach((item) => {
      if (item.hasilUjiKelembapan?.claimPercentage) {
        const claimValue = Number(item.hasilUjiKelembapan.claimPercentage) || 0;
        // Hanya hitung jika claim >= 20%
        if (claimValue >= THRESHOLD) {
          total += claimValue;
          count++;
        }
      }
    });

    if (count === 0) return '0.00';

    return (total / count).toFixed(2);
  }

  // 9. Calculate Average Bruto
  calculateAvgBruto(): number {
    const total = this.calculateTotalBruto();
    const count = this.displayedData.filter((item) => item.hasilUjiKelembapan?.beratBahan).length;

    if (count === 0) return 0;

    return total / count;
  }

  // 10. Calculate Average Netto
  calculateAvgNetto(): number {
    const total = this.calculateTotalNetto();
    const count = this.displayedData.filter((item) => item.hasilUjiKelembapan?.netto).length;

    if (count === 0) return 0;

    return total / count;
  }
}
