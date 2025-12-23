// src/app/admin/pages/cek-laporan/components/timbangan/timbangan.component.ts

import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import {
  ReportParams,
  TimbanganData,
  TimbanganService,
} from '../../../../services/timbangan.service';

import * as XLSX from 'xlsx';
import { WorkSheet } from 'xlsx';

type FilterPeriod = 'harian' | 'mingguan' | 'bulanan' | 'custom';
type FilterStatus = 'semua' | 'menunggu' | 'selesai';
type FilterTipe = 'semua' | 'bahan-baku' | 'lainnya';

interface LaporanStats {
  totalTransaksi: number;
  totalSelesai: number;
  totalMenunggu: number;
  totalNetto: number;

  // Existing additional stats
  totalBruto: number;
  totalTara: number;
  totalPotongan: number;
  bahanBaku: number;
  lainnya: number;
  sudahDiuji: number;
  belumDiuji: number;

  // ➕ Tambahkan rata-rata
  rataRataBruto: number;
  rataRataTara: number;
  rataRataNetto: number;
}

@Component({
  selector: 'app-timbangan',
  templateUrl: './timbangan.component.html',
  styleUrls: ['./timbangan.component.scss'],
  standalone: false,
})
export class TimbanganComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  filterForm!: FormGroup;
  filteredData: TimbanganData[] = [];
  stats: LaporanStats = this.getEmptyStats();
  isLoading = false;

  // ANCHOR ACTIVE TAB
  activeTab: 'timbangan' | 'kelembapan' = 'kelembapan';

  readonly periodOptions = [
    { value: 'harian', label: 'Hari Ini', apiValue: 'Hari Ini' },
    { value: 'mingguan', label: 'Minggu Ini', apiValue: 'Minggu Ini' },
    { value: 'bulanan', label: 'Bulan Ini', apiValue: 'Bulan Ini' },
    { value: 'custom', label: 'Custom Range', apiValue: 'Custom Range' },
  ];

  readonly statusOptions = [
    { value: 'semua', label: 'Semua Status', apiValue: null },
    { value: 'menunggu', label: 'Menunggu Tara', apiValue: 0 },
    { value: 'selesai', label: 'Selesai', apiValue: 1 },
  ];

  readonly tipeOptions = [
    { value: 'semua', label: 'Semua Tipe', apiValue: null },
    { value: 'bahan-baku', label: 'Bahan Baku', apiValue: 'Bahan Baku' },
    { value: 'lainnya', label: 'Lainnya', apiValue: 'Lainnya' },
  ];

  currentDate = new Date().toISOString();
  isRincianVisible: boolean = false;

  constructor(
    private fb: FormBuilder,
    private timbanganService: TimbanganService,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.setupFilterListener();
    this.loadReportData(); // Load initial data
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

  private setupFilterListener(): void {
    this.filterForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadReportData();
    });
  }

  tara: any;

  private loadReportData(): void {
    const formValues = this.filterForm.value;
    const params = this.buildReportParams(formValues);

    console.log('🔍 Loading report with params:', params);
    this.isLoading = true;

    this.timbanganService
      .getReportData(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('📊 Report response:', response);

          // Convert API data to TimbanganData format
          this.filteredData = response.data.map((item) => this.convertApiToTimbanganData(item));

          // Update stats from API response
          this.stats = {
            totalTransaksi: response.statistik.total,
            totalSelesai: response.statistik.finished,
            totalMenunggu: response.statistik.not_finished,
            totalNetto: parseFloat(response.statistik.netto),
            // Calculate additional stats from data
            ...this.calculateAdditionalStats(this.filteredData),
          };

          this.isLoading = false;
          console.log('✅ Report loaded successfully:', {
            dataCount: this.filteredData.length,
            stats: this.stats,
          });
        },
        error: (error) => {
          console.error('❌ Error loading report:', error);
          this.filteredData = [];
          this.stats = this.getEmptyStats();
          this.isLoading = false;
        },
      });
  }

  private buildReportParams(formValues: any): ReportParams {
    const { period, startDate, endDate, status, tipe } = formValues;

    const params: ReportParams = {};

    // Periode
    const periodOption = this.periodOptions.find((opt) => opt.value === period);
    if (periodOption) {
      params.periode = periodOption.apiValue;
    }

    // Custom date range
    if (period === 'custom' && startDate && endDate) {
      params.start_date = startDate;
      params.end_date = endDate;
    }

    // Status
    const statusOption = this.statusOptions.find((opt) => opt.value === status);
    if (statusOption && statusOption.apiValue !== null) {
      params.status = statusOption.apiValue;
    }

    // Type
    const tipeOption = this.tipeOptions.find((opt) => opt.value === tipe);
    if (tipeOption && tipeOption.apiValue !== null) {
      params.type = tipeOption.apiValue;
    }

    return params;
  }

  private convertApiToTimbanganData(apiData: any): TimbanganData {
    const tipeTransaksi: 'pembelian' | 'penjualan' = apiData.customer ? 'penjualan' : 'pembelian';
    return {
      id: apiData.id.toString(),
      noTiket: apiData.nomor_bon,
      noKendaraan: apiData.nomor_kendaraan,
      jenisKendaraan: apiData.jenis_kendaraan.toLowerCase() === 'truck' ? 'truck' : 'container',
      noContainer: apiData.nomor_container || undefined,
      namaBarang: apiData.barang,
      keteranganBarang: apiData.keterangan_barang || undefined,
      namaRelasi: apiData.suplier || apiData.customer || '',
      jenisRelasi: apiData.customer ? 'customer' : 'supplier',
      namaSupir: apiData.supir,
      timbanganPertama: parseFloat(apiData.berat_bruto) || 0,
      timbanganKedua: null, // Not provided in this endpoint
      tipeTransaksi: tipeTransaksi,
      // beratTara2:
      //   apiData.berat_bruto - apiData.berat_netto
      //     ? parseFloat(apiData.berat_bruto) - parseFloat(apiData.berat_netto)
      //     : null,
      laporanCustomer: apiData.customer || null,
      laporanSupplier: apiData.suplier || null,
      beratNetto: apiData.berat_netto ? parseFloat(apiData.berat_netto) : null,
      namaPenimbang: apiData.petugas,
      kelembapan: null,
      tipeBahan: apiData.type_bahan === 'Bahan Baku' ? 'bahan-baku' : 'lainnya',
      timestamp: apiData.created_at,
      updatedAt: apiData.updated_at,
      statusTimbangan: apiData.is_finished === '1' ? 'selesai' : 'masuk',
      statusUjiKelembapan: apiData.status === 'Belum Diuji' ? 'pending' : 'completed',
    };
  }

  private calculateAdditionalStats(
    data: TimbanganData[],
  ): Pick<
    LaporanStats,
    | 'totalBruto'
    | 'totalTara'
    | 'totalPotongan'
    | 'bahanBaku'
    | 'lainnya'
    | 'sudahDiuji'
    | 'belumDiuji'
    | 'rataRataBruto'
    | 'rataRataTara'
    | 'rataRataNetto'
  > {
    let totalBruto = 0;
    let totalTara = 0;
    let totalNetto = 0;
    let totalPotongan = 0;

    let countBruto = 0;
    let countTara = 0;
    let countNetto = 0;

    let bahanBaku = 0;
    let lainnya = 0;
    let sudahDiuji = 0;
    let belumDiuji = 0;

    for (const item of data) {
      // Bruto
      if (item.timbanganPertama && item.timbanganPertama > 0) {
        totalBruto += item.timbanganPertama;
        countBruto++;
      }

      // Tara = Bruto - Netto (jika Netto tersedia)
      const tara = item.beratNetto != null ? item.timbanganPertama - item.beratNetto : null;
      if (tara != null && tara >= 0) {
        totalTara += tara;
        countTara++;
      }

      // Netto
      if (item.beratNetto != null && item.beratNetto > 0) {
        totalNetto += item.beratNetto;
        countNetto++;
      }

      // Potongan hanya jika ada netto dan tara valid
      if (item.beratNetto != null && tara != null) {
        const potongan = item.timbanganPertama - tara - item.beratNetto;
        if (potongan > 0) {
          totalPotongan += potongan;
        }
      }

      // Klasifikasi tipe
      if (item.tipeBahan === 'bahan-baku') {
        bahanBaku++;
        if (item.statusUjiKelembapan === 'completed') {
          sudahDiuji++;
        } else {
          belumDiuji++;
        }
      } else {
        lainnya++;
      }
    }

    return {
      totalBruto,
      totalTara,
      totalPotongan,
      bahanBaku,
      lainnya,
      sudahDiuji,
      belumDiuji,
      rataRataBruto: countBruto > 0 ? totalBruto / countBruto : 0,
      rataRataTara: countTara > 0 ? totalTara / countTara : 0,
      rataRataNetto: countNetto > 0 ? totalNetto / countNetto : 0,
    };
  }

  private getEmptyStats(): LaporanStats {
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
      rataRataBruto: 0,
      rataRataTara: 0,
      rataRataNetto: 0,
    };
  }

  // EXCEL EXPORT DENGAN TAMPILAN SAMA SEPERTI PRINT LAPORAN
  // Install: npm install xlsx

  exportToExcel(): void {
    if (this.filteredData.length === 0) {
      alert('Tidak ada data untuk di-export');
      return;
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet: WorkSheet = {};

    // ====================================
    // 1. HEADER SECTION (Baris 1-4)
    // ====================================
    let currentRow = 1;

    // Baris 1: Logo dan Title (merge cells)
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, // Title row
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } }, // Subtitle row
    ];

    XLSX.utils.sheet_add_aoa(worksheet, [['PT AGRO DELI SERDANG'], ['LAPORAN DATA TIMBANGAN']], {
      origin: 'A1',
    });

    currentRow = 3;

    // Baris 3: Meta info (Periode, Tanggal Cetak, Jumlah Data)
    const metaInfo = [
      `Periode: ${this.periodLabel}`,
      `Tanggal Cetak: ${this.formatDate(this.currentDate)}`,
      `Jumlah Data: ${this.filteredData.length} transaksi`,
    ];

    XLSX.utils.sheet_add_aoa(
      worksheet,
      [
        [metaInfo.join('     |     ')], // Gabung dengan separator
      ],
      { origin: `A${currentRow}` },
    );

    worksheet['!merges'].push({ s: { r: currentRow - 1, c: 0 }, e: { r: currentRow - 1, c: 10 } });

    currentRow += 2; // Baris kosong

    // ====================================
    // 2. TABLE HEADER (Baris 5)
    // ====================================
    const headers = [
      'No.',
      'Tanggal',
      'No. Tiket',
      'Kendaraan',
      'Customer',
      'Supplier',
      'Barang',
      'Tipe',
      'Bruto (kg)',
      'Tara (kg)',
      'Netto (kg)',
    ];

    XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: `A${currentRow}` });

    currentRow++;

    // ====================================
    // 3. TABLE DATA
    // ====================================
    const tableData = this.filteredData.map((item, index) => [
      index + 1,
      this.formatDate(item.timestamp),
      item.noTiket,
      item.noKendaraan,
      item.laporanCustomer == '---' ? '-' : item.laporanCustomer || '-',
      item.laporanSupplier == '---' ? '-' : item.laporanSupplier || '-',
      item.namaBarang,
      item.tipeBahan === 'bahan-baku' ? 'Bahan Baku' : 'Lainnya',
      item.timbanganPertama,
      item.timbanganPertama - (item.beratNetto || 0),
      item.beratNetto ? item.beratNetto : 0,
    ]);

    XLSX.utils.sheet_add_aoa(worksheet, tableData, { origin: `A${currentRow}` });

    currentRow += tableData.length + 1; // +1 untuk baris kosong

    // ====================================
    // 4. SUMMARY SECTION (Seperti di print)
    // ====================================
    const summaryData = [
      [
        'Total Bruto',
        `${this.formatNumber(this.stats.totalBruto)} kg`,
        'Rata-rata Bruto',
        `${this.formatNumber(this.stats.rataRataBruto)} kg`,
      ],
      [
        'Total Tara',
        `${this.formatNumber(this.stats.totalTara)} kg`,
        'Rata-rata Tara',
        `${this.formatNumber(this.stats.rataRataTara)} kg`,
      ],
      [
        'Total Netto',
        `${this.formatNumber(this.stats.totalNetto)} kg`,
        'Rata-rata Netto',
        `${this.formatNumber(this.stats.rataRataNetto)} kg`,
      ],
    ];

    XLSX.utils.sheet_add_aoa(worksheet, summaryData, { origin: `A${currentRow}` });

    // ====================================
    // 5. STYLING & FORMATTING
    // ====================================

    // Set column widths (sama seperti print layout)
    worksheet['!cols'] = [
      { wch: 5 }, // No.
      { wch: 18 }, // Tanggal
      { wch: 12 }, // No. Tiket
      { wch: 15 }, // Kendaraan
      { wch: 15 }, // Customer
      { wch: 18 }, // Supplier
      { wch: 20 }, // Barang
      { wch: 12 }, // Tipe
      { wch: 12 }, // Bruto
      { wch: 12 }, // Tara
      { wch: 12 }, // Netto
    ];

    // Apply cell styles (header, borders, alignment)
    this.applyExcelStyles(worksheet, headers.length, tableData.length, currentRow);

    // ====================================
    // 6. SAVE FILE
    // ====================================
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Timbangan');

    const filename = `Laporan_Timbangan_${this.getFilenameDate()}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }

  // ====================================
  // HELPER: Apply Excel Styles
  // ====================================
  private applyExcelStyles(
    worksheet: WorkSheet,
    colCount: number,
    dataRowCount: number,
    summaryStartRow: number,
  ): void {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    // Style untuk setiap cell
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!worksheet[cellAddress]) continue;

        const cell = worksheet[cellAddress];

        // Initialize cell style
        if (!cell.s) cell.s = {};

        // Header Company (Row 1-2): Bold, Large, Center
        if (R === 0 || R === 1) {
          cell.s = {
            font: { bold: true, sz: R === 0 ? 16 : 14 },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: 'E8E8E8' } },
          };
        }

        // Meta Info (Row 3): Center
        if (R === 2) {
          cell.s = {
            font: { sz: 10 },
            alignment: { horizontal: 'center' },
            border: {
              bottom: { style: 'thin', color: { rgb: '000000' } },
            },
          };
        }

        // Table Headers (Row 5): Bold, Center, Background
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

        // Table Data: Borders
        if (R >= 5 && R < 5 + dataRowCount) {
          cell.s = {
            border: {
              top: { style: 'thin', color: { rgb: 'CCCCCC' } },
              bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
              left: { style: 'thin', color: { rgb: 'CCCCCC' } },
              right: { style: 'thin', color: { rgb: 'CCCCCC' } },
            },
            alignment: {
              horizontal: C === 0 ? 'center' : C >= 8 ? 'right' : 'left',
              vertical: 'center',
            },
          };

          // Number format untuk kolom angka (Bruto, Tara, Netto)
          if (C >= 8 && C <= 10) {
            cell.z = '#,##0'; // Thousand separator
          }
        }

        // Summary Section: Bold
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

  // ====================================
  // HELPER: Format Date for Excel
  // ====================================
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

  // ====================================
  // HELPER: Generate Filename with Date
  // ====================================
  private getFilenameDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');

    return `${year}${month}${day}_${hour}${minute}`;
  }

  // ====================================
  // VERSI ALTERNATIF: TANPA STYLING (Lebih Simple)
  // ====================================
  exportToExcelSimple(): void {
    if (this.filteredData.length === 0) {
      alert('Tidak ada data untuk di-export');
      return;
    }

    const workbook = XLSX.utils.book_new();

    // Header section
    const headerData = [
      ['PT AGRO DELI SERDANG'],
      ['LAPORAN DATA TIMBANGAN'],
      [
        `Periode: ${this.periodLabel}  |  Tanggal Cetak: ${this.formatDate(this.currentDate)}  |  Jumlah Data: ${this.filteredData.length} transaksi`,
      ],
      [], // Empty row
    ];

    // Table headers
    const tableHeaders = [
      [
        'No.',
        'Tanggal',
        'No. Tiket',
        'Kendaraan',
        'Customer',
        'Supplier',
        'Barang',
        'Tipe',
        'Bruto (kg)',
        'Tara (kg)',
        'Netto (kg)',
      ],
    ];

    // Table data
    const tableData = this.filteredData.map((item, index) => [
      index + 1,
      this.formatDate(item.timestamp),
      item.noTiket,
      item.noKendaraan,
      item.laporanCustomer || '-',
      item.laporanSupplier || '-',
      item.namaBarang,
      item.tipeBahan === 'bahan-baku' ? 'Bahan Baku' : 'Lainnya',
      item.timbanganPertama,
      item.timbanganPertama - (item.beratNetto || 0),
      item.beratNetto || 0,
    ]);

    // Summary section
    const summaryData = [
      [], // Empty row
      [
        'Total Bruto',
        `${this.formatNumber(this.stats.totalBruto)} kg`,
        'Rata-rata Bruto',
        `${this.formatNumber(this.stats.rataRataBruto)} kg`,
      ],
      [
        'Total Tara',
        `${this.formatNumber(this.stats.totalTara)} kg`,
        'Rata-rata Tara',
        `${this.formatNumber(this.stats.rataRataTara)} kg`,
      ],
      [
        'Total Netto',
        `${this.formatNumber(this.stats.totalNetto)} kg`,
        'Rata-rata Netto',
        `${this.formatNumber(this.stats.rataRataNetto)} kg`,
      ],
    ];

    // Combine all data
    const allData = [...headerData, ...tableHeaders, ...tableData, ...summaryData];

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(allData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 5 },
      { wch: 18 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Timbangan');

    // Save file
    const filename = `Laporan_Timbangan_${this.getFilenameDate()}.xlsx`;
    XLSX.writeFile(workbook, filename);
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
    // Pastikan data siap
    if (this.filteredData.length === 0) return;

    // Trigger print
    window.print();
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  formatNumber(num: number | string | null | undefined): string {
    if (num === null || num === undefined || num === '' || isNaN(Number(num))) {
      return '0';
    }

    const value = Number(num);
    if (!isFinite(value)) {
      return '0';
    }

    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.floor(value)); // atau Math.round(value) jika ingin pembulatan
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

  // Ganti getter periodLabel yang sudah ada dengan ini:
  get periodLabel(): string {
    const period = this.filterForm.get('period')?.value;
    const startDate = this.filterForm.get('startDate')?.value;
    const endDate = this.filterForm.get('endDate')?.value;

    if (period === 'custom' && startDate && endDate) {
      // Format tanggal untuk custom range
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

    // Untuk periode lainnya (harian, mingguan, bulanan)
    const option = this.periodOptions.find((opt) => opt.value === period);
    return option?.label || '';
  }

  toggleShowRincian(): void {
    this.isRincianVisible = !this.isRincianVisible;
  }
}
