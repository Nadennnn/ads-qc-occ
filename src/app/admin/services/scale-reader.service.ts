// src/app/admin/services/scale-reader.service.ts

import { Injectable, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

interface ScaleReading {
  weight: number;
  stable: boolean;
  unit: string;
  timestamp: Date;
}

interface SerialConfig {
  baudRate: number;
  dataBits: 7 | 8;
  stopBits: 1 | 2;
  parity: 'none' | 'even' | 'odd';
}

@Injectable({
  providedIn: 'root',
})
export class ScaleReaderService {
  private port: any = null;
  private reader: any = null;
  private isReading = false;
  private detectedConfig: SerialConfig | null = null;
  private dataBuffer = '';
  private validReadingsCount = 0;

  // Signals
  currentWeight = signal<number | null>(null);
  isStable = signal<boolean>(false);
  isConnected = signal<boolean>(false);
  connectionError = signal<string | null>(null);

  // Observable
  private weightSubject = new BehaviorSubject<ScaleReading | null>(null);
  weight$ = this.weightSubject.asObservable();

  constructor() {
    if (!('serial' in navigator)) {
      this.connectionError.set('Web Serial API tidak didukung di browser ini');
      console.error('Web Serial API not supported');
    }
  }

  async connect(): Promise<boolean> {
    // Kombinasi pengaturan yang umum untuk timbangan industri
    const configs: SerialConfig[] = [
      // Konfigurasi paling umum dulu
      // { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' },
      // { baudRate: 9600, dataBits: 7, stopBits: 1, parity: 'even' },
      // { baudRate: 9600, dataBits: 7, stopBits: 1, parity: 'odd' },
      // { baudRate: 4800, dataBits: 8, stopBits: 1, parity: 'none' },
      // { baudRate: 4800, dataBits: 7, stopBits: 1, parity: 'even' },
      { baudRate: 2400, dataBits: 8, stopBits: 1, parity: 'none' },
      { baudRate: 2400, dataBits: 7, stopBits: 1, parity: 'even' },
      // { baudRate: 19200, dataBits: 8, stopBits: 1, parity: 'none' },
    ];

    try {
      this.port = await (navigator as any).serial.requestPort();
    } catch (err) {
      this.connectionError.set('Gagal memilih port serial');
      return false;
    }

    this.currentWeight.set(null);
    this.isStable.set(false);

    for (const config of configs) {
      try {
        console.log(
          `🔌 Testing: ${config.baudRate} baud, ${
            config.dataBits
          }${config.parity[0].toUpperCase()}${config.stopBits}`
        );

        // Reset state
        this.dataBuffer = '';
        this.validReadingsCount = 0;
        this.isReading = false;

        // Tutup port jika masih terbuka
        if (this.port.readable) {
          try {
            if (this.reader) {
              await this.reader.cancel().catch(() => {});
              this.reader = null;
            }
            await this.port.close();
            await this.delay(300);
          } catch (e) {
            console.warn('Close error:', e);
          }
        }

        // Buka dengan konfigurasi baru
        await this.port.open({
          baudRate: config.baudRate,
          dataBits: config.dataBits,
          stopBits: config.stopBits,
          parity: config.parity,
          flowControl: 'none',
          bufferSize: 255,
        });

        this.isConnected.set(true);
        this.connectionError.set(null);
        this.detectedConfig = config;

        // Mulai baca
        this.startReading();

        // Tunggu 2.5 detik untuk validasi
        await this.delay(2500);

        // Cek apakah dapat data valid (min 2 pembacaan)
        if (this.validReadingsCount >= 2) {
          console.log(
            `✅ Connected: ${config.baudRate} baud, ${
              config.dataBits
            }${config.parity[0].toUpperCase()}${config.stopBits} (${this.validReadingsCount} valid)`
          );
          return true;
        } else {
          console.warn(`⚠️ Config invalid (${this.validReadingsCount} readings)`);
          this.isReading = false;
        }
      } catch (error: any) {
        console.warn(`⚠️ Config failed:`, error.message);
        this.isReading = false;
      }
    }

    // Cleanup jika semua gagal
    if (this.port?.readable) {
      try {
        if (this.reader) {
          await this.reader.cancel().catch(() => {});
          this.reader = null;
        }
        await this.port.close();
      } catch (e) {}
    }

    this.isConnected.set(false);
    this.connectionError.set(
      'Tidak dapat menemukan konfigurasi yang tepat. Periksa pengaturan timbangan.'
    );
    this.port = null;
    return false;
  }

  async disconnect(): Promise<void> {
    try {
      this.isReading = false;

      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }

      if (this.port) {
        await this.port.close();
        this.port = null;
      }

      this.isConnected.set(false);
      this.currentWeight.set(null);
      this.isStable.set(false);
      this.weightSubject.next(null);
      this.detectedConfig = null;
      this.dataBuffer = '';
      this.validReadingsCount = 0;

      console.log('🔌 Terputus dari timbangan');
    } catch (error) {
      console.error('Error saat disconnect:', error);
    }
  }

  private async startReading(): Promise<void> {
    if (!this.port || this.isReading) return;
    this.isReading = true;

    try {
      while (this.port.readable && this.isReading) {
        this.reader = this.port.readable.getReader();
        try {
          while (this.isReading) {
            const { value, done } = await this.reader.read();
            if (done) break;

            if (value) {
              const text = new TextDecoder('utf-8', { fatal: false }).decode(value);
              this.dataBuffer += text;
              this.processBuffer();
            }
          }
        } catch (error: any) {
          // Abaikan FramingError dan BreakError saat testing
          if (error.name === 'FramingError' || error.name === 'BreakError') {
            console.warn('⚠️ Serial error (config mismatch):', error.name);
            break; // Stop trying this config
          }
          if (this.isReading && error.name !== 'NetworkError') {
            console.error('Error reading:', error);
          }
        } finally {
          this.reader.releaseLock();
        }
      }
    } catch (error) {
      console.error('Error in startReading:', error);
    }
  }

  private processBuffer(): void {
    let newlineIndex = this.dataBuffer.indexOf('\n');

    while (newlineIndex !== -1) {
      const line = this.dataBuffer.substring(0, newlineIndex);
      this.dataBuffer = this.dataBuffer.substring(newlineIndex + 1);

      if (line.length > 0) {
        this.parseWeightData(line);
      }

      newlineIndex = this.dataBuffer.indexOf('\n');
    }

    if (this.dataBuffer.length > 500) {
      this.dataBuffer = '';
    }
  }

  private parseWeightData(line: string): void {
    try {
      const cleaned = line
        .replace(/[\x00-\x1F\x7F-\xFF]/g, '')
        .replace(/[^A-Z0-9+\-.,\s]/gi, '')
        .trim();

      console.log('✨ Cleaned:', JSON.stringify(cleaned));

      if (!cleaned || cleaned.length < 2) return;

      let isStable = false;
      let weight: number | null = null;
      let match;

      // **PATTERN BARU: ST,GS,+0000230kg** (Format timbangan Anda)
      match = cleaned.match(/^(ST|US),(GS|US),([+-]?\d+)kg$/i);
      if (match) {
        isStable = match[1].toUpperCase() === 'ST'; // ST = stable, US = unstable
        weight = parseInt(match[3]); // 0000230 -> 230 kg (langsung, tanpa dibagi)
        console.log(`✅ Pattern: ${match[1]},${match[2]} (${isStable ? 'Stable' : 'Unstable'})`);
      }

      // Pattern 1: USGS+0000090 atau SGS+0000090 (tanpa koma)
      if (!match) {
        match = cleaned.match(/^(US|S)GS([+-]?\d{7})$/i);
        if (match) {
          isStable = match[1].toUpperCase() === 'S';
          weight = parseInt(match[2]) / 10; // Format lama masih dibagi 10
          console.log(`✅ Pattern: ${match[1]}GS (${isStable ? 'Stable' : 'Unstable'})`);
        }
      }

      // Pattern 2: ST+0000070 atau US+0000070 (tanpa koma)
      if (!match) {
        match = cleaned.match(/^(ST|US)([+-]?\d+)$/i);
        if (match) {
          isStable = match[1].toUpperCase() === 'ST';
          weight = parseInt(match[2]) / 10; // Format lama masih dibagi 10
          console.log('✅ Pattern: ST/US');
        }
      }

      // Validasi
      if (weight !== null && !isNaN(weight) && weight >= 0 && weight <= 60000) {
        // const currentWt = this.currentWeight();

        // // Skip jika perubahan terlalu ekstrem (lebih dari 1000kg)
        // if (currentWt !== null && Math.abs(weight - currentWt) > 1000) {
        //   console.warn('⚠️ Extreme change, skip');
        //   return;
        // }

        this.currentWeight.set(weight);
        this.isStable.set(isStable);
        this.validReadingsCount++;

        const reading: ScaleReading = {
          weight,
          stable: isStable,
          unit: 'kg',
          timestamp: new Date(),
        };
        this.weightSubject.next(reading);

        console.log(`✅ ${weight} kg | Stable: ${isStable} | Count: ${this.validReadingsCount}`);
      } else {
        console.warn('⚠️ Invalid:', weight);
      }
    } catch (error) {
      console.error('❌ Parse error:', error);
    }
  }

  getStableWeight(): number | null {
    return this.isStable() && this.currentWeight() !== null ? this.currentWeight() : null;
  }

  async requestWeight(): Promise<void> {
    if (!this.port?.writable) return;
    try {
      const writer = this.port.writable.getWriter();
      await writer.write(new TextEncoder().encode('P\r\n')); // Print command
      writer.releaseLock();
    } catch (error) {
      console.error('Error requesting weight:', error);
    }
  }

  isWebSerialSupported(): boolean {
    return 'serial' in navigator;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
