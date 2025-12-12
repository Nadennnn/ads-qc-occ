// ===== scale-display.component.ts =====
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ScaleReaderService } from '../../services/scale-reader.service';

@Component({
  selector: 'app-scale-display',
  templateUrl: './scale-display.component.html',
  standalone: false,
})
export class ScaleDisplayComponent implements OnInit, OnDestroy {
  weight: number | null = null;
  stable = false;
  connected = false;
  error: string | null = null;

  // Debug mode
  debugMode = false;
  rawData: string[] = [];
  lastDecimalValue: string = '';
  decimalChanged = false;

  private sub: Subscription | null = null;
  private port: any = null;
  private reader: any = null;
  private isReading = false;
  private refreshInterval: any = null;

  constructor(public scale: ScaleReaderService) {}

  ngOnInit() {
    this.sub = this.scale.weight$.subscribe((val) => {
      if (val) {
        this.weight = val.weight;
        this.stable = val.stable;
      } else {
        this.weight = null;
        this.stable = false;
      }
      this.connected = this.scale.isConnected();
      this.error = this.scale.connectionError();
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    if (this.debugMode) {
      this.disconnectDebug();
    }
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  async connect() {
    if (this.debugMode) {
      await this.connectDebug();
    } else {
      await this.scale.connect();
    }
  }

  async disconnect() {
    if (this.debugMode) {
      await this.disconnectDebug();
    } else {
      await this.scale.disconnect();
    }
  }

  async reqWeight() {
    await this.scale.requestWeight();
  }

  toggleDebugMode() {
    this.debugMode = !this.debugMode;
    if (this.debugMode) {
      this.rawData = ['🔍 Debug mode aktif. Klik Connect untuk mulai.'];
      this.lastDecimalValue = '';
      this.decimalChanged = false;
      // Start watch interval
      this.startWatchInterval();
    } else {
      this.rawData = [];
      this.stopWatchInterval();
    }
  }

  private startWatchInterval() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.refreshInterval = setInterval(() => {
      // Force change detection every 500ms
      this.decimalChanged = false;
    }, 500);
  }

  private stopWatchInterval() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  clearLog() {
    this.rawData = [];
    this.lastDecimalValue = '';
    this.decimalChanged = false;
  }

  copyLog() {
    const text = this.rawData.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      alert('Log copied to clipboard!');
    });
  }

  // ===== DEBUG MODE METHODS =====
  async connectDebug() {
    if (!('serial' in navigator)) {
      this.error = 'Web Serial API tidak didukung di browser ini';
      return;
    }

    try {
      this.port = await (navigator as any).serial.requestPort();

      await this.port.open({
        baudRate: 2400,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none',
      });

      this.connected = true;
      this.error = null;
      this.rawData = ['🔌 Connected! Waiting for data...'];

      this.startReadingDebug();
    } catch (err: any) {
      this.error = 'Error: ' + err.message;
      console.error(err);
    }
  }

  async disconnectDebug() {
    try {
      this.isReading = false;
      this.stopWatchInterval();

      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }

      if (this.port) {
        await this.port.close();
        this.port = null;
      }

      this.connected = false;
      this.lastDecimalValue = '';
      this.decimalChanged = false;
      this.rawData.push('🔌 Disconnected');
    } catch (error: any) {
      this.error = 'Error: ' + error.message;
    }
  }

  private async startReadingDebug() {
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
              const timestamp = new Date().toLocaleTimeString('id-ID', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                fractionalSecondDigits: 3,
              });

              // Cast to Uint8Array
              const bytes = value as Uint8Array;

              // UTF-8
              const textUTF8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);

              // Hexadecimal
              const hex = Array.from(bytes)
                .map((b: number) => b.toString(16).padStart(2, '0').toUpperCase())
                .join(' ');

              // ASCII with control chars
              const ascii = Array.from(bytes)
                .map((b: number) => {
                  if (b === 13) return '\\r';
                  if (b === 10) return '\\n';
                  if (b === 9) return '\\t';
                  if (b < 32 || b > 126) return `[${b}]`;
                  return String.fromCharCode(b);
                })
                .join('');

              // Decimal
              const decimal = Array.from(bytes).join(', ');

              // Check if decimal value changed
              if (this.lastDecimalValue && this.lastDecimalValue !== decimal) {
                this.decimalChanged = true;
                this.rawData.push(`⚡ VALUE CHANGED! ⚡`);
              }
              this.lastDecimalValue = decimal;

              this.rawData.push(`[${timestamp}] UTF-8: "${textUTF8}"`);
              this.rawData.push(`           HEX: ${hex}`);
              this.rawData.push(`           ASCII: ${ascii}`);
              this.rawData.push(`           DEC: ${decimal}${this.decimalChanged ? ' 🔥' : ''}`);
              this.rawData.push(`           ---`);

              if (this.rawData.length > 500) {
                this.rawData = this.rawData.slice(-500);
              }
            }
          }
        } catch (error: any) {
          this.rawData.push(`❌ Read error: ${error.name} - ${error.message}`);
          if (this.isReading) {
            console.error('Error reading:', error);
          }
        } finally {
          this.reader.releaseLock();
        }
      }
    } catch (error: any) {
      this.rawData.push(`❌ Fatal error: ${error.message}`);
    }
  }
}
