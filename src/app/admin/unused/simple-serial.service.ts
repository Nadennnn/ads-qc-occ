// src/app/admin/services/simple-serial.service.ts

import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SimpleSerialService {
  private port: any = null;
  private reader: any = null;
  private keepReading = false;

  // Reactive signals
  currentWeight = signal<number>(0);
  isConnected = signal(false);
  isStable = signal(false);
  rawData = signal<string>('');
  errorMessage = signal<string>('');

  constructor() {
    // Check browser support
    if (!('serial' in navigator)) {
      this.errorMessage.set(
        'Browser tidak support Web Serial API. Gunakan Chrome/Edge versi terbaru.'
      );
    }
  }

  /**
   * Connect dan mulai baca data dari timbangan
   */
  async connect(): Promise<boolean> {
    try {
      // Request user pilih port
      this.port = await (navigator as any).serial.requestPort();

      // Buka port dengan setting Presica PSC-7803
      await this.port.open({
        baudRate: 9600, // ⚠️ Sesuaikan dengan setting timbangan Anda
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',
      });

      this.isConnected.set(true);
      this.errorMessage.set('');
      console.log('✅ Timbangan terhubung!');

      // Mulai baca data
      this.startReading();
      return true;
    } catch (error: any) {
      console.error('❌ Gagal connect:', error);
      this.errorMessage.set(error.message || 'Gagal menghubungkan timbangan');
      this.isConnected.set(false);
      return false;
    }
  }

  /**
   * Disconnect dari timbangan
   */
  async disconnect(): Promise<void> {
    try {
      this.keepReading = false;

      if (this.reader) {
        await this.reader.cancel();
        this.reader.releaseLock();
        this.reader = null;
      }

      if (this.port) {
        await this.port.close();
        this.port = null;
      }

      this.isConnected.set(false);
      this.currentWeight.set(0);
      this.isStable.set(false);
      this.rawData.set('');
      console.log('🔌 Timbangan terputus');
    } catch (error) {
      console.error('Error disconnect:', error);
    }
  }

  /**
   * Baca data dari timbangan secara kontinyu
   */
  private async startReading(): Promise<void> {
    if (!this.port?.readable) {
      console.error('Port tidak bisa dibaca');
      return;
    }

    this.keepReading = true;
    let buffer = '';

    try {
      this.reader = this.port.readable.getReader();

      while (this.keepReading) {
        const { value, done } = await this.reader.read();

        if (done) {
          console.log('Reader selesai');
          break;
        }

        // Convert bytes ke string
        const text = new TextDecoder().decode(value);
        buffer += text;

        // Split by line (biasanya \r\n atau \n)
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        // Process setiap line yang lengkap
        for (const line of lines) {
          if (line.trim()) {
            this.parseData(line.trim());
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('❌ Error reading:', error);
        this.errorMessage.set('Error membaca data: ' + error.message);
      }
    } finally {
      if (this.reader) {
        this.reader.releaseLock();
      }
    }
  }

  /**
   * Parse data dari timbangan
   *
   * CONTOH FORMAT PRESICA PSC-7803:
   * - "ST,GS,+00000.00kg" = Stable, Gross, 0.00 kg
   * - "US,NT,+12345.67kg" = Unstable, Net, 12345.67 kg
   *
   * ⚠️ SESUAIKAN PARSING SESUAI FORMAT ACTUAL TIMBANGAN ANDA!
   */
  private parseData(data: string): void {
    this.rawData.set(data); // Simpan raw data untuk debugging

    try {
      console.log('📊 Raw:', data);

      // Cek stability (ST = stable, US = unstable)
      const isStable = data.startsWith('ST') || data.includes('STABLE');
      this.isStable.set(isStable);

      // Extract angka dengan regex
      // Cari pola: +/- diikuti angka dengan/tanpa desimal
      const weightMatch = data.match(/([+-]?\d+\.?\d*)/);

      if (weightMatch) {
        const weight = parseFloat(weightMatch[1]);
        this.currentWeight.set(weight);

        console.log(`⚖️ ${weight} kg ${isStable ? '✓ Stabil' : '⚠️ Bergerak'}`);
      }

      // ========================================
      // ALTERNATIVE PARSING METHODS (pilih yang sesuai):
      // ========================================

      // Method 1: Split by comma
      // const parts = data.split(',');
      // if (parts.length >= 3) {
      //   const weightStr = parts[2].replace(/[^\d.-]/g, '');
      //   this.currentWeight.set(parseFloat(weightStr));
      // }

      // Method 2: Extract everything between specific characters
      // const match = data.match(/([+-]?\d+\.\d+)kg/i);
      // if (match) {
      //   this.currentWeight.set(parseFloat(match[1]));
      // }

      // Method 3: Fixed position parsing (jika format fixed-width)
      // const weightStr = data.substring(6, 15).trim();
      // this.currentWeight.set(parseFloat(weightStr));
    } catch (error) {
      console.error('❌ Parse error:', error);
      this.errorMessage.set('Error parsing data timbangan');
    }
  }

  /**
   * Get weight saat stabil (untuk auto-capture)
   */
  getStableWeight(): number | null {
    return this.isStable() ? this.currentWeight() : null;
  }

  /**
   * Tunggu sampai berat stabil, lalu return nilainya
   */
  async waitForStableWeight(timeoutMs: number = 10000): Promise<number | null> {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkInterval = setInterval(() => {
        // Cek jika sudah stabil
        if (this.isStable() && this.currentWeight() > 0) {
          clearInterval(checkInterval);
          resolve(this.currentWeight());
        }

        // Timeout
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkInterval);
          resolve(null);
        }
      }, 200); // Check setiap 200ms
    });
  }

  /**
   * Get current weight immediately (tidak perlu tunggu stabil)
   */
  getCurrentWeight(): number {
    return this.currentWeight();
  }
}
