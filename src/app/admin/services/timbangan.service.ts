// src/app/admin/services/timbangan.service.ts

import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiResponse, ApiService } from './api.service';

// Interface untuk data dari API Backend
export interface ApiTimbanganData {
  id: number;
  nomor_bon: string;
  jenis_kendaraan: string;
  nomor_kendaraan: string;
  nomor_container: string | null;
  type_bahan: string;
  barang: string;
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
}

// Interface untuk data internal (tetap untuk compatibility)
// ✅ STEP 2: Update interface TimbanganData (tambahkan 2 field ini)
export interface TimbanganData {
  id: string;
  noTiket: string;
  noKendaraan: string;
  namaBarang: string;
  jenisKendaraan: 'truck' | 'container';
  noContainer?: string;
  keteranganBarang?: string;
  namaRelasi: string;
  laporanCustomer?: string | null;
  laporanSupplier?: string | null;
  jenisRelasi?: 'customer' | 'supplier';
  namaSupir: string;
  timbanganPertama: number;
  timbanganKedua: number | null;
  // beratTara2: number | null;
  beratNetto: number | null;
  namaPenimbang: string;
  kelembapan: number | null;
  tipeBahan: 'bahan-baku' | 'lainnya';
  timestamp: string;
  updatedAt?: string; // ✅ TAMBAHKAN INI
  statusTimbangan: 'masuk' | 'selesai';
  statusUjiKelembapan?: 'pending' | 'completed';
  hasilUjiKelembapan?: {
    id?: string; // ✅ Tambahkan id
    totalMoisture: number;
    averageMoisture: number;
    claimPercentage: number;
    beratBahan: number;
    netto: number;
    pointsChecked: number;
    moisturePoints: string[];
    tanggalUji: string;
  };
  hasilTara?: HasilTara; // ✅ TAMBAHKAN INI
}

// Interface untuk payload API Backend
interface ApiTimbanganPayload {
  nomor_bon: string;
  jenis_kendaraan: string;
  nomor_kendaraan: string;
  nomor_container?: string;
  type_bahan: string;
  barang: string;
  keterangan_barang?: string;
  customer?: string;
  suplier?: string;
  supir: string;
  berat_bruto: string;
  petugas: string;
}

export interface HasilTara {
  id: string | number;
  timbanganMasukId: string;
  beratBruto: string;
  beratTara: string;
  potonganMoisture: string;
  beratNetto: string;
  timestamp?: string;
  updatedAt?: string;
}

export interface ReportResponse {
  success: boolean;
  message: string;
  statistik: {
    total: number;
    finished: number;
    not_finished: number;
    netto: string;
  };
  data: ApiTimbanganData[];
}

export interface ReportParams {
  periode?: string;
  start_date?: string;
  end_date?: string;
  status?: number;
  type?: string;
}

@Injectable({
  providedIn: 'root',
})
export class TimbanganService {
  private readonly apiService = inject(ApiService);

  // BehaviorSubject untuk list (dari API)
  private timbanganDataSubject = new BehaviorSubject<TimbanganData[]>([]);
  public timbanganData$: Observable<TimbanganData[]> = this.timbanganDataSubject.asObservable();

  // ✅ BehaviorSubject khusus untuk data menunggu tara
  private menungguTaraSubject = new BehaviorSubject<TimbanganData[]>([]);
  public menungguTara$: Observable<TimbanganData[]> = this.menungguTaraSubject.asObservable();

  constructor() {
    // Load initial data dari API
    this.loadDaftarBahanBaku();
    // ✅ Load daftar menunggu tara juga
    this.loadDaftarMenungguTara();
  }

  /**
   * ✅ Load daftar menunggu tara dari endpoint baru
   * Endpoint: GET /daftar-menunggu-tara
   */
  loadDaftarMenungguTara(): Observable<TimbanganData[]> {
    return this.apiService.get<ApiTimbanganData[]>('daftar-menunggu-tara').pipe(
      map((response) => {
        if (response.success && response.data) {
          const convertedData = response.data.map((item) => this.convertFromApiFormat(item));
          this.menungguTaraSubject.next(convertedData);
          console.log('✅ Loaded daftar menunggu tara:', convertedData.length, 'items');
          return convertedData;
        }
        this.menungguTaraSubject.next([]);
        return [];
      }),
      catchError((error) => {
        console.error('❌ Error loading daftar menunggu tara:', error);
        this.menungguTaraSubject.next([]);
        return throwError(() => error);
      }),
    );
  }

