// src/app/admin/pages/stock/interfaces/stock.interface.ts

export interface BarangOption {
  value: string;
  label: string;
}

export interface StockItem {
  id: number;
  barang: string;
  stock_awal: number;
  penerimaan: number;
  pemakaian: number;
  stock_akhir: number;
  satuan: string;
  last_updated: string;
  stock_barang: any;
}

export interface TransactionHistory {
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
  keterangan?: string;
}

export interface PenerimaanRequest {
  barang: string;
  jumlah: number;
  nomor_bon: string;
  nomor_kendaraan: string;
  suplier: string;
  supir: string;
  tanggal: string;
  petugas: string;
  keterangan?: string;
}

export interface PemakaianRequest {
  barang: string;
  jumlah: number;
  nomor_bon: string;
  keperluan: string;
  tanggal: string;
  petugas: string;
  keterangan?: string;
}

export interface StockResponse {
  success: boolean;
  message: string;
  data: StockItem[];
}

export interface TransactionResponse {
  success: boolean;
  message: string;
  data: TransactionHistory[];
}

// API response for /api/raw-material-report
export interface RawMaterialReportItem {
  id: number;
  nama: string;
  stok: number;
  used_in_period: number;
  received_in_period: number;
  beginning_ballance: number;
  ending_ballance: number;
}

export interface RawMaterialReportStats {
  total_beginning_ballance: number;
  total_ending_ballance: number;
  total_received_in_period: number;
  total_used_in_period: number;
}

export interface RawMaterialReportResponse {
  success: boolean;
  message: string;
  data: RawMaterialReportItem[];
  statistik: RawMaterialReportStats;
}
