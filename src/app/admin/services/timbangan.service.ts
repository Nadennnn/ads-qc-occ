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
export interface TimbanganData {
  id: string;
  noTiket: string;
  noKendaraan: string;
  namaBarang: string;
  jenisKendaraan: 'truck' | 'container';
  noContainer?: string;
  keteranganBarang?: string;
  namaRelasi: string;
  jenisRelasi?: 'customer' | 'supplier';
  namaSupir: string;
  timbanganPertama: number;
  timbanganKedua: number | null;
  beratNetto: number | null;
  namaPenimbang: string;
  kelembapan: number | null;
  tipeBahan: 'bahan-baku' | 'lainnya';
  timestamp: string;
  statusTimbangan: 'masuk' | 'selesai';
  statusUjiKelembapan?: 'pending' | 'completed';
  hasilUjiKelembapan?: {
    totalMoisture: number;
    averageMoisture: number;
    claimPercentage: number;
    beratBahan: number;
    netto: number;
    pointsChecked: number;
    moisturePoints: string[];
    tanggalUji: string;
  };
}

// Interface untuk payload API Backend
interface ApiTimbanganPayload {
  nomor_bon: string;
  jenis_kendaraan: string;
  nomor_kendaraan: string;
  nomor_container?: string;
  type_bahan: string;
  barang: string;
  customer?: string;
  suplier?: string;
  supir: string;
  berat_bruto: string;
  petugas: string;
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
  private convertFromApiFormat(apiData: ApiTimbanganData): TimbanganData {
    return {
      id: apiData.id.toString(),
      noTiket: apiData.nomor_bon,
      noKendaraan: apiData.nomor_kendaraan,
      jenisKendaraan: apiData.jenis_kendaraan.toLowerCase() === 'truck' ? 'truck' : 'container',
      noContainer: apiData.nomor_container || undefined,
      namaBarang: apiData.barang,
      namaRelasi: apiData.suplier || apiData.customer || '',
      jenisRelasi: apiData.customer ? 'customer' : 'supplier',
      namaSupir: apiData.supir,
      timbanganPertama: parseFloat(apiData.berat_bruto) || 0,
      timbanganKedua: apiData.berat_netto ? parseFloat(apiData.berat_netto) : null,
      beratNetto: apiData.berat_netto ? parseFloat(apiData.berat_netto) : null,
      namaPenimbang: apiData.petugas,
      kelembapan: null,
      tipeBahan: apiData.type_bahan === 'Bahan Baku' ? 'bahan-baku' : 'lainnya',
      timestamp: apiData.created_at,
      statusTimbangan: apiData.is_finished === '1' ? 'selesai' : 'masuk',
      statusUjiKelembapan: apiData.status === 'Belum Diuji' ? 'pending' : 'completed',
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
    return this.apiService.get<ApiTimbanganData[]>('daftar-tara-selesai').pipe(
      map((response) => {
        if (response.success && response.data) {
          const convertedData = response.data.map((item) => this.convertFromApiFormat(item));
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
}
