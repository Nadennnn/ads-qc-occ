// src/app/admin/pages/stock/stock.component.ts

import { ChangeDetectionStrategy, Component, computed, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as XLSX from 'xlsx';
import { StockItem, TransactionHistory as ApiTransactionHistory } from './interfaces/stock.interface';
import { StockService } from './services/stock.service';

interface BarangOption {
  value: string;
  label: string;
}

interface TransactionHistory {
  id: number;
  barang: string;
  jenis: 'penerimaan' | 'pemakaian';
  jumlah: number;
  nomor_bon: string;
  nomor_kendaraan: string;
  suplier?: string;
  supir: string;
  tanggal: string;
  petugas: string;
}

interface PeriodReport {
  item: string;
  description: string;
  beginningBalance: number;
  receivedInPeriod: number;
  usedInPeriod: number;
  endingBalance: number;
  isTotal?: boolean;
}

@Component({
  selector: 'app-stock',
  templateUrl: './stock.component.html',
  styleUrls: ['./stock.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class StockComponent implements OnInit {
  readonly bahanBakuOptions: BarangOption[] = [
    { value: 'semua', label: 'All Items' },
    { value: 'LOCC/OCC', label: 'LOCC/OCC' },
    { value: 'DLK', label: 'DLK' },
    { value: 'DUPLEK', label: 'DUPLEK' },
    { value: 'MIX WASTE', label: 'MIX WASTE' },
    { value: 'SARANG TELOR', label: 'SARANG TELOR' },
    { value: 'TUNGKUL', label: 'TUNGKUL' },
  ];

  // Signals untuk reactive state
  stockData = signal<StockItem[]>([]);
  filteredStockData = signal<StockItem[]>([]);
  transactionHistory = signal<TransactionHistory[]>([]);
  filteredTransactions = signal<TransactionHistory[]>([]);
  selectedBarang = signal<string>('semua');
  isLoading = signal<boolean>(false);
  isRincianVisible = signal<boolean>(false);
  isPeriodLoading = signal<boolean>(false);

  // Modal states
  showPenerimaanModal = signal<boolean>(false);
  showPemakaianModal = signal<boolean>(false);
  showHistoryModal = signal<boolean>(false);

  // Forms
  penerimaanForm!: FormGroup;
  pemakaianForm!: FormGroup;

  // Filter untuk history
  filterBarangHistory = signal<string>('semua');
  filterJenisTransaksi = signal<string>('semua');
  filterDateFrom = signal<string>('');
  filterDateTo = signal<string>('');

  // Period Report
  periodStartDate = signal<string>(this.getFirstDayOfMonth());
  periodEndDate = signal<string>(this.getTodayDate());
  periodReportData = signal<PeriodReport[]>([]);

  // Computed values for totals
  totalStockAwal = computed(() =>
    this.filteredStockData().reduce((sum, item) => sum + item.stock_awal, 0),
  );

  totalPenerimaan = computed(() =>
    this.filteredStockData().reduce((sum, item) => sum + item.penerimaan, 0),
  );

  totalPemakaian = computed(() =>
    this.filteredStockData().reduce((sum, item) => sum + item.pemakaian, 0),
  );

  totalStockAkhir = computed(() =>
    this.filteredStockData().reduce((sum, item) => sum + item.stock_akhir, 0),
  );

  constructor(private fb: FormBuilder, private stockService: StockService) {}

  ngOnInit(): void {
    this.initializeForms();
    this.loadStockData();
    this.loadTransactionHistory();
    this.calculatePeriodReport();
  }

  initializeForms(): void {
    this.penerimaanForm = this.fb.group({
      barang: ['', Validators.required],
      jumlah: ['', [Validators.required, Validators.min(1)]],
      nomor_bon: ['', Validators.required],
      nomor_kendaraan: ['', Validators.required],
      suplier: ['', Validators.required],
      supir: ['', Validators.required],
      tanggal: [new Date().toISOString().split('T')[0], Validators.required],
      petugas: ['', Validators.required],
      keterangan: [''],
    });

    this.pemakaianForm = this.fb.group({
      barang: ['', Validators.required],
      jumlah: ['', [Validators.required, Validators.min(1)]],
      nomor_bon: ['', Validators.required],
      keperluan: ['', Validators.required],
      tanggal: [new Date().toISOString().split('T')[0], Validators.required],
      petugas: ['', Validators.required],
      keterangan: [''],
    });
  }

  private formatDateParam(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Load stock data from API /api/raw-material-report with dynamic dates
  // Rule: start_date = yesterday, end_date = today
  loadStockData(): void {
    this.isLoading.set(true);

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const startDate = this.formatDateParam(yesterday);
    const endDate = this.formatDateParam(today);

    this.stockService.getRawMaterialReport(startDate, endDate).subscribe({
      next: (res) => {
        const mappedData: StockItem[] = res.data.map((item) => ({
          id: item.id,
          barang: item.nama,
          stock_awal: item.beginning_ballance,
          penerimaan: item.received_in_period,
          pemakaian: item.used_in_period,
          stock_akhir: item.ending_ballance,
          satuan: 'Kg',
          // API tidak menyediakan last_updated, jadi kita gunakan tanggal hari ini
          last_updated: new Date().toISOString(),
        }));

        this.stockData.set(mappedData);
        this.filteredStockData.set(mappedData);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to load stock data from API', error);
        this.isLoading.set(false);
      },
    });
  }

  loadTransactionHistory(): void {
    // Dummy transaction history
    const dummyHistory: TransactionHistory[] = [
      {
        id: 1,
        barang: 'LOCC/OCC',
        jenis: 'penerimaan',
        jumlah: 918,
        nomor_bon: 'DLK-001',
        nomor_kendaraan: 'BK 123 ADS',
        suplier: 'CV SEMENBATU LTO',
        supir: 'YOGA',
        tanggal: '2025-12-11T03:00:03Z',
        petugas: 'NADEN',
      },
      {
        id: 2,
        barang: 'DLK',
        jenis: 'penerimaan',
        jumlah: 1500,
        nomor_bon: 'DLK-002',
        nomor_kendaraan: 'L 456 XYZ',
        suplier: 'PT MAJU JAYA',
        supir: 'BUDI',
        tanggal: '2025-12-12T04:30:00Z',
        petugas: 'SITI',
      },
      {
        id: 3,
        barang: 'LOCC/OCC',
        jenis: 'pemakaian',
        jumlah: 2500,
        nomor_bon: 'PM-001',
        nomor_kendaraan: '-',
        supir: '-',
        tanggal: '2025-12-13T02:15:00Z',
        petugas: 'AHMAD',
      },
      {
        id: 4,
        barang: 'MIX WASTE',
        jenis: 'penerimaan',
        jumlah: 750,
        nomor_bon: 'MW-001',
        nomor_kendaraan: 'N 789 ABC',
        suplier: 'CV BERKAH',
        supir: 'DEDI',
        tanggal: '2025-12-14T05:00:00Z',
        petugas: 'RINI',
      },
    ];

    this.transactionHistory.set(dummyHistory);
    this.filteredTransactions.set(dummyHistory);
  }

  filterStock(): void {
    const selected = this.selectedBarang();
    const allData = this.stockData();

    if (selected === 'semua') {
      this.filteredStockData.set(allData);
    } else {
      this.filteredStockData.set(allData.filter((item) => item.barang === selected));
    }

    // Recalculate period report when filter changes
    this.calculatePeriodReport();
  }

  onBarangChange(value: string): void {
    this.selectedBarang.set(value);
    this.filterStock();
  }

  toggleRincian(): void {
    this.isRincianVisible.set(!this.isRincianVisible());
  }

  openPenerimaanModal(): void {
    this.penerimaanForm.reset({
      tanggal: new Date().toISOString().split('T')[0],
    });
    this.showPenerimaanModal.set(true);
  }

  closePenerimaanModal(): void {
    this.showPenerimaanModal.set(false);
  }

  openPemakaianModal(): void {
    this.pemakaianForm.reset({
      tanggal: new Date().toISOString().split('T')[0],
    });
    this.showPemakaianModal.set(true);
  }

  closePemakaianModal(): void {
    this.showPemakaianModal.set(false);
  }

  openHistoryModal(): void {
    this.showHistoryModal.set(true);
    this.applyHistoryFilter();
  }

  closeHistoryModal(): void {
    this.showHistoryModal.set(false);
  }

  submitPenerimaan(): void {
    if (this.penerimaanForm.valid) {
      const formData = this.penerimaanForm.value;

      // TODO: Kirim ke API
      console.log('Penerimaan submitted:', formData);

      // Update stock (dummy)
      const currentStock = this.stockData();
      const updatedStock = currentStock.map((item) => {
        if (item.barang === formData.barang) {
          return {
            ...item,
            penerimaan: item.penerimaan + Number(formData.jumlah),
            stock_akhir: item.stock_akhir + Number(formData.jumlah),
            last_updated: new Date().toISOString(),
          };
        }
        return item;
      });

      this.stockData.set(updatedStock);
      this.filterStock();

      // Add to history
      const newTransaction: TransactionHistory = {
        id: this.transactionHistory().length + 1,
        barang: formData.barang,
        jenis: 'penerimaan',
        jumlah: formData.jumlah,
        nomor_bon: formData.nomor_bon,
        nomor_kendaraan: formData.nomor_kendaraan,
        suplier: formData.suplier,
        supir: formData.supir,
        tanggal: new Date().toISOString(),
        petugas: formData.petugas,
      };

      this.transactionHistory.set([newTransaction, ...this.transactionHistory()]);

      this.closePenerimaanModal();
      alert('Receipt successfully added!');
    }
  }

  submitPemakaian(): void {
    if (this.pemakaianForm.valid) {
      const formData = this.pemakaianForm.value;

      // Cek apakah stock cukup
      const stockItem = this.stockData().find((item) => item.barang === formData.barang);
      if (stockItem && stockItem.stock_akhir < formData.jumlah) {
        alert('Insufficient stock!');
        return;
      }

      // TODO: Kirim ke API
      console.log('Pemakaian submitted:', formData);

      // Update stock (dummy)
      const currentStock = this.stockData();
      const updatedStock = currentStock.map((item) => {
        if (item.barang === formData.barang) {
          return {
            ...item,
            pemakaian: item.pemakaian + Number(formData.jumlah),
            stock_akhir: item.stock_akhir - Number(formData.jumlah),
            last_updated: new Date().toISOString(),
          };
        }
        return item;
      });

      this.stockData.set(updatedStock);
      this.filterStock();

      // Add to history
      const newTransaction: TransactionHistory = {
        id: this.transactionHistory().length + 1,
        barang: formData.barang,
        jenis: 'pemakaian',
        jumlah: formData.jumlah,
        nomor_bon: formData.nomor_bon,
        nomor_kendaraan: '-',
        supir: '-',
        tanggal: new Date().toISOString(),
        petugas: formData.petugas,
      };

      this.transactionHistory.set([newTransaction, ...this.transactionHistory()]);

      this.closePemakaianModal();
      alert('Usage successfully added!');
    }
  }

  applyHistoryFilter(): void {
    let filtered = this.transactionHistory();

    // Filter by barang
    if (this.filterBarangHistory() !== 'semua') {
      filtered = filtered.filter((t) => t.barang === this.filterBarangHistory());
    }

    // Filter by jenis transaksi
    if (this.filterJenisTransaksi() !== 'semua') {
      filtered = filtered.filter((t) => t.jenis === this.filterJenisTransaksi());
    }

    // Filter by date range
    if (this.filterDateFrom()) {
      const fromDate = new Date(this.filterDateFrom());
      filtered = filtered.filter((t) => new Date(t.tanggal) >= fromDate);
    }

    if (this.filterDateTo()) {
      const toDate = new Date(this.filterDateTo());
      toDate.setHours(23, 59, 59);
      filtered = filtered.filter((t) => new Date(t.tanggal) <= toDate);
    }

    this.filteredTransactions.set(filtered);
  }

  resetHistoryFilter(): void {
    this.filterBarangHistory.set('semua');
    this.filterJenisTransaksi.set('semua');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.filteredTransactions.set(this.transactionHistory());
  }

  formatNumber(num: number): string {
    return new Intl.NumberFormat('id-ID').format(num);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  exportToExcel(): void {
    // TODO: Implement export to Excel
    alert('Export feature coming soon!');
  }

  // Helper functions for period report
  getFirstDayOfMonth(): string {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  }

  getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  calculatePeriodReport(): void {
    const startDate = this.periodStartDate();
    const endDate = this.periodEndDate();

    if (!startDate || !endDate) {
      this.periodReportData.set([]);
      return;
    }

    this.isPeriodLoading.set(true);

    this.stockService.getRawMaterialReport(startDate, endDate).subscribe({
      next: (res) => {
        // Filter by selected item if needed
        let items = res.data;
        if (this.selectedBarang() !== 'semua') {
          items = items.filter((i) => i.nama === this.selectedBarang());
        }

        // Hanya tampilkan item yang punya aktivitas (received atau used in period != 0/null)
        items = items.filter((i) => {
          const received = i.received_in_period ?? 0;
          const used = i.used_in_period ?? 0;
          return received !== 0 || used !== 0;
        });

        const reportData: PeriodReport[] = [];

        let totalBeginning = 0;
        let totalReceived = 0;
        let totalUsed = 0;
        let totalEnding = 0;

        items.forEach((item, index) => {
          const beginningBalance = item.beginning_ballance;
          const receivedInPeriod = item.received_in_period;
          const usedInPeriod = item.used_in_period;
          const endingBalance = item.ending_ballance;

          // Generate item code (optional, not shown in table but kept for consistency)
          const itemCode = `RM_${item.nama.replace(/\//g, '_').replace(/\s+/g, '_')}_${String(
            item.id ?? index + 1,
          ).padStart(2, '0')}`;

          reportData.push({
            item: itemCode,
            description: item.nama,
            beginningBalance,
            receivedInPeriod,
            usedInPeriod,
            endingBalance,
          });

          totalBeginning += beginningBalance;
          totalReceived += receivedInPeriod;
          totalUsed += usedInPeriod;
          totalEnding += endingBalance;
        });

        // Tambahkan baris TOTAL
        reportData.push({
          item: 'TOTAL',
          description: '',
          beginningBalance: totalBeginning,
          receivedInPeriod: totalReceived,
          usedInPeriod: totalUsed,
          endingBalance: totalEnding,
          isTotal: true,
        });

        this.periodReportData.set(reportData);
        this.isPeriodLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to load period report from API', error);
        this.periodReportData.set([]);
        this.isPeriodLoading.set(false);
      },
    });
  }

  formatDateShort(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  getCurrentDateFormatted(): string {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  exportPeriodReport(): void {
    // TODO: Implement export period report to Excel
    alert('Period report export feature coming soon!');
  }

  printPeriodReport(): void {
    window.print();
  }

  exportPeriodToExcel(): void {
    // Prepare data for export
    const exportData: any[] = [];

    // Add header info
    exportData.push(['PT AGRO DELI SERDANG']);
    exportData.push(['RAW MATERIAL PERIOD REPORT']);
    exportData.push([]);
    exportData.push([
      'Period:',
      `${this.formatDateShort(this.periodStartDate())} - ${this.formatDateShort(this.periodEndDate())}`,
    ]);
    if (this.selectedBarang() !== 'semua') {
      exportData.push(['Filter:', this.selectedBarang()]);
    }
    exportData.push(['Print Date:', this.getCurrentDateFormatted()]);
    exportData.push([]);

    // Add table headers
    exportData.push([
      'Item',
      'Description',
      'Beginning Balance (Kg)',
      'Received in Period (Kg)',
      'Used in Period (Kg)',
      'Ending Balance (Kg)',
    ]);

    // Add data rows
    this.periodReportData().forEach((report) => {
      exportData.push([
        report.item,
        report.description,
        report.beginningBalance,
        report.receivedInPeriod,
        report.usedInPeriod,
        report.endingBalance,
      ]);
    });

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(exportData);

    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Item
      { wch: 20 }, // Description
      { wch: 20 }, // Beginning Balance
      { wch: 22 }, // Received
      { wch: 20 }, // Used
      { wch: 20 }, // Ending Balance
    ];

    // Style header rows (bold)
    const headerStyle = {
      font: { bold: true },
      alignment: { horizontal: 'center' },
    };

    // Apply styles to headers
    if (ws['A1']) ws['A1'].s = { font: { bold: true, sz: 14 } };
    if (ws['A2']) ws['A2'].s = { font: { bold: true, sz: 12 } };

    // Find the data table header row (should be row with "Item", "Description", etc)
    let headerRowIndex = -1;
    for (let i = 0; i < exportData.length; i++) {
      if (exportData[i][0] === 'Item') {
        headerRowIndex = i;
        break;
      }
    }

    // Style table header row
    if (headerRowIndex !== -1) {
      const headerRow = headerRowIndex + 1; // XLSX uses 1-based indexing
      ['A', 'B', 'C', 'D', 'E', 'F'].forEach((col) => {
        const cellRef = `${col}${headerRow}`;
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: 'E8E8E8' } },
            alignment: { horizontal: 'center' },
          };
        }
      });
    }

    // Style TOTAL row
    const totalRowIndex = exportData.length;
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach((col) => {
      const cellRef = `${col}${totalRowIndex}`;
      if (ws[cellRef]) {
        ws[cellRef].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: 'E8E8E8' } },
        };
      }
    });

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Period Report');

    // Generate filename with date range
    const filename = `Stock_Period_Report_${this.periodStartDate()}_to_${this.periodEndDate()}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);
  }
}