  /**
   * Load daftar bahan baku dari API
   * Endpoint: GET /daftar-bahan-baku
   */
  loadDaftarBahanBaku(): Observable<TimbanganData[]> {
    return this.apiService.get<ApiTimbanganData[]>('daftar-bahan-baku').pipe(
      map((response) => {
        if (response.success && response.data) {
          const convertedData = response.data.map((item) => this.convertFromApiFormat(item));
          this.timbanganDataSubject.next(convertedData);
          return convertedData;
        }
        return [];
      }),
      catchError((error) => {
        console.error('❌ Error loading daftar bahan baku:', error);
        this.timbanganDataSubject.next([]);
        return throwError(() => error);
      }),
    );
  }

  /**
   * Konversi data dari API format ke internal format
   */
  private convertFromApiFormat(apiData: any): TimbanganData {
    // Mapping hasilTara jika ada data tara
    let hasilTara: HasilTara | undefined = undefined;
    if (apiData.tara) {
      hasilTara = {
        id: apiData.tara.id,
        timbanganMasukId: apiData.tara.timbangan_masuk_id,
        beratBruto: apiData.tara.berat_bruto,
        beratTara: apiData.tara.berat_tara,
        potonganMoisture: apiData.tara.potongan_moisture,
        beratNetto: apiData.tara.berat_netto,
        timestamp: apiData.tara.created_at,
        updatedAt: apiData.tara.updated_at,
      };
    }

    // Mapping hasilUjiKelembapan jika ada
    let hasilUjiKelembapan: TimbanganData['hasilUjiKelembapan'] = undefined;
    if (apiData.uji_kelembapan) {
      const uji = apiData.uji_kelembapan;
      hasilUjiKelembapan = {
        id: uji.id?.toString(),
        totalMoisture: parseFloat(uji.total_moisture?.replace('%', '') || '0'),
        averageMoisture: parseFloat(uji.avg_moisture?.replace('%', '') || '0'),
        claimPercentage: parseFloat(uji.nilai_claim?.replace('%', '').replace('+', '') || '0'),
        beratBahan: parseFloat(uji.berat_bruto || '0'),
        netto: parseFloat(uji.berat_netto || '0'),
        pointsChecked: parseInt(uji.jumlah_ball || '0'),
        moisturePoints: apiData.titik?.map((t: any) => t.nilai?.toString() || '0') || [],
        tanggalUji: uji.created_at || '',
      };
    }

    return {
      id: apiData.id.toString(),
      noTiket: apiData.nomor_bon,
      noKendaraan: apiData.nomor_kendaraan,
      jenisKendaraan: apiData.jenis_kendaraan.toLowerCase() === 'truck' ? 'truck' : 'container',
      noContainer: apiData.nomor_container || undefined,
      namaBarang: apiData.barang,
      keteranganBarang: apiData.keterangan_barang || undefined,
      namaRelasi: apiData.suplier || apiData.customer || '',
      laporanCustomer: apiData.customer || null,
      laporanSupplier: apiData.suplier || null,
      jenisRelasi: apiData.customer ? 'customer' : 'supplier',
      namaSupir: apiData.supir,
      timbanganPertama: parseFloat(apiData.berat_bruto) || 0,
      timbanganKedua: hasilTara ? parseFloat(hasilTara.beratTara) : null,
      // beratTara2: parseFloat(apiData.berat_bruto) - parseFloat(apiData.berat_netto) || null,
      beratNetto: parseFloat(apiData.berat_netto) || null,
      namaPenimbang: apiData.petugas,
      kelembapan: null,
      tipeBahan: apiData.type_bahan === 'Bahan Baku' ? 'bahan-baku' : 'lainnya',
      timestamp: apiData.created_at,
      updatedAt: apiData.updated_at, // ✅ Mapping updated_at
      statusTimbangan: apiData.is_finished === '1' ? 'selesai' : 'masuk',
      statusUjiKelembapan: apiData.status === 'Belum Diuji' ? 'pending' : 'completed',
      hasilUjiKelembapan: hasilUjiKelembapan, // ✅ Mapping hasil uji kelembapan
      hasilTara: hasilTara, // ✅ Mapping hasil tara
    };
  }

