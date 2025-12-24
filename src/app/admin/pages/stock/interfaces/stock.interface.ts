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
