// src/app/admin/pages/stock/services/stock.service.ts

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  PemakaianRequest,
  PenerimaanRequest,
  StockItem,
  StockResponse,
  TransactionHistory,
  TransactionResponse,
  RawMaterialReportResponse,
} from '../interfaces/stock.interface';
import { ApiService } from '../../../services/api.service';

@Injectable({
  providedIn: 'root',
})
export class StockService {
  private apiUrl = 'stock'; // endpoint relatif untuk ApiService
  private rawMaterialReportEndpoint = 'raw-material-report';

  constructor(private http: HttpClient, private api: ApiService) {}

  /**
   * Get all stock data
   */
  getStockData(): Observable<StockResponse> {
    // TODO: Uncomment when API is ready
    // return this.http.get<StockResponse>(`${this.apiUrl}`);

    // Dummy data untuk development
    const dummyData: StockItem[] = [
      {
        id: 1,
        barang: 'LOCC/OCC',
        stock_awal: 15804333,
        penerimaan: 175580,
        pemakaian: 188658,
        stock_akhir: 15791255,
        satuan: 'Kg',
        last_updated: new Date().toISOString(),
      },
      {
        id: 2,
        barang: 'DLK',
        stock_awal: 211080,
        penerimaan: 34290,
        pemakaian: 40170,
        stock_akhir: 205200,
        satuan: 'Kg',
        last_updated: new Date().toISOString(),
      },
      {
        id: 3,
        barang: 'DUPLEK',
        stock_awal: 125000,
        penerimaan: 12500,
        pemakaian: 15000,
        stock_akhir: 122500,
        satuan: 'Kg',
        last_updated: new Date().toISOString(),
      },
      {
        id: 4,
        barang: 'MIX WASTE',
        stock_awal: 43840,
        penerimaan: 5800,
        pemakaian: 10790,
        stock_akhir: 38850,
        satuan: 'Kg',
        last_updated: new Date().toISOString(),
      },
      {
        id: 5,
        barang: 'SARANG TELOR',
        stock_awal: 8500,
        penerimaan: 1200,
        pemakaian: 950,
        stock_akhir: 8750,
        satuan: 'Kg',
        last_updated: new Date().toISOString(),
      },
      {
        id: 6,
        barang: 'TUNGKUL',
        stock_awal: 6200,
        penerimaan: 800,
        pemakaian: 1100,
        stock_akhir: 5900,
        satuan: 'Kg',
        last_updated: new Date().toISOString(),
      },
    ];

    return of({
      success: true,
      message: 'Data stock berhasil diambil',
      data: dummyData,
    }).pipe(delay(500)); // Simulate network delay
  }

  /**
   * Get stock data by barang type
   */
  getStockByBarang(barang: string): Observable<StockResponse> {
    // TODO: Uncomment when API is ready
    // const params = new HttpParams().set('barang', barang);
    // return this.http.get<StockResponse>(`${this.apiUrl}`, { params });

    return this.getStockData();
  }

  /**
   * Get transaction history
   */
  getTransactionHistory(filters?: {
    barang?: string;
    jenis?: string;
    date_from?: string;
    date_to?: string;
  }): Observable<TransactionResponse> {
    // TODO: Uncomment when API is ready
    // let params = new HttpParams();
    // if (filters?.barang) params = params.set('barang', filters.barang);
    // if (filters?.jenis) params = params.set('jenis', filters.jenis);
    // if (filters?.date_from) params = params.set('date_from', filters.date_from);
    // if (filters?.date_to) params = params.set('date_to', filters.date_to);
    // return this.http.get<TransactionResponse>(`${this.apiUrl}/history`, { params });

    // Dummy data untuk development
    const dummyHistory: TransactionHistory[] = [
      {
        id: 1,
        barang: 'LOCC/OCC',
        jenis: 'penerimaan',
        jumlah: 918,
        nomor_bon: 'DLK',
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
        keterangan: 'Produksi batch A',
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

    return of({
      success: true,
      message: 'Data riwayat transaksi berhasil diambil',
      data: dummyHistory,
    }).pipe(delay(500));
  }

  /**
   * Create penerimaan (incoming stock)
   */
  createPenerimaan(data: PenerimaanRequest): Observable<any> {
    // TODO: Uncomment when API is ready
    // return this.http.post(`${this.apiUrl}/penerimaan`, data);

    // Dummy response untuk development
    return of({
      success: true,
      message: 'Penerimaan bahan baku berhasil ditambahkan',
      data: {
        id: Math.floor(Math.random() * 1000),
        ...data,
        created_at: new Date().toISOString(),
      },
    }).pipe(delay(500));
  }

  /**
   * Create pemakaian (outgoing stock)
   */
  createPemakaian(data: PemakaianRequest): Observable<any> {
    // TODO: Uncomment when API is ready
    // return this.http.post(`${this.apiUrl}/pemakaian`, data);

    // Dummy response untuk development
    return of({
      success: true,
      message: 'Pemakaian bahan baku berhasil ditambahkan',
      data: {
        id: Math.floor(Math.random() * 1000),
        ...data,
        created_at: new Date().toISOString(),
      },
    }).pipe(delay(500));
  }

  /**
   * Export stock data to Excel
   */
  exportToExcel(barang?: string): Observable<Blob> {
    // TODO: Uncomment when API is ready
    // const params = barang ? new HttpParams().set('barang', barang) : undefined;
    // return this.http.get(`${this.apiUrl}/export`, {
    //   params,
    //   responseType: 'blob'
    // });

    // Dummy response untuk development
    return of(new Blob(['Dummy Excel Data'], { type: 'application/vnd.ms-excel' })).pipe(
      delay(1000),
    );
  }

  /**
   * Get stock summary/statistics
   */
  getStockSummary(): Observable<any> {
    // TODO: Uncomment when API is ready
    // return this.http.get(`${this.apiUrl}/summary`);

    return of({
      success: true,
      message: 'Data summary berhasil diambil',
      data: {
        total_stock_awal: 16198953,
        total_penerimaan: 230170,
        total_pemakaian: 256668,
        total_stock_akhir: 16172455,
        total_items: 6,
      },
    }).pipe(delay(300));
  }

  /**
   * Get raw material report (used for stock table)
   */
  getRawMaterialReport(startDate: string, endDate: string): Observable<RawMaterialReportResponse> {
    return this.api.get<RawMaterialReportResponse>(this.rawMaterialReportEndpoint, {
      start_date: startDate,
      end_date: endDate,
    }) as unknown as Observable<RawMaterialReportResponse>;
  }
}