  /**
   * Konversi data internal ke format API Backend
   */
  private convertToApiFormat(data: Partial<TimbanganData>): ApiTimbanganPayload {
    let typeBahan = '';
    if (data.tipeBahan === 'bahan-baku') {
      typeBahan = 'Bahan Baku';
    } else if (data.tipeBahan === 'lainnya') {
      typeBahan = 'Lainnya';
    }

    let jenisKendaraan = '';
    if (data.jenisKendaraan === 'truck') {
      jenisKendaraan = 'Truck';
    } else if (data.jenisKendaraan === 'container') {
      jenisKendaraan = 'Container';
    }

    const payload: ApiTimbanganPayload = {
      nomor_bon: data.noTiket || '',
      jenis_kendaraan: jenisKendaraan,
      nomor_kendaraan: data.noKendaraan || '',
      type_bahan: typeBahan,
      barang: data.namaBarang || '',
      supir: data.namaSupir || '',
      berat_bruto: String(data.timbanganPertama || 0),
      petugas: data.namaPenimbang || '',
    };

    // Tambahkan nomor_container jika ada
    if (data.jenisKendaraan === 'container' && data.noContainer) {
      payload.nomor_container = data.noContainer;
    }

    if (data.keteranganBarang) {
      payload.keterangan_barang = data.keteranganBarang;
    }

    // Tentukan customer atau supplier
    if (data.jenisRelasi === 'customer') {
      payload.customer = data.namaRelasi || '';
    } else if (data.jenisRelasi === 'supplier') {
      payload.suplier = data.namaRelasi || '';
    } else {
      payload.suplier = data.namaRelasi || '';
    }

    return payload;
  }

  /**
   * Tambah data timbangan baru
   * ✅ HANYA simpan jika API sukses
   * ✅ Reload list setelah sukses
   */
  addTimbanganData(
    data: Omit<
      TimbanganData,
      | 'id'
      | 'statusTimbangan'
      | 'statusUjiKelembapan'
      | 'beratNetto'
      | 'timbanganKedua'
      | 'kelembapan'
    >,
  ): Observable<ApiResponse> {
    const payload = this.convertToApiFormat(data);

    return this.apiService.postMultipart('timbangan', payload).pipe(
      tap((response) => {
        if (response.success) {
          console.log('✅ Data berhasil tersimpan di server:', response.message);
          // ✅ Reload list menunggu tara
          this.loadDaftarMenungguTara().subscribe();
        }
      }),
      catchError((error) => {
        console.error('❌ Gagal menyimpan ke server:', error);
        throw error;
      }),
    );
  }

  /**
   * ✅ Insert data Tara (Timbangan Kedua)
   * Endpoint: POST /insert-tara
   * Payload: { timbangan_masuk_id, berat_tara }
   */
  updateTaraData(id: string, timbanganKedua: number): Observable<ApiResponse> {
    const payload = {
      timbangan_masuk_id: id,
      berat_tara: String(timbanganKedua),
    };

    console.log('📤 Sending tara data:', payload);

    return this.apiService.postMultipart('insert-tara', payload).pipe(
      tap((response) => {
        if (response.success) {
          console.log('✅ Tara berhasil diinput:', response.message);
          // ✅ Reload list menunggu tara setelah sukses
          this.loadDaftarMenungguTara().subscribe();
        }
      }),
      catchError((error) => {
        console.error('❌ Gagal input tara:', error);
        throw error;
      }),
    );
  }

  /**
   * Get data by ID (dari current list)
   */
  getTimbanganDataById(id: string): TimbanganData | undefined {
    return this.timbanganDataSubject.value.find((item) => item.id === id);
  }

  /**
   * Get bahan baku yang belum diuji
   */
  getBahanBakuPending(): TimbanganData[] {
    return this.timbanganDataSubject.value.filter(
      (item) => item.tipeBahan === 'bahan-baku' && item.statusUjiKelembapan === 'pending',
    );
  }

  /**
   * Get semua bahan baku
   */
  getAllBahanBaku(): TimbanganData[] {
    return this.timbanganDataSubject.value.filter((item) => item.tipeBahan === 'bahan-baku');
  }

  /**
   * ✅ Get data menunggu tara dari subject
   */
  getMenungguTara(): TimbanganData[] {
    return this.menungguTaraSubject.value;
  }

  /**
   * Get data yang statusnya masih "masuk"
   */
  getTimbanganMasuk(): TimbanganData[] {
    return this.timbanganDataSubject.value.filter((item) => item.statusTimbangan === 'masuk');
  }

