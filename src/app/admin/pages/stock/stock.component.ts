// src/app/admin/pages/stock/stock.component.ts

import { ChangeDetectionStrategy, Component, computed, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as XLSX from 'xlsx';
import { ApiService } from '../../services/api.service';
import { StockItem } from './interfaces/stock.interface';
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
  isSubmittingPemakaian = signal<boolean>(false);

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

  constructor(
    private fb: FormBuilder,
    private stockService: StockService,
    private api: ApiService,
  ) {}

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
      jumlah: ['', [Validators.required, Validators.min(0.01)]],
      nomor_bon: ['', Validators.required],
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

  loadStockData(): void {
    this.isLoading.set(true);

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const startDate = this.formatDateParam(yesterday);
    const endDate = this.formatDateParam(today);

    this.stockService.getRawMaterialReport(startDate, endDate).subscribe({
      next: (res) => {
        // Langsung filter res.data di sini, misalnya hanya id === 1
        const dataFiltered = res.data.filter(
          (item: any) =>
            item.id == 1 ||
            item.id == 2 ||
            item.id == 3 ||
            item.id == 4 ||
            item.id == 5 ||
            item.id == 6,
        );

        const mappedData: StockItem[] = dataFiltered.map((item) => ({
          id: item.id,
          barang: item.nama,
          stock_awal: item.beginning_ballance,
          penerimaan: item.received_in_period,
          pemakaian: item.used_in_period,
          stock_akhir: item.ending_ballance,
          stock_barang: item.stok,
          satuan: 'Kg',
          last_updated: new Date().toISOString(),
        }));

        this.stockData.set(mappedData);
        this.filteredStockData.set(mappedData);
        this.isLoading.set(false);

        console.log('cek data ini (hanya id 1): ', this.stockData());
      },
      error: (error) => {
        console.error('Failed to load stock data from API', error);
        this.isLoading.set(false);
      },
    });
  }

  loadTransactionHistory(): void {
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
      keterangan: '',
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

      console.log('Penerimaan submitted:', formData);

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
    if (!this.pemakaianForm.valid) {
      alert('Please fill in all required fields correctly');
      return;
    }

    const formData = this.pemakaianForm.value;
    const jumlah = Number(formData.jumlah);

    // Cari stock item berdasarkan nama barang
    const stockItem = this.stockData().find((item) => item.barang === formData.barang);

    if (!stockItem) {
      alert('Item not found in stock data');
      return;
    }

    // Validasi stock mencukupi
    if (stockItem.stock_akhir < jumlah) {
      alert(`Insufficient stock! Available: ${this.formatNumber(stockItem.stock_akhir)} Kg`);
      return;
    }

    // Set loading state
    this.isSubmittingPemakaian.set(true);

    // Payload sesuai dokumentasi API
    const payload = {
      id: stockItem.id.toString(), // ID bahan baku dari API
      qty: jumlah.toString(), // Jumlah penggunaan
      usage_no: formData.nomor_bon, // Nomor bon penggunaan
      purpose: '-', // Keperluan (bisa diisi default atau dari form)
      date: formData.tanggal, // Tanggal penggunaan
      officer: formData.petugas, // Petugas yang mencatat
      notes: formData.keterangan || '', // Catatan tambahan (opsional)
    };

    console.log('Submitting pemakaian with payload:', payload);

    // Kirim ke API menggunakan ApiService
    this.api.postMultipart('pemakaian-barang', payload).subscribe({
      next: (response: any) => {
        console.log('Pemakaian API response:', response);

        if (response.success) {
          // Update stock data di frontend
          const currentStock = this.stockData();
          const updatedStock = currentStock.map((item) => {
            if (item.id === stockItem.id) {
              return {
                ...item,
                pemakaian: item.pemakaian + jumlah,
                stock_akhir: item.stock_akhir - jumlah,
                last_updated: new Date().toISOString(),
              };
            }
            return item;
          });

          this.stockData.set(updatedStock);
          this.filterStock();

          // Tambahkan ke transaction history
          const newTransaction: TransactionHistory = {
            id: this.transactionHistory().length + 1,
            barang: formData.barang,
            jenis: 'pemakaian',
            jumlah,
            nomor_bon: formData.nomor_bon,
            nomor_kendaraan: '-',
            supir: '-',
            tanggal: new Date().toISOString(),
            petugas: formData.petugas,
          };

          this.transactionHistory.set([newTransaction, ...this.transactionHistory()]);

          // Refresh stock data from server untuk data terbaru
          this.loadStockData();
          this.calculatePeriodReport();

          // Tutup modal dan tampilkan pesan sukses
          this.closePemakaianModal();
          alert(response.message || 'Material usage recorded successfully!');
        } else {
          alert(response.message || 'Failed to record usage');
        }

        this.isSubmittingPemakaian.set(false);
      },
      error: (error) => {
        console.error('Failed to submit pemakaian:', error);

        let errorMessage = 'Failed to record material usage. ';

        if (error.error?.message) {
          errorMessage += error.error.message;
        } else if (error.message) {
          errorMessage += error.message;
        } else {
          errorMessage += 'Please try again.';
        }

        alert(errorMessage);
        this.isSubmittingPemakaian.set(false);
      },
    });
  }

  applyHistoryFilter(): void {
    let filtered = this.transactionHistory();

    if (this.filterBarangHistory() !== 'semua') {
      filtered = filtered.filter((t) => t.barang === this.filterBarangHistory());
    }

    if (this.filterJenisTransaksi() !== 'semua') {
      filtered = filtered.filter((t) => t.jenis === this.filterJenisTransaksi());
    }

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
    alert('Export feature coming soon!');
  }

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
        const dataFiltered = res.data.filter(
          (item: any) =>
            item.id == 1 ||
            item.id == 2 ||
            item.id == 3 ||
            item.id == 4 ||
            item.id == 5 ||
            item.id == 6,
        );
        let items = dataFiltered;
        if (this.selectedBarang() !== 'semua') {
          items = items.filter((i) => i.nama === this.selectedBarang());
        }

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
    alert('Period report export feature coming soon!');
  }

  printPeriodReport(): void {
    window.print();
  }

  exportPeriodToExcel(): void {
    const exportData: any[] = [];

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

    exportData.push([
      'Item',
      'Description',
      'Beginning Balance (Kg)',
      'Received in Period (Kg)',
      'Used in Period (Kg)',
      'Ending Balance (Kg)',
    ]);

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

    const ws = XLSX.utils.aoa_to_sheet(exportData);

    ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 20 }, { wch: 20 }];

    const headerStyle = {
      font: { bold: true },
      alignment: { horizontal: 'center' },
    };

    if (ws['A1']) ws['A1'].s = { font: { bold: true, sz: 14 } };
    if (ws['A2']) ws['A2'].s = { font: { bold: true, sz: 12 } };

    let headerRowIndex = -1;
    for (let i = 0; i < exportData.length; i++) {
      if (exportData[i][0] === 'Item') {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex !== -1) {
      const headerRow = headerRowIndex + 1;
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

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Period Report');

    const filename = `Stock_Period_Report_${this.periodStartDate()}_to_${this.periodEndDate()}.xlsx`;

    XLSX.writeFile(wb, filename);
  }

  // ANCHOR STOCK LEVEL
  // Cari stok LOCC/OCC sebagai reference (id === 1) - gunakan stock_barang
  getLoccOccStock(): number {
    const loccItem = this.stockData().find((item) => item.id === 1);
    return loccItem ? loccItem.stock_barang : 0;
  }

  // Tentukan apakah item adalah primary (LOCC/OCC atau DLK)
  isPrimaryItem(item: StockItem): boolean {
    return item.id === 1 || item.id === 2; // LOCC/OCC atau DLK
  }

  // Hitung persentase stock level
  getStockPercentage(item: StockItem): number {
    if (this.isPrimaryItem(item)) {
      return 100; // Selalu 100% untuk LOCC/OCC dan DLK
    }

    const loccStock = this.getLoccOccStock();
    if (loccStock <= 0) {
      return 0;
    }

    // Gunakan stock_barang untuk perhitungan
    const percentage = (item.stock_barang / loccStock) * 100;
    return Math.min(100, Math.max(0, percentage)); // Batasi 0-100%
  }

  // Tentukan level warna: high, medium, low + warning
  getStockLevelClass(item: StockItem): string {
    if (this.isPrimaryItem(item)) {
      return 'level-high'; // Selalu hijau
    }

    const percentage = this.getStockPercentage(item);

    if (percentage >= 50) return 'level-high';
    if (percentage >= 20) return 'level-medium';
    return 'level-low'; // <20% → merah + warning
  }

  // Apakah perlu warning "gunakan dulu"?
  needsRestockWarning(item: StockItem): boolean {
    if (this.isPrimaryItem(item)) return false;
    // DIBALIK: warning jika >= 20% (bukan < 20%)
    return this.getStockPercentage(item) >= 20;
  }
  // ANCHOR END STOCK LEVEL
}