  /**
   * Update hasil uji kelembapan
   * TODO: Implementasi sesuai endpoint backend Anda
   */
  updateHasilUjiKelembapan(
    id: string,
    hasilUji: NonNullable<TimbanganData['hasilUjiKelembapan']>,
  ): Observable<ApiResponse> {
    return this.apiService.putMultipart(`timbangan/${id}/kelembapan`, hasilUji).pipe(
      tap((response) => {
        if (response.success) {
          console.log('✅ Hasil uji kelembapan berhasil diupdate');
          this.loadDaftarBahanBaku().subscribe();
        }
      }),
      catchError((error) => {
        console.error('❌ Gagal update kelembapan:', error);
        throw error;
      }),
    );
  }

  /**
   * Delete data timbangan
   * TODO: Implementasi sesuai endpoint backend Anda
   */
  deleteTimbanganData(id: string): Observable<ApiResponse> {
    return this.apiService.delete(`timbangan/${id}`).pipe(
      tap((response) => {
        if (response.success) {
          console.log('✅ Data berhasil dihapus');
          // ✅ Reload list menunggu tara
          this.loadDaftarMenungguTara().subscribe();
        }
      }),
      catchError((error) => {
        console.error('❌ Gagal hapus data:', error);
        throw error;
      }),
    );
  }

  /**
   * ✅ Refresh data menunggu tara dari API
   */
  refreshMenungguTara(): void {
    this.loadDaftarMenungguTara().subscribe();
  }

  /**
   * Refresh data dari API
   */
  refreshData(): void {
    this.loadDaftarBahanBaku().subscribe();
  }

  private taraSelesaiSubject = new BehaviorSubject<TimbanganData[]>([]);
  public taraSelesai$: Observable<TimbanganData[]> = this.taraSelesaiSubject.asObservable();

  /**
   * ✅ Load daftar tara selesai dari endpoint
   * Endpoint: GET /daftar-tara-selesai
   */
  loadDaftarTaraSelesai(): Observable<TimbanganData[]> {
    return this.apiService.get<any>('daftar-tara-selesai').pipe(
      map((response) => {
        if (response.success && response.data) {
          console.log('📥 Raw API Response:', response.data);

          const convertedData = response.data.map((item: any) => {
            const converted = this.convertFromApiFormat(item);
            console.log('🔄 Converted item:', {
              id: converted.id,
              noTiket: converted.noTiket,
              tipeBahan: converted.tipeBahan,
              hasilTara: converted.hasilTara,
              beratNetto: converted.beratNetto,
            });
            return converted;
          });

          this.taraSelesaiSubject.next(convertedData);
          console.log('✅ Loaded daftar tara selesai:', convertedData.length, 'items');
          return convertedData;
        }
        this.taraSelesaiSubject.next([]);
        return [];
      }),
      catchError((error) => {
        console.error('❌ Error loading daftar tara selesai:', error);
        this.taraSelesaiSubject.next([]);
        return throwError(() => error);
      }),
    );
  }

  /**
   * ✅ Get data tara selesai dari subject
   */
  getTaraSelesai(): TimbanganData[] {
    return this.taraSelesaiSubject.value;
  }

  /**
   * ✅ Refresh data tara selesai dari API
   */
  refreshTaraSelesai(): void {
    this.loadDaftarTaraSelesai().subscribe();
  }

  /**
   * ✅ Get report data dengan filter parameters
   * Endpoint: GET /report
   */
  getReportData(params: ReportParams): Observable<ReportResponse> {
    // Build query params
    const queryParams: any = {};

    if (params.periode) {
      queryParams.periode = params.periode;
    }
    if (params.start_date) {
      queryParams.start_date = params.start_date;
    }
    if (params.end_date) {
      queryParams.end_date = params.end_date;
    }
    if (params.status !== undefined && params.status !== null) {
      queryParams.status = params.status;
    }
    if (params.type) {
      queryParams.type = params.type;
    }

    console.log('📤 Fetching report with params:', queryParams);

    return this.apiService.get<ReportResponse>('report', queryParams).pipe(
      map((response: any) => {
        if (response.success && response.data) {
          console.log('✅ Report data received:', {
            total: response.statistik?.total,
            dataLength: response.data?.length,
          });

          return {
            success: response.success,
            message: response.message,
            statistik: response.statistik || {
              total: 0,
              finished: 0,
              not_finished: 0,
              netto: '0',
            },
            data: response.data || [],
          };
        }
        return {
          success: false,
          message: 'No data',
          statistik: {
            total: 0,
            finished: 0,
            not_finished: 0,
            netto: '0',
          },
          data: [],
        };
      }),
      catchError((error) => {
        console.error('❌ Error fetching report data:', error);
        return throwError(() => error);
      }),
    );
  }
}
